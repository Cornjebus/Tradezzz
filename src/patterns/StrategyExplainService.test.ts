import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NeonDatabase } from '../database/NeonDatabase';
import { StrategyExplainService } from './StrategyExplainService';

function createStubDb(): NeonDatabase {
  const db: any = {
    strategies: {
      findById: vi.fn(),
    },
    backtests: {
      findByStrategyId: vi.fn(),
    },
  };
  return db as NeonDatabase;
}

describe('StrategyExplainService', () => {
  let db: NeonDatabase;
  let service: StrategyExplainService;

  beforeEach(() => {
    db = createStubDb();
    service = new StrategyExplainService(db, null);
  });

  it('throws when strategy is not found for user', async () => {
    (db.strategies.findById as any).mockResolvedValue(null);

    await expect(service.buildContextForStrategy('user-1', 'missing')).rejects.toThrow(
      'Strategy not found',
    );
  });

  it('throws when strategy belongs to a different user', async () => {
    (db.strategies.findById as any).mockResolvedValue({
      id: 'strat-1',
      user_id: 'other-user',
      name: 'Other user strategy',
      description: 'Not owned by user-1',
      type: 'momentum',
      config: {},
    });

    await expect(service.buildContextForStrategy('user-1', 'strat-1')).rejects.toThrow(
      'Strategy not found',
    );
  });

  it('returns context with latest completed backtest metrics when available', async () => {
    (db.strategies.findById as any).mockResolvedValue({
      id: 'strat-1',
      user_id: 'user-1',
      name: 'Momentum BTC',
      description: 'Test strategy',
      type: 'momentum',
      config: { symbols: ['BTC/USDT'] },
    });

    (db.backtests.findByStrategyId as any).mockResolvedValue([
      {
        id: 'bt-1',
        status: 'completed',
        metrics: {
          totalReturn: 20,
          maxDrawdown: 8,
          winRate: 55,
          sharpeRatio: 1.1,
        },
        completed_at: new Date('2024-01-01'),
      },
      {
        id: 'bt-2',
        status: 'completed',
        metrics: {
          totalReturn: 25,
          maxDrawdown: 10,
          winRate: 57,
          sharpeRatio: 1.2,
        },
        completed_at: new Date('2024-02-01'),
      },
    ]);

    const ctx = await service.buildContextForStrategy('user-1', 'strat-1');

    expect(ctx.strategyId).toBe('strat-1');
    expect(ctx.name).toBe('Momentum BTC');
    expect(ctx.symbols).toEqual(['BTC/USDT']);
    expect(ctx.metrics).toBeDefined();
    expect(ctx.metrics?.totalReturn).toBe(25);
    expect(ctx.metrics?.maxDrawdown).toBe(10);
    expect(ctx.metrics?.winRate).toBe(57);
  });

  it('returns context without metrics when no completed backtests exist', async () => {
    (db.strategies.findById as any).mockResolvedValue({
      id: 'strat-1',
      user_id: 'user-1',
      name: 'New Strategy',
      description: 'No backtests yet',
      type: 'custom',
      config: { symbols: ['ETH/USDT'] },
    });

    (db.backtests.findByStrategyId as any).mockResolvedValue([
      { id: 'bt-1', status: 'pending' },
    ]);

    const ctx = await service.buildContextForStrategy('user-1', 'strat-1');

    expect(ctx.strategyId).toBe('strat-1');
    expect(ctx.symbols).toEqual(['ETH/USDT']);
    expect(ctx.metrics).toBeUndefined();
  });
});

