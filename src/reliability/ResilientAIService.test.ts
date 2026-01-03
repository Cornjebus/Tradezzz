/**
 * Resilient AI Service Tests - Phase 20: Fallback & Reliability
 * TDD Red Phase - Write tests first
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ResilientAIService,
  ResilientAIConfig,
} from './ResilientAIService';
import { CircuitBreakerState } from './CircuitBreaker';

// Mock AI Provider
const createMockProvider = () => ({
  id: 'provider-1',
  name: 'OpenAI',
  provider: 'openai' as const,
  chat: vi.fn(),
  analyzeSentiment: vi.fn(),
  generateSignal: vi.fn(),
});

describe('ResilientAIService', () => {
  let resilientService: ResilientAIService;
  let mockProvider: ReturnType<typeof createMockProvider>;
  let config: ResilientAIConfig;

  beforeEach(() => {
    mockProvider = createMockProvider();
    config = {
      circuitBreaker: {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 5000,
        resetTimeout: 30000,
      },
      retry: {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
    };

    resilientService = new ResilientAIService(config);
  });

  // ============================================================================
  // Basic Execution Tests
  // ============================================================================

  describe('successful execution', () => {
    it('should_execute_operation_successfully', async () => {
      const result = await resilientService.execute(
        'provider-1',
        () => Promise.resolve({ content: 'success' })
      );

      expect(result).toEqual({ content: 'success' });
    });

    it('should_return_result_without_circuit_breaking_on_success', async () => {
      await resilientService.execute('provider-1', () => Promise.resolve('ok'));

      const status = resilientService.getCircuitStatus('provider-1');
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  // ============================================================================
  // Retry Integration Tests
  // ============================================================================

  describe('retry behavior', () => {
    it('should_retry_on_transient_failure', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('transient error');
        }
        return 'success';
      };

      const result = await resilientService.execute('provider-1', fn);

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should_respect_max_retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('persistent error'));

      await expect(
        resilientService.execute('provider-1', fn)
      ).rejects.toThrow();

      // Initial + 3 retries = 4 attempts
      expect(fn).toHaveBeenCalledTimes(4);
    });
  });

  // ============================================================================
  // Circuit Breaker Integration Tests
  // ============================================================================

  describe('circuit breaker behavior', () => {
    it('should_open_circuit_after_failures', async () => {
      // Cause enough failures to trip circuit
      for (let i = 0; i < 4; i++) {
        try {
          await resilientService.execute(
            'provider-1',
            () => Promise.reject(new Error('fail'))
          );
        } catch (e) {
          // Expected
        }
      }

      const status = resilientService.getCircuitStatus('provider-1');
      expect(status.state).toBe(CircuitBreakerState.OPEN);
    });

    it('should_fail_fast_when_circuit_is_open', async () => {
      // Open the circuit
      resilientService.openCircuit('provider-1');

      await expect(
        resilientService.execute('provider-1', () => Promise.resolve('ok'))
      ).rejects.toThrow('Circuit breaker is open');
    });

    it('should_use_fallback_when_circuit_is_open', async () => {
      resilientService.openCircuit('provider-1');

      const result = await resilientService.executeWithFallback(
        'provider-1',
        () => Promise.resolve('primary'),
        () => Promise.resolve('fallback')
      );

      expect(result).toBe('fallback');
    });
  });

  // ============================================================================
  // Fallback Tests
  // ============================================================================

  describe('fallback behavior', () => {
    it('should_use_fallback_on_failure', async () => {
      const result = await resilientService.executeWithFallback(
        'provider-1',
        () => Promise.reject(new Error('primary failed')),
        () => Promise.resolve('fallback result')
      );

      expect(result).toBe('fallback result');
    });

    it('should_not_use_fallback_on_success', async () => {
      const fallback = vi.fn().mockResolvedValue('fallback');

      const result = await resilientService.executeWithFallback(
        'provider-1',
        () => Promise.resolve('primary'),
        fallback
      );

      expect(result).toBe('primary');
      expect(fallback).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Provider Failover Tests
  // ============================================================================

  describe('provider failover', () => {
    it('should_failover_to_backup_provider', async () => {
      // Open primary circuit
      resilientService.openCircuit('provider-1');

      const providers = ['provider-1', 'provider-2'];
      const operations = {
        'provider-1': () => Promise.resolve('primary'),
        'provider-2': () => Promise.resolve('backup'),
      };

      const result = await resilientService.executeWithFailover(
        providers,
        (providerId) => operations[providerId as keyof typeof operations]()
      );

      expect(result).toBe('backup');
    });

    it('should_try_all_providers_in_order', async () => {
      const uniqueProviders: string[] = [];

      const result = await resilientService.executeWithFailover(
        ['provider-1', 'provider-2', 'provider-3'],
        (providerId) => {
          if (!uniqueProviders.includes(providerId)) {
            uniqueProviders.push(providerId);
          }
          if (providerId !== 'provider-3') {
            throw new Error('fail');
          }
          return Promise.resolve('success');
        }
      );

      expect(result).toBe('success');
      // Verify all providers were tried in order (with retries for each)
      expect(uniqueProviders).toEqual(['provider-1', 'provider-2', 'provider-3']);
    });

    it('should_throw_when_all_providers_fail', async () => {
      await expect(
        resilientService.executeWithFailover(
          ['provider-1', 'provider-2'],
          () => Promise.reject(new Error('all fail'))
        )
      ).rejects.toThrow('All providers failed');
    });
  });

  // ============================================================================
  // Status and Statistics Tests
  // ============================================================================

  describe('status and statistics', () => {
    it('should_track_circuit_status_per_provider', async () => {
      // Success on provider-1
      await resilientService.execute('provider-1', () => Promise.resolve('ok'));

      // Failure on provider-2
      try {
        await resilientService.execute('provider-2', () => Promise.reject(new Error('fail')));
      } catch (e) {
        // Expected
      }

      const status1 = resilientService.getCircuitStatus('provider-1');
      const status2 = resilientService.getCircuitStatus('provider-2');

      expect(status1.state).toBe(CircuitBreakerState.CLOSED);
      expect(status2.failureCount).toBeGreaterThan(0);
    });

    it('should_return_all_circuit_statuses', async () => {
      await resilientService.execute('provider-1', () => Promise.resolve('ok'));
      await resilientService.execute('provider-2', () => Promise.resolve('ok'));

      const allStatuses = resilientService.getAllCircuitStatuses();

      expect(Object.keys(allStatuses)).toContain('provider-1');
      expect(Object.keys(allStatuses)).toContain('provider-2');
    });

    it('should_get_health_summary', async () => {
      await resilientService.execute('provider-1', () => Promise.resolve('ok'));

      const health = resilientService.getHealthSummary();

      expect(health.totalProviders).toBeGreaterThan(0);
      expect(health.healthyProviders).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Manual Control Tests
  // ============================================================================

  describe('manual control', () => {
    it('should_manually_open_circuit', () => {
      resilientService.openCircuit('provider-1');

      const status = resilientService.getCircuitStatus('provider-1');
      expect(status.state).toBe(CircuitBreakerState.OPEN);
    });

    it('should_manually_reset_circuit', async () => {
      // Open the circuit
      resilientService.openCircuit('provider-1');

      // Reset it
      resilientService.resetCircuit('provider-1');

      const status = resilientService.getCircuitStatus('provider-1');
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should_reset_all_circuits', async () => {
      resilientService.openCircuit('provider-1');
      resilientService.openCircuit('provider-2');

      resilientService.resetAllCircuits();

      const status1 = resilientService.getCircuitStatus('provider-1');
      const status2 = resilientService.getCircuitStatus('provider-2');

      expect(status1.state).toBe(CircuitBreakerState.CLOSED);
      expect(status2.state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  // ============================================================================
  // Event Tests
  // ============================================================================

  describe('events', () => {
    it('should_emit_circuit_open_event', async () => {
      const handler = vi.fn();
      resilientService.on('circuitOpen', handler);

      // Cause enough failures
      for (let i = 0; i < 4; i++) {
        try {
          await resilientService.execute('provider-1', () => Promise.reject(new Error('fail')));
        } catch (e) {
          // Expected
        }
      }

      expect(handler).toHaveBeenCalled();
    });

    it('should_emit_fallback_used_event', async () => {
      const handler = vi.fn();
      resilientService.on('fallbackUsed', handler);

      await resilientService.executeWithFallback(
        'provider-1',
        () => Promise.reject(new Error('fail')),
        () => Promise.resolve('fallback')
      );

      expect(handler).toHaveBeenCalled();
    });

    it('should_emit_retry_event', async () => {
      const handler = vi.fn();
      resilientService.on('retry', handler);

      let attempts = 0;
      await resilientService.execute('provider-1', async () => {
        attempts++;
        if (attempts < 2) throw new Error('retry');
        return 'ok';
      });

      expect(handler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Timeout Tests
  // ============================================================================

  describe('timeout handling', () => {
    it('should_timeout_slow_operations', async () => {
      const slowFn = () => new Promise((resolve) => setTimeout(resolve, 10000));

      await expect(
        resilientService.execute('provider-1', slowFn)
      ).rejects.toThrow(/timeout/i);
    });
  });
});
