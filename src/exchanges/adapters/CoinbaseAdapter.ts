/**
 * CoinbaseAdapter - ExchangeAdapter implementation for Coinbase (spot)
 *
 * This adapter targets Coinbase's public REST API for read-only operations.
 * Private, signed endpoints for trading can be added later.
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

export interface CoinbaseAdapterOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export class CoinbaseAdapter implements ExchangeAdapter {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: CoinbaseAdapterOptions = {}) {
    this.baseUrl =
      options.baseUrl ||
      process.env.COINBASE_BASE_URL ||
      'https://api.exchange.coinbase.com';
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  private toCoinbaseProductId(symbol: string): string {
    // Convert "BTC/USDT" -> "BTC-USDT"
    return symbol.replace('/', '-');
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
          `Coinbase API error: HTTP ${response.status} ${response.statusText} ${errorText}`,
        );
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getTicker(ctx: ExchangeAdapterContext, symbol: string): Promise<Ticker> {
    const productId = this.toCoinbaseProductId(symbol);
    const ticker = await this.getJson(`/products/${productId}/ticker`);
    const stats = await this.getJson(`/products/${productId}/stats`);

    const bid = parseFloat(ticker.bid);
    const ask = parseFloat(ticker.ask);
    const last = parseFloat(ticker.price);
    const high = parseFloat(stats.high);
    const low = parseFloat(stats.low);
    const volume = parseFloat(stats.volume);

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
    const productId = this.toCoinbaseProductId(symbol);
    const depth = await this.getJson(`/products/${productId}/book`, { level: '2' });

    const bids: OrderBookEntry[] = depth.bids.map((entry: [string, string, string]) => ({
      price: parseFloat(entry[0]),
      quantity: parseFloat(entry[1]),
    }));

    const asks: OrderBookEntry[] = depth.asks.map((entry: [string, string, string]) => ({
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
    const productId = this.toCoinbaseProductId(symbol);
    const candles = await this.getJson(`/products/${productId}/candles`, {
      granularity: this.timeframeToSeconds(timeframe).toString(),
    });

    // Coinbase returns [time, low, high, open, close, volume]
    return candles.slice(0, limit).map((candle: any[]): OHLCV => ({
      timestamp: candle[0] * 1000,
      open: candle[3],
      high: candle[2],
      low: candle[1],
      close: candle[4],
      volume: candle[5],
    }));
  }

  private timeframeToSeconds(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '6h': 21600,
      '1d': 86400,
    };
    return map[timeframe] || 3600;
  }

  async getSymbols(ctx: ExchangeAdapterContext): Promise<string[]> {
    const products = await this.getJson('/products');
    return products
      .filter((p: any) => p.trading_disabled === false && p.status === 'online')
      .map((p: any) => `${p.base_currency}/${p.quote_currency}`);
  }

  async getBalance(ctx: ExchangeAdapterContext): Promise<Balance> {
    // Placeholder: real implementation will call private accounts endpoint.
    return {
      total: {},
      free: {},
      used: {},
      assets: [],
    };
  }

  async getTradingFees(ctx: ExchangeAdapterContext): Promise<TradingFees> {
    // Placeholder: use conservative defaults; real implementation would query fee endpoints.
    return {
      maker: 0.0015,
      taker: 0.0025,
    };
  }

  async getSymbolLimits(ctx: ExchangeAdapterContext, symbol: string): Promise<SymbolLimits> {
    // Placeholder: a real implementation would inspect product min/max fields.
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

