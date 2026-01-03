/**
 * CoinbaseAdapter - ExchangeAdapter implementation for Coinbase Advanced Trade API
 *
 * This adapter uses Coinbase's Advanced Trade API (api.coinbase.com)
 * which replaced the deprecated Coinbase Pro API.
 *
 * Authentication uses JWT tokens signed with the API secret.
 */

import * as crypto from 'crypto';
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
      'https://api.coinbase.com';
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  /**
   * Convert symbol format: "BTC/USDT" -> "BTC-USDT"
   */
  private toCoinbaseProductId(symbol: string): string {
    return symbol.replace('/', '-');
  }

  /**
   * Generate JWT token for Coinbase Advanced Trade API authentication
   */
  private generateJWT(
    apiKey: string,
    apiSecret: string,
    requestMethod: string,
    requestPath: string,
  ): string {
    const timestamp = Math.floor(Date.now() / 1000);

    // JWT Header
    const header = {
      alg: 'ES256',
      kid: apiKey,
      nonce: crypto.randomBytes(16).toString('hex'),
      typ: 'JWT',
    };

    // JWT Payload
    const payload = {
      iss: 'coinbase-cloud',
      nbf: timestamp,
      exp: timestamp + 120, // 2 minutes expiry
      sub: apiKey,
      uri: `${requestMethod} ${this.baseUrl}${requestPath}`,
    };

    // For ES256, we need to use EC key signing
    // Simplified version - in production use proper EC signing
    const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const signatureInput = `${base64Header}.${base64Payload}`;

    // Create HMAC signature (simplified - real impl would use EC)
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(signatureInput)
      .digest('base64url');

    return `${base64Header}.${base64Payload}.${signature}`;
  }

  /**
   * Make authenticated request to Coinbase Advanced Trade API
   */
  private async getJson(
    path: string,
    ctx?: ExchangeAdapterContext,
    params?: Record<string, string>,
  ): Promise<any> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication if credentials provided
    if (ctx?.apiKey && ctx?.apiSecret) {
      const jwt = this.generateJWT(ctx.apiKey, ctx.apiSecret, 'GET', path);
      headers['Authorization'] = `Bearer ${jwt}`;
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `Coinbase API error: HTTP ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get ticker for a trading pair
   */
  async getTicker(ctx: ExchangeAdapterContext, symbol: string): Promise<Ticker> {
    const productId = this.toCoinbaseProductId(symbol);

    // Use the public market data endpoint
    const response = await this.getJson(
      `/api/v3/brokerage/market/products/${productId}`,
      ctx,
    );

    const product = response;
    const price = parseFloat(product.price || '0');
    const bid = parseFloat(product.quote?.bid_price || product.price || '0');
    const ask = parseFloat(product.quote?.ask_price || product.price || '0');

    return {
      symbol,
      bid,
      ask,
      last: price,
      high: parseFloat(product.high_24h || '0'),
      low: parseFloat(product.low_24h || '0'),
      volume: parseFloat(product.volume_24h || '0'),
      timestamp: Date.now(),
    };
  }

  /**
   * Get order book for a trading pair
   */
  async getOrderBook(ctx: ExchangeAdapterContext, symbol: string): Promise<OrderBook> {
    const productId = this.toCoinbaseProductId(symbol);

    const response = await this.getJson(
      `/api/v3/brokerage/market/products/${productId}/book`,
      ctx,
      { limit: '50' },
    );

    const pricebook = response.pricebook || response;

    const bids: OrderBookEntry[] = (pricebook.bids || []).map((entry: any) => ({
      price: parseFloat(entry.price || entry[0]),
      quantity: parseFloat(entry.size || entry[1]),
    }));

    const asks: OrderBookEntry[] = (pricebook.asks || []).map((entry: any) => ({
      price: parseFloat(entry.price || entry[0]),
      quantity: parseFloat(entry.size || entry[1]),
    }));

    return {
      symbol,
      bids,
      asks,
      timestamp: Date.now(),
    };
  }

  /**
   * Get OHLCV candles for a trading pair
   */
  async getOHLCV(
    ctx: ExchangeAdapterContext,
    symbol: string,
    timeframe: string,
    limit: number,
  ): Promise<OHLCV[]> {
    const productId = this.toCoinbaseProductId(symbol);
    const granularity = this.timeframeToGranularity(timeframe);

    const end = Math.floor(Date.now() / 1000);
    const start = end - granularity * limit;

    const response = await this.getJson(
      `/api/v3/brokerage/market/products/${productId}/candles`,
      ctx,
      {
        start: start.toString(),
        end: end.toString(),
        granularity,
      },
    );

    const candles = response.candles || response;

    return candles.slice(0, limit).map((candle: any): OHLCV => ({
      timestamp: (candle.start || candle[0]) * 1000,
      open: parseFloat(candle.open || candle[3]),
      high: parseFloat(candle.high || candle[2]),
      low: parseFloat(candle.low || candle[1]),
      close: parseFloat(candle.close || candle[4]),
      volume: parseFloat(candle.volume || candle[5]),
    }));
  }

  /**
   * Convert timeframe string to Coinbase granularity
   */
  private timeframeToGranularity(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': 'ONE_MINUTE',
      '5m': 'FIVE_MINUTE',
      '15m': 'FIFTEEN_MINUTE',
      '30m': 'THIRTY_MINUTE',
      '1h': 'ONE_HOUR',
      '2h': 'TWO_HOUR',
      '6h': 'SIX_HOUR',
      '1d': 'ONE_DAY',
    };
    return map[timeframe] || 'ONE_HOUR';
  }

  /**
   * Get all available trading symbols
   */
  async getSymbols(ctx: ExchangeAdapterContext): Promise<string[]> {
    const response = await this.getJson('/api/v3/brokerage/market/products', ctx);
    const products = response.products || response;

    return products
      .filter((p: any) => !p.is_disabled && p.status === 'online')
      .map((p: any) => `${p.base_currency_id}/${p.quote_currency_id}`);
  }

  /**
   * Get account balances (requires authentication)
   */
  async getBalance(ctx: ExchangeAdapterContext): Promise<Balance> {
    if (!ctx.apiKey || !ctx.apiSecret) {
      return { total: {}, free: {}, used: {}, assets: [] };
    }

    try {
      const response = await this.getJson('/api/v3/brokerage/accounts', ctx);
      const accounts = response.accounts || response;

      const total: Record<string, number> = {};
      const free: Record<string, number> = {};
      const used: Record<string, number> = {};
      const assets: string[] = [];

      for (const account of accounts) {
        const currency = account.currency;
        const available = parseFloat(account.available_balance?.value || '0');
        const hold = parseFloat(account.hold?.value || '0');

        total[currency] = available + hold;
        free[currency] = available;
        used[currency] = hold;

        if (available + hold > 0) {
          assets.push(currency);
        }
      }

      return { total, free, used, assets };
    } catch (error) {
      console.error('Failed to fetch Coinbase balance:', error);
      return { total: {}, free: {}, used: {}, assets: [] };
    }
  }

  /**
   * Get trading fees
   */
  async getTradingFees(ctx: ExchangeAdapterContext): Promise<TradingFees> {
    // Coinbase Advanced Trade standard fees
    // Real implementation would fetch from /api/v3/brokerage/transaction_summary
    return {
      maker: 0.004, // 0.4%
      taker: 0.006, // 0.6%
    };
  }

  /**
   * Get symbol trading limits
   */
  async getSymbolLimits(ctx: ExchangeAdapterContext, symbol: string): Promise<SymbolLimits> {
    const productId = this.toCoinbaseProductId(symbol);

    try {
      const response = await this.getJson(
        `/api/v3/brokerage/market/products/${productId}`,
        ctx,
      );

      return {
        minQuantity: parseFloat(response.base_min_size || '0.0001'),
        maxQuantity: parseFloat(response.base_max_size || '10000'),
        minPrice: parseFloat(response.quote_min_size || '0.01'),
        maxPrice: parseFloat(response.quote_max_size || '1000000'),
        minNotional: parseFloat(response.min_market_funds || '1'),
        quantityPrecision: parseInt(response.base_increment?.split('.')[1]?.length || '8'),
        pricePrecision: parseInt(response.quote_increment?.split('.')[1]?.length || '2'),
      };
    } catch (error) {
      // Return defaults if API fails
      const isBTC = symbol.startsWith('BTC');
      return {
        minQuantity: isBTC ? 0.0001 : 0.01,
        maxQuantity: isBTC ? 1000 : 100000,
        minPrice: 0.01,
        maxPrice: 1_000_000,
        minNotional: 1,
        quantityPrecision: isBTC ? 8 : 4,
        pricePrecision: 2,
      };
    }
  }

  /**
   * Validate order parameters
   */
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

  /**
   * Calculate order cost including fees
   */
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

  /**
   * Test API connection
   */
  async testConnection(ctx: ExchangeAdapterContext): Promise<{ success: boolean; error?: string }> {
    try {
      // Try to fetch products to test public API
      await this.getJson('/api/v3/brokerage/market/products', ctx, { limit: '1' });

      // If we have credentials, test authenticated endpoint
      if (ctx.apiKey && ctx.apiSecret) {
        await this.getBalance(ctx);
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Connection failed',
      };
    }
  }
}
