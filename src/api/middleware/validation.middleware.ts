/**
 * Request Validation Middleware
 * Uses Zod for runtime validation of request bodies
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { ValidationError } from './error.middleware';

// ============================================================================
// Auth Schemas
// ============================================================================

export const registerSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
  tier: z.enum(['free', 'pro', 'elite', 'institutional']).optional(),
});

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// ============================================================================
// Validation Middleware Factory
// ============================================================================

/**
 * Creates validation middleware for a Zod schema
 */
export function validate<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Zod v4 uses 'issues' instead of 'errors'
      const issues = result.error.issues || result.error.errors || [];
      const messages = issues.map((e: { message: string }) => e.message).join(', ');
      const validationError = new ValidationError(messages);
      return next(validationError);
    }

    next();
  };
}

// ============================================================================
// Type Exports
// ============================================================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
