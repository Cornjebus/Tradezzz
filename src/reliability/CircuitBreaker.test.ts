/**
 * Circuit Breaker Tests - Phase 20: Fallback & Reliability
 * TDD Red Phase - Write tests first
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerError,
} from './CircuitBreaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000, // 30 seconds
      resetTimeout: 10000, // 10 seconds for half-open
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // Basic State Tests
  // ============================================================================

  describe('initial state', () => {
    it('should_start_in_closed_state', () => {
      expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should_have_zero_failure_count', () => {
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });

  // ============================================================================
  // Success Handling Tests
  // ============================================================================

  describe('success handling', () => {
    it('should_execute_function_when_closed', async () => {
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });

    it('should_increment_success_count', async () => {
      await breaker.execute(() => Promise.resolve('success'));
      const stats = breaker.getStats();
      expect(stats.successCount).toBe(1);
    });

    it('should_reset_failure_count_on_success', async () => {
      // Simulate some failures first
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch (e) {
          // Expected
        }
      }

      // Success should reset
      await breaker.execute(() => Promise.resolve('success'));
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
    });
  });

  // ============================================================================
  // Failure Handling Tests
  // ============================================================================

  describe('failure handling', () => {
    it('should_increment_failure_count_on_error', async () => {
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch (e) {
        // Expected
      }
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(1);
    });

    it('should_open_circuit_after_threshold_failures', async () => {
      // Trigger threshold failures
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should_throw_CircuitBreakerError_when_open', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch (e) {
          // Expected
        }
      }

      // Now it should throw CircuitBreakerError
      await expect(
        breaker.execute(() => Promise.resolve('success'))
      ).rejects.toThrow(CircuitBreakerError);
    });
  });

  // ============================================================================
  // State Transition Tests
  // ============================================================================

  describe('state transitions', () => {
    it('should_transition_to_half_open_after_timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Fast forward past reset timeout
      vi.advanceTimersByTime(10001);

      expect(breaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should_close_from_half_open_after_success_threshold', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch (e) {
          // Expected
        }
      }

      // Wait for half-open
      vi.advanceTimersByTime(10001);

      // Succeed enough times
      await breaker.execute(() => Promise.resolve('success'));
      await breaker.execute(() => Promise.resolve('success'));

      expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should_reopen_from_half_open_on_failure', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch (e) {
          // Expected
        }
      }

      // Wait for half-open
      vi.advanceTimersByTime(10001);
      expect(breaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);

      // Fail in half-open
      try {
        await breaker.execute(() => Promise.reject(new Error('fail again')));
      } catch (e) {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  // ============================================================================
  // Timeout Tests
  // ============================================================================

  describe('timeout handling', () => {
    it('should_timeout_slow_operations', async () => {
      vi.useRealTimers(); // Use real timers for actual timeout test

      const slowBreaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 50, // 50ms timeout
        resetTimeout: 10000,
      });

      const slowFn = () =>
        new Promise((resolve) => setTimeout(() => resolve('slow'), 200));

      await expect(slowBreaker.execute(slowFn)).rejects.toThrow('timeout');

      vi.useFakeTimers(); // Restore fake timers
    });

    it('should_count_timeout_as_failure', async () => {
      vi.useRealTimers(); // Use real timers for actual timeout test

      const slowBreaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 50, // 50ms timeout
        resetTimeout: 10000,
      });

      const slowFn = () =>
        new Promise((resolve) => setTimeout(() => resolve('slow'), 200));

      try {
        await slowBreaker.execute(slowFn);
      } catch (e) {
        // Expected
      }

      const stats = slowBreaker.getStats();
      expect(stats.failureCount).toBe(1);

      vi.useFakeTimers(); // Restore fake timers
    });
  });

  // ============================================================================
  // Fallback Tests
  // ============================================================================

  describe('fallback handling', () => {
    it('should_execute_fallback_when_circuit_open', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch (e) {
          // Expected
        }
      }

      const result = await breaker.executeWithFallback(
        () => Promise.resolve('primary'),
        () => Promise.resolve('fallback')
      );

      expect(result).toBe('fallback');
    });

    it('should_execute_fallback_on_error', async () => {
      const result = await breaker.executeWithFallback(
        () => Promise.reject(new Error('primary failed')),
        () => Promise.resolve('fallback')
      );

      expect(result).toBe('fallback');
    });

    it('should_not_use_fallback_on_success', async () => {
      const result = await breaker.executeWithFallback(
        () => Promise.resolve('primary'),
        () => Promise.resolve('fallback')
      );

      expect(result).toBe('primary');
    });
  });

  // ============================================================================
  // Event Tests
  // ============================================================================

  describe('events', () => {
    it('should_emit_state_change_event', async () => {
      const stateChanges: CircuitBreakerState[] = [];
      breaker.on('stateChange', (state) => stateChanges.push(state));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch (e) {
          // Expected
        }
      }

      expect(stateChanges).toContain(CircuitBreakerState.OPEN);
    });

    it('should_emit_failure_event', async () => {
      let failureCount = 0;
      breaker.on('failure', () => failureCount++);

      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch (e) {
        // Expected
      }

      expect(failureCount).toBe(1);
    });

    it('should_emit_success_event', async () => {
      let successCount = 0;
      breaker.on('success', () => successCount++);

      await breaker.execute(() => Promise.resolve('success'));

      expect(successCount).toBe(1);
    });
  });

  // ============================================================================
  // Manual Control Tests
  // ============================================================================

  describe('manual control', () => {
    it('should_allow_manual_reset', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);

      breaker.reset();

      expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(breaker.getStats().failureCount).toBe(0);
    });

    it('should_allow_manual_open', () => {
      expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);

      breaker.open();

      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('statistics', () => {
    it('should_track_total_requests', async () => {
      await breaker.execute(() => Promise.resolve('success'));
      await breaker.execute(() => Promise.resolve('success'));
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch (e) {
        // Expected
      }

      const stats = breaker.getStats();
      expect(stats.totalRequests).toBe(3);
    });

    it('should_calculate_failure_rate', async () => {
      await breaker.execute(() => Promise.resolve('success'));
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch (e) {
        // Expected
      }

      const stats = breaker.getStats();
      expect(stats.failureRate).toBeCloseTo(0.5, 2);
    });

    it('should_track_last_failure_time', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch (e) {
        // Expected
      }

      const stats = breaker.getStats();
      expect(stats.lastFailureTime).toBe(now);
    });
  });
});
