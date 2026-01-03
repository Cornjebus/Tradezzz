import { describe, it, expect, beforeEach } from 'vitest';
import type {
  NeonDatabase,
  Position as NeonPosition,
  ExchangeConnection as NeonExchangeConnection,
} from '../database/NeonDatabase';
import { NeonMarkToMarketService } from './NeonMarkToMarketService';

interface StubDb extends Partial<NeonDatabase> {
  _positions: NeonPosition[];
  _exchangeConnections: NeonExchangeConnection[];
}

class StubExchangeService {
  prices: Record<string, number> = {};

  setPrice(symbol: string, price: number) {
    this.prices[symbol] = price;
  }

  async getTicker(connectionId: string, userId: string, symbol: string) {
    const price = this.prices[symbol];
    if (price === undefined) {
      throw new Error(`No price configured for ${symbol}`);
    }
    return {
      last: price,
      symbol,
      exchange: 'binance',
      connectionId,
      userId,
    } as any;
  }
}

function createStubDb(): StubDb {
  const db: any = {
    _positions: [] as NeonPosition[],
    _exchangeConnections: [] as NeonExchangeConnection[],
    positions: {
      findOpen: async (userId: string) =>
        db._positions.filter((p: NeonPosition) => p.user_id === userId && !p.closed_at),
      update: async (id: string, patch: any) => {
        const idx = db._positions.findIndex((p: NeonPosition) => p.id === id);
        if (idx === -1) {
          throw new Error('Position not found');
        }
        db._positions[idx] = {
          ...db._positions[idx],
          ...patch,
          updated_at: new Date(),
        } as any;
        return db._positions[idx];
      },
    },
    exchangeConnections: {
      findByUserId: async (userId: string) =>
        db._exchangeConnections.filter((c: NeonExchangeConnection) => c.user_id === userId),
    },
    userSettings: {
      findByUserId: async () => null,
    },
  };

  return db as StubDb;
}

describe('NeonMarkToMarketService', () => {
  let db: StubDb;
  let exchangeService: StubExchangeService;
  let service: NeonMarkToMarketService;

  beforeEach(() => {
    db = createStubDb();
    exchangeService = new StubExchangeService();

    // Single Binance connection for the user
    db._exchangeConnections.push({
      id: 'conn-1',
      user_id: 'user-1',
      exchange: 'binance',
      name: 'Binance',
      status: 'active',
      encrypted_api_key: 'k',
      encrypted_api_secret: 's',
      created_at: new Date(),
      updated_at: new Date(),
    } as any);

    service = new NeonMarkToMarketService(db as unknown as NeonDatabase, exchangeService as any);
  });

  it('updates long positions with correct unrealized PnL', async () => {
    const position: NeonPosition = {
      id: 'pos-1',
      user_id: 'user-1',
      strategy_id: 'strat-1',
      symbol: 'BTC/USDT',
      side: 'long',
      quantity: 0.5,
      entry_price: 40000,
      mode: 'live',
      opened_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    } as any;
    db._positions.push(position);

    // Current price 45k -> unrealized PnL = (45k - 40k) * 0.5 = 2500
    exchangeService.setPrice('BTC/USDT', 45000);

    const result = await service.markToMarket('user-1');

    expect(result.updatedPositions).toBe(1);
    expect(result.totalUnrealizedPnl).toBeCloseTo(2500, 6);
    expect(db._positions[0].currentPrice ?? (db._positions[0] as any).current_price).toBe(45000);
    const upnl = (db._positions[0] as any).unrealizedPnl ?? (db._positions[0] as any).unrealized_pnl;
    expect(upnl).toBeCloseTo(2500, 6);
  });

  it('updates short positions with correct unrealized PnL', async () => {
    const position: NeonPosition = {
      id: 'pos-2',
      user_id: 'user-1',
      strategy_id: 'strat-1',
      symbol: 'ETH/USDT',
      side: 'short',
      quantity: 10,
      entry_price: 2000,
      mode: 'live',
      opened_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    } as any;
    db._positions.push(position);

    // Current price 1800 -> unrealized PnL = (2000 - 1800) * 10 = 2000
    exchangeService.setPrice('ETH/USDT', 1800);

    const result = await service.markToMarket('user-1');

    expect(result.updatedPositions).toBe(1);
    expect(result.totalUnrealizedPnl).toBeCloseTo(2000, 6);
    const upnl = (db._positions[0] as any).unrealizedPnl ?? (db._positions[0] as any).unrealized_pnl;
    expect(upnl).toBeCloseTo(2000, 6);
  });

  it('throws when positions exist but no exchange connections are available', async () => {
    // Remove all exchange connections
    db._exchangeConnections.length = 0;

    // Add a live position that requires pricing
    const position: NeonPosition = {
      id: 'pos-3',
      user_id: 'user-1',
      strategy_id: 'strat-1',
      symbol: 'BTC/USDT',
      side: 'long',
      quantity: 1,
      entry_price: 40000,
      mode: 'live',
      opened_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    } as any;
    db._positions.push(position);

    await expect(service.markToMarket('user-1')).rejects.toThrow(
      'No exchange connections available for mark-to-market',
    );
  });
});
