/**
 * BinanceAdapter - ExchangeAdapter implementation for Binance (spot)
 *
 * This adapter is designed to work against Binance's public REST API. For now
 * it focuses on read-only operations (tickers, order books, candles, etc.).
 * Private endpoints and signing can be added later when we wire in live
 * trading with real credentials.
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

export interface BinanceAdapterOptions {
  /**
   * When true, uses the Binance spot testnet endpoints.
   * Otherwise uses the mainnet API.
   */
  testnet?: boolean;

  /**
   * Optional base URL override. If not provided, the adapter chooses based on
   * the `testnet` flag.
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds.
   */
  timeoutMs?: number;
}

export class BinanceAdapter implements ExchangeAdapter {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: BinanceAdapterOptions = {}) {
    const testnet =
      options.testnet ??
      (process.env.BINANCE_TESTNET === '1' || process.env.BINANCE_TESTNET === 'true');

    this.baseUrl =
      options.baseUrl ||
      (testnet
        ? process.env.BINANCE_TESTNET_BASE_URL || 'https://testnet.binance.vision'
        : process.env.BINANCE_BASE_URL || 'https://api.binance.com');

    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  private toBinanceSymbol(symbol: string): string {
    // Convert "BTC/USDT" -> "BTCUSDT"
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
          `Binance API error: HTTP ${response.status} ${response.statusText} ${errorText}`,
        );
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getTicker(ctx: ExchangeAdapterContext, symbol: string): Promise<Ticker> {
    const binanceSymbol = this.toBinanceSymbol(symbol);

    // Use bookTicker for bid/ask and 24hr ticker for high/low/last/volume
    const [bookTicker, dayTicker] = await Promise.all([
      this.getJson('/api/v3/ticker/bookTicker', { symbol: binanceSymbol }),
      this.getJson('/api/v3/ticker/24hr', { symbol: binanceSymbol }),
    ]);

    const bid = parseFloat(bookTicker.bidPrice);
    const ask = parseFloat(bookTicker.askPrice);
    const last = parseFloat(dayTicker.lastPrice);
    const high = parseFloat(dayTicker.highPrice);
    const low = parseFloat(dayTicker.lowPrice);
    const volume = parseFloat(dayTicker.volume);

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
    const binanceSymbol = this.toBinanceSymbol(symbol);
    const depth = await this.getJson('/api/v3/depth', {
      symbol: binanceSymbol,
      limit: '50',
    });

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
    const binanceSymbol = this.toBinanceSymbol(symbol);
    const candles = await this.getJson('/api/v3/klines', {
      symbol: binanceSymbol,
      interval: timeframe,
      limit: String(limit),
    });

    return candles.map((candle: any[]): OHLCV => ({
      timestamp: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    }));
  }

  async getSymbols(ctx: ExchangeAdapterContext): Promise<string[]> {
    const exchangeInfo = await this.getJson('/api/v3/exchangeInfo');
    return exchangeInfo.symbols
      .filter((s: any) => s.status === 'TRADING')
      .map((s: any) => `${s.baseAsset}/${s.quoteAsset}`);
  }

  async getBalance(ctx: ExchangeAdapterContext): Promise<Balance> {
    // Placeholder: real implementation will call the signed account endpoint.
    // For now, return zero balances to keep the adapter deterministic without keys.
    return {
      total: {},
      free: {},
      used: {},
      assets: [],
    };
  }

  async getTradingFees(ctx: ExchangeAdapterContext): Promise<TradingFees> {
    // Placeholder: in a full implementation, query Binance trade fee endpoints.
    // Use conservative defaults similar to the simulated service.
    return {
      maker: 0.001,
      taker: 0.001,
    };
  }

  async getSymbolLimits(ctx: ExchangeAdapterContext, symbol: string): Promise<SymbolLimits> {
    // Placeholder: in a full implementation, derive from exchangeInfo filters.
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

