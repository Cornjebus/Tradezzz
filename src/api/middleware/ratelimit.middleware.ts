/**
 * Rate Limiting Middleware - Phase 12
 *
 * Express middleware for rate limiting API requests:
 * - Per-user limits based on tier
 * - Adds rate limit headers to responses
 * - Protects exchange APIs from overuse
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiter, UserTier } from '../../ratelimit/RateLimiter';

// Global rate limiter instance
const rateLimiter = new RateLimiter();

// Export for use in other modules
export { rateLimiter };

/**
 * Get tier limits for API requests
 */
function getApiLimitForTier(tier: UserTier): number {
  const limits = rateLimiter.getLimitsForTier(tier);
  return limits.apiRequestsPerMinute;
}

/**
 * Rate limit middleware factory
 */
export function rateLimit(options?: {
  category?: string;
  tierBased?: boolean;
}) {
  const category = options?.category || 'api';
  const tierBased = options?.tierBased ?? true;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get user ID (from auth middleware)
      const userId = req.user?.id || req.ip || 'anonymous';
      const tier = (req.user?.tier as UserTier) || 'free';

      // Set user tier in rate limiter
      rateLimiter.setUserTier(userId, tier);

      // Get limit based on tier
      const limit = tierBased ? getApiLimitForTier(tier) : 60;
      const windowSeconds = 60;

      // Check rate limit
      const result = await rateLimiter.checkLimit(userId, category, limit, windowSeconds);

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.reset);

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter || result.reset);

        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          limit: result.limit,
          remaining: 0
        });
      }

      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      next(); // Allow request on error (fail open)
    }
  };
}

/**
 * Stricter rate limit for sensitive operations
 */
export function strictRateLimit(limit: number, windowSeconds: number = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || req.ip || 'anonymous';

      const result = await rateLimiter.checkLimit(
        userId,
        'strict',
        limit,
        windowSeconds
      );

      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.reset);

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter || result.reset);

        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded for this operation',
          retryAfter: result.retryAfter
        });
      }

      next();
    } catch (error) {
      console.error('Strict rate limit error:', error);
      next();
    }
  };
}

/**
 * Order rate limit - stricter limits for trading
 */
export function orderRateLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const tier = (req.user?.tier as UserTier) || 'free';
      const limits = rateLimiter.getLimitsForTier(tier);

      const result = await rateLimiter.checkLimit(
        userId,
        'orders',
        limits.ordersPerMinute,
        60
      );

      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.reset);

      if (!result.allowed) {
        return res.status(429).json({
          success: false,
          error: 'Order rate limit exceeded',
          retryAfter: result.retryAfter,
          message: 'Upgrade your plan for higher order limits'
        });
      }

      // Track usage
      rateLimiter.trackUsage(userId, 'order');

      next();
    } catch (error) {
      console.error('Order rate limit error:', error);
      next();
    }
  };
}

/**
 * Backtest rate limit - daily limits
 */
export function backtestRateLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const canPerform = rateLimiter.canPerformAction(userId, 'backtest');

      if (!canPerform.allowed) {
        return res.status(429).json({
          success: false,
          error: canPerform.reason,
          message: 'Upgrade your plan for more backtests'
        });
      }

      // Track usage
      rateLimiter.trackUsage(userId, 'backtest');

      next();
    } catch (error) {
      console.error('Backtest rate limit error:', error);
      next();
    }
  };
}

/**
 * Exchange rate limit protection
 */
export function exchangeRateLimit(exchange: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const canCall = await rateLimiter.canMakeExchangeCall(userId, exchange);

      if (!canCall.allowed) {
        return res.status(429).json({
          success: false,
          error: canCall.reason,
          exchange
        });
      }

      // Track the call
      await rateLimiter.trackExchangeCall(userId, exchange);

      // Add exchange status to response headers
      const status = rateLimiter.getExchangeStatus(userId, exchange);
      res.setHeader('X-Exchange-RateLimit-Warning', status.warning);
      res.setHeader('X-Exchange-RateLimit-Remaining', status.remaining);

      next();
    } catch (error) {
      console.error('Exchange rate limit error:', error);
      next();
    }
  };
}

/**
 * Get rate limit status endpoint handler
 */
export async function getRateLimitStatus(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tier = (req.user?.tier as UserTier) || 'free';
    const tierLimits = rateLimiter.getLimitsForTier(tier);
    const currentStatus = rateLimiter.getStatus(userId);
    const dailyUsage = rateLimiter.getDailyUsage(userId);

    res.json({
      success: true,
      data: {
        tier,
        limits: tierLimits,
        current: currentStatus,
        dailyUsage,
        exchanges: {} // Could add exchange status here
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
