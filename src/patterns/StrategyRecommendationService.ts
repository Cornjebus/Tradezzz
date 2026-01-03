import type { NeonDatabase } from '../database/NeonDatabase';
import type { RuVectorClient } from './RuVectorClient';

export interface StrategyRecommendation {
  strategyId: string;
  name: string;
  score: number;
  symbols: string[];
  metrics: {
    totalReturn: number | null;
    maxDrawdown: number | null;
    winRate: number | null;
    sharpeRatio: number | null;
  };
  reason?: string;
}

export class StrategyRecommendationService {
  private readonly db: NeonDatabase;
  private readonly client: RuVectorClient | null;

  constructor(db: NeonDatabase, client: RuVectorClient | null) {
    this.db = db;
    this.client = client;
  }

  /**
   * Recommend strategies for a user. Initial implementation uses Neon
   * backtest metrics to compute a simple score:
   *
   *   score = totalReturn - maxDrawdown
   *
   * When RuVector is available, this can be extended to incorporate
   * similarity search and regime-aware scoring.
   */
  async recommendForUser(userId: string, limit = 5): Promise<StrategyRecommendation[]> {
    const rows = await this.db.strategies.findByUserId(userId);
    if (!rows || rows.length === 0) return [];

    const recommendations: StrategyRecommendation[] = [];

    for (const row of rows) {
      let latest: any | null = null;
      let metrics: any = {};

      if (this.db.backtests && typeof this.db.backtests.findByStrategyId === 'function') {
        const bts = await this.db.backtests.findByStrategyId(row.id);
        const completed = bts.filter((b: any) => b.status === 'completed');
        if (completed.length > 0) {
          latest = completed[completed.length - 1];
          metrics = latest.metrics || {};
        }
      }

      const totalReturn =
        typeof metrics.totalReturn === 'number' ? metrics.totalReturn : null;
      const maxDrawdown =
        typeof metrics.maxDrawdown === 'number' ? metrics.maxDrawdown : null;
      const winRate = typeof metrics.winRate === 'number' ? metrics.winRate : null;
      const sharpeRatio =
        typeof metrics.sharpeRatio === 'number' ? metrics.sharpeRatio : null;

      const score =
        totalReturn !== null && maxDrawdown !== null
          ? totalReturn - maxDrawdown
          : 0;

      const configSymbols = Array.isArray((row.config as any).symbols)
        ? ((row.config as any).symbols as string[])
        : [];

      recommendations.push({
        strategyId: row.id,
        name: row.name,
        score,
        symbols: configSymbols,
        metrics: {
          totalReturn,
          maxDrawdown,
          winRate,
          sharpeRatio,
        },
        reason:
          totalReturn !== null && maxDrawdown !== null
            ? `Total return ${totalReturn.toFixed(
                1,
              )}%, max drawdown ${maxDrawdown.toFixed(1)}%`
            : 'Insufficient backtest data; using default score',
      });
    }

    // If RuVector is available, let it propose an ordering by similarity to a
    // simple "ideal" performance vector. We still enforce per-user strategies.
    if (this.client) {
      try {
        const idealVector = this.buildPreferenceVector();
        const results = await this.client.search('strategies', {
          vector: idealVector,
          topK: limit,
          namespace: 'strategies',
          filter: { userId },
        });

        if (results && results.length > 0) {
          const order = new Map<string, number>();
          results.forEach((r, idx) => order.set(r.id, idx));

          recommendations.sort((a, b) => {
            const ia = order.get(a.strategyId);
            const ib = order.get(b.strategyId);
            if (ia !== undefined && ib !== undefined) return ia - ib;
            if (ia !== undefined) return -1;
            if (ib !== undefined) return 1;
            return 0;
          });
        }
      } catch {
        // If RuVector is unavailable or misconfigured, fall back to local scoring.
      }
    }

    recommendations.sort((a, b) => b.score - a.score);
    return recommendations.slice(0, limit);
  }

  /**
   * Idealized performance vector for similarity search in RuVector.
   * High return, low drawdown, decent win rate and Sharpe/profit factor.
   */
  private buildPreferenceVector(): number[] {
    const totalReturn = 40; // 40%
    const maxDrawdown = 10; // 10%
    const winRate = 55; // 55%
    const sharpeRatio = 1.5;
    const profitFactor = 1.8;

    const normReturn = totalReturn / 100;
    const normDrawdown = maxDrawdown / 100;
    const normWinRate = winRate / 100;
    const logSharpe = Math.log1p(Math.max(0, sharpeRatio));
    const logProfitFactor = Math.log1p(Math.max(0, profitFactor));

    return [normReturn, normDrawdown, normWinRate, logSharpe, logProfitFactor];
  }
}
