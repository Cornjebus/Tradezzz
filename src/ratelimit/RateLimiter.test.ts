import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter, TierLimits, UserTier } from './RateLimiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('User Rate Limits', () => {
    it('should_allow_requests_within_limit', async () => {
      const userId = 'user_1';
      const limit = 10;

      // Make requests up to the limit
      for (let i = 0; i < limit; i++) {
        const result = await limiter.checkLimit(userId, 'api', limit, 60);
        expect(result.allowed).toBe(true);
      }
    });

    it('should_deny_requests_over_limit', async () => {
      const userId = 'user_1';
      const limit = 5;

      // Exhaust the limit
      for (let i = 0; i < limit; i++) {
        await limiter.checkLimit(userId, 'api', limit, 60);
      }

      // Next request should be denied
      const result = await limiter.checkLimit(userId, 'api', limit, 60);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.remaining).toBe(0);
    });

    it('should_reset_after_window_expires', async () => {
      vi.useFakeTimers();
      const userId = 'user_1';
      const limit = 5;
      const windowSeconds = 60;

      // Exhaust limit
      for (let i = 0; i < limit; i++) {
        await limiter.checkLimit(userId, 'api', limit, windowSeconds);
      }

      // Should be denied
      let result = await limiter.checkLimit(userId, 'api', limit, windowSeconds);
      expect(result.allowed).toBe(false);

      // Advance time past window
      vi.advanceTimersByTime((windowSeconds + 1) * 1000);

      // Should be allowed again
      result = await limiter.checkLimit(userId, 'api', limit, windowSeconds);
      expect(result.allowed).toBe(true);
    });

    it('should_track_limits_per_category', async () => {
      const userId = 'user_1';

      // Use different categories
      await limiter.checkLimit(userId, 'orders', 10, 60);
      await limiter.checkLimit(userId, 'orders', 10, 60);
      await limiter.checkLimit(userId, 'backtests', 5, 60);

      const status = limiter.getStatus(userId);

      expect(status.orders.used).toBe(2);
      expect(status.orders.limit).toBe(10);
      expect(status.backtests.used).toBe(1);
      expect(status.backtests.limit).toBe(5);
    });

    it('should_track_separate_limits_per_user', async () => {
      await limiter.checkLimit('user_1', 'api', 10, 60);
      await limiter.checkLimit('user_1', 'api', 10, 60);
      await limiter.checkLimit('user_2', 'api', 10, 60);

      const status1 = limiter.getStatus('user_1');
      const status2 = limiter.getStatus('user_2');

      expect(status1.api.used).toBe(2);
      expect(status2.api.used).toBe(1);
    });
  });

  describe('Tier-Based Limits', () => {
    it('should_apply_free_tier_limits', () => {
      const limits = limiter.getLimitsForTier('free');

      expect(limits.backtestsPerDay).toBe(5);
      expect(limits.strategiesMax).toBe(1);
      expect(limits.ordersPerMinute).toBe(10);
      expect(limits.liveTrading).toBe(false);
      expect(limits.apiRequestsPerMinute).toBe(60);
    });

    it('should_apply_pro_tier_limits', () => {
      const limits = limiter.getLimitsForTier('pro');

      expect(limits.backtestsPerDay).toBe(50);
      expect(limits.strategiesMax).toBe(5);
      expect(limits.ordersPerMinute).toBe(60);
      expect(limits.liveTrading).toBe(true);
      expect(limits.apiRequestsPerMinute).toBe(300);
    });

    it('should_apply_elite_tier_limits', () => {
      const limits = limiter.getLimitsForTier('elite');

      expect(limits.backtestsPerDay).toBe(-1); // Unlimited
      expect(limits.strategiesMax).toBe(20);
      expect(limits.ordersPerMinute).toBe(300);
      expect(limits.priorityExecution).toBe(true);
      expect(limits.apiRequestsPerMinute).toBe(1000);
    });

    it('should_apply_institutional_tier_limits', () => {
      const limits = limiter.getLimitsForTier('institutional');

      expect(limits.backtestsPerDay).toBe(-1); // Unlimited
      expect(limits.strategiesMax).toBe(-1); // Unlimited
      expect(limits.ordersPerMinute).toBe(-1); // Unlimited
      expect(limits.priorityExecution).toBe(true);
      expect(limits.dedicatedSupport).toBe(true);
    });
  });

  describe('Exchange Rate Limit Protection', () => {
    it('should_track_exchange_api_calls', async () => {
      const userId = 'user_1';
      const exchange = 'binance';

      await limiter.trackExchangeCall(userId, exchange);
      await limiter.trackExchangeCall(userId, exchange);

      const usage = limiter.getExchangeUsage(userId, exchange);
      expect(usage.calls).toBe(2);
    });

    it('should_warn_when_approaching_exchange_limit', async () => {
      const userId = 'user_1';
      const exchange = 'binance';

      // Binance has ~1200 req/min limit, we warn at 80%
      limiter.setExchangeLimit(exchange, 100); // Lower for testing

      // Make 85 calls
      for (let i = 0; i < 85; i++) {
        await limiter.trackExchangeCall(userId, exchange);
      }

      const status = limiter.getExchangeStatus(userId, exchange);
      expect(status.warning).toBe(true);
      expect(status.percentUsed).toBeGreaterThanOrEqual(80);
    });

    it('should_block_when_at_exchange_limit', async () => {
      const userId = 'user_1';
      const exchange = 'binance';

      limiter.setExchangeLimit(exchange, 10);

      // Exhaust limit
      for (let i = 0; i < 10; i++) {
        await limiter.trackExchangeCall(userId, exchange);
      }

      const canCall = await limiter.canMakeExchangeCall(userId, exchange);
      expect(canCall.allowed).toBe(false);
      expect(canCall.reason).toContain('Exchange rate limit');
    });

    it('should_track_per_exchange_limits', async () => {
      const userId = 'user_1';

      await limiter.trackExchangeCall(userId, 'binance');
      await limiter.trackExchangeCall(userId, 'binance');
      await limiter.trackExchangeCall(userId, 'coinbase');

      expect(limiter.getExchangeUsage(userId, 'binance').calls).toBe(2);
      expect(limiter.getExchangeUsage(userId, 'coinbase').calls).toBe(1);
    });
  });

  describe('Usage Tracking', () => {
    it('should_track_daily_usage', () => {
      const userId = 'user_1';

      limiter.trackUsage(userId, 'backtest');
      limiter.trackUsage(userId, 'backtest');
      limiter.trackUsage(userId, 'order');

      const usage = limiter.getDailyUsage(userId);
      expect(usage.backtest).toBe(2);
      expect(usage.order).toBe(1);
    });

    it('should_check_daily_limit', () => {
      const userId = 'user_1';

      // Set user tier
      limiter.setUserTier(userId, 'free');

      // Free tier gets 5 backtests/day
      for (let i = 0; i < 5; i++) {
        limiter.trackUsage(userId, 'backtest');
      }

      const canBacktest = limiter.canPerformAction(userId, 'backtest');
      expect(canBacktest.allowed).toBe(false);
      expect(canBacktest.reason).toContain('Daily limit reached');
    });

    it('should_reset_daily_usage_at_midnight', () => {
      vi.useFakeTimers();
      const userId = 'user_1';

      limiter.trackUsage(userId, 'backtest');
      expect(limiter.getDailyUsage(userId).backtest).toBe(1);

      // Advance to next day
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1000);

      // After reset, backtest should be undefined (no usage today)
      expect(limiter.getDailyUsage(userId).backtest).toBeUndefined();
    });
  });

  describe('Rate Limit Response', () => {
    it('should_include_rate_limit_headers_info', async () => {
      const userId = 'user_1';
      const limit = 100;

      const result = await limiter.checkLimit(userId, 'api', limit, 60);

      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(99);
      expect(result.reset).toBeDefined();
    });

    it('should_calculate_retry_after_correctly', async () => {
      vi.useFakeTimers();
      const userId = 'user_1';
      const limit = 2;
      const windowSeconds = 60;

      // Exhaust limit
      await limiter.checkLimit(userId, 'api', limit, windowSeconds);
      await limiter.checkLimit(userId, 'api', limit, windowSeconds);

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);

      const result = await limiter.checkLimit(userId, 'api', limit, windowSeconds);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeLessThanOrEqual(30);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });
});
