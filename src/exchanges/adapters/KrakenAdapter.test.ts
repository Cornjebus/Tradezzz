import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KrakenAdapter } from './KrakenAdapter';
import type { ExchangeAdapterContext } from '../ExchangeService';

describe('KrakenAdapter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should_call_Ticker_endpoint_and_map_to_Ticker', async () => {
    const responseJson = {
      error: [],
      result: {
        XXBTZUSD: {
          a: ['101.00', '1', '1.0'],
          b: ['100.00', '1', '1.0'],
          c: ['100.50', '1'],
          h: ['105.00', '110.00'],
          l: ['95.00', '90.00'],
          v: ['100.0', '1234.56'],
        },
      },
    };

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => responseJson,
    } as any);

    // @ts-expect-error - stubbing global fetch for tests
    globalThis.fetch = fetchMock;

    const adapter = new KrakenAdapter({
      baseUrl: 'https://api.kraken.com',
    });

    const ctx: ExchangeAdapterContext = {
      connectionId: 'conn-1',
      userId: 'user-1',
      exchange: 'kraken',
    };

    const ticker = await adapter.getTicker(ctx, 'BTC/USDT');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/0/public/Ticker');

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

