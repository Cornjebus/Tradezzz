/**
 * StrategyService Tests - TDD Red Phase
 * Tests for strategy management and execution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrategyService } from './StrategyService';
import { MockDatabase, createMockDatabase } from '../../tests/helpers/mock-db';
import { ConfigService } from '../config/ConfigService';

describe('StrategyService', () => {
  let strategyService: StrategyService;
  let configService: ConfigService;
  let db: MockDatabase;
  let userId: string;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'development');
    db = createMockDatabase();
    configService = new ConfigService({ db });
    strategyService = new StrategyService({ db, configService });

    // Create test user
    const user = await db.users.create({
      email: 'strategist@example.com',
      passwordHash: 'hash',
      tier: 'pro',
    });
    userId = user.id;
  });

  // ============================================================================
  // Strategy Creation Tests
  // ============================================================================

  describe('createStrategy', () => {
    it('should_create_momentum_strategy', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'BTC Momentum',
        type: 'momentum',
        config: {
          symbols: ['BTC/USDT'],
          timeframe: '1h',
          lookbackPeriod: 14,
          entryThreshold: 0.02,
          exitThreshold: -0.01,
        },
      });

      expect(strategy.id).toBeDefined();
      expect(strategy.name).toBe('BTC Momentum');
      expect(strategy.type).toBe('momentum');
      expect(strategy.status).toBe('draft');
      expect(strategy.userId).toBe(userId);
    });

    it('should_create_mean_reversion_strategy', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'ETH Mean Reversion',
        type: 'mean_reversion',
        config: {
          symbols: ['ETH/USDT'],
          timeframe: '4h',
          bollingerPeriod: 20,
          bollingerStdDev: 2,
          rsiPeriod: 14,
          oversoldThreshold: 30,
          overboughtThreshold: 70,
        },
      });

      expect(strategy.type).toBe('mean_reversion');
      expect(strategy.config.bollingerPeriod).toBe(20);
    });

    it('should_create_sentiment_strategy', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Sentiment Trading',
        type: 'sentiment',
        config: {
          symbols: ['BTC/USDT', 'ETH/USDT'],
          aiProvider: 'openai',
          model: 'gpt-4-turbo',
          sentimentSources: ['twitter', 'reddit', 'news'],
          bullishThreshold: 0.6,
          bearishThreshold: 0.4,
        },
      });

      expect(strategy.type).toBe('sentiment');
      expect(strategy.config.aiProvider).toBe('openai');
    });

    it('should_create_arbitrage_strategy', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Cross-Exchange Arb',
        type: 'arbitrage',
        config: {
          symbols: ['BTC/USDT'],
          exchanges: ['binance', 'coinbase'],
          minSpreadPercent: 0.5,
          maxPositionSize: 1000,
        },
      });

      expect(strategy.type).toBe('arbitrage');
      expect(strategy.config.exchanges).toContain('binance');
    });

    it('should_create_trend_following_strategy', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Trend Follower',
        type: 'trend_following',
        config: {
          symbols: ['SOL/USDT'],
          timeframe: '1d',
          fastMaPeriod: 10,
          slowMaPeriod: 50,
          adxPeriod: 14,
          adxThreshold: 25,
        },
      });

      expect(strategy.type).toBe('trend_following');
      expect(strategy.config.fastMaPeriod).toBe(10);
    });

    it('should_reject_invalid_strategy_type', async () => {
      await expect(
        strategyService.createStrategy({
          userId,
          name: 'Invalid',
          type: 'invalid_type' as any,
          config: {},
        })
      ).rejects.toThrow('Invalid strategy type');
    });

    it('should_reject_strategy_without_name', async () => {
      await expect(
        strategyService.createStrategy({
          userId,
          name: '',
          type: 'momentum',
          config: {},
        })
      ).rejects.toThrow('Strategy name is required');
    });

    it('should_enforce_tier_strategy_limit', async () => {
      // Create user with free tier (max 2 strategies)
      const freeUser = await db.users.create({
        email: 'free@example.com',
        passwordHash: 'hash',
        tier: 'free',
      });

      // Create 2 strategies
      await strategyService.createStrategy({
        userId: freeUser.id,
        name: 'Strategy 1',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      await strategyService.createStrategy({
        userId: freeUser.id,
        name: 'Strategy 2',
        type: 'momentum',
        config: { symbols: ['ETH/USDT'] },
      });

      // Third should fail
      await expect(
        strategyService.createStrategy({
          userId: freeUser.id,
          name: 'Strategy 3',
          type: 'momentum',
          config: { symbols: ['SOL/USDT'] },
        })
      ).rejects.toThrow('Strategy limit reached for free tier');
    });

    it('should_validate_momentum_config', async () => {
      await expect(
        strategyService.createStrategy({
          userId,
          name: 'Bad Momentum',
          type: 'momentum',
          config: {
            symbols: [], // Empty symbols
            timeframe: '1h',
          },
        })
      ).rejects.toThrow('At least one symbol is required');
    });

    it('should_set_default_risk_parameters', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Default Risk',
        type: 'momentum',
        config: {
          symbols: ['BTC/USDT'],
          timeframe: '1h',
        },
      });

      expect(strategy.config.stopLossPercent).toBe(2);
      expect(strategy.config.takeProfitPercent).toBe(5);
      expect(strategy.config.maxPositionPercent).toBe(10);
    });
  });

  // ============================================================================
  // Strategy Retrieval Tests
  // ============================================================================

  describe('getStrategy', () => {
    it('should_get_strategy_by_id', async () => {
      const created = await strategyService.createStrategy({
        userId,
        name: 'Test Strategy',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      const retrieved = await strategyService.getStrategy(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('Test Strategy');
    });

    it('should_return_null_for_nonexistent_strategy', async () => {
      const result = await strategyService.getStrategy('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });

  describe('getUserStrategies', () => {
    it('should_get_all_user_strategies', async () => {
      await strategyService.createStrategy({
        userId,
        name: 'Strategy 1',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      await strategyService.createStrategy({
        userId,
        name: 'Strategy 2',
        type: 'mean_reversion',
        config: { symbols: ['ETH/USDT'] },
      });

      const strategies = await strategyService.getUserStrategies(userId);

      expect(strategies.length).toBe(2);
    });

    it('should_filter_by_status', async () => {
      const s1 = await strategyService.createStrategy({
        userId,
        name: 'Draft',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      const s2 = await strategyService.createStrategy({
        userId,
        name: 'Active',
        type: 'momentum',
        config: { symbols: ['ETH/USDT'] },
      });

      // Go through proper status transitions
      await strategyService.updateStatus(s2.id, 'backtesting');
      await strategyService.updateStatus(s2.id, 'paper');
      await strategyService.updateStatus(s2.id, 'active');

      const activeOnly = await strategyService.getUserStrategies(userId, { status: 'active' });

      expect(activeOnly.length).toBe(1);
      expect(activeOnly[0].name).toBe('Active');
    });

    it('should_filter_by_type', async () => {
      await strategyService.createStrategy({
        userId,
        name: 'Momentum',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      await strategyService.createStrategy({
        userId,
        name: 'Mean Reversion',
        type: 'mean_reversion',
        config: { symbols: ['ETH/USDT'] },
      });

      const momentumOnly = await strategyService.getUserStrategies(userId, { type: 'momentum' });

      expect(momentumOnly.length).toBe(1);
      expect(momentumOnly[0].type).toBe('momentum');
    });
  });

  // ============================================================================
  // Strategy Update Tests
  // ============================================================================

  describe('updateStrategy', () => {
    it('should_update_strategy_name', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Original Name',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      const updated = await strategyService.updateStrategy(strategy.id, {
        name: 'New Name',
      });

      expect(updated.name).toBe('New Name');
    });

    it('should_update_strategy_config', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Config Test',
        type: 'momentum',
        config: {
          symbols: ['BTC/USDT'],
          lookbackPeriod: 14,
        },
      });

      const updated = await strategyService.updateStrategy(strategy.id, {
        config: {
          ...strategy.config,
          lookbackPeriod: 20,
        },
      });

      expect(updated.config.lookbackPeriod).toBe(20);
    });

    it('should_not_allow_type_change', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Type Test',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      await expect(
        strategyService.updateStrategy(strategy.id, {
          type: 'mean_reversion' as any,
        })
      ).rejects.toThrow('Cannot change strategy type');
    });

    it('should_not_update_active_strategy_config', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Active Strategy',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      // Go through proper status transitions
      await strategyService.updateStatus(strategy.id, 'backtesting');
      await strategyService.updateStatus(strategy.id, 'paper');
      await strategyService.updateStatus(strategy.id, 'active');

      await expect(
        strategyService.updateStrategy(strategy.id, {
          config: { symbols: ['ETH/USDT'] },
        })
      ).rejects.toThrow('Cannot modify config of active strategy');
    });
  });

  // ============================================================================
  // Strategy Status Tests
  // ============================================================================

  describe('updateStatus', () => {
    it('should_transition_from_draft_to_backtesting', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Status Test',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      const updated = await strategyService.updateStatus(strategy.id, 'backtesting');

      expect(updated.status).toBe('backtesting');
    });

    it('should_transition_from_backtesting_to_paper', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Paper Test',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      await strategyService.updateStatus(strategy.id, 'backtesting');
      const updated = await strategyService.updateStatus(strategy.id, 'paper');

      expect(updated.status).toBe('paper');
    });

    it('should_transition_from_paper_to_active', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Active Test',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      await strategyService.updateStatus(strategy.id, 'backtesting');
      await strategyService.updateStatus(strategy.id, 'paper');
      const updated = await strategyService.updateStatus(strategy.id, 'active');

      expect(updated.status).toBe('active');
    });

    it('should_reject_invalid_status_transition', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Invalid Transition',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      // Cannot go directly from draft to active
      await expect(
        strategyService.updateStatus(strategy.id, 'active')
      ).rejects.toThrow('Invalid status transition');
    });

    it('should_allow_pausing_active_strategy', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Pause Test',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      await strategyService.updateStatus(strategy.id, 'backtesting');
      await strategyService.updateStatus(strategy.id, 'paper');
      await strategyService.updateStatus(strategy.id, 'active');
      const paused = await strategyService.updateStatus(strategy.id, 'paused');

      expect(paused.status).toBe('paused');
    });

    it('should_allow_resuming_paused_strategy', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Resume Test',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      await strategyService.updateStatus(strategy.id, 'backtesting');
      await strategyService.updateStatus(strategy.id, 'paper');
      await strategyService.updateStatus(strategy.id, 'active');
      await strategyService.updateStatus(strategy.id, 'paused');
      const resumed = await strategyService.updateStatus(strategy.id, 'active');

      expect(resumed.status).toBe('active');
    });

    it('should_reject_live_trading_for_free_tier', async () => {
      const freeUser = await db.users.create({
        email: 'freelive@example.com',
        passwordHash: 'hash',
        tier: 'free',
      });

      const strategy = await strategyService.createStrategy({
        userId: freeUser.id,
        name: 'Free Live Test',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      await strategyService.updateStatus(strategy.id, 'backtesting');
      await strategyService.updateStatus(strategy.id, 'paper');

      await expect(
        strategyService.updateStatus(strategy.id, 'active')
      ).rejects.toThrow('Live trading not available for free tier');
    });
  });

  // ============================================================================
  // Strategy Deletion Tests
  // ============================================================================

  describe('deleteStrategy', () => {
    it('should_delete_draft_strategy', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Delete Test',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      await strategyService.deleteStrategy(strategy.id);

      const result = await strategyService.getStrategy(strategy.id);
      expect(result).toBeNull();
    });

    it('should_archive_instead_of_delete_if_has_trades', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Has Trades',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      // Create a trade for this strategy
      await db.trades.create({
        userId,
        strategyId: strategy.id,
        symbol: 'BTC/USDT',
        side: 'buy',
        quantity: 0.1,
        price: 50000,
        mode: 'paper',
      });

      await strategyService.deleteStrategy(strategy.id);

      const result = await strategyService.getStrategy(strategy.id);
      expect(result).toBeDefined();
      expect(result!.status).toBe('archived');
    });

    it('should_not_delete_active_strategy', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Active Delete',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      await strategyService.updateStatus(strategy.id, 'backtesting');
      await strategyService.updateStatus(strategy.id, 'paper');
      await strategyService.updateStatus(strategy.id, 'active');

      await expect(
        strategyService.deleteStrategy(strategy.id)
      ).rejects.toThrow('Cannot delete active strategy');
    });
  });

  // ============================================================================
  // Strategy Validation Tests
  // ============================================================================

  describe('validateConfig', () => {
    it('should_validate_timeframe', async () => {
      await expect(
        strategyService.createStrategy({
          userId,
          name: 'Bad Timeframe',
          type: 'momentum',
          config: {
            symbols: ['BTC/USDT'],
            timeframe: 'invalid',
          },
        })
      ).rejects.toThrow('Invalid timeframe');
    });

    it('should_validate_symbols_format', async () => {
      await expect(
        strategyService.createStrategy({
          userId,
          name: 'Bad Symbol',
          type: 'momentum',
          config: {
            symbols: ['BTCUSDT'], // Should be BTC/USDT
          },
        })
      ).rejects.toThrow('Invalid symbol format');
    });

    it('should_validate_risk_parameters', async () => {
      await expect(
        strategyService.createStrategy({
          userId,
          name: 'Bad Risk',
          type: 'momentum',
          config: {
            symbols: ['BTC/USDT'],
            stopLossPercent: 101, // > 100%
          },
        })
      ).rejects.toThrow('Stop loss must be between 0 and 100');
    });
  });

  // ============================================================================
  // Strategy Cloning Tests
  // ============================================================================

  describe('cloneStrategy', () => {
    it('should_clone_strategy_with_new_name', async () => {
      const original = await strategyService.createStrategy({
        userId,
        name: 'Original',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'], lookbackPeriod: 14 },
      });

      const clone = await strategyService.cloneStrategy(original.id, 'Clone of Original');

      expect(clone.id).not.toBe(original.id);
      expect(clone.name).toBe('Clone of Original');
      expect(clone.type).toBe('momentum');
      expect(clone.config.lookbackPeriod).toBe(14);
      expect(clone.status).toBe('draft');
    });

    it('should_not_clone_another_users_strategy', async () => {
      const otherUser = await db.users.create({
        email: 'other@example.com',
        passwordHash: 'hash',
        tier: 'pro',
      });

      const otherStrategy = await strategyService.createStrategy({
        userId: otherUser.id,
        name: 'Other Strategy',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      await expect(
        strategyService.cloneStrategy(otherStrategy.id, 'My Clone', userId)
      ).rejects.toThrow('Cannot clone another user\'s strategy');
    });
  });

  // ============================================================================
  // Strategy Statistics Tests
  // ============================================================================

  describe('getStrategyStats', () => {
    it('should_return_empty_stats_for_new_strategy', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'No Stats',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      const stats = await strategyService.getStrategyStats(strategy.id);

      expect(stats.totalTrades).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.profitLoss).toBe(0);
    });

    it('should_calculate_stats_from_trades', async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Has Stats',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      // Create some trades
      await db.trades.create({
        userId,
        strategyId: strategy.id,
        symbol: 'BTC/USDT',
        side: 'buy',
        quantity: 0.1,
        price: 50000,
        mode: 'paper',
        status: 'filled',
      });

      await db.trades.create({
        userId,
        strategyId: strategy.id,
        symbol: 'BTC/USDT',
        side: 'sell',
        quantity: 0.1,
        price: 52000,
        mode: 'paper',
        status: 'filled',
      });

      const stats = await strategyService.getStrategyStats(strategy.id);

      expect(stats.totalTrades).toBe(2);
    });
  });
});
