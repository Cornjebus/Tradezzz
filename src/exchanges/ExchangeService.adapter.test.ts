import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExchangeService,
  ExchangeAdapter,
  ExchangeAdapterContext,
  Ticker,
  OrderBook,
  OHLCV,
  Balance,
  TradingFees,
  SymbolLimits,
  OrderValidation,
  OrderCost,
  ExchangeType,
} from './ExchangeService';
import { ConfigService } from '../config/ConfigService';
import { MockDatabase, createMockDatabase } from '../../tests/helpers/mock-db';

class StubExchangeAdapter implements ExchangeAdapter {
  public lastTickerRequest: { ctx: ExchangeAdapterContext; symbol: string } | null = null;

  async getTicker(ctx: ExchangeAdapterContext, symbol: string): Promise<Ticker> {
    this.lastTickerRequest = { ctx, symbol };
    return {
      symbol,
      bid: 100,
      ask: 101,
      last: 100.5,
      high: 110,
      low: 90,
      volume: 1234,
      timestamp: 42,
    };
  }

  // The remaining methods are not used in this test and can throw if called.
  async getOrderBook(): Promise<OrderBook> {
    throw new Error('not implemented');
  }

  async getOHLCV(): Promise<OHLCV[]> {
    throw new Error('not implemented');
  }

  async getSymbols(): Promise<string[]> {
    throw new Error('not implemented');
  }

  async getBalance(): Promise<Balance> {
    throw new Error('not implemented');
  }

  async getTradingFees(): Promise<TradingFees> {
    throw new Error('not implemented');
  }

  async getSymbolLimits(): Promise<SymbolLimits> {
    throw new Error('not implemented');
  }

  async validateOrderParams(): Promise<OrderValidation> {
    throw new Error('not implemented');
  }

  async calculateOrderCost(): Promise<OrderCost> {
    throw new Error('not implemented');
  }
}

describe('ExchangeService with adapterFactory', () => {
  let db: MockDatabase;
  let configService: ConfigService;
  let adapter: StubExchangeAdapter;
  let service: ExchangeService;
  let connectionId: string;
  let userId: string;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'test');
    db = createMockDatabase();
    configService = new ConfigService({ db });
    adapter = new StubExchangeAdapter();

    const adapterFactory = (exchange: ExchangeType): ExchangeAdapter => {
      // For this test we always return the same stub adapter
      expect(exchange).toBe('binance');
      return adapter;
    };

    service = new ExchangeService({
      db,
      configService,
      encryptionKey: 'test-encryption-key-32-characters!',
      adapterFactory,
    });

    const user = await db.users.create({
      email: 'adapter@example.com',
      passwordHash: 'hash',
      tier: 'pro',
    });
    userId = user.id;

    const connection = await service.createConnection({
      userId,
      exchange: 'binance',
      name: 'Binance Adapter Test',
      apiKey: 'key',
      apiSecret: 'secret',
    });
    connectionId = connection.id;
  });

  it('should_delegate_getTicker_to_adapter_when_factory_is_provided', async () => {
    const result = await service.getTicker(connectionId, 'BTC/USDT');

    expect(result.symbol).toBe('BTC/USDT');
    expect(result.bid).toBe(100);
    expect(adapter.lastTickerRequest).not.toBeNull();
    expect(adapter.lastTickerRequest!.ctx.connectionId).toBe(connectionId);
    expect(adapter.lastTickerRequest!.ctx.userId).toBe(userId);
    expect(adapter.lastTickerRequest!.ctx.exchange).toBe('binance');
  });
});

