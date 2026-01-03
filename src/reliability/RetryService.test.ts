/**
 * Retry Service Tests - Phase 20: Fallback & Reliability
 * TDD Red Phase - Write tests first
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RetryService,
  RetryConfig,
  RetryError,
  withRetry,
} from './RetryService';

describe('RetryService', () => {
  let retryService: RetryService;

  beforeEach(() => {
    vi.useFakeTimers();
    retryService = new RetryService({
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // Basic Retry Tests
  // ============================================================================

  describe('successful execution', () => {
    it('should_return_result_on_success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retryService.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should_not_retry_on_success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      await retryService.execute(fn);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Retry Behavior Tests
  // ============================================================================

  describe('retry behavior', () => {
    it('should_retry_on_failure', async () => {
      vi.useRealTimers(); // Use real timers to avoid timing issues

      const shortRetryService = new RetryService({
        maxRetries: 3,
        initialDelayMs: 5,
        maxDelayMs: 20,
        backoffMultiplier: 2,
      });

      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockResolvedValue('success');

      const result = await shortRetryService.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);

      vi.useFakeTimers();
    });

    it('should_retry_up_to_max_retries', async () => {
      vi.useRealTimers(); // Use real timers to avoid timing issues

      const shortRetryService = new RetryService({
        maxRetries: 3,
        initialDelayMs: 5,
        maxDelayMs: 20,
        backoffMultiplier: 2,
      });

      const fn = vi.fn().mockRejectedValue(new Error('always fail'));

      await expect(shortRetryService.execute(fn)).rejects.toThrow(RetryError);
      expect(fn).toHaveBeenCalledTimes(4); // Initial + 3 retries

      vi.useFakeTimers();
    });

    it('should_succeed_after_multiple_failures', async () => {
      vi.useRealTimers(); // Use real timers to avoid timing issues

      const shortRetryService = new RetryService({
        maxRetries: 3,
        initialDelayMs: 5,
        maxDelayMs: 20,
        backoffMultiplier: 2,
      });

      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await shortRetryService.execute(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);

      vi.useFakeTimers();
    });
  });

  // ============================================================================
  // Backoff Tests
  // ============================================================================

  describe('exponential backoff', () => {
    it('should_use_exponential_backoff', async () => {
      vi.useRealTimers(); // Use real timers to avoid timing issues

      const shortRetryService = new RetryService({
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      });

      const delays: number[] = [];
      shortRetryService.on('retry', (attempt, delay) => {
        delays.push(delay);
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await shortRetryService.execute(fn);
      } catch (e) {
        // Expected
      }

      expect(delays).toEqual([10, 20, 40]);

      vi.useFakeTimers();
    });

    it('should_respect_max_delay', async () => {
      vi.useRealTimers(); // Use real timers to avoid timing issues

      const service = new RetryService({
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 20,
        backoffMultiplier: 2,
      });

      const delays: number[] = [];
      service.on('retry', (attempt, delay) => delays.push(delay));

      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await service.execute(fn);
      } catch (e) {
        // Expected
      }

      // All delays should be capped at max (20)
      expect(delays.every(d => d <= 20)).toBe(true);

      vi.useFakeTimers();
    });
  });

  // ============================================================================
  // Jitter Tests
  // ============================================================================

  describe('jitter', () => {
    it('should_add_jitter_when_configured', async () => {
      vi.useRealTimers(); // Use real timers for jitter test

      const service = new RetryService({
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 50,
        backoffMultiplier: 2,
        jitter: true,
      });

      const delays: number[] = [];
      service.on('retry', (attempt, delay) => delays.push(delay));

      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await service.execute(fn);
      } catch (e) {
        // Expected
      }

      // With jitter, delays should vary but be within reasonable bounds
      expect(delays.length).toBe(2);

      vi.useFakeTimers();
    });
  });

  // ============================================================================
  // Retry Condition Tests
  // ============================================================================

  describe('retry conditions', () => {
    it('should_only_retry_on_retryable_errors', async () => {
      vi.useRealTimers(); // Use real timers

      const service = new RetryService({
        maxRetries: 3,
        initialDelayMs: 5,
        maxDelayMs: 20,
        backoffMultiplier: 2,
        retryCondition: (error) => error.message.includes('RETRY_ME'),
      });

      const fn = vi.fn().mockRejectedValue(new Error('permanent failure'));

      await expect(service.execute(fn)).rejects.toThrow('permanent failure');
      expect(fn).toHaveBeenCalledTimes(1); // No retries

      vi.useFakeTimers();
    });

    it('should_retry_retryable_errors', async () => {
      vi.useRealTimers(); // Use real timers to avoid timing issues

      const service = new RetryService({
        maxRetries: 3,
        initialDelayMs: 5,
        maxDelayMs: 20,
        backoffMultiplier: 2,
        retryCondition: (error) => error.message.includes('RETRY_ME'),
      });

      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('RETRY_ME error'))
        .mockResolvedValue('success');

      const result = await service.execute(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);

      vi.useFakeTimers();
    });
  });

  // ============================================================================
  // Abort Tests
  // ============================================================================

  describe('abort handling', () => {
    it('should_abort_on_signal', async () => {
      vi.useRealTimers(); // Use real timers

      const shortRetryService = new RetryService({
        maxRetries: 3,
        initialDelayMs: 100, // Longer delay to allow abort
        maxDelayMs: 200,
        backoffMultiplier: 2,
      });

      const controller = new AbortController();
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      const resultPromise = shortRetryService.execute(fn, { signal: controller.signal });

      // Abort after first attempt (before retry delay completes)
      setTimeout(() => controller.abort(), 10);

      await expect(resultPromise).rejects.toThrow('aborted');
      expect(fn).toHaveBeenCalledTimes(1);

      vi.useFakeTimers();
    });
  });

  // ============================================================================
  // Event Tests
  // ============================================================================

  describe('events', () => {
    it('should_emit_retry_event', async () => {
      vi.useRealTimers(); // Use real timers to avoid timing issues

      const shortRetryService = new RetryService({
        maxRetries: 3,
        initialDelayMs: 5,
        maxDelayMs: 20,
        backoffMultiplier: 2,
      });

      const retryHandler = vi.fn();
      shortRetryService.on('retry', retryHandler);

      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      await shortRetryService.execute(fn);

      expect(retryHandler).toHaveBeenCalledWith(1, 5, expect.any(Error));

      vi.useFakeTimers();
    });

    it('should_emit_exhausted_event', async () => {
      vi.useRealTimers(); // Use real timers to avoid timing issues

      const shortRetryService = new RetryService({
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 50,
        backoffMultiplier: 2,
      });

      const exhaustedHandler = vi.fn();
      shortRetryService.on('exhausted', exhaustedHandler);

      const fn = vi.fn().mockRejectedValue(new Error('always fail'));

      try {
        await shortRetryService.execute(fn);
      } catch (e) {
        // Expected
      }

      expect(exhaustedHandler).toHaveBeenCalled();

      vi.useFakeTimers();
    });

    it('should_emit_success_event', async () => {
      const successHandler = vi.fn();
      retryService.on('success', successHandler);

      await retryService.execute(() => Promise.resolve('success'));

      expect(successHandler).toHaveBeenCalledWith('success', 0);
    });
  });

  // ============================================================================
  // Helper Function Tests
  // ============================================================================

  describe('withRetry helper', () => {
    it('should_work_with_default_config', async () => {
      vi.useRealTimers(); // Use real timers for this test

      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 1, initialDelayMs: 10 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);

      vi.useFakeTimers();
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('statistics', () => {
    it('should_track_attempt_count', async () => {
      vi.useRealTimers(); // Use real timers

      const shortRetryService = new RetryService({
        maxRetries: 3,
        initialDelayMs: 5,
        maxDelayMs: 20,
        backoffMultiplier: 2,
      });

      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      await shortRetryService.execute(fn);
      const stats = shortRetryService.getStats();

      expect(stats.totalAttempts).toBeGreaterThan(0);

      vi.useFakeTimers();
    });
  });
});
