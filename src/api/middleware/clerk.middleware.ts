/**
 * Clerk Authentication Middleware
 * Validates JWT tokens from Clerk and syncs users to database
 */

import { Request, Response, NextFunction } from 'express';
import { createClerkClient } from '@clerk/backend';
import { getDatabase, User } from '../../database/NeonDatabase';

// Initialize Clerk client
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        clerkId: string;
        user: User;
        sessionId?: string;
      };
    }
  }
}

/**
 * Middleware to verify Clerk JWT and attach user to request
 * SECURITY: All requests must include valid Authorization header
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verify the token with Clerk
    let clerkUserId: string;
    let sessionId: string | undefined;

    try {
      // Verify the session token
      const verifiedToken = await clerk.verifyToken(token);
      clerkUserId = verifiedToken.sub;
      sessionId = verifiedToken.sid;
    } catch (error) {
      console.error('Token verification failed:', error);
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Get or create user in our database
    const db = getDatabase();
    let user = await db.users.findByClerkId(clerkUserId);

    if (!user) {
      // Fetch user details from Clerk and create in our database
      const clerkUser = await clerk.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;

      if (!email) {
        res.status(400).json({ error: 'User email not found' });
        return;
      }

      user = await db.users.upsertFromClerk({
        id: clerkUserId,
        email,
      });
    }

    if (!user) {
      res.status(500).json({ error: 'Failed to create user' });
      return;
    }

    // Check if user is active
    if (!user.is_active) {
      res.status(403).json({ error: 'Account is deactivated' });
      return;
    }

    // Attach auth info to request
    req.auth = {
      userId: user.id,
      clerkId: clerkUserId,
      user,
      sessionId,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional auth - doesn't fail if no token, but attaches user if present
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  // Try to authenticate, but don't fail if it doesn't work
  try {
    await requireAuth(req, res, () => {});
    if (req.auth) {
      next();
    }
  } catch {
    next();
  }
}

/**
 * Check if user has required tier
 */
export function requireTier(...allowedTiers: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedTiers.includes(req.auth.user.tier)) {
      res.status(403).json({
        error: 'Insufficient tier',
        required: allowedTiers,
        current: req.auth.user.tier,
      });
      return;
    }

    next();
  };
}

/**
 * Tier limits for feature gating
 */
export const TIER_LIMITS = {
  free: {
    strategies: 1,
    aiModels: 2,
    exchanges: 1,
    backtestsPerDay: 5,
    liveTrading: false,
    maxOpenLiveOrders: 0,
    maxDailyLoss: 100,
    maxStrategyNotional: 1000,
  },
  pro: {
    strategies: 5,
    aiModels: Infinity,
    exchanges: 3,
    backtestsPerDay: 50,
    liveTrading: true,
    maxOpenLiveOrders: 10,
    maxDailyLoss: 1000,
    maxStrategyNotional: 50000,
  },
  elite: {
    strategies: 20,
    aiModels: Infinity,
    exchanges: 10,
    backtestsPerDay: Infinity,
    liveTrading: true,
    maxOpenLiveOrders: 50,
    maxDailyLoss: 10000,
    maxStrategyNotional: 500000,
  },
  institutional: {
    strategies: Infinity,
    aiModels: Infinity,
    exchanges: Infinity,
    backtestsPerDay: Infinity,
    liveTrading: true,
    maxOpenLiveOrders: 200,
    maxDailyLoss: -1, // Unlimited
    maxStrategyNotional: Infinity,
  },
};

export function getTierLimits(tier: string) {
  return TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;
}
