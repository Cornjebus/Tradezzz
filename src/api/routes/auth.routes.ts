/**
 * Auth Routes - Authentication API Endpoints
 * Handles registration, login, logout, token refresh, and password management
 */

import { Router, Request, Response } from 'express';
import { AuthService } from '../../users/AuthService';
import { createAuthMiddleware } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import {
  validate,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  verifyEmailSchema,
} from '../middleware/validation.middleware';

/**
 * Creates the auth router with all authentication endpoints
 */
export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // ============================================================================
  // POST /register - Create new user account
  // ============================================================================

  router.post(
    '/register',
    validate(registerSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password, tier } = req.body;

      const result = await authService.register({
        email,
        password,
        tier,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    })
  );

  // ============================================================================
  // POST /login - Authenticate user
  // ============================================================================

  router.post(
    '/login',
    validate(loginSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password } = req.body;

      // Extract IP address from request
      const ipAddress = req.ip ||
        req.headers['x-forwarded-for']?.toString().split(',')[0] ||
        req.socket.remoteAddress;

      const userAgent = req.headers['user-agent'];

      const result = await authService.login({
        email,
        password,
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        data: result,
      });
    })
  );

  // ============================================================================
  // POST /refresh - Refresh access token
  // ============================================================================

  router.post(
    '/refresh',
    validate(refreshTokenSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { refreshToken } = req.body;

      const result = await authService.refreshTokens(refreshToken);

      res.json({
        success: true,
        data: result,
      });
    })
  );

  // ============================================================================
  // POST /logout - End user session
  // ============================================================================

  router.post(
    '/logout',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { refreshToken } = req.body;
      const userId = req.userId!;

      await authService.logout(userId, refreshToken);

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    })
  );

  // ============================================================================
  // GET /me - Get current user profile
  // ============================================================================

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;

      const profile = await authService.getUserProfile(userId);

      res.json({
        success: true,
        data: profile,
      });
    })
  );

  // ============================================================================
  // POST /change-password - Change user password
  // ============================================================================

  router.post(
    '/change-password',
    requireAuth,
    validate(changePasswordSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { currentPassword, newPassword } = req.body;
      const userId = req.userId!;

      await authService.changePassword({
        userId,
        currentPassword,
        newPassword,
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    })
  );

  // ============================================================================
  // POST /verify-email - Verify email with token
  // ============================================================================

  router.post(
    '/verify-email',
    validate(verifyEmailSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { token } = req.body;

      await authService.verifyEmail(token);

      res.json({
        success: true,
        message: 'Email verified successfully',
      });
    })
  );

  // ============================================================================
  // POST /request-verification - Request new verification email
  // ============================================================================

  router.post(
    '/request-verification',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;

      const token = await authService.generateEmailVerificationToken(userId);

      // In production, this would send an email instead of returning the token
      res.json({
        success: true,
        data: { token },
        message: 'Verification email sent',
      });
    })
  );

  return router;
}
