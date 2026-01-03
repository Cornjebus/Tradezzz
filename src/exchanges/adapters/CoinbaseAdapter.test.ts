import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoinbaseAdapter } from './CoinbaseAdapter';
import type { ExchangeAdapterContext } from '../ExchangeService';

describe('CoinbaseAdapter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should_call_ticker_and_stats_endpoints_and_map_to_Ticker', async () => {
    const fetchMock = vi.fn()
      // /ticker
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bid: '100.00',
          ask: '101.00',
          price: '100.50',
        }),
      } as any)
      // /stats
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          high: '110.00',
          low: '90.00',
          volume: '1234.56',
        }),
      } as any);

    // @ts-expect-error - stubbing global fetch for tests
    globalThis.fetch = fetchMock;

    const adapter = new CoinbaseAdapter({
      baseUrl: 'https://api.exchange.coinbase.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'coinbase',
    };

    const ticker = await adapter.getTicker(ctx, 'BTC/USDT');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = fetchMock.mock.calls[0][0] as string;
    const secondUrl = fetchMock.mock.calls[1][0] as string;
    expect(firstUrl).toContain('/products/BTC-USDT/ticker');
    expect(secondUrl).toContain('/products/BTC-USDT/stats');

    expect(ticker.symbol).toBe('BTC/USDT');
    expect(ticker.bid).toBe(100);
    expect(ticker.ask).toBe(101);
    expect(ticker.last).toBe(100.5);
    expect(ticker.high).toBe(110);
    expect(ticker.low).toBe(90);
    expect(ticker.volume).toBe(1234.56);
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });
});

