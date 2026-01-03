/**
 * PatternStoreService - Phase 21: Pattern Intelligence
 *
 * Handles ingestion of data from Neon to RuVector:
 * - Strategy ingestion with backtest metrics
 * - Trade ingestion with features
 * - Regime snapshot ingestion
 * - Batch rebuild operations
 */

import { RuVectorClient, VectorUpsertInput } from './RuVectorClient';

// ============================================================================
// Types
// ============================================================================

export interface PatternStoreConfig {
  embeddingDimension: number;
  strategyIndex: string;
  tradeIndex: string;
  regimeIndex: string;
}

export interface PatternStoreOptions {
  client: RuVectorClient;
  db: any;
  config: PatternStoreConfig;
}

export interface IngestionResult {
  success: boolean;
  error?: string;
  vectorId?: string;
}

export interface TradeIngestionResult {
  success: boolean;
  count: number;
  error?: string;
}

export interface RegimeData {
  symbol: string;
  timestamp: Date;
  volatility: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  liquidity: 'high' | 'medium' | 'low';
  indicators: Record<string, number>;
}

export interface RebuildResult {
  success: boolean;
  strategiesIngested: number;
  tradesIngested: number;
  error?: string;
}

export interface HealthStatus {
  healthy: boolean;
  ruVectorStatus: string;
  lastCheck: Date;
}

// ============================================================================
// PatternStoreService Implementation
// ============================================================================

export class PatternStoreService {
  private client: RuVectorClient;
  private db: any;
  private config: PatternStoreConfig;

  constructor(options: PatternStoreOptions) {
    this.client = options.client;
    this.db = options.db;
    this.config = options.config;
  }

  // ============================================================================
  // Strategy Ingestion
  // ============================================================================

  /**
   * Ingest a strategy and its backtest data into RuVector
   */
  async ingestStrategy(strategyId: string, tenantId: string): Promise<IngestionResult> {
    try {
      const strategy = await this.db.strategies.findById(strategyId);

      if (!strategy) {
        return { success: false, error: 'Strategy not found' };
      }

      // Get backtest results
      const backtests = await this.db.backtests.findByStrategyId(strategyId);
      const bestBacktest = this.selectBestBacktest(backtests);

      // Generate embedding from strategy text + metrics
      const embedding = this.generateStrategyEmbedding(strategy, bestBacktest);

      // Create vector for upsert
      const vector: VectorUpsertInput = {
        id: `strategy-${strategyId}`,
        vector: embedding,
        metadata: {
          type: 'Strategy',
          strategyId,
          userId: strategy.userId,
          tenantId,
          name: strategy.name,
          description: strategy.description,
          config: strategy.config,
          backtestMetrics: bestBacktest ? {
            totalReturn: bestBacktest.totalReturn,
            sharpeRatio: bestBacktest.sharpeRatio,
            maxDrawdown: bestBacktest.maxDrawdown,
            winRate: bestBacktest.winRate,
          } : null,
          createdAt: strategy.createdAt,
        },
        namespace: tenantId,
      };

      await this.client.upsertVectors([vector], this.config.strategyIndex);

      return { success: true, vectorId: vector.id };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Generate embedding for a strategy
   */
  private generateStrategyEmbedding(strategy: any, backtest: any): number[] {
    const dim = this.config.embeddingDimension;
    const embedding = new Array(dim).fill(0);

    // Text-based features (simulated - in production, use an embedding model)
    const text = `${strategy.name} ${strategy.description || ''}`.toLowerCase();
    const textHash = this.simpleHash(text);

    for (let i = 0; i < dim / 4; i++) {
      embedding[i] = ((textHash >> (i % 32)) & 1) ? 0.1 : -0.1;
    }

    // Performance-based features
    if (backtest) {
      const metricsStart = Math.floor(dim / 4);
      embedding[metricsStart] = backtest.totalReturn || 0;
      embedding[metricsStart + 1] = backtest.sharpeRatio || 0;
      embedding[metricsStart + 2] = backtest.maxDrawdown || 0;
      embedding[metricsStart + 3] = backtest.winRate || 0;
    }

    // Normalize
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

  // ============================================================================
  // Trade Ingestion
  // ============================================================================

  /**
   * Ingest trades for a user
   */
  async ingestTradesForUser(userId: string, tenantId: string): Promise<TradeIngestionResult> {
    try {
      const trades = await this.db.orders.findByUserId(userId);

      if (!trades || trades.length === 0) {
        return { success: true, count: 0 };
      }

      const vectors: VectorUpsertInput[] = trades.map((trade: any) => ({
        id: `trade-${trade.id}`,
        vector: this.generateTradeEmbedding(trade),
        metadata: {
          type: 'Trade',
          tradeId: trade.id,
          userId,
          tenantId,
          symbol: trade.symbol,
          side: trade.side,
          price: trade.price,
          amount: trade.amount,
          pnl: trade.pnl,
          createdAt: trade.createdAt,
        },
        namespace: tenantId,
      }));

      await this.client.upsertVectors(vectors, this.config.tradeIndex);

      return { success: true, count: trades.length };
    } catch (error) {
      return { success: false, count: 0, error: (error as Error).message };
    }
  }

  /**
   * Generate embedding for a trade
   */
  private generateTradeEmbedding(trade: any): number[] {
    const dim = this.config.embeddingDimension;
    const embedding = new Array(dim).fill(0);

    // Symbol hash
    const symbolHash = this.simpleHash(trade.symbol || '');
    embedding[0] = (symbolHash & 0xFF) / 255;
    embedding[1] = ((symbolHash >> 8) & 0xFF) / 255;

    // Side (buy = 1, sell = -1)
    embedding[2] = trade.side === 'buy' ? 1 : -1;

    // Price (normalized)
    embedding[3] = Math.log10(trade.price || 1) / 6;

    // Amount (normalized)
    embedding[4] = Math.tanh(trade.amount || 0);

    // PnL (normalized)
    embedding[5] = Math.tanh((trade.pnl || 0) / 1000);

    return this.normalizeVector(embedding);
  }

  // ============================================================================
  // Regime Ingestion
  // ============================================================================

  /**
   * Ingest a market regime snapshot
   */
  async ingestRegimeSnapshot(data: RegimeData, tenantId: string): Promise<IngestionResult> {
    try {
      const embedding = this.generateRegimeEmbedding(data);
      const id = `regime-${data.symbol}-${data.timestamp.getTime()}`;

      const vector: VectorUpsertInput = {
        id,
        vector: embedding,
        metadata: {
          type: 'Regime',
          symbol: data.symbol,
          tenantId,
          timestamp: data.timestamp.toISOString(),
          volatility: data.volatility,
          trend: data.trend,
          liquidity: data.liquidity,
          indicators: data.indicators,
        },
        namespace: tenantId,
      };

      await this.client.upsertVectors([vector], this.config.regimeIndex);

      return { success: true, vectorId: id };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Generate embedding for a regime
   */
  private generateRegimeEmbedding(data: RegimeData): number[] {
    const dim = this.config.embeddingDimension;
    const embedding = new Array(dim).fill(0);

    // Volatility
    embedding[0] = data.volatility;

    // Trend encoding
    embedding[1] = data.trend === 'bullish' ? 1 : data.trend === 'bearish' ? -1 : 0;

    // Liquidity encoding
    embedding[2] = data.liquidity === 'high' ? 1 : data.liquidity === 'medium' ? 0.5 : 0;

    // Indicators
    let i = 3;
    for (const [key, value] of Object.entries(data.indicators)) {
      if (i < dim / 2) {
        embedding[i] = Math.tanh(value);
        i++;
      }
    }

    return this.normalizeVector(embedding);
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Rebuild the entire pattern graph for a tenant
   */
  async rebuildForTenant(tenantId: string, userId: string): Promise<RebuildResult> {
    try {
      let strategiesIngested = 0;
      let tradesIngested = 0;

      // Ingest all strategies
      const strategies = await this.db.strategies.findByUserId(userId);
      for (const strategy of strategies) {
        const result = await this.ingestStrategy(strategy.id, tenantId);
        if (result.success) strategiesIngested++;
      }

      // Ingest all trades
      const tradeResult = await this.ingestTradesForUser(userId, tenantId);
      tradesIngested = tradeResult.count;

      return {
        success: true,
        strategiesIngested,
        tradesIngested,
      };
    } catch (error) {
      return {
        success: false,
        strategiesIngested: 0,
        tradesIngested: 0,
        error: (error as Error).message,
      };
    }
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * Check health of the pattern store
   */
  async checkHealth(): Promise<HealthStatus> {
    const pingResult = await this.client.ping();

    return {
      healthy: pingResult.status === 'ok',
      ruVectorStatus: pingResult.status,
      lastCheck: new Date(),
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

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
