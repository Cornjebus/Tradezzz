/**
 * StrategyGraphService Tests - Phase 21: Pattern Intelligence
 * TDD Red Phase - Write tests first
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrategyGraphService, StrategyRecommendation, StrategyExplanation } from './StrategyGraphService';
import { RuVectorClient } from './RuVectorClient';

// Mock RuVectorClient
const createMockRuVectorClient = () => ({
  search: vi.fn().mockResolvedValue([]),
  upsertVectors: vi.fn().mockResolvedValue(undefined),
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
});

describe('StrategyGraphService', () => {
  let service: StrategyGraphService;
  let mockClient: ReturnType<typeof createMockRuVectorClient>;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockClient = createMockRuVectorClient();
    mockDb = createMockDb();

    service = new StrategyGraphService({
      client: mockClient as unknown as RuVectorClient,
      db: mockDb,
      config: {
        embeddingDimension: 768,
        strategyIndex: 'strategies',
        regimeIndex: 'regimes',
      },
    });
  });

  // ============================================================================
  // Recommendation Tests
  // ============================================================================

  describe('strategy recommendations', () => {
    it('should_recommend_strategies_based_on_current_regime', async () => {
      // Mock search to return similar strategies
      mockClient.search.mockResolvedValue([
        {
          id: 'strategy-1',
          score: 0.95,
          metadata: {
            strategyId: 'strategy-1',
            name: 'Momentum Strategy',
            backtestMetrics: { totalReturn: 0.25, sharpeRatio: 1.8 },
          },
        },
        {
          id: 'strategy-2',
          score: 0.85,
          metadata: {
            strategyId: 'strategy-2',
            name: 'Mean Reversion',
            backtestMetrics: { totalReturn: 0.15, sharpeRatio: 1.2 },
          },
        },
      ]);

      const recommendations = await service.recommendForRegime({
        tenantId: 'tenant-1',
        userId: 'user-1',
        currentRegime: {
          volatility: 0.03,
          trend: 'bullish',
          liquidity: 'high',
          indicators: { rsi: 55, macd: 0.001 },
        },
        limit: 5,
      });

      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].strategyId).toBe('strategy-1');
      expect(recommendations[0].confidence).toBeGreaterThan(0);
    });

    it('should_filter_by_user_tier', async () => {
      mockClient.search.mockResolvedValue([
        {
          id: 'strategy-1',
          score: 0.95,
          metadata: {
            strategyId: 'strategy-1',
            name: 'Pro Strategy',
            tier: 'pro',
          },
        },
      ]);

      const recommendations = await service.recommendForRegime({
        tenantId: 'tenant-1',
        userId: 'user-1',
        currentRegime: { volatility: 0.02, trend: 'neutral', liquidity: 'medium', indicators: {} },
        userTier: 'free',
        limit: 5,
      });

      // Pro strategies should be filtered for free users
      expect(recommendations.every(r => r.tier !== 'pro')).toBe(true);
    });

    it('should_include_explanation_for_each_recommendation', async () => {
      mockClient.search.mockResolvedValue([
        {
          id: 'strategy-1',
          score: 0.9,
          metadata: {
            strategyId: 'strategy-1',
            name: 'Test Strategy',
            backtestMetrics: { totalReturn: 0.20, maxDrawdown: 0.08 },
          },
        },
      ]);

      const recommendations = await service.recommendForRegime({
        tenantId: 'tenant-1',
        userId: 'user-1',
        currentRegime: { volatility: 0.02, trend: 'bullish', liquidity: 'high', indicators: {} },
        limit: 5,
      });

      expect(recommendations[0].explanation).toBeDefined();
      expect(recommendations[0].explanation).toContain('similar');
    });
  });

  // ============================================================================
  // Similarity Search Tests
  // ============================================================================

  describe('strategy similarity', () => {
    it('should_find_similar_strategies', async () => {
      mockClient.search.mockResolvedValue([
        { id: 'strategy-2', score: 0.92, metadata: { strategyId: 'strategy-2', name: 'Similar 1' } },
        { id: 'strategy-3', score: 0.88, metadata: { strategyId: 'strategy-3', name: 'Similar 2' } },
      ]);

      mockDb.strategies.findById.mockResolvedValue({
        id: 'strategy-1',
        name: 'Base Strategy',
        userId: 'user-1',
      });
      mockDb.backtests.findByStrategyId.mockResolvedValue([]);

      const similar = await service.findSimilarStrategies({
        strategyId: 'strategy-1',
        tenantId: 'tenant-1',
        limit: 5,
      });

      expect(similar).toHaveLength(2);
      expect(similar[0].similarity).toBeGreaterThan(0.5);
    });

    it('should_exclude_source_strategy_from_results', async () => {
      mockClient.search.mockResolvedValue([
        { id: 'strategy-1', score: 1.0, metadata: { strategyId: 'strategy-1' } },
        { id: 'strategy-2', score: 0.9, metadata: { strategyId: 'strategy-2' } },
      ]);

      mockDb.strategies.findById.mockResolvedValue({
        id: 'strategy-1',
        name: 'Base Strategy',
      });
      mockDb.backtests.findByStrategyId.mockResolvedValue([]);

      const similar = await service.findSimilarStrategies({
        strategyId: 'strategy-1',
        tenantId: 'tenant-1',
        limit: 5,
      });

      // Should not include the source strategy
      expect(similar.every(s => s.strategyId !== 'strategy-1')).toBe(true);
    });
  });

  // ============================================================================
  // Strategy Explanation Tests
  // ============================================================================

  describe('strategy explanation', () => {
    it('should_explain_strategy_performance', async () => {
      mockDb.strategies.findById.mockResolvedValue({
        id: 'strategy-1',
        name: 'Test Strategy',
        description: 'A momentum-based strategy',
        config: { symbols: ['BTC/USDT'], timeframe: '1h' },
      });

      mockDb.backtests.findByStrategyId.mockResolvedValue([
        {
          id: 'bt-1',
          totalReturn: 0.35,
          sharpeRatio: 2.1,
          maxDrawdown: 0.12,
          winRate: 0.58,
          totalTrades: 150,
        },
      ]);

      // Mock regime search
      mockClient.search.mockResolvedValue([
        {
          id: 'regime-1',
          score: 0.95,
          metadata: { trend: 'bullish', volatility: 0.04 },
        },
      ]);

      const explanation = await service.explainStrategy({
        strategyId: 'strategy-1',
        tenantId: 'tenant-1',
      });

      expect(explanation.strategyId).toBe('strategy-1');
      expect(explanation.summary).toBeDefined();
      expect(explanation.performanceFactors).toBeDefined();
      expect(explanation.bestRegimes).toBeDefined();
    });

    it('should_include_risk_warnings', async () => {
      mockDb.strategies.findById.mockResolvedValue({
        id: 'strategy-1',
        name: 'Risky Strategy',
      });

      mockDb.backtests.findByStrategyId.mockResolvedValue([
        { id: 'bt-1', totalReturn: 0.50, maxDrawdown: 0.35, winRate: 0.42 },
      ]);

      mockClient.search.mockResolvedValue([]);

      const explanation = await service.explainStrategy({
        strategyId: 'strategy-1',
        tenantId: 'tenant-1',
      });

      // High drawdown should trigger risk warning
      expect(explanation.riskWarnings).toBeDefined();
      expect(explanation.riskWarnings.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Regime Matching Tests
  // ============================================================================

  describe('regime matching', () => {
    it('should_find_strategies_that_perform_well_in_regime', async () => {
      mockClient.search.mockResolvedValue([
        {
          id: 'strategy-1',
          score: 0.9,
          metadata: {
            strategyId: 'strategy-1',
            name: 'Bull Runner',
            backtestMetrics: { totalReturn: 0.40, sharpeRatio: 2.5 },
          },
        },
      ]);

      const result = await service.findStrategiesForRegime({
        tenantId: 'tenant-1',
        regime: {
          trend: 'bullish',
          volatility: 0.05,
          liquidity: 'high',
        },
        minPerformance: { sharpeRatio: 1.5 },
        limit: 10,
      });

      expect(result.strategies).toHaveLength(1);
      expect(result.strategies[0].name).toBe('Bull Runner');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should_handle_strategy_not_found', async () => {
      mockDb.strategies.findById.mockResolvedValue(null);

      await expect(
        service.explainStrategy({
          strategyId: 'nonexistent',
          tenantId: 'tenant-1',
        })
      ).rejects.toThrow(/not found/i);
    });

    it('should_return_empty_recommendations_when_no_data', async () => {
      mockClient.search.mockResolvedValue([]);

      const recommendations = await service.recommendForRegime({
        tenantId: 'tenant-1',
        userId: 'user-1',
        currentRegime: { volatility: 0.02, trend: 'neutral', liquidity: 'low', indicators: {} },
        limit: 5,
      });

      expect(recommendations).toEqual([]);
    });
  });
});
