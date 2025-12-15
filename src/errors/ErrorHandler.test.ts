import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ErrorHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExchangeError,
  CircuitBreaker,
  CircuitState
} from './ErrorHandler';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler();
  });

  describe('Custom Error Classes', () => {
    it('should_create_validation_error', () => {
      const error = new ValidationError('Invalid email format');

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid email format');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    it('should_create_authentication_error', () => {
      const error = new AuthenticationError('Invalid token');

      expect(error.name).toBe('AuthenticationError');
      expect(error.statusCode).toBe(401);
    });

    it('should_create_authorization_error', () => {
      const error = new AuthorizationError('Insufficient permissions');

      expect(error.name).toBe('AuthorizationError');
      expect(error.statusCode).toBe(403);
    });

    it('should_create_not_found_error', () => {
      const error = new NotFoundError('User not found');

      expect(error.name).toBe('NotFoundError');
      expect(error.statusCode).toBe(404);
    });

    it('should_create_rate_limit_error', () => {
      const error = new RateLimitError('Too many requests', 30);

      expect(error.name).toBe('RateLimitError');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(30);
    });

    it('should_create_exchange_error', () => {
      const error = new ExchangeError('Binance API timeout', 'binance');

      expect(error.name).toBe('ExchangeError');
      expect(error.statusCode).toBe(502);
      expect(error.exchange).toBe('binance');
    });
  });

  describe('Error Handling', () => {
    it('should_handle_operational_errors', () => {
      const error = new ValidationError('Invalid input');
      const result = handler.handleError(error);

      expect(result.statusCode).toBe(400);
      expect(result.message).toBe('Invalid input');
      expect(result.isOperational).toBe(true);
    });

    it('should_handle_unknown_errors', () => {
      const error = new Error('Something went wrong');
      const result = handler.handleError(error);

      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('Internal server error');
      expect(result.isOperational).toBe(false);
    });

    it('should_log_errors', () => {
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new ValidationError('Test error');

      handler.handleError(error);

      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should_track_error_counts', () => {
      handler.handleError(new ValidationError('Error 1'));
      handler.handleError(new ValidationError('Error 2'));
      handler.handleError(new AuthenticationError('Error 3'));

      const stats = handler.getErrorStats();

      expect(stats.ValidationError).toBe(2);
      expect(stats.AuthenticationError).toBe(1);
    });
  });

  describe('Error Recovery', () => {
    it('should_retry_failed_operations', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await handler.withRetry(operation, { maxRetries: 3, delayMs: 10 });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should_fail_after_max_retries', async () => {
      const operation = async () => {
        throw new Error('Persistent failure');
      };

      await expect(
        handler.withRetry(operation, { maxRetries: 2, delayMs: 10 })
      ).rejects.toThrow('Persistent failure');
    });

    it('should_not_retry_non_retryable_errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new ValidationError('Invalid input');
      };

      await expect(
        handler.withRetry(operation, { maxRetries: 3, delayMs: 10 })
      ).rejects.toThrow('Invalid input');

      expect(attempts).toBe(1); // No retries for validation errors
    });

    it('should_use_exponential_backoff', async () => {
      const delays: number[] = [];
      let attempts = 0;
      let lastTime = Date.now();

      const operation = async () => {
        const now = Date.now();
        if (attempts > 0) {
          delays.push(now - lastTime);
        }
        lastTime = now;
        attempts++;
        if (attempts < 4) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      await handler.withRetry(operation, {
        maxRetries: 4,
        delayMs: 10,
        exponentialBackoff: true
      });

      // Delays should increase: ~10ms, ~20ms, ~40ms
      expect(delays[1]).toBeGreaterThan(delays[0]);
      expect(delays[2]).toBeGreaterThan(delays[1]);
    });
  });

  describe('Graceful Degradation', () => {
    it('should_return_fallback_on_error', async () => {
      const operation = async () => {
        throw new Error('Service unavailable');
      };

      const result = await handler.withFallback(
        operation,
        { defaultValue: 'cached_result' }
      );

      expect(result).toBe('cached_result');
    });

    it('should_return_operation_result_on_success', async () => {
      const operation = async () => 'live_result';

      const result = await handler.withFallback(
        operation,
        { defaultValue: 'cached_result' }
      );

      expect(result).toBe('live_result');
    });
  });
});

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 100
    });
  });

  it('should_start_in_closed_state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should_allow_requests_when_closed', async () => {
    const result = await breaker.execute(async () => 'success');
    expect(result).toBe('success');
  });

  it('should_open_after_failure_threshold', async () => {
    const failingOp = async () => {
      throw new Error('Failure');
    };

    // Fail 3 times
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingOp);
      } catch {
        // Expected
      }
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('should_reject_requests_when_open', async () => {
    // Force open state
    const failingOp = async () => { throw new Error('Failure'); };
    for (let i = 0; i < 3; i++) {
      try { await breaker.execute(failingOp); } catch {}
    }

    await expect(
      breaker.execute(async () => 'should not run')
    ).rejects.toThrow('Circuit breaker is open');
  });

  it('should_transition_to_half_open_after_timeout', async () => {
    // Force open state
    const failingOp = async () => { throw new Error('Failure'); };
    for (let i = 0; i < 3; i++) {
      try { await breaker.execute(failingOp); } catch {}
    }

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 150));

    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
  });

  it('should_close_on_success_in_half_open', async () => {
    // Force open state
    const failingOp = async () => { throw new Error('Failure'); };
    for (let i = 0; i < 3; i++) {
      try { await breaker.execute(failingOp); } catch {}
    }

    // Wait for half-open
    await new Promise(r => setTimeout(r, 150));

    // Successful request should close circuit
    await breaker.execute(async () => 'success');

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should_reopen_on_failure_in_half_open', async () => {
    // Force open state
    const failingOp = async () => { throw new Error('Failure'); };
    for (let i = 0; i < 3; i++) {
      try { await breaker.execute(failingOp); } catch {}
    }

    // Wait for half-open
    await new Promise(r => setTimeout(r, 150));

    // Another failure should re-open
    try {
      await breaker.execute(failingOp);
    } catch {}

    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('should_track_success_and_failure_counts', async () => {
    await breaker.execute(async () => 'success');
    await breaker.execute(async () => 'success');

    try {
      await breaker.execute(async () => { throw new Error('Failure'); });
    } catch {}

    const stats = breaker.getStats();
    expect(stats.successes).toBe(2);
    expect(stats.failures).toBe(1);
  });
});
