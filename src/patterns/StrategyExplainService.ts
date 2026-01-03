import type { NeonDatabase } from '../database/NeonDatabase';
import type { RuVectorClient } from './RuVectorClient';

export interface StrategyExplanationMetrics {
  totalReturn: number | null;
  maxDrawdown: number | null;
  winRate: number | null;
  sharpeRatio: number | null;
}

export interface StrategyExplanationContext {
  strategyId: string;
  name: string;
  description?: string | null;
  type?: string | null;
  symbols: string[];
  metrics?: StrategyExplanationMetrics;
}

/**
 * StrategyExplainService
 *
 * Builds a structured context object for a single strategy that can be
 * used to drive LLM-based explanations or simple rule-based summaries.
 * The first iteration uses Neon data only; RuVector can be layered in
 * later for richer regime and pattern context.
 */
export class StrategyExplainService {
  private readonly db: NeonDatabase;
  // RuVector client is accepted for future enrichment but is not yet required.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private readonly client: RuVectorClient | null;

  constructor(db: NeonDatabase, client: RuVectorClient | null) {
    this.db = db;
    this.client = client;
  }

  async buildContextForStrategy(
    userId: string,
    strategyId: string,
  ): Promise<StrategyExplanationContext> {
    const strategy = await this.db.strategies.findById(strategyId);

    if (!strategy || strategy.user_id !== userId) {
      throw new Error('Strategy not found');
    }

    const backtests = await this.db.backtests.findByStrategyId(strategyId);
    const completed = Array.isArray(backtests)
      ? backtests.filter((b: any) => b.status === 'completed')
      : [];

    let latest: any | null = null;
    if (completed.length > 0) {
      latest = completed.reduce((acc, curr) => {
        const accDate = acc
          ? new Date(acc.completed_at || acc.created_at || 0)
          : new Date(0);
        const currDate = new Date(curr.completed_at || curr.created_at || 0);
        return currDate > accDate ? curr : acc;
      }, completed[0]);
    }

    const rawConfig = (strategy as any).config || {};
    const symbols: string[] = Array.isArray((rawConfig as any).symbols)
      ? (rawConfig as any).symbols
      : [];

    let metrics: StrategyExplanationMetrics | undefined;
    if (latest && latest.metrics) {
      const m = latest.metrics as any;
      metrics = {
        totalReturn:
          typeof m.totalReturn === 'number' ? m.totalReturn : null,
        maxDrawdown:
          typeof m.maxDrawdown === 'number' ? m.maxDrawdown : null,
        winRate: typeof m.winRate === 'number' ? m.winRate : null,
        sharpeRatio:
          typeof m.sharpeRatio === 'number' ? m.sharpeRatio : null,
      };
    }

    return {
      strategyId: strategy.id,
      name: strategy.name,
      description: strategy.description,
      type: strategy.type,
      symbols,
      metrics,
    };
  }
}

