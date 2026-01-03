/**
 * Resilient AI Service - Phase 20: Fallback & Reliability
 *
 * Combines Circuit Breaker and Retry patterns for resilient AI provider calls:
 * - Per-provider circuit breakers
 * - Configurable retry with exponential backoff
 * - Provider failover support
 * - Fallback handlers
 * - Health monitoring
 * - Event emission for observability
 */

import { EventEmitter } from 'events';
import {
  CircuitBreaker,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerStats,
  CircuitBreakerError,
} from './CircuitBreaker';
import {
  RetryService,
  RetryConfig,
  RetryError,
} from './RetryService';

// ============================================================================
// Types
// ============================================================================

export interface ResilientAIConfig {
  circuitBreaker: Omit<CircuitBreakerConfig, 'name'>;
  retry: RetryConfig;
}

export interface HealthSummary {
  totalProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  unhealthyProviders: number;
  providerStates: Record<string, CircuitBreakerState>;
}

export interface ExecutionResult<T> {
  result: T;
  providerId: string;
  retries: number;
  duration: number;
}

// ============================================================================
// Resilient AI Service Implementation
// ============================================================================

export class ResilientAIService extends EventEmitter {
  private readonly config: ResilientAIConfig;
  private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private readonly retryServices: Map<string, RetryService> = new Map();

  constructor(config: ResilientAIConfig) {
    super();
    this.config = config;
  }

  // ============================================================================
  // Circuit Breaker Management
  // ============================================================================

  private getOrCreateCircuitBreaker(providerId: string): CircuitBreaker {
    let breaker = this.circuitBreakers.get(providerId);

    if (!breaker) {
      breaker = new CircuitBreaker({
        ...this.config.circuitBreaker,
        name: providerId,
      });

      // Forward circuit breaker events
      breaker.on('stateChange', (newState, oldState) => {
        if (newState === CircuitBreakerState.OPEN) {
          this.emit('circuitOpen', providerId, oldState);
        } else if (newState === CircuitBreakerState.CLOSED && oldState === CircuitBreakerState.HALF_OPEN) {
          this.emit('circuitRecovered', providerId);
        }
      });

      this.circuitBreakers.set(providerId, breaker);
    }

    return breaker;
  }

  private getOrCreateRetryService(providerId: string): RetryService {
    let retrier = this.retryServices.get(providerId);

    if (!retrier) {
      retrier = new RetryService(this.config.retry);

      // Forward retry events
      retrier.on('retry', (attempt, delay, error) => {
        this.emit('retry', providerId, attempt, delay, error);
      });

      retrier.on('exhausted', (error, attempts) => {
        this.emit('retryExhausted', providerId, error, attempts);
      });

      this.retryServices.set(providerId, retrier);
    }

    return retrier;
  }

  // ============================================================================
  // Execution Methods
  // ============================================================================

  /**
   * Execute an operation with circuit breaker and retry protection
   */
  async execute<T>(
    providerId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const circuitBreaker = this.getOrCreateCircuitBreaker(providerId);
    const retryService = this.getOrCreateRetryService(providerId);

    // Wrap the operation with retry, then protect with circuit breaker
    const retryWrappedFn = async () => {
      return retryService.execute(fn);
    };

    return circuitBreaker.execute(retryWrappedFn);
  }

  /**
   * Execute an operation with a fallback if it fails or circuit is open
   */
  async executeWithFallback<T>(
    providerId: string,
    fn: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    const circuitBreaker = this.getOrCreateCircuitBreaker(providerId);
    const retryService = this.getOrCreateRetryService(providerId);

    const retryWrappedFn = async () => {
      return retryService.execute(fn);
    };

    try {
      return await circuitBreaker.executeWithFallback(retryWrappedFn, async () => {
        this.emit('fallbackUsed', providerId, 'circuit_open_or_failure');
        return fallback();
      });
    } catch (error) {
      this.emit('fallbackUsed', providerId, 'execution_error');
      return fallback();
    }
  }

  /**
   * Execute with provider failover - tries providers in order until one succeeds
   */
  async executeWithFailover<T>(
    providerIds: string[],
    fn: (providerId: string) => Promise<T>
  ): Promise<T> {
    const errors: Error[] = [];

    for (const providerId of providerIds) {
      const circuitBreaker = this.getOrCreateCircuitBreaker(providerId);

      // Skip providers with open circuits
      if (circuitBreaker.getState() === CircuitBreakerState.OPEN) {
        this.emit('providerSkipped', providerId, 'circuit_open');
        continue;
      }

      try {
        const result = await this.execute(providerId, () => fn(providerId));
        this.emit('failoverSuccess', providerId, providerIds.indexOf(providerId));
        return result;
      } catch (error) {
        errors.push(error as Error);
        this.emit('providerFailed', providerId, error);
        // Continue to next provider
      }
    }

    throw new Error(`All providers failed: ${errors.map(e => e.message).join(', ')}`);
  }

  // ============================================================================
  // Circuit Control
  // ============================================================================

  /**
   * Manually open a circuit breaker
   */
  openCircuit(providerId: string): void {
    const breaker = this.getOrCreateCircuitBreaker(providerId);
    breaker.open();
  }

  /**
   * Manually reset a circuit breaker
   */
  resetCircuit(providerId: string): void {
    const breaker = this.circuitBreakers.get(providerId);
    if (breaker) {
      breaker.reset();
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuits(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
  }

  // ============================================================================
  // Status and Health
  // ============================================================================

  /**
   * Get circuit status for a provider
   */
  getCircuitStatus(providerId: string): CircuitBreakerStats {
    const breaker = this.getOrCreateCircuitBreaker(providerId);
    return breaker.getStats();
  }

  /**
   * Get all circuit statuses
   */
  getAllCircuitStatuses(): Record<string, CircuitBreakerStats> {
    const statuses: Record<string, CircuitBreakerStats> = {};

    for (const [id, breaker] of this.circuitBreakers) {
      statuses[id] = breaker.getStats();
    }

    return statuses;
  }

  /**
   * Get health summary across all providers
   */
  getHealthSummary(): HealthSummary {
    const providerStates: Record<string, CircuitBreakerState> = {};
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;

    for (const [id, breaker] of this.circuitBreakers) {
      const state = breaker.getState();
      providerStates[id] = state;

      switch (state) {
        case CircuitBreakerState.CLOSED:
          healthy++;
          break;
        case CircuitBreakerState.HALF_OPEN:
          degraded++;
          break;
        case CircuitBreakerState.OPEN:
          unhealthy++;
          break;
      }
    }

    return {
      totalProviders: this.circuitBreakers.size,
      healthyProviders: healthy,
      degradedProviders: degraded,
      unhealthyProviders: unhealthy,
      providerStates,
    };
  }

  /**
   * Check if a provider is healthy (circuit is closed)
   */
  isProviderHealthy(providerId: string): boolean {
    const breaker = this.circuitBreakers.get(providerId);
    if (!breaker) return true; // Unknown provider is assumed healthy

    return breaker.getState() === CircuitBreakerState.CLOSED;
  }

  /**
   * Get list of healthy providers from a given list
   */
  getHealthyProviders(providerIds: string[]): string[] {
    return providerIds.filter(id => this.isProviderHealthy(id));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ResilientAIService with default configuration
 */
export function createResilientAIService(
  options: Partial<ResilientAIConfig> = {}
): ResilientAIService {
  const defaultConfig: ResilientAIConfig = {
    circuitBreaker: {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      resetTimeout: 60000,
    },
    retry: {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      jitter: true,
    },
  };

  return new ResilientAIService({
    circuitBreaker: { ...defaultConfig.circuitBreaker, ...options.circuitBreaker },
    retry: { ...defaultConfig.retry, ...options.retry },
  });
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { CircuitBreakerState, CircuitBreakerStats, CircuitBreakerError };
export { RetryError };
