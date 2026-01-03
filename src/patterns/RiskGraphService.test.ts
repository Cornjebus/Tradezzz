import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NeonDatabase } from '../database/NeonDatabase';
import { RiskGraphService } from './RiskGraphService';

function createStubDb(): NeonDatabase {
  const db: any = {
    orders: {
      findByUserId: vi.fn().mockResolvedValue([]),
    },
    positions: {
      findOpen: vi.fn().mockResolvedValue([]),
    },
  };
  return db as NeonDatabase;
}

describe('RiskGraphService', () => {
  let db: NeonDatabase;
  let service: RiskGraphService;

  beforeEach(() => {
    db = createStubDb();
    service = new RiskGraphService(db, null);
  });

  it('returns low score when there is no live exposure', async () => {
    (db.orders.findByUserId as any).mockResolvedValue([]);
    (db.positions.findOpen as any).mockResolvedValue([]);

    const summary = await service.getGraphRisk('user-1');
    expect(summary.score).toBeLessThanOrEqual(10);
    expect(summary.openLivePositions).toBe(0);
    expect(summary.openLiveOrders).toBe(0);
  });

  it('flags concentrated exposure when most notional is in a single symbol', async () => {
    (db.orders.findByUserId as any).mockResolvedValue([]);
    (db.positions.findOpen as any).mockResolvedValue([
      {
        id: 'p1',
        user_id: 'user-1',
        symbol: 'BTC/USDT',
        side: 'long',
        quantity: 1,
        entry_price: 50000,
        mode: 'live',
      },
      {
        id: 'p2',
        user_id: 'user-1',
        symbol: 'ETH/USDT',
        side: 'long',
        quantity: 0.1,
        entry_price: 3000,
        mode: 'live',
      },
    ]);

    const summary = await service.getGraphRisk('user-1');
    expect(summary.score).toBeGreaterThan(0);
    expect(
      summary.factors.some(
        (f) => f.label === 'Concentrated exposure' && f.severity === 'high',
      ),
    ).toBe(true);
  });
});

