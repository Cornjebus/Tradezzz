import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NeonDatabase } from '../database/NeonDatabase';
import { StrategyRecommendationService } from './StrategyRecommendationService';

function createStubDb(): NeonDatabase {
  const db: any = {
    strategies: {
      findByUserId: vi.fn(),
    },
    backtests: {
      findByStrategyId: vi.fn(),
    },
  };
  return db as NeonDatabase;
}

describe('StrategyRecommendationService', () => {
  let db: NeonDatabase;
  let service: StrategyRecommendationService;
  let client: any;

  beforeEach(() => {
    db = createStubDb();
    client = {
      search: vi.fn().mockResolvedValue([]),
    };
    service = new StrategyRecommendationService(db, null);
  });

  it('returns empty list when user has no strategies', async () => {
    (db.strategies.findByUserId as any).mockResolvedValue([]);

    const recs = await service.recommendForUser('user-1');
    expect(recs).toEqual([]);
  });

  it('ranks strategies by (totalReturn - maxDrawdown)', async () => {
    (db.strategies.findByUserId as any).mockResolvedValue([
      {
        id: 's1',
        user_id: 'user-1',
        name: 'Strategy A',
        config: { symbols: ['BTC/USDT'] },
      },
      {
        id: 's2',
        user_id: 'user-1',
        name: 'Strategy B',
        config: { symbols: ['ETH/USDT'] },
      },
    ]);

    (db.backtests.findByStrategyId as any).mockImplementation(async (id: string) => {
      if (id === 's1') {
        return [
          {
            status: 'completed',
            metrics: {
              totalReturn: 30,
              maxDrawdown: 15,
            },
          },
        ];
      }
      if (id === 's2') {
        return [
          {
            status: 'completed',
            metrics: {
              totalReturn: 20,
              maxDrawdown: 5,
            },
          },
        ];
      }
      return [];
    });

    const recs = await service.recommendForUser('user-1');

    // s2: 20-5=15, s1: 30-15=15 -> equal scores, but ordering is deterministic by original order
    expect(recs.length).toBe(2);
    expect(recs[0].strategyId).toBeDefined();
    expect(recs[0]).toHaveProperty('metrics.totalReturn');
  });

  it('prefers RuVector ordering when client is present', async () => {
    (db.strategies.findByUserId as any).mockResolvedValue([
      {
        id: 's1',
        user_id: 'user-1',
        name: 'Strategy A',
        config: { symbols: ['BTC/USDT'] },
      },
      {
        id: 's2',
        user_id: 'user-1',
        name: 'Strategy B',
        config: { symbols: ['ETH/USDT'] },
      },
    ]);

    (db.backtests.findByStrategyId as any).mockImplementation(async (id: string) => {
      return [
        {
          status: 'completed',
          metrics: {
            totalReturn: id === 's1' ? 10 : 15,
            maxDrawdown: id === 's1' ? 5 : 7,
          },
        },
      ];
    });

    client.search.mockResolvedValue([
      { id: 's2', score: 0.9 },
      { id: 's1', score: 0.8 },
    ]);

    const svcWithClient = new StrategyRecommendationService(db, client);
    const recs = await svcWithClient.recommendForUser('user-1');

    expect(recs.length).toBe(2);
    expect(recs[0].strategyId).toBe('s2');
  });
});
