/**
 * PatternStoreService Tests - Phase 21: Pattern Intelligence
 * TDD Red Phase - Write tests first
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PatternStoreService, PatternStoreConfig } from './PatternStoreService';
import { RuVectorClient } from './RuVectorClient';

// Mock RuVectorClient
const createMockRuVectorClient = () => ({
  ping: vi.fn().mockResolvedValue({ status: 'ok' }),
  upsertVectors: vi.fn().mockResolvedValue(undefined),
  search: vi.fn().mockResolvedValue([]),
});

// Mock Database
const createMockDb = () => ({
  strategies: {
    findById: vi.fn(),
    findByUserId: vi.fn().mockResolvedValue([]),
  },
  backtests: {
    findByStrategyId: vi.fn().mockResolvedValue([]),
  },
  orders: {
    findByUserId: vi.fn().mockResolvedValue([]),
  },
});

describe('PatternStoreService', () => {
  let service: PatternStoreService;
  let mockClient: ReturnType<typeof createMockRuVectorClient>;
  let mockDb: ReturnType<typeof createMockDb>;
  let config: PatternStoreConfig;

  beforeEach(() => {
    mockClient = createMockRuVectorClient();
    mockDb = createMockDb();
    config = {
      embeddingDimension: 768,
      strategyIndex: 'strategies',
      tradeIndex: 'trades',
      regimeIndex: 'regimes',
    };

    service = new PatternStoreService({
      client: mockClient as unknown as RuVectorClient,
      db: mockDb,
      config,
    });
  });

  // ============================================================================
  // Strategy Ingestion Tests
  // ============================================================================

  describe('strategy ingestion', () => {
    it('should_ingest_strategy_to_ruvector', async () => {
      const strategy = {
        id: 'strategy-1',
        userId: 'user-1',
        name: 'Momentum Strategy',
        description: 'A trend-following momentum strategy',
        config: { symbols: ['BTC/USDT'], timeframe: '1h' },
        createdAt: new Date(),
      };

      mockDb.strategies.findById.mockResolvedValue(strategy);
      mockDb.backtests.findByStrategyId.mockResolvedValue([
        { id: 'bt-1', totalReturn: 0.25, sharpeRatio: 1.5, maxDrawdown: 0.1 },
      ]);

      const result = await service.ingestStrategy('strategy-1', 'tenant-1');

      expect(result.success).toBe(true);
      expect(mockClient.upsertVectors).toHaveBeenCalled();
    });

    it('should_include_backtest_metrics_in_embedding', async () => {
      const strategy = {
        id: 'strategy-1',
        userId: 'user-1',
        name: 'Test Strategy',
        config: {},
      };

      const backtests = [
        { id: 'bt-1', totalReturn: 0.30, sharpeRatio: 2.0, maxDrawdown: 0.05, winRate: 0.65 },
      ];

      mockDb.strategies.findById.mockResolvedValue(strategy);
      mockDb.backtests.findByStrategyId.mockResolvedValue(backtests);

      await service.ingestStrategy('strategy-1', 'tenant-1');

      const upsertCall = mockClient.upsertVectors.mock.calls[0];
      expect(upsertCall[0][0].metadata.backtestMetrics).toBeDefined();
    });

    it('should_fail_if_strategy_not_found', async () => {
      mockDb.strategies.findById.mockResolvedValue(null);

      const result = await service.ingestStrategy('nonexistent', 'tenant-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ============================================================================
  // Trade Ingestion Tests
  // ============================================================================

  describe('trade ingestion', () => {
    it('should_ingest_trades_for_user', async () => {
      const trades = [
        { id: 'trade-1', symbol: 'BTC/USDT', side: 'buy', price: 50000, amount: 0.1, pnl: 500 },
        { id: 'trade-2', symbol: 'ETH/USDT', side: 'sell', price: 3000, amount: 1, pnl: -100 },
      ];

      mockDb.orders.findByUserId.mockResolvedValue(trades);

      const result = await service.ingestTradesForUser('user-1', 'tenant-1');

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });

    it('should_include_trade_features_in_embedding', async () => {
      const trades = [
        {
          id: 'trade-1',
          symbol: 'BTC/USDT',
          side: 'buy',
          price: 50000,
          amount: 0.1,
          pnl: 500,
          createdAt: new Date(),
        },
      ];

      mockDb.orders.findByUserId.mockResolvedValue(trades);

      await service.ingestTradesForUser('user-1', 'tenant-1');

      expect(mockClient.upsertVectors).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Regime Ingestion Tests
  // ============================================================================

  describe('regime ingestion', () => {
    it('should_ingest_regime_snapshot', async () => {
      const regimeData = {
        symbol: 'BTC/USDT',
        timestamp: new Date(),
        volatility: 0.05,
        trend: 'bullish' as const,
        liquidity: 'high' as const,
        indicators: { rsi: 65, macd: 0.002 },
      };

      const result = await service.ingestRegimeSnapshot(regimeData, 'tenant-1');

      expect(result.success).toBe(true);
      expect(mockClient.upsertVectors).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Batch Operations Tests
  // ============================================================================

  describe('batch operations', () => {
    it('should_rebuild_pattern_graph', async () => {
      // Reset mocks for this specific test
      mockDb.strategies.findByUserId.mockResolvedValue([
        { id: 'strategy-1', userId: 'user-1', name: 'S1' },
        { id: 'strategy-2', userId: 'user-1', name: 'S2' },
      ]);
      mockDb.strategies.findById
        .mockResolvedValueOnce({ id: 'strategy-1', userId: 'user-1', name: 'S1' })
        .mockResolvedValueOnce({ id: 'strategy-2', userId: 'user-1', name: 'S2' });
      mockDb.orders.findByUserId.mockResolvedValue([
        { id: 'trade-1', symbol: 'BTC/USDT', side: 'buy', price: 50000, amount: 0.1 },
      ]);
      mockDb.backtests.findByStrategyId.mockResolvedValue([]);

      const result = await service.rebuildForTenant('tenant-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.strategiesIngested).toBe(2);
      expect(result.tradesIngested).toBe(1);
    });
  });

  // ============================================================================
  // Health Check Tests
  // ============================================================================

  describe('health check', () => {
    it('should_return_healthy_when_ruvector_is_ok', async () => {
      mockClient.ping.mockResolvedValue({ status: 'ok' });

      const health = await service.checkHealth();

      expect(health.healthy).toBe(true);
    });

    it('should_return_unhealthy_when_ruvector_is_down', async () => {
      mockClient.ping.mockResolvedValue({ status: 'unhealthy' });

      const health = await service.checkHealth();

      expect(health.healthy).toBe(false);
    });
  });
});
