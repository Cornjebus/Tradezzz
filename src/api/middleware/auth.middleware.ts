/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user info to request
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService, TokenPayload } from '../../users/AuthService';
import { AuthenticationError } from './error.middleware';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      userId?: string;
    }
  }
}

/**
 * Creates authentication middleware with the provided AuthService
 */
export function createAuthMiddleware(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        throw new AuthenticationError('No authorization header');
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw new AuthenticationError('Invalid authorization format');
      }

      const token = parts[1];
      const payload = await authService.verifyAccessToken(token);

      // Attach user info to request
      req.user = payload;
      req.userId = payload.userId;

      next();
    } catch (error: any) {
      // Transform auth errors to proper format
      const message = error.message || 'Authentication failed';
      next(new AuthenticationError(message));
    }
  };
}

/**
 * Optional authentication - doesn't fail if no token, but attaches user if present
 */
export function createOptionalAuthMiddleware(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return next();
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return next();
      }

      const token = parts[1];
      const payload = await authService.verifyAccessToken(token);

      req.user = payload;
      req.userId = payload.userId;

      next();
    } catch (error) {
      // Silently continue without user
      next();
    }
  };
}
