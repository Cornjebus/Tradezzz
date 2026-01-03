import type { NeonDatabase } from '../database/NeonDatabase';
import type { RuVectorClient, VectorUpsertInput } from './RuVectorClient';

export interface PatternIngestionServiceOptions {
  db: NeonDatabase;
  client: RuVectorClient;
  tenantId: string;
}

/**
 * PatternIngestionService
 *
 * Streams selected Neon entities (strategies, backtests, trades, positions)
 * into RuVector as vectors with metadata. This first version focuses on
 * strategies + their latest completed backtest so that similarity search
 * and recommendations have a numeric basis without requiring LLM embeddings.
 */
export class PatternIngestionService {
  private readonly db: NeonDatabase;
  private readonly client: RuVectorClient;
  private readonly tenantId: string;

  constructor(options: PatternIngestionServiceOptions) {
    this.db = options.db;
    this.client = options.client;
    this.tenantId = options.tenantId;
  }

  /**
   * Ingest a single strategy and its latest completed backtest into RuVector.
   * Creates/updates a single vector in the "strategies" index keyed by
   * the strategy id.
   */
  async ingestStrategy(strategyId: string): Promise<void> {
    const strategy = await this.db.strategies.findById(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    let latestBacktest: any | null = null;
    let metrics: any = {};

    if (this.db.backtests && typeof this.db.backtests.findByStrategyId === 'function') {
      const rows = await this.db.backtests.findByStrategyId(strategyId);
      const completed = rows.filter((row: any) => row.status === 'completed');
      if (completed.length > 0) {
        latestBacktest = completed[completed.length - 1];
        metrics = latestBacktest.metrics || {};
      }
    }

    const vector = this.buildStrategyVector(metrics);

    const payload: VectorUpsertInput = {
      id: strategy.id,
      vector,
      namespace: 'strategies',
      metadata: {
        tenantId: this.tenantId,
        type: 'strategy',
        strategyId: strategy.id,
        userId: strategy.user_id,
        name: strategy.name,
        description: strategy.description,
        typeLabel: strategy.type,
        status: strategy.status,
        executionMode: (strategy as any).execution_mode || null,
        symbols: Array.isArray((strategy.config as any).symbols)
          ? (strategy.config as any).symbols
          : [],
        metrics: {
          totalReturn: metrics.totalReturn ?? null,
          maxDrawdown: metrics.maxDrawdown ?? null,
          winRate: metrics.winRate ?? null,
          sharpeRatio: metrics.sharpeRatio ?? null,
          profitFactor: metrics.profitFactor ?? null,
        },
        latestBacktestId: latestBacktest ? latestBacktest.id : null,
        latestBacktestCompletedAt: latestBacktest
          ? latestBacktest.completed_at || latestBacktest.end_date || latestBacktest.created_at
          : null,
      },
    };

    await this.client.upsertVectors([payload], 'strategies');
  }

  /**
   * Build a simple numeric feature vector from backtest metrics.
   * This does not rely on LLM embeddings and is safe for CI.
   */
  private buildStrategyVector(metrics: any): number[] {
    const totalReturn = typeof metrics.totalReturn === 'number' ? metrics.totalReturn : 0;
    const maxDrawdown = typeof metrics.maxDrawdown === 'number' ? metrics.maxDrawdown : 0;
    const winRate = typeof metrics.winRate === 'number' ? metrics.winRate : 0;
    const sharpe = typeof metrics.sharpeRatio === 'number' ? metrics.sharpeRatio : 0;
    const profitFactor = typeof metrics.profitFactor === 'number' ? metrics.profitFactor : 1;

    // Normalize some metrics to reasonable ranges; keep it simple and
    // deterministic for now.
    const normReturn = totalReturn / 100;
    const normDrawdown = maxDrawdown / 100;
    const normWinRate = winRate / 100;
    const logSharpe = Math.log1p(Math.max(0, sharpe));
    const logProfitFactor = Math.log1p(Math.max(0, profitFactor));

    return [normReturn, normDrawdown, normWinRate, logSharpe, logProfitFactor];
  }
}

