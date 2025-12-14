/**
 * BacktestService Tests - TDD Red Phase
 * Tests for backtesting engine and performance analysis
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BacktestService, BacktestConfig, BacktestResult, OHLCV } from './BacktestService';
import { MockDatabase, createMockDatabase } from '../../tests/helpers/mock-db';
import { ConfigService } from '../config/ConfigService';
import { StrategyService } from '../strategies/StrategyService';

describe('BacktestService', () => {
  let backtestService: BacktestService;
  let strategyService: StrategyService;
  let configService: ConfigService;
  let db: MockDatabase;
  let userId: string;
  let strategyId: string;

  // Sample OHLCV data for testing
  const sampleData: OHLCV[] = [
    { timestamp: 1000, open: 100, high: 105, low: 98, close: 103, volume: 1000 },
    { timestamp: 2000, open: 103, high: 108, low: 101, close: 107, volume: 1200 },
    { timestamp: 3000, open: 107, high: 110, low: 105, close: 109, volume: 1100 },
    { timestamp: 4000, open: 109, high: 112, low: 106, close: 108, volume: 900 },
    { timestamp: 5000, open: 108, high: 111, low: 104, close: 106, volume: 1300 },
    { timestamp: 6000, open: 106, high: 109, low: 103, close: 105, volume: 1000 },
    { timestamp: 7000, open: 105, high: 108, low: 102, close: 104, volume: 800 },
    { timestamp: 8000, open: 104, high: 110, low: 103, close: 109, volume: 1500 },
    { timestamp: 9000, open: 109, high: 115, low: 108, close: 114, volume: 2000 },
    { timestamp: 10000, open: 114, high: 118, low: 112, close: 116, volume: 1800 },
  ];

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'development');
    db = createMockDatabase();
    configService = new ConfigService({ db });
    strategyService = new StrategyService({ db, configService });
    backtestService = new BacktestService({ db, configService, strategyService });

    // Create test user
    const user = await db.users.create({
      email: 'backtester@example.com',
      passwordHash: 'hash',
      tier: 'pro',
    });
    userId = user.id;

    // Create test strategy
    const strategy = await strategyService.createStrategy({
      userId,
      name: 'Test Momentum',
      type: 'momentum',
      config: {
        symbols: ['BTC/USDT'],
        timeframe: '1h',
        lookbackPeriod: 3,
        entryThreshold: 0.02,
        exitThreshold: -0.01,
      },
    });
    strategyId = strategy.id;
  });

  // ============================================================================
  // Backtest Execution Tests
  // ============================================================================

  describe('runBacktest', () => {
    it('should_run_backtest_with_valid_config', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);

      expect(result.id).toBeDefined();
      expect(result.strategyId).toBe(strategyId);
      expect(result.status).toBe('completed');
      expect(result.metrics).toBeDefined();
      expect(result.trades).toBeDefined();
      expect(result.equityCurve).toBeDefined();
    });

    it('should_calculate_basic_metrics', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);

      expect(result.metrics.initialCapital).toBe(10000);
      expect(typeof result.metrics.finalCapital).toBe('number');
      expect(typeof result.metrics.totalReturn).toBe('number');
      expect(typeof result.metrics.totalTrades).toBe('number');
      expect(typeof result.metrics.winRate).toBe('number');
      expect(typeof result.metrics.maxDrawdown).toBe('number');
    });

    it('should_generate_equity_curve', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);

      expect(result.equityCurve.length).toBeGreaterThan(0);
      expect(result.equityCurve[0].equity).toBe(10000);
      result.equityCurve.forEach(point => {
        expect(point.timestamp).toBeDefined();
        expect(point.equity).toBeDefined();
      });
    });

    it('should_record_trades', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);

      result.trades.forEach(trade => {
        expect(trade.entryTime).toBeDefined();
        expect(trade.entryPrice).toBeGreaterThan(0);
        expect(trade.side).toMatch(/^(long|short)$/);
        expect(trade.quantity).toBeGreaterThan(0);
      });
    });

    it('should_reject_nonexistent_strategy', async () => {
      const config: BacktestConfig = {
        strategyId: '00000000-0000-0000-0000-000000000000',
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      await expect(backtestService.runBacktest(config)).rejects.toThrow('Strategy not found');
    });

    it('should_reject_invalid_date_range', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-31'),
        endDate: new Date('2024-01-01'), // End before start
        initialCapital: 10000,
        data: sampleData,
      };

      await expect(backtestService.runBacktest(config)).rejects.toThrow('End date must be after start date');
    });

    it('should_reject_zero_or_negative_capital', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 0,
        data: sampleData,
      };

      await expect(backtestService.runBacktest(config)).rejects.toThrow('Initial capital must be positive');
    });

    it('should_reject_empty_data', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: [],
      };

      await expect(backtestService.runBacktest(config)).rejects.toThrow('No data provided for backtest');
    });
  });

  // ============================================================================
  // Performance Metrics Tests
  // ============================================================================

  describe('calculateMetrics', () => {
    it('should_calculate_total_return', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);

      // totalReturn = (finalCapital - initialCapital) / initialCapital * 100
      const expectedReturn = (result.metrics.finalCapital - 10000) / 10000 * 100;
      expect(result.metrics.totalReturn).toBeCloseTo(expectedReturn, 2);
    });

    it('should_calculate_win_rate', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);

      expect(result.metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.winRate).toBeLessThanOrEqual(100);
    });

    it('should_calculate_max_drawdown', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);

      expect(result.metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(result.metrics.maxDrawdown).toBeLessThanOrEqual(100);
    });

    it('should_calculate_sharpe_ratio', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);

      expect(typeof result.metrics.sharpeRatio).toBe('number');
    });

    it('should_calculate_profit_factor', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);

      expect(result.metrics.profitFactor).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Strategy Signal Tests
  // ============================================================================

  describe('generateSignals', () => {
    it('should_generate_momentum_signals', async () => {
      const signals = backtestService.generateSignals('momentum', sampleData, {
        lookbackPeriod: 3,
        entryThreshold: 0.02,
        exitThreshold: -0.01,
      });

      expect(Array.isArray(signals)).toBe(true);
      signals.forEach(signal => {
        expect(signal.timestamp).toBeDefined();
        expect(signal.type).toMatch(/^(entry|exit)$/);
        expect(signal.side).toMatch(/^(long|short)$/);
      });
    });

    it('should_generate_mean_reversion_signals', async () => {
      const signals = backtestService.generateSignals('mean_reversion', sampleData, {
        bollingerPeriod: 3,
        bollingerStdDev: 2,
        oversoldThreshold: 30,
        overboughtThreshold: 70,
      });

      expect(Array.isArray(signals)).toBe(true);
    });

    it('should_generate_trend_following_signals', async () => {
      const signals = backtestService.generateSignals('trend_following', sampleData, {
        fastMaPeriod: 2,
        slowMaPeriod: 4,
      });

      expect(Array.isArray(signals)).toBe(true);
    });
  });

  // ============================================================================
  // Backtest History Tests
  // ============================================================================

  describe('getBacktestHistory', () => {
    it('should_save_and_retrieve_backtest_results', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);

      const history = await backtestService.getBacktestHistory(strategyId);

      expect(history.length).toBeGreaterThan(0);
      expect(history.some(h => h.id === result.id)).toBe(true);
    });

    it('should_return_empty_array_for_no_history', async () => {
      const newStrategy = await strategyService.createStrategy({
        userId,
        name: 'No History',
        type: 'momentum',
        config: { symbols: ['ETH/USDT'] },
      });

      const history = await backtestService.getBacktestHistory(newStrategy.id);

      expect(history).toEqual([]);
    });
  });

  // ============================================================================
  // Backtest Comparison Tests
  // ============================================================================

  describe('compareBacktests', () => {
    it('should_compare_multiple_backtests', async () => {
      const config1: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result1 = await backtestService.runBacktest(config1);

      // Create another strategy
      const strategy2 = await strategyService.createStrategy({
        userId,
        name: 'Test Mean Reversion',
        type: 'mean_reversion',
        config: {
          symbols: ['BTC/USDT'],
          bollingerPeriod: 3,
          bollingerStdDev: 2,
        },
      });

      const config2: BacktestConfig = {
        strategyId: strategy2.id,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result2 = await backtestService.runBacktest(config2);

      const comparison = backtestService.compareBacktests([result1, result2]);

      expect(comparison.length).toBe(2);
      expect(comparison[0].backtestId).toBeDefined();
      expect(comparison[0].strategyName).toBeDefined();
      expect(comparison[0].totalReturn).toBeDefined();
      expect(comparison[0].sharpeRatio).toBeDefined();
    });
  });

  // ============================================================================
  // Risk Analysis Tests
  // ============================================================================

  describe('analyzeRisk', () => {
    it('should_calculate_var', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);
      const riskAnalysis = backtestService.analyzeRisk(result);

      expect(typeof riskAnalysis.valueAtRisk95).toBe('number');
      expect(typeof riskAnalysis.valueAtRisk99).toBe('number');
    });

    it('should_calculate_sortino_ratio', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);
      const riskAnalysis = backtestService.analyzeRisk(result);

      expect(typeof riskAnalysis.sortinoRatio).toBe('number');
    });

    it('should_calculate_calmar_ratio', async () => {
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        initialCapital: 10000,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);
      const riskAnalysis = backtestService.analyzeRisk(result);

      expect(typeof riskAnalysis.calmarRatio).toBe('number');
    });
  });

  // ============================================================================
  // Tier Limits Tests
  // ============================================================================

  describe('Tier Limits', () => {
    it('should_limit_backtest_period_for_free_tier', async () => {
      const freeUser = await db.users.create({
        email: 'free@example.com',
        passwordHash: 'hash',
        tier: 'free',
      });

      const freeStrategy = await strategyService.createStrategy({
        userId: freeUser.id,
        name: 'Free Strategy',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      // Try to backtest more than 30 days (free limit)
      const config: BacktestConfig = {
        strategyId: freeStrategy.id,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-01'), // 60 days
        initialCapital: 10000,
        data: sampleData,
      };

      await expect(backtestService.runBacktest(config)).rejects.toThrow('Backtest period exceeds free tier limit');
    });

    it('should_allow_longer_period_for_pro_tier', async () => {
      // Default user is pro tier
      const config: BacktestConfig = {
        strategyId,
        symbol: 'BTC/USDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-06-01'), // 5 months
        initialCapital: 10000,
        data: sampleData,
      };

      // Should not throw
      const result = await backtestService.runBacktest(config);
      expect(result.status).toBe('completed');
    });
  });
});
