/**
 * StrategyGraphService - Phase 21: Pattern Intelligence
 *
 * Uses RuVector for intelligent strategy operations:
 * - Strategy recommendations based on current market regime
 * - Similar strategy discovery
 * - Strategy explanation and performance analysis
 * - Regime-based strategy matching
 */

import { RuVectorClient, VectorSearchQuery } from './RuVectorClient';

// ============================================================================
// Types
// ============================================================================

export interface StrategyGraphConfig {
  embeddingDimension: number;
  strategyIndex: string;
  regimeIndex: string;
}

export interface StrategyGraphOptions {
  client: RuVectorClient;
  db: any;
  config: StrategyGraphConfig;
}

export interface RegimeContext {
  volatility: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  liquidity: 'high' | 'medium' | 'low';
  indicators?: Record<string, number>;
}

export interface RecommendationRequest {
  tenantId: string;
  userId: string;
  currentRegime: RegimeContext;
  userTier?: string;
  limit?: number;
}

export interface StrategyRecommendation {
  strategyId: string;
  name: string;
  confidence: number;
  expectedReturn?: number;
  expectedSharpe?: number;
  explanation: string;
  tier?: string;
}

export interface SimilarStrategyRequest {
  strategyId: string;
  tenantId: string;
  limit?: number;
}

export interface SimilarStrategy {
  strategyId: string;
  name: string;
  similarity: number;
  keyDifferences?: string[];
}

export interface ExplainRequest {
  strategyId: string;
  tenantId: string;
}

export interface StrategyExplanation {
  strategyId: string;
  name: string;
  summary: string;
  performanceFactors: PerformanceFactor[];
  bestRegimes: RegimePerformance[];
  worstRegimes: RegimePerformance[];
  riskWarnings: string[];
  similarStrategies: string[];
}

export interface PerformanceFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

export interface RegimePerformance {
  regime: string;
  performance: number;
  description: string;
}

export interface RegimeSearchRequest {
  tenantId: string;
  regime: Partial<RegimeContext>;
  minPerformance?: { sharpeRatio?: number; totalReturn?: number };
  limit?: number;
}

export interface RegimeSearchResult {
  strategies: {
    strategyId: string;
    name: string;
    performance: { sharpeRatio?: number; totalReturn?: number };
    regimeMatch: number;
  }[];
}

// ============================================================================
// StrategyGraphService Implementation
// ============================================================================

export class StrategyGraphService {
  private client: RuVectorClient;
  private db: any;
  private config: StrategyGraphConfig;

  constructor(options: StrategyGraphOptions) {
    this.client = options.client;
    this.db = options.db;
    this.config = options.config;
  }

  // ============================================================================
  // Strategy Recommendations
  // ============================================================================

  /**
   * Recommend strategies based on current market regime
   */
  async recommendForRegime(request: RecommendationRequest): Promise<StrategyRecommendation[]> {
    const { tenantId, userTier, currentRegime, limit = 5 } = request;

    // Generate regime embedding for search
    const regimeEmbedding = this.generateRegimeEmbedding(currentRegime);

    // Search for strategies that performed well in similar regimes
    const searchResults = await this.client.search(this.config.strategyIndex, {
      vector: regimeEmbedding,
      topK: limit * 2, // Get extra to filter
      filter: { tenantId },
    });

    // Process and filter results
    const recommendations: StrategyRecommendation[] = [];

    for (const result of searchResults) {
      const metadata = result.metadata || {};

      // Skip if tier mismatch (pro strategies for free users)
      if (userTier === 'free' && metadata.tier === 'pro') {
        continue;
      }

      const backtestMetrics = metadata.backtestMetrics as any || {};

      recommendations.push({
        strategyId: (metadata.strategyId as string) || result.id,
        name: (metadata.name as string) || 'Unknown Strategy',
        confidence: result.score,
        expectedReturn: backtestMetrics.totalReturn,
        expectedSharpe: backtestMetrics.sharpeRatio,
        explanation: this.generateRecommendationExplanation(result.score, currentRegime, backtestMetrics),
        tier: metadata.tier as string | undefined,
      });

      if (recommendations.length >= limit) break;
    }

    return recommendations;
  }

  /**
   * Generate explanation for a recommendation
   */
  private generateRecommendationExplanation(
    score: number,
    regime: RegimeContext,
    metrics: any
  ): string {
    const parts: string[] = [];

    parts.push(`This strategy has ${Math.round(score * 100)}% similarity to strategies that performed well in similar market conditions.`);

    if (regime.trend !== 'neutral') {
      parts.push(`Current ${regime.trend} trend aligns with this strategy's historical strength.`);
    }

    if (metrics.totalReturn) {
      parts.push(`Historical return: ${(metrics.totalReturn * 100).toFixed(1)}%.`);
    }

    if (metrics.maxDrawdown) {
      parts.push(`Max drawdown: ${(metrics.maxDrawdown * 100).toFixed(1)}%.`);
    }

    return parts.join(' ');
  }

  // ============================================================================
  // Strategy Similarity
  // ============================================================================

  /**
   * Find strategies similar to a given strategy
   */
  async findSimilarStrategies(request: SimilarStrategyRequest): Promise<SimilarStrategy[]> {
    const { strategyId, tenantId, limit = 5 } = request;

    // Get the source strategy
    const strategy = await this.db.strategies.findById(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    // Get backtests for embedding
    const backtests = await this.db.backtests.findByStrategyId(strategyId);

    // Generate embedding for the strategy
    const embedding = this.generateStrategyEmbedding(strategy, backtests);

    // Search for similar strategies
    const searchResults = await this.client.search(this.config.strategyIndex, {
      vector: embedding,
      topK: limit + 1, // +1 to exclude self
      filter: { tenantId },
    });

    // Filter out the source strategy and map results
    return searchResults
      .filter(r => (r.metadata?.strategyId || r.id) !== strategyId)
      .slice(0, limit)
      .map(r => ({
        strategyId: (r.metadata?.strategyId as string) || r.id,
        name: (r.metadata?.name as string) || 'Unknown',
        similarity: r.score,
      }));
  }

  // ============================================================================
  // Strategy Explanation
  // ============================================================================

  /**
   * Generate a comprehensive explanation for a strategy
   */
  async explainStrategy(request: ExplainRequest): Promise<StrategyExplanation> {
    const { strategyId, tenantId } = request;

    // Get strategy details
    const strategy = await this.db.strategies.findById(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    // Get backtest results
    const backtests = await this.db.backtests.findByStrategyId(strategyId);
    const bestBacktest = this.selectBestBacktest(backtests);

    // Get regime performance
    const regimeResults = await this.client.search(this.config.regimeIndex, {
      vector: this.generateStrategyEmbedding(strategy, backtests),
      topK: 10,
      filter: { tenantId },
    });

    // Build explanation
    const performanceFactors = this.analyzePerformanceFactors(bestBacktest);
    const riskWarnings = this.generateRiskWarnings(bestBacktest);
    const { bestRegimes, worstRegimes } = this.analyzeRegimePerformance(regimeResults);

    return {
      strategyId,
      name: strategy.name,
      summary: this.generateStrategySummary(strategy, bestBacktest),
      performanceFactors,
      bestRegimes,
      worstRegimes,
      riskWarnings,
      similarStrategies: [],
    };
  }

  /**
   * Generate a summary for a strategy
   */
  private generateStrategySummary(strategy: any, backtest: any): string {
    const parts: string[] = [];

    parts.push(`${strategy.name} is a ${strategy.description || 'trading strategy'}.`);

    if (backtest) {
      if (backtest.totalReturn) {
        parts.push(`It has achieved ${(backtest.totalReturn * 100).toFixed(1)}% return in backtesting.`);
      }
      if (backtest.sharpeRatio) {
        parts.push(`Sharpe ratio: ${backtest.sharpeRatio.toFixed(2)}.`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Analyze performance factors
   */
  private analyzePerformanceFactors(backtest: any): PerformanceFactor[] {
    if (!backtest) return [];

    const factors: PerformanceFactor[] = [];

    if (backtest.sharpeRatio > 1.5) {
      factors.push({
        factor: 'Risk-Adjusted Returns',
        impact: 'positive',
        description: `Strong Sharpe ratio of ${backtest.sharpeRatio.toFixed(2)} indicates good risk-adjusted performance.`,
      });
    }

    if (backtest.winRate > 0.55) {
      factors.push({
        factor: 'Win Rate',
        impact: 'positive',
        description: `Win rate of ${(backtest.winRate * 100).toFixed(1)}% shows consistent profitability.`,
      });
    } else if (backtest.winRate && backtest.winRate < 0.45) {
      factors.push({
        factor: 'Win Rate',
        impact: 'negative',
        description: `Low win rate of ${(backtest.winRate * 100).toFixed(1)}% may indicate inconsistent signals.`,
      });
    }

    return factors;
  }

  /**
   * Generate risk warnings
   */
  private generateRiskWarnings(backtest: any): string[] {
    const warnings: string[] = [];

    if (!backtest) return warnings;

    if (backtest.maxDrawdown && backtest.maxDrawdown > 0.20) {
      warnings.push(`High maximum drawdown of ${(backtest.maxDrawdown * 100).toFixed(1)}% - significant capital at risk.`);
    }

    if (backtest.winRate && backtest.winRate < 0.45) {
      warnings.push(`Low win rate may require strict risk management.`);
    }

    if (backtest.totalTrades && backtest.totalTrades < 50) {
      warnings.push(`Limited sample size (${backtest.totalTrades} trades) - results may not be statistically significant.`);
    }

    return warnings;
  }

  /**
   * Analyze regime performance
   */
  private analyzeRegimePerformance(regimeResults: any[]): {
    bestRegimes: RegimePerformance[];
    worstRegimes: RegimePerformance[];
  } {
    // Map regime results to performance
    const regimePerf = regimeResults.map(r => ({
      regime: this.describeRegime(r.metadata),
      performance: r.score,
      description: `${Math.round(r.score * 100)}% match in ${this.describeRegime(r.metadata)} conditions.`,
    }));

    // Sort and split
    regimePerf.sort((a, b) => b.performance - a.performance);

    return {
      bestRegimes: regimePerf.slice(0, 3),
      worstRegimes: regimePerf.slice(-3).reverse(),
    };
  }

  /**
   * Describe a regime
   */
  private describeRegime(metadata: any): string {
    if (!metadata) return 'unknown';

    const parts: string[] = [];
    if (metadata.trend) parts.push(metadata.trend);
    if (metadata.volatility) {
      parts.push(metadata.volatility > 0.05 ? 'high volatility' : 'low volatility');
    }
    return parts.join(', ') || 'mixed';
  }

  // ============================================================================
  // Regime Search
  // ============================================================================

  /**
   * Find strategies that perform well in a specific regime
   */
  async findStrategiesForRegime(request: RegimeSearchRequest): Promise<RegimeSearchResult> {
    const { tenantId, regime, minPerformance, limit = 10 } = request;

    // Generate regime embedding
    const regimeEmbedding = this.generateRegimeEmbedding(regime as RegimeContext);

    // Search
    const results = await this.client.search(this.config.strategyIndex, {
      vector: regimeEmbedding,
      topK: limit * 2,
      filter: { tenantId },
    });

    // Filter by minimum performance
    const strategies = results
      .filter(r => {
        const metrics = (r.metadata?.backtestMetrics as any) || {};
        if (minPerformance?.sharpeRatio && (metrics.sharpeRatio || 0) < minPerformance.sharpeRatio) {
          return false;
        }
        if (minPerformance?.totalReturn && (metrics.totalReturn || 0) < minPerformance.totalReturn) {
          return false;
        }
        return true;
      })
      .slice(0, limit)
      .map(r => {
        const metrics = (r.metadata?.backtestMetrics as any) || {};
        return {
          strategyId: (r.metadata?.strategyId as string) || r.id,
          name: (r.metadata?.name as string) || 'Unknown',
          performance: {
            sharpeRatio: metrics.sharpeRatio,
            totalReturn: metrics.totalReturn,
          },
          regimeMatch: r.score,
        };
      });

    return { strategies };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate embedding for a regime
   */
  private generateRegimeEmbedding(regime: RegimeContext): number[] {
    const dim = this.config.embeddingDimension;
    const embedding = new Array(dim).fill(0);

    // Volatility
    embedding[0] = regime.volatility || 0;

    // Trend encoding
    embedding[1] = regime.trend === 'bullish' ? 1 : regime.trend === 'bearish' ? -1 : 0;

    // Liquidity encoding
    embedding[2] = regime.liquidity === 'high' ? 1 : regime.liquidity === 'medium' ? 0.5 : 0;

    // Indicators
    if (regime.indicators) {
      let i = 3;
      for (const [_, value] of Object.entries(regime.indicators)) {
        if (i < dim / 2) {
          embedding[i] = Math.tanh(value);
          i++;
        }
      }
    }

    return this.normalizeVector(embedding);
  }

  /**
   * Generate embedding for a strategy
   */
  private generateStrategyEmbedding(strategy: any, backtests: any[]): number[] {
    const dim = this.config.embeddingDimension;
    const embedding = new Array(dim).fill(0);

    // Text-based features
    const text = `${strategy.name} ${strategy.description || ''}`.toLowerCase();
    const textHash = this.simpleHash(text);

    for (let i = 0; i < dim / 4; i++) {
      embedding[i] = ((textHash >> (i % 32)) & 1) ? 0.1 : -0.1;
    }

    // Performance-based features
    const bestBacktest = this.selectBestBacktest(backtests);
    if (bestBacktest) {
      const metricsStart = Math.floor(dim / 4);
      embedding[metricsStart] = bestBacktest.totalReturn || 0;
      embedding[metricsStart + 1] = bestBacktest.sharpeRatio || 0;
      embedding[metricsStart + 2] = bestBacktest.maxDrawdown || 0;
      embedding[metricsStart + 3] = bestBacktest.winRate || 0;
    }

    return this.normalizeVector(embedding);
  }

  /**
   * Select the best backtest result
   */
  private selectBestBacktest(backtests: any[]): any | null {
    if (!backtests || backtests.length === 0) return null;

    return backtests.reduce((best, current) => {
      const bestScore = (best.sharpeRatio || 0) * (best.totalReturn || 0);
      const currentScore = (current.sharpeRatio || 0) * (current.totalReturn || 0);
      return currentScore > bestScore ? current : best;
    });
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) return vector;
    return vector.map((v) => v / magnitude);
  }
}
