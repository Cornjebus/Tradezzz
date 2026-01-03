import type { NeonDatabase } from '../database/NeonDatabase';
import type { BacktestService, BacktestResult } from './BacktestService';

export interface StrategyRiskSummary {
  strategyId: string;
  symbol?: string;
  latestBacktestId?: string;
  completedAt?: Date;
  metrics?: {
    totalReturn?: number | null;
    maxDrawdown?: number | null;
    winRate?: number | null;
    sharpeRatio?: number | null;
  };
  risk?: {
    valueAtRisk95: number;
    valueAtRisk99: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxConsecutiveLosses: number;
  };
  status: 'ok' | 'warning' | 'blocked';
  reasons: string[];
}

export class StrategyRiskService {
  private db: NeonDatabase;
  private backtestService: BacktestService;

  constructor(deps: { db: NeonDatabase; backtestService: BacktestService }) {
    this.db = deps.db;
    this.backtestService = deps.backtestService;
  }

  /**
   * Build a structured risk summary for a strategy based on its latest
   * completed backtest stored in Neon. This is read-only and does not
   * modify strategy state or live-eligibility flags.
   */
  async getStrategyRisk(userId: string, strategyId: string): Promise<StrategyRiskSummary | null> {
    const strategy = await this.db.strategies.findById(strategyId);
    if (!strategy || strategy.user_id !== userId) {
      return null;
    }

    if (!this.db.backtests || typeof this.db.backtests.findByStrategyId !== 'function') {
      return {
        strategyId,
        status: 'blocked',
        reasons: ['Backtest store unavailable; cannot analyze risk'],
      };
    }

    const rows = await this.db.backtests.findByStrategyId(strategyId);
    const completed = rows.filter((row: any) => row.status === 'completed');

    if (completed.length === 0) {
      return {
        strategyId,
        status: 'blocked',
        reasons: ['No completed backtests; run a backtest before going live'],
      };
    }

    const latest = completed[completed.length - 1];
    const metrics = (latest.metrics || {}) as any;

    const backtestResult: BacktestResult = {
      id: latest.id,
      strategyId: latest.strategy_id,
      symbol: latest.symbol,
      startDate: latest.start_date,
      endDate: latest.end_date,
      status: latest.status,
      metrics: metrics,
      trades: metrics.trades || [],
      equityCurve: metrics.equityCurve || [],
      createdAt: latest.created_at,
    };

    const riskAnalysis = this.backtestService.analyzeRisk(backtestResult);

    const reasons: string[] = [];
    let status: StrategyRiskSummary['status'] = 'ok';

    const totalReturn = metrics.totalReturn as number | undefined;
    const maxDrawdown = metrics.maxDrawdown as number | undefined;
    const winRate = metrics.winRate as number | undefined;
    const sharpeRatio = metrics.sharpeRatio as number | undefined;

    if (totalReturn === undefined || maxDrawdown === undefined) {
      status = 'blocked';
      reasons.push('Backtest metrics incomplete; missing totalReturn or maxDrawdown');
    } else {
      if (totalReturn < 0) {
        status = 'blocked';
        reasons.push('Latest backtest has negative return');
      }
      if (maxDrawdown > 30) {
        status = 'blocked';
        reasons.push('Latest backtest max drawdown exceeds 30%');
      }
      if (winRate !== undefined && winRate < 40) {
        status = status === 'ok' ? 'warning' : status;
        reasons.push('Win rate below 40%');
      }
      if (sharpeRatio !== undefined && sharpeRatio < 0.5) {
        status = status === 'ok' ? 'warning' : status;
        reasons.push('Sharpe ratio below 0.5');
      }
    }

    if (reasons.length === 0) {
      reasons.push('Backtest metrics within configured thresholds');
    }

    return {
      strategyId,
      symbol: latest.symbol,
      latestBacktestId: latest.id,
      completedAt: latest.completed_at || latest.end_date || latest.created_at,
      metrics: {
        totalReturn: totalReturn ?? null,
        maxDrawdown: maxDrawdown ?? null,
        winRate: winRate ?? null,
        sharpeRatio: sharpeRatio ?? null,
      },
      risk: {
        valueAtRisk95: riskAnalysis.valueAtRisk95,
        valueAtRisk99: riskAnalysis.valueAtRisk99,
        sortinoRatio: riskAnalysis.sortinoRatio,
        calmarRatio: riskAnalysis.calmarRatio,
        maxConsecutiveLosses: riskAnalysis.maxConsecutiveLosses,
      },
      status,
      reasons,
    };
  }
}

