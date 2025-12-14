/**
 * Error Handling Middleware
 * Centralized error handling for API routes
 */

import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export class ValidationError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'VALIDATION_ERROR';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthenticationError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
    this.code = 'AUTHENTICATION_ERROR';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class ConflictError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
    this.code = 'CONFLICT_ERROR';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class NotFoundError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Map known error messages to appropriate HTTP status codes
 */
function getStatusCodeFromError(error: Error): number {
  const message = error.message.toLowerCase();

  // 400 Bad Request
  if (
    message.includes('password must be') ||
    message.includes('invalid email') ||
    message.includes('current password is incorrect') ||
    message.includes('new password must be different') ||
    message.includes('invalid verification token') ||
    message.includes('invalid status transition') ||
    message.includes('invalid strategy type') ||
    message.includes('strategy name is required') ||
    message.includes('at least one symbol') ||
    message.includes('invalid symbol format') ||
    message.includes('invalid timeframe') ||
    message.includes('stop loss must be') ||
    message.includes('cannot change strategy type') ||
    message.includes('cannot modify config of active')
  ) {
    return 400;
  }

  // 401 Unauthorized
  if (
    message.includes('invalid credentials') ||
    message.includes('invalid token') ||
    message.includes('token expired') ||
    message.includes('invalid refresh token') ||
    message.includes('account is deactivated') ||
    message.includes('token has been invalidated')
  ) {
    return 401;
  }

  // 404 Not Found
  if (message.includes('not found')) {
    return 404;
  }

  // 409 Conflict
  if (message.includes('already exists') || message.includes('duplicate')) {
    return 409;
  }

  return 500;
}

/**
 * Express error handling middleware
 */
export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If headers already sent, delegate to default error handler
  if (res.headersSent) {
    return next(err);
  }

  // Check for custom error classes by name (prototype chain issue workaround)
  let statusCode = err.statusCode;
  let code = err.code;

  if (!statusCode) {
    if (err.name === 'ValidationError') {
      statusCode = 400;
      code = 'VALIDATION_ERROR';
    } else if (err.name === 'AuthenticationError') {
      statusCode = 401;
      code = 'AUTHENTICATION_ERROR';
    } else if (err.name === 'ConflictError') {
      statusCode = 409;
      code = 'CONFLICT_ERROR';
    } else if (err.name === 'NotFoundError') {
      statusCode = 404;
      code = 'NOT_FOUND';
    } else {
      statusCode = getStatusCodeFromError(err);
    }
  }

  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
    code,
  });
}

/**
 * Async handler wrapper to catch async errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
