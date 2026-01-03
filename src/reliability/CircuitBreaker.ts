/**
 * Circuit Breaker Service - Phase 20: Fallback & Reliability
 *
 * Implements the Circuit Breaker pattern for resilient service calls:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail fast
 * - HALF_OPEN: Testing if service has recovered
 *
 * Features:
 * - Configurable failure/success thresholds
 * - Timeout handling
 * - Fallback support
 * - Event emission for monitoring
 * - Manual control (reset/open)
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Number of successes in half-open before closing */
  successThreshold: number;
  /** Timeout for operations in ms */
  timeout: number;
  /** Time before transitioning from OPEN to HALF_OPEN in ms */
  resetTimeout: number;
  /** Optional name for logging */
  name?: string;
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  failureRate: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  openedAt: number | null;
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

// ============================================================================
// Circuit Breaker Implementation
// ============================================================================

export class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private halfOpenSuccessCount = 0;
  private totalRequests = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private openedAt: number | null = null;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    super();
    this.config = config;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkStateTransition();

    if (this.state === CircuitBreakerState.OPEN) {
      throw new CircuitBreakerError(
        `Circuit breaker is open${this.config.name ? ` for ${this.config.name}` : ''}`
      );
    }

    this.totalRequests++;

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute with a fallback function if circuit is open or execution fails
   */
  async executeWithFallback<T>(
    fn: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    this.checkStateTransition();

    if (this.state === CircuitBreakerState.OPEN) {
      return fallback();
    }

    this.totalRequests++;

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      return fallback();
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    this.checkStateTransition();
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      failureRate: this.totalRequests > 0 ? this.failureCount / this.totalRequests : 0,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
    };
  }

  /**
   * Manually reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenSuccessCount = 0;
    this.openedAt = null;
    this.emit('stateChange', this.state);
    this.emit('reset');
  }

  /**
   * Manually open the circuit breaker
   */
  open(): void {
    this.state = CircuitBreakerState.OPEN;
    this.openedAt = Date.now();
    this.emit('stateChange', this.state);
    this.emit('manualOpen');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();
    this.failureCount = 0; // Reset failure count on success
    this.emit('success');

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenSuccessCount++;
      if (this.halfOpenSuccessCount >= this.config.successThreshold) {
        this.transitionTo(CircuitBreakerState.CLOSED);
        this.halfOpenSuccessCount = 0;
      }
    }
  }

  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.emit('failure', error);

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Any failure in half-open immediately opens
      this.transitionTo(CircuitBreakerState.OPEN);
      this.halfOpenSuccessCount = 0;
    } else if (this.state === CircuitBreakerState.CLOSED) {
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo(CircuitBreakerState.OPEN);
      }
    }
  }

  private checkStateTransition(): void {
    if (this.state === CircuitBreakerState.OPEN && this.openedAt) {
      const timeSinceOpen = Date.now() - this.openedAt;
      if (timeSinceOpen >= this.config.resetTimeout) {
        this.transitionTo(CircuitBreakerState.HALF_OPEN);
      }
    }
  }

  private transitionTo(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitBreakerState.OPEN) {
      this.openedAt = Date.now();
    } else if (newState === CircuitBreakerState.CLOSED) {
      this.openedAt = null;
      this.failureCount = 0;
    }

    this.emit('stateChange', newState, oldState);
  }
}

// ============================================================================
// Circuit Breaker Registry
// ============================================================================

/**
 * Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker by name
   */
  getOrCreate(name: string, config: Omit<CircuitBreakerConfig, 'name'>): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker({ ...config, name });
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  /**
   * Get an existing circuit breaker
   */
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get stats for all circuit breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Default registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry();
