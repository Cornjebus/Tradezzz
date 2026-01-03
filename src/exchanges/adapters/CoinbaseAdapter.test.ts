import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { CoinbaseAdapter } from './CoinbaseAdapter';
import type { ExchangeAdapterContext } from '../ExchangeService';

describe('CoinbaseAdapter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('should_call_product_endpoint_and_map_to_Ticker', async () => {
    // New Coinbase Advanced Trade API returns all data in single product endpoint
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        price: '100.50',
        quote: {
          bid_price: '100.00',
          ask_price: '101.00',
        },
        high_24h: '110.00',
        low_24h: '90.00',
        volume_24h: '1234.56',
      }),
    } as any);

    // @ts-expect-error - stubbing global fetch for tests
    globalThis.fetch = fetchMock;

    const adapter = new CoinbaseAdapter({
      baseUrl: 'https://api.coinbase.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'coinbase',
    };

    const ticker = await adapter.getTicker(ctx, 'BTC/USDT');

    // Advanced Trade API uses single endpoint for product data
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v3/brokerage/market/products/BTC-USDT');

    expect(ticker.symbol).toBe('BTC/USDT');
    expect(ticker.bid).toBe(100);
    expect(ticker.ask).toBe(101);
    expect(ticker.last).toBe(100.5);
    expect(ticker.high).toBe(110);
    expect(ticker.low).toBe(90);
    expect(ticker.volume).toBe(1234.56);
  });

  it('should_get_order_book_from_book_endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pricebook: {
          bids: [
            { price: '100.00', size: '1.5' },
            { price: '99.50', size: '2.0' },
          ],
          asks: [
            { price: '101.00', size: '1.0' },
            { price: '101.50', size: '1.5' },
          ],
        },
      }),
    } as any);

    // @ts-expect-error - stubbing global fetch for tests
    globalThis.fetch = fetchMock;

    const adapter = new CoinbaseAdapter({
      baseUrl: 'https://api.coinbase.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'coinbase',
    };

    const orderBook = await adapter.getOrderBook(ctx, 'ETH/USD');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v3/brokerage/market/products/ETH-USD/book');

    expect(orderBook.symbol).toBe('ETH/USD');
    expect(orderBook.bids).toHaveLength(2);
    expect(orderBook.bids[0]).toEqual({ price: 100, quantity: 1.5 });
    expect(orderBook.asks).toHaveLength(2);
    expect(orderBook.asks[0]).toEqual({ price: 101, quantity: 1 });
  });

  it('should_get_ohlcv_candles', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candles: [
          { start: 1704067200, open: '100', high: '105', low: '98', close: '103', volume: '500' },
          { start: 1704070800, open: '103', high: '108', low: '101', close: '106', volume: '600' },
        ],
      }),
    } as any);

    // @ts-expect-error - stubbing global fetch for tests
    globalThis.fetch = fetchMock;

    const adapter = new CoinbaseAdapter({
      baseUrl: 'https://api.coinbase.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'coinbase',
    };

    const candles = await adapter.getOHLCV(ctx, 'BTC/USD', '1h', 2);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v3/brokerage/market/products/BTC-USD/candles');

    expect(candles).toHaveLength(2);
    expect(candles[0].open).toBe(100);
    expect(candles[0].close).toBe(103);
    expect(candles[0].volume).toBe(500);
  });

  it('should_get_balance_with_auth', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accounts: [
          {
            currency: 'BTC',
            available_balance: { value: '1.5' },
            hold: { value: '0.5' },
          },
          {
            currency: 'USD',
            available_balance: { value: '10000' },
            hold: { value: '1000' },
          },
        ],
      }),
    } as any);

    // @ts-expect-error - stubbing global fetch for tests
    globalThis.fetch = fetchMock;

    const adapter = new CoinbaseAdapter({
      baseUrl: 'https://api.coinbase.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'coinbase',
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
    };

    const balance = await adapter.getBalance(ctx);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v3/brokerage/accounts');

    expect(balance.total['BTC']).toBe(2);
    expect(balance.free['BTC']).toBe(1.5);
    expect(balance.used['BTC']).toBe(0.5);
    expect(balance.assets).toContain('BTC');
    expect(balance.assets).toContain('USD');
  });

  it('should_return_empty_balance_without_auth', async () => {
    const adapter = new CoinbaseAdapter({
      baseUrl: 'https://api.coinbase.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'coinbase',
    };

    const balance = await adapter.getBalance(ctx);

    expect(balance.total).toEqual({});
    expect(balance.free).toEqual({});
    expect(balance.used).toEqual({});
    expect(balance.assets).toEqual([]);
  });

  it('should_test_connection_successfully', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ products: [] }),
    } as any);

    // @ts-expect-error - stubbing global fetch for tests
    globalThis.fetch = fetchMock;

    const adapter = new CoinbaseAdapter({
      baseUrl: 'https://api.coinbase.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'coinbase',
    };

    const result = await adapter.testConnection(ctx);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should_report_connection_failure', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    // @ts-expect-error - stubbing global fetch for tests
    globalThis.fetch = fetchMock;

    const adapter = new CoinbaseAdapter({
      baseUrl: 'https://api.coinbase.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'coinbase',
    };

    const result = await adapter.testConnection(ctx);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('should_validate_order_params', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        base_min_size: '0.001',
        base_max_size: '10000',
        quote_min_size: '1',
        min_market_funds: '10',
      }),
    } as any);

    // @ts-expect-error - stubbing global fetch for tests
    globalThis.fetch = fetchMock;

    const adapter = new CoinbaseAdapter({
      baseUrl: 'https://api.coinbase.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'coinbase',
    };

    const result = await adapter.validateOrderParams(ctx, {
      symbol: 'BTC/USD',
      side: 'buy',
      type: 'limit',
      quantity: 0.1,
      price: 50000,
    });

    expect(result.valid).toBe(true);
  });

  it('should_reject_order_below_min_quantity', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        base_min_size: '0.001',
        base_max_size: '10000',
      }),
    } as any);

    // @ts-expect-error - stubbing global fetch for tests
    globalThis.fetch = fetchMock;

    const adapter = new CoinbaseAdapter({
      baseUrl: 'https://api.coinbase.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'coinbase',
    };

    const result = await adapter.validateOrderParams(ctx, {
      symbol: 'BTC/USD',
      side: 'buy',
      type: 'limit',
      quantity: 0.0001,
      price: 50000,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('minimum');
  });

  it('should_calculate_order_cost', async () => {
    const adapter = new CoinbaseAdapter({
      baseUrl: 'https://api.coinbase.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'coinbase',
    };

    const cost = await adapter.calculateOrderCost(ctx, {
      symbol: 'BTC/USD',
      side: 'buy',
      quantity: 1,
      price: 50000,
    });

    expect(cost.subtotal).toBe(50000);
    expect(cost.fee).toBe(300); // 0.6% taker fee
    expect(cost.total).toBe(50300);
  });

  it('should_get_available_symbols', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [
          { base_currency_id: 'BTC', quote_currency_id: 'USD', is_disabled: false, status: 'online' },
          { base_currency_id: 'ETH', quote_currency_id: 'USD', is_disabled: false, status: 'online' },
          { base_currency_id: 'DOGE', quote_currency_id: 'USD', is_disabled: true, status: 'offline' },
        ],
      }),
    } as any);

    // @ts-expect-error - stubbing global fetch for tests
    globalThis.fetch = fetchMock;

    const adapter = new CoinbaseAdapter({
      baseUrl: 'https://api.coinbase.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'coinbase',
    };

    const symbols = await adapter.getSymbols(ctx);

    expect(symbols).toContain('BTC/USD');
    expect(symbols).toContain('ETH/USD');
    expect(symbols).not.toContain('DOGE/USD'); // Disabled
  });
});
