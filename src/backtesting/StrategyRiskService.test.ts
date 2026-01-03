import { describe, it, expect, beforeEach } from 'vitest';
import type { NeonDatabase } from '../database/NeonDatabase';
import { StrategyRiskService } from './StrategyRiskService';

function createStubDb() {
  const db: any = {
    _strategies: [] as any[],
    _backtests: [] as any[],
    strategies: {
      findById: async (id: string) => db._strategies.find((s: any) => s.id === id) || null,
    },
    backtests: {
      findByStrategyId: async (strategyId: string) =>
        db._backtests.filter((b: any) => b.strategy_id === strategyId),
    },
  };
  return db as NeonDatabase & { _strategies: any[]; _backtests: any[] };
}

class StubBacktestService {
  analyzeRisk(result: any) {
    const hasTrades = Array.isArray(result.trades) && result.trades.length > 0;
    return {
      valueAtRisk95: hasTrades ? 5 : 0,
      valueAtRisk99: hasTrades ? 10 : 0,
      sortinoRatio: 1.2,
      calmarRatio: 1.5,
      maxConsecutiveLosses: 3,
      avgDrawdownDuration: 0,
    };
  }
}

describe('StrategyRiskService', () => {
  let db: ReturnType<typeof createStubDb>;
  let service: StrategyRiskService;

  beforeEach(() => {
    db = createStubDb();
    const backtestService = new StubBacktestService() as any;
    service = new StrategyRiskService({ db: db as unknown as NeonDatabase, backtestService });
  });

  it('returns null when strategy does not belong to user', async () => {
    db._strategies.push({
      id: 'strat-1',
      user_id: 'other-user',
    });

    const summary = await service.getStrategyRisk('user-1', 'strat-1');
    expect(summary).toBeNull();
  });

  it('returns blocked status when no backtests exist', async () => {
    db._strategies.push({
      id: 'strat-1',
      user_id: 'user-1',
    });

    const summary = await service.getStrategyRisk('user-1', 'strat-1');
    expect(summary).not.toBeNull();
    expect(summary!.status).toBe('blocked');
    expect(summary!.reasons[0]).toMatch(/No completed backtests/i);
  });

  it('returns risk summary from latest backtest with ok status when metrics are healthy', async () => {
    db._strategies.push({
      id: 'strat-1',
      user_id: 'user-1',
    });

    db._backtests.push(
      {
        id: 'bt-1',
        strategy_id: 'strat-1',
        symbol: 'BTC/USDT',
        status: 'completed',
        metrics: {
          totalReturn: 20,
          maxDrawdown: 10,
          winRate: 55,
          sharpeRatio: 0.8,
          trades: [{ pnl: 10 }],
          equityCurve: [{ timestamp: Date.now(), equity: 10000 }],
        },
        created_at: new Date('2024-01-01'),
      },
    );

    const summary = await service.getStrategyRisk('user-1', 'strat-1');
    expect(summary).not.toBeNull();
    expect(summary!.status).toBe('ok');
    expect(summary!.metrics?.totalReturn).toBe(20);
    expect(summary!.risk?.valueAtRisk95).toBe(5);
    expect(summary!.reasons.length).toBeGreaterThan(0);
  });

  it('returns blocked status when backtest has negative return or high drawdown', async () => {
    db._strategies.push({
      id: 'strat-1',
      user_id: 'user-1',
    });

    db._backtests.push(
      {
        id: 'bt-1',
        strategy_id: 'strat-1',
        symbol: 'BTC/USDT',
        status: 'completed',
        metrics: {
          totalReturn: -5,
          maxDrawdown: 35,
          winRate: 30,
          sharpeRatio: 0.2,
          trades: [],
          equityCurve: [],
        },
        created_at: new Date('2024-01-01'),
      },
    );

    const summary = await service.getStrategyRisk('user-1', 'strat-1');
    expect(summary).not.toBeNull();
    expect(summary!.status).toBe('blocked');
    expect(summary!.reasons.join(' ')).toMatch(/negative return/i);
    expect(summary!.reasons.join(' ')).toMatch(/max drawdown exceeds 30/i);
  });
});

