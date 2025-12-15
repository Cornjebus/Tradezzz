/**
 * ErrorHandler - Phase 14: Error Handling & Recovery
 *
 * Comprehensive error handling with:
 * - Custom error classes
 * - Retry mechanisms with exponential backoff
 * - Circuit breaker pattern
 * - Graceful degradation
 */

// ============================================
// CUSTOM ERROR CLASSES
// ============================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string) {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string) {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message, 429);
    this.retryAfter = retryAfter;
  }
}

export class ExchangeError extends AppError {
  public readonly exchange: string;

  constructor(message: string, exchange: string) {
    super(message, 502);
    this.exchange = exchange;
  }
}

// ============================================
// ERROR HANDLER
// ============================================

export interface ErrorResult {
  statusCode: number;
  message: string;
  isOperational: boolean;
  timestamp: Date;
}

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  exponentialBackoff?: boolean;
}

export interface FallbackOptions<T> {
  defaultValue: T;
}

export class ErrorHandler {
  private errorCounts: Map<string, number> = new Map();

  /**
   * Handle an error and return standardized result
   */
  handleError(error: Error): ErrorResult {
    // Log the error
    console.error(`[${new Date().toISOString()}] Error:`, error.message);

    // Track error count
    const errorType = error.name || 'UnknownError';
    this.errorCounts.set(errorType, (this.errorCounts.get(errorType) || 0) + 1);

    // Handle operational errors
    if (error instanceof AppError) {
      return {
        statusCode: error.statusCode,
        message: error.message,
        isOperational: error.isOperational,
        timestamp: new Date()
      };
    }

    // Handle unknown errors
    return {
      statusCode: 500,
      message: 'Internal server error',
      isOperational: false,
      timestamp: new Date()
    };
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [type, count] of this.errorCounts.entries()) {
      stats[type] = count;
    }
    return stats;
  }

  /**
   * Execute operation with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    const { maxRetries, delayMs, exponentialBackoff } = options;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Don't retry validation errors or other non-retryable errors
        if (error instanceof ValidationError ||
            error instanceof AuthenticationError ||
            error instanceof AuthorizationError) {
          throw error;
        }

        // If this was the last attempt, throw
        if (attempt === maxRetries) {
          throw error;
        }

        // Calculate delay with optional exponential backoff
        const delay = exponentialBackoff
          ? delayMs * Math.pow(2, attempt - 1)
          : delayMs;

        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Operation failed');
  }

  /**
   * Execute operation with fallback value on error
   */
  async withFallback<T>(
    operation: () => Promise<T>,
    options: FallbackOptions<T>
  ): Promise<T> {
    try {
      return await operation();
    } catch {
      return options.defaultValue;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset error stats
   */
  resetStats(): void {
    this.errorCounts.clear();
  }
}

// ============================================
// CIRCUIT BREAKER
// ============================================

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
}

export interface CircuitBreakerStats {
  successes: number;
  failures: number;
  state: CircuitState;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(options: CircuitBreakerOptions) {
    this.failureThreshold = options.failureThreshold;
    this.resetTimeoutMs = options.resetTimeoutMs;
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure >= this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
      }
    }
    return this.state;
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === CircuitState.OPEN) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Successful request in half-open state closes the circuit
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failure in half-open state re-opens the circuit
      this.state = CircuitState.OPEN;
    } else if (this.failureCount >= this.failureThreshold) {
      // Threshold reached, open the circuit
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      successes: this.successCount,
      failures: this.failureCount,
      state: this.getState()
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}
