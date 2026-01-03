import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BinanceAdapter } from './BinanceAdapter';
import type { ExchangeAdapterContext } from '../ExchangeService';

describe('BinanceAdapter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should_call_bookTicker_and_24hr_endpoints_and_map_to_Ticker', async () => {
    const fetchMock = vi.fn()
      // bookTicker
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bidPrice: '100.00',
          askPrice: '101.00',
        }),
      } as any)
      // 24hr ticker
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lastPrice: '100.50',
          highPrice: '110.00',
          lowPrice: '90.00',
          volume: '1234.56',
        }),
      } as any);

    // @ts-expect-error - we are stubbing global fetch for tests
    globalThis.fetch = fetchMock;

    const adapter = new BinanceAdapter({
      baseUrl: 'https://api.binance.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'binance',
    };

    const ticker = await adapter.getTicker(ctx, 'BTC/USDT');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstCallUrl = (fetchMock.mock.calls[0][0] as string);
    const secondCallUrl = (fetchMock.mock.calls[1][0] as string);

    expect(firstCallUrl).toContain('/api/v3/ticker/bookTicker');
    expect(firstCallUrl).toContain('symbol=BTCUSDT');
    expect(secondCallUrl).toContain('/api/v3/ticker/24hr');
    expect(secondCallUrl).toContain('symbol=BTCUSDT');

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

