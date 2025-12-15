/**
 * RateLimiter - Phase 12: Rate Limiting & Fair Usage
 *
 * Implements token bucket algorithm for rate limiting:
 * - Per-user API request limits
 * - Tier-based limits (Free, Pro, Elite, Institutional)
 * - Exchange API rate limit protection
 * - Daily usage tracking
 */

export type UserTier = 'free' | 'pro' | 'elite' | 'institutional';

export interface TierLimits {
  backtestsPerDay: number;
  strategiesMax: number;
  ordersPerMinute: number;
  liveTrading: boolean;
  apiRequestsPerMinute: number;
  priorityExecution?: boolean;
  dedicatedSupport?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface ExchangeStatus {
  warning: boolean;
  percentUsed: number;
  remaining: number;
}

export interface ActionResult {
  allowed: boolean;
  reason?: string;
}

interface RateLimitBucket {
  count: number;
  windowStart: number;
  limit: number;
}

interface ExchangeUsage {
  calls: number;
  windowStart: number;
}

interface DailyUsage {
  [action: string]: number;
  date: number;
}

const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    backtestsPerDay: 5,
    strategiesMax: 1,
    ordersPerMinute: 10,
    liveTrading: false,
    apiRequestsPerMinute: 60
  },
  pro: {
    backtestsPerDay: 50,
    strategiesMax: 5,
    ordersPerMinute: 60,
    liveTrading: true,
    apiRequestsPerMinute: 300
  },
  elite: {
    backtestsPerDay: -1, // Unlimited
    strategiesMax: 20,
    ordersPerMinute: 300,
    liveTrading: true,
    apiRequestsPerMinute: 1000,
    priorityExecution: true
  },
  institutional: {
    backtestsPerDay: -1,
    strategiesMax: -1,
    ordersPerMinute: -1,
    liveTrading: true,
    apiRequestsPerMinute: -1,
    priorityExecution: true,
    dedicatedSupport: true
  }
};

// Default exchange limits (requests per minute)
const DEFAULT_EXCHANGE_LIMITS: Record<string, number> = {
  binance: 1200,
  coinbase: 300,
  kraken: 180,
  bybit: 600,
  okx: 600
};

export class RateLimiter {
  private buckets: Map<string, RateLimitBucket> = new Map();
  private exchangeUsage: Map<string, ExchangeUsage> = new Map();
  private exchangeLimits: Map<string, number> = new Map();
  private dailyUsage: Map<string, DailyUsage> = new Map();
  private userTiers: Map<string, UserTier> = new Map();

  constructor() {
    // Initialize default exchange limits
    for (const [exchange, limit] of Object.entries(DEFAULT_EXCHANGE_LIMITS)) {
      this.exchangeLimits.set(exchange, limit);
    }
  }

  /**
   * Check if a request is allowed under rate limits
   */
  async checkLimit(
    userId: string,
    category: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const key = `${userId}:${category}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    let bucket = this.buckets.get(key);

    // Check if window has expired
    if (!bucket || now - bucket.windowStart >= windowMs) {
      bucket = {
        count: 0,
        windowStart: now,
        limit
      };
    }

    bucket.limit = limit;

    // Check if under limit
    if (bucket.count < limit) {
      bucket.count++;
      this.buckets.set(key, bucket);

      return {
        allowed: true,
        limit,
        remaining: limit - bucket.count,
        reset: Math.ceil((bucket.windowStart + windowMs - now) / 1000)
      };
    }

    // Over limit
    const retryAfter = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return {
      allowed: false,
      limit,
      remaining: 0,
      reset: retryAfter,
      retryAfter
    };
  }

  /**
   * Get current rate limit status for a user
   */
  getStatus(userId: string): Record<string, { used: number; limit: number; remaining: number }> {
    const result: Record<string, { used: number; limit: number; remaining: number }> = {};

    for (const [key, bucket] of this.buckets.entries()) {
      if (key.startsWith(`${userId}:`)) {
        const category = key.split(':')[1];
        result[category] = {
          used: bucket.count,
          limit: bucket.limit,
          remaining: bucket.limit - bucket.count
        };
      }
    }

    return result;
  }

  /**
   * Get tier-based limits
   */
  getLimitsForTier(tier: UserTier): TierLimits {
    return { ...TIER_LIMITS[tier] };
  }

  /**
   * Set user's tier
   */
  setUserTier(userId: string, tier: UserTier): void {
    this.userTiers.set(userId, tier);
  }

  /**
   * Get user's tier
   */
  getUserTier(userId: string): UserTier {
    return this.userTiers.get(userId) || 'free';
  }

  // ============================================
  // EXCHANGE RATE LIMIT PROTECTION
  // ============================================

  /**
   * Track an exchange API call
   */
  async trackExchangeCall(userId: string, exchange: string): Promise<void> {
    const key = `${userId}:${exchange}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    let usage = this.exchangeUsage.get(key);

    if (!usage || now - usage.windowStart >= windowMs) {
      usage = { calls: 0, windowStart: now };
    }

    usage.calls++;
    this.exchangeUsage.set(key, usage);
  }

  /**
   * Get exchange usage for a user
   */
  getExchangeUsage(userId: string, exchange: string): { calls: number } {
    const key = `${userId}:${exchange}`;
    const usage = this.exchangeUsage.get(key);
    return { calls: usage?.calls || 0 };
  }

  /**
   * Set exchange rate limit
   */
  setExchangeLimit(exchange: string, limit: number): void {
    this.exchangeLimits.set(exchange, limit);
  }

  /**
   * Get exchange limit
   */
  getExchangeLimit(exchange: string): number {
    return this.exchangeLimits.get(exchange) || 100;
  }

  /**
   * Get exchange status with warning
   */
  getExchangeStatus(userId: string, exchange: string): ExchangeStatus {
    const usage = this.getExchangeUsage(userId, exchange);
    const limit = this.getExchangeLimit(exchange);
    const percentUsed = (usage.calls / limit) * 100;

    return {
      warning: percentUsed >= 80,
      percentUsed: Math.round(percentUsed),
      remaining: Math.max(0, limit - usage.calls)
    };
  }

  /**
   * Check if exchange call is allowed
   */
  async canMakeExchangeCall(userId: string, exchange: string): Promise<ActionResult> {
    const usage = this.getExchangeUsage(userId, exchange);
    const limit = this.getExchangeLimit(exchange);

    if (usage.calls >= limit) {
      return {
        allowed: false,
        reason: `Exchange rate limit reached for ${exchange}. Please wait before making more requests.`
      };
    }

    return { allowed: true };
  }

  // ============================================
  // DAILY USAGE TRACKING
  // ============================================

  /**
   * Track a usage action
   */
  trackUsage(userId: string, action: string): void {
    const today = this.getToday();
    let usage = this.dailyUsage.get(userId);

    if (!usage || usage.date !== today) {
      usage = { date: today };
    }

    usage[action] = (usage[action] || 0) + 1;
    this.dailyUsage.set(userId, usage);
  }

  /**
   * Get daily usage for a user
   */
  getDailyUsage(userId: string): Record<string, number> {
    const today = this.getToday();
    const usage = this.dailyUsage.get(userId);

    if (!usage || usage.date !== today) {
      return {};
    }

    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(usage)) {
      if (key !== 'date') {
        result[key] = value as number;
      }
    }
    return result;
  }

  /**
   * Check if user can perform an action based on daily limits
   */
  canPerformAction(userId: string, action: string): ActionResult {
    const tier = this.getUserTier(userId);
    const limits = this.getLimitsForTier(tier);
    const usage = this.getDailyUsage(userId);

    // Map actions to limits
    const actionLimits: Record<string, number> = {
      backtest: limits.backtestsPerDay,
      order: limits.ordersPerMinute * 60 * 24, // Daily order limit
    };

    const limit = actionLimits[action];
    if (limit === undefined || limit === -1) {
      return { allowed: true }; // No limit or unlimited
    }

    const used = usage[action] || 0;
    if (used >= limit) {
      return {
        allowed: false,
        reason: `Daily limit reached for ${action}. Upgrade your plan for higher limits.`
      };
    }

    return { allowed: true };
  }

  /**
   * Get today's date as a number (YYYYMMDD)
   */
  private getToday(): number {
    const now = new Date();
    return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  }

  /**
   * Reset all limits (for testing)
   */
  reset(): void {
    this.buckets.clear();
    this.exchangeUsage.clear();
    this.dailyUsage.clear();
  }
}
