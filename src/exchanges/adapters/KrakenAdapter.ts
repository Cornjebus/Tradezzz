/**
 * KrakenAdapter - ExchangeAdapter implementation for Kraken (spot)
 *
 * Read-only implementation using Kraken's public REST API. Private trading
 * endpoints can be added later.
 */

import {
  ExchangeAdapter,
  ExchangeAdapterContext,
  Ticker,
  OrderBook,
  OrderBookEntry,
  OHLCV,
  Balance,
  TradingFees,
  SymbolLimits,
  OrderValidation,
  OrderCost,
} from '../ExchangeService';

export interface KrakenAdapterOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export class KrakenAdapter implements ExchangeAdapter {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: KrakenAdapterOptions = {}) {
    this.baseUrl =
      options.baseUrl ||
      process.env.KRAKEN_BASE_URL ||
      'https://api.kraken.com';
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  private toKrakenPair(symbol: string): string {
    // Basic conversion: "BTC/USDT" -> "BTCUSDT". Real mapping may be more complex.
    return symbol.replace('/', '');
  }

  private async getJson(path: string, params?: Record<string, string>): Promise<any> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `Kraken API error: HTTP ${response.status} ${response.statusText} ${errorText}`,
        );
      }

      const json = await response.json();
      if (json.error && json.error.length) {
        throw new Error(`Kraken API error: ${json.error.join(', ')}`);
      }
      return json.result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getTicker(ctx: ExchangeAdapterContext, symbol: string): Promise<Ticker> {
    const pair = this.toKrakenPair(symbol);
    const data = await this.getJson('/0/public/Ticker', { pair });
    const key = Object.keys(data)[0];
    const ticker = data[key];

    const bid = parseFloat(ticker.b[0]);
    const ask = parseFloat(ticker.a[0]);
    const last = parseFloat(ticker.c[0]);
    const high = parseFloat(ticker.h[1]);
    const low = parseFloat(ticker.l[1]);
    const volume = parseFloat(ticker.v[1]);

    return {
      symbol,
      bid,
      ask,
      last,
      high,
      low,
      volume,
      timestamp: Date.now(),
    };
  }

  async getOrderBook(ctx: ExchangeAdapterContext, symbol: string): Promise<OrderBook> {
    const pair = this.toKrakenPair(symbol);
    const data = await this.getJson('/0/public/Depth', { pair, count: '50' });
    const key = Object.keys(data)[0];
    const depth = data[key];

    const bids: OrderBookEntry[] = depth.bids.map((entry: [string, string]) => ({
      price: parseFloat(entry[0]),
      quantity: parseFloat(entry[1]),
    }));

    const asks: OrderBookEntry[] = depth.asks.map((entry: [string, string]) => ({
      price: parseFloat(entry[0]),
      quantity: parseFloat(entry[1]),
    }));

    return {
      symbol,
      bids,
      asks,
      timestamp: Date.now(),
    };
  }

  async getOHLCV(
    ctx: ExchangeAdapterContext,
    symbol: string,
    timeframe: string,
    limit: number,
  ): Promise<OHLCV[]> {
    const pair = this.toKrakenPair(symbol);
    const interval = this.timeframeToMinutes(timeframe);
    const data = await this.getJson('/0/public/OHLC', { pair, interval: interval.toString() });
    const key = Object.keys(data)[0];
    const candles = data[key];

    return candles.slice(0, limit).map((candle: any[]): OHLCV => ({
      timestamp: candle[0] * 1000,
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[6]),
    }));
  }

  private timeframeToMinutes(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
    };
    return map[timeframe] || 60;
  }

  async getSymbols(ctx: ExchangeAdapterContext): Promise<string[]> {
    const assets = await this.getJson('/0/public/AssetPairs');
    return Object.values(assets).map((p: any) => `${p.base}/${p.quote}`);
  }

  async getBalance(ctx: ExchangeAdapterContext): Promise<Balance> {
    // Placeholder: private balance endpoint would be required.
    return {
      total: {},
      free: {},
      used: {},
      assets: [],
    };
  }

  async getTradingFees(ctx: ExchangeAdapterContext): Promise<TradingFees> {
    // Placeholder defaults; real implementation would query Kraken's fee schedule.
    return {
      maker: 0.0016,
      taker: 0.0026,
    };
  }

  async getSymbolLimits(ctx: ExchangeAdapterContext, symbol: string): Promise<SymbolLimits> {
    // Placeholder: real implementation would inspect pair settings.
    const isBTC = symbol.startsWith('BTC');
    return {
      minQuantity: isBTC ? 0.0001 : 0.01,
      maxQuantity: isBTC ? 1000 : 100000,
      minPrice: 0.01,
      maxPrice: 1_000_000,
      minNotional: 10,
      quantityPrecision: isBTC ? 8 : 4,
      pricePrecision: 2,
    };
  }

  async validateOrderParams(
    ctx: ExchangeAdapterContext,
    params: { symbol: string; side: string; type: string; quantity: number; price?: number },
  ): Promise<OrderValidation> {
    const limits = await this.getSymbolLimits(ctx, params.symbol);

    if (params.quantity < limits.minQuantity) {
      return { valid: false, error: `Quantity below minimum (${limits.minQuantity})` };
    }

    if (params.quantity > limits.maxQuantity) {
      return { valid: false, error: `Quantity above maximum (${limits.maxQuantity})` };
    }

    if (params.price && params.price < limits.minPrice) {
      return { valid: false, error: `Price below minimum (${limits.minPrice})` };
    }

    if (params.price) {
      const notional = params.quantity * params.price;
      if (notional < limits.minNotional) {
        return { valid: false, error: `Order value below minimum (${limits.minNotional})` };
      }
    }

    return { valid: true };
  }

  async calculateOrderCost(
    ctx: ExchangeAdapterContext,
    params: { symbol: string; side: string; quantity: number; price: number },
  ): Promise<OrderCost> {
    const fees = await this.getTradingFees(ctx);
    const subtotal = params.quantity * params.price;
    const fee = subtotal * fees.taker;

    return {
      subtotal,
      fee,
      total: params.side === 'buy' ? subtotal + fee : subtotal - fee,
    };
  }
}

