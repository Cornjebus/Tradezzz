import { describe, it, expect, beforeEach } from 'vitest';
import type { NeonDatabase, Order as NeonOrder, Position as NeonPosition, Trade as NeonTrade } from '../database/NeonDatabase';
import { NeonLiveTradingService } from './NeonLiveTradingService';

interface StubDb extends Partial<NeonDatabase> {
  _orders: NeonOrder[];
  _positions: NeonPosition[];
  _trades: NeonTrade[];
}

function createStubDb(): StubDb {
  const db: any = {
    _orders: [],
    _positions: [],
    _trades: [],
    orders: {
      findById: async (id: string) => db._orders.find((o: NeonOrder) => o.id === id) || null,
      update: async (id: string, patch: Partial<NeonOrder>) => {
        const idx = db._orders.findIndex((o: NeonOrder) => o.id === id);
        if (idx === -1) return null;
        db._orders[idx] = { ...db._orders[idx], ...patch };
        return db._orders[idx];
      },
    },
    positions: {
      create: async (data: any) => {
        const pos: NeonPosition = {
          id: `pos-${db._positions.length + 1}`,
          user_id: data.userId,
          strategy_id: data.strategyId,
          symbol: data.symbol,
          side: data.side,
          quantity: data.quantity,
          entry_price: data.entryPrice,
          mode: data.mode,
          opened_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        } as any;
        db._positions.push(pos);
        return pos;
      },
      findOpen: async (userId: string, symbol?: string) => {
        return db._positions.filter(
          (p: NeonPosition) =>
            p.user_id === userId && !p.closed_at && (!symbol || p.symbol === symbol),
        );
      },
      update: async (id: string, patch: any) => {
        const idx = db._positions.findIndex((p: NeonPosition) => p.id === id);
        if (idx === -1) return null;
        db._positions[idx] = { ...db._positions[idx], ...patch };
        return db._positions[idx];
      },
      close: async (id: string, exitPrice: number, realizedPnl: number) => {
        const idx = db._positions.findIndex((p: NeonPosition) => p.id === id);
        if (idx === -1) return null;
        db._positions[idx] = {
          ...db._positions[idx],
          current_price: exitPrice,
          realized_pnl: realizedPnl,
          unrealized_pnl: 0,
          closed_at: new Date(),
          updated_at: new Date(),
        };
        return db._positions[idx];
      },
    },
    trades: {
      create: async (data: any) => {
        const trade: NeonTrade = {
          id: `trade-${db._trades.length + 1}`,
          user_id: data.userId,
          strategy_id: data.strategyId,
          order_id: data.orderId,
          position_id: data.positionId,
          symbol: data.symbol,
          side: data.side,
          quantity: data.quantity,
          price: data.price,
          fee: data.fee,
          pnl: data.pnl,
          mode: data.mode,
          executed_at: new Date(),
          created_at: new Date(),
        } as any;
        db._trades.push(trade);
        return trade;
      },
    },
  };

  return db as StubDb;
}

describe('NeonLiveTradingService', () => {
  let db: StubDb;
  let service: NeonLiveTradingService;

  beforeEach(() => {
    db = createStubDb();
    service = new NeonLiveTradingService(db as unknown as NeonDatabase);
  });

  it('fills a new long position for a buy order with no existing position', async () => {
    const order: NeonOrder = {
      id: 'ord-1',
      user_id: 'user-1',
      strategy_id: 'strat-1',
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
      status: 'pending',
      mode: 'live',
      created_at: new Date(),
      updated_at: new Date(),
    } as any;
    db._orders.push(order);

    const result = await service.fillOrder({ orderId: order.id, price: 50000 });

    expect(result.order.status).toBe('filled');
    expect(result.position).toBeDefined();
    expect(result.position!.side).toBe('long');
    expect(result.position!.quantity).toBe(0.1);
    expect(result.trade.pnl).toBe(0);
  });

  it('closes an existing long position on sell with realized PnL', async () => {
    const order: NeonOrder = {
      id: 'ord-2',
      user_id: 'user-1',
      strategy_id: 'strat-1',
      symbol: 'BTC/USDT',
      side: 'sell',
      type: 'market',
      quantity: 0.1,
      status: 'pending',
      mode: 'live',
      created_at: new Date(),
      updated_at: new Date(),
    } as any;
    db._orders.push(order);

    // Existing long: entry 40k, qty 0.1
    const existing: NeonPosition = {
      id: 'pos-1',
      user_id: 'user-1',
      strategy_id: 'strat-1',
      symbol: 'BTC/USDT',
      side: 'long',
      quantity: 0.1,
      entry_price: 40000,
      mode: 'live',
      opened_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    } as any;
    db._positions.push(existing);

    const result = await service.fillOrder({ orderId: order.id, price: 50000, feeRatePercent: 0 });

    expect(result.order.status).toBe('filled');
    expect(result.position!.closed_at).toBeInstanceOf(Date);
    // PnL = (50k - 40k) * 0.1 = 1000
    expect(result.trade.pnl).toBeCloseTo(1000, 6);
  });

  it('partially_closes_long_position_on_sell', async () => {
    const order: NeonOrder = {
      id: 'ord-3',
      user_id: 'user-1',
      strategy_id: 'strat-1',
      symbol: 'BTC/USDT',
      side: 'sell',
      type: 'market',
      quantity: 0.05,
      status: 'pending',
      mode: 'live',
      created_at: new Date(),
      updated_at: new Date(),
    } as any;
    db._orders.push(order);

    const existing: NeonPosition = {
      id: 'pos-1',
      user_id: 'user-1',
      strategy_id: 'strat-1',
      symbol: 'BTC/USDT',
      side: 'long',
      quantity: 0.1,
      entry_price: 40000,
      mode: 'live',
      opened_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    } as any;
    db._positions.push(existing);

    const result = await service.fillOrder({ orderId: order.id, price: 50000, feeRatePercent: 0 });

    // Remaining position should have half the original size
    expect(db._positions[0].quantity).toBeCloseTo(0.05, 6);
    // Realized PnL should be half of full-close PnL: (50k-40k)*0.05 = 500
    expect(result.trade.pnl).toBeCloseTo(500, 6);
  });
});
