import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NeonDatabase } from '../database/NeonDatabase';
import { PatternIngestionService } from './PatternIngestionService';

function createStubDb() {
  const db: any = {
    strategies: {
      findById: vi.fn(),
    },
    backtests: {
      findByStrategyId: vi.fn(),
    },
  };
  return db as unknown as NeonDatabase;
}

function createStubClient() {
  return {
    upsertVectors: vi.fn().mockResolvedValue(undefined),
  };
}

describe('PatternIngestionService', () => {
  let db: NeonDatabase;
  let client: any;
  let service: PatternIngestionService;

  beforeEach(() => {
    db = createStubDb();
    client = createStubClient();
    service = new PatternIngestionService({
      db,
      client,
      tenantId: 'tenant-1',
    });
  });

  it('throws when strategy is not found', async () => {
    (db.strategies.findById as any).mockResolvedValue(null);

    await expect(service.ingestStrategy('missing')).rejects.toThrow('Strategy not found');
    expect(client.upsertVectors).not.toHaveBeenCalled();
  });

  it('ingests strategy with latest completed backtest into strategies index', async () => {
    (db.strategies.findById as any).mockResolvedValue({
      id: 'strat-1',
      user_id: 'user-1',
      name: 'Momentum BTC',
      description: 'Test strategy',
      type: 'momentum',
      status: 'active',
      config: { symbols: ['BTC/USDT'] },
      execution_mode: 'auto',
    });

    (db.backtests.findByStrategyId as any).mockResolvedValue([
      {
        id: 'bt-1',
        status: 'completed',
        metrics: {
          totalReturn: 25,
          maxDrawdown: 10,
          winRate: 55,
          sharpeRatio: 1.2,
          profitFactor: 1.5,
        },
        created_at: new Date('2024-01-01'),
      },
    ]);

    await service.ingestStrategy('strat-1');

    expect(client.upsertVectors).toHaveBeenCalledTimes(1);
    const [vectors, index] = client.upsertVectors.mock.calls[0];
    expect(index).toBe('strategies');
    expect(vectors[0].id).toBe('strat-1');
    expect(vectors[0].namespace).toBe('strategies');
    expect(vectors[0].metadata.strategyId).toBe('strat-1');
    expect(vectors[0].metadata.metrics.totalReturn).toBe(25);
  });
});

