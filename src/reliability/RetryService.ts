/**
 * Retry Service - Phase 20: Fallback & Reliability
 *
 * Implements retry logic with exponential backoff:
 * - Configurable max retries
 * - Exponential backoff with optional jitter
 * - Retry conditions for selective retry
 * - Abort signal support
 * - Event emission for monitoring
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay between retries in ms */
  initialDelayMs: number;
  /** Maximum delay between retries in ms */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Add random jitter to delays */
  jitter?: boolean;
  /** Custom condition to determine if error is retryable */
  retryCondition?: (error: Error) => boolean;
}

export interface RetryOptions {
  /** AbortSignal to cancel retries */
  signal?: AbortSignal;
}

export interface RetryStats {
  totalAttempts: number;
  totalSuccesses: number;
  totalFailures: number;
  totalRetries: number;
}

export class RetryError extends Error {
  public readonly attempts: number;
  public readonly lastError: Error;

  constructor(message: string, attempts: number, lastError: Error) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

// ============================================================================
// Retry Service Implementation
// ============================================================================

export class RetryService extends EventEmitter {
  private readonly config: RetryConfig;
  private stats: RetryStats = {
    totalAttempts: 0,
    totalSuccesses: 0,
    totalFailures: 0,
    totalRetries: 0,
  };

  constructor(config: RetryConfig) {
    super();
    this.config = {
      ...config,
      retryCondition: config.retryCondition || (() => true),
    };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const { signal } = options;
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      // Check for abort
      if (signal?.aborted) {
        throw new RetryError('Retry aborted', attempt, lastError || new Error('Aborted'));
      }

      try {
        this.stats.totalAttempts++;
        const result = await fn();
        this.stats.totalSuccesses++;
        this.emit('success', result, attempt);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.stats.totalFailures++;

        // Check if we should retry
        if (!this.config.retryCondition!(lastError)) {
          throw lastError;
        }

        // Check if we've exhausted retries
        if (attempt >= this.config.maxRetries) {
          this.emit('exhausted', lastError, attempt + 1);
          throw new RetryError(
            `Retry exhausted after ${attempt + 1} attempts: ${lastError.message}`,
            attempt + 1,
            lastError
          );
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);
        this.stats.totalRetries++;
        this.emit('retry', attempt + 1, delay, lastError);

        // Wait before retry
        await this.delay(delay, signal);
        attempt++;
      }
    }

    // Should never reach here, but TypeScript needs this
    throw new RetryError(
      `Retry exhausted after ${attempt + 1} attempts`,
      attempt + 1,
      lastError || new Error('Unknown error')
    );
  }

  /**
   * Get retry statistics
   */
  getStats(): RetryStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalRetries: 0,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private calculateDelay(attempt: number): number {
    // Calculate base delay with exponential backoff
    let delay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt);

    // Apply max delay cap
    delay = Math.min(delay, this.config.maxDelayMs);

    // Apply jitter if configured
    if (this.config.jitter) {
      // Add random jitter: 0.5x to 1.5x the calculated delay
      const jitterMultiplier = 0.5 + Math.random();
      delay = Math.floor(delay * jitterMultiplier);
    }

    return delay;
  }

  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(resolve, ms);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new RetryError('Retry aborted', 0, new Error('Aborted')));
        });
      }
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute a function with retry logic using default configuration
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const service = new RetryService({
    maxRetries: config.maxRetries ?? 3,
    initialDelayMs: config.initialDelayMs ?? 100,
    maxDelayMs: config.maxDelayMs ?? 10000,
    backoffMultiplier: config.backoffMultiplier ?? 2,
    jitter: config.jitter ?? false,
    retryCondition: config.retryCondition,
  });

  return service.execute(fn);
}

/**
 * Create a retry-wrapped version of a function
 */
export function createRetryWrapper<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: Partial<RetryConfig> = {}
): T {
  const service = new RetryService({
    maxRetries: config.maxRetries ?? 3,
    initialDelayMs: config.initialDelayMs ?? 100,
    maxDelayMs: config.maxDelayMs ?? 10000,
    backoffMultiplier: config.backoffMultiplier ?? 2,
    jitter: config.jitter ?? false,
    retryCondition: config.retryCondition,
  });

  return ((...args: Parameters<T>) => service.execute(() => fn(...args))) as T;
}

// ============================================================================
// Common Retry Conditions
// ============================================================================

export const RetryConditions = {
  /** Retry on network errors */
  networkErrors: (error: Error): boolean => {
    const networkErrorCodes = ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
    return networkErrorCodes.some(code => error.message.includes(code));
  },

  /** Retry on HTTP 5xx errors */
  serverErrors: (error: Error): boolean => {
    const statusMatch = error.message.match(/status[:\s]*(\d{3})/i);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      return status >= 500 && status < 600;
    }
    return false;
  },

  /** Retry on rate limit errors (429) */
  rateLimitErrors: (error: Error): boolean => {
    return error.message.includes('429') || error.message.toLowerCase().includes('rate limit');
  },

  /** Retry on any error */
  always: (): boolean => true,

  /** Never retry */
  never: (): boolean => false,

  /** Combine multiple conditions with OR logic */
  any: (...conditions: ((error: Error) => boolean)[]): ((error: Error) => boolean) => {
    return (error: Error) => conditions.some(cond => cond(error));
  },

  /** Combine multiple conditions with AND logic */
  all: (...conditions: ((error: Error) => boolean)[]): ((error: Error) => boolean) => {
    return (error: Error) => conditions.every(cond => cond(error));
  },
};
