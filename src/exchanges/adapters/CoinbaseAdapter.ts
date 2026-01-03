/**
 * CoinbaseAdapter - ExchangeAdapter implementation for Coinbase Advanced Trade API
 *
 * This adapter uses Coinbase's Advanced Trade API (api.coinbase.com)
 * which replaced the deprecated Coinbase Pro API.
 *
 * Authentication uses JWT tokens signed with ES256 (ECDSA P-256).
 *
 * PUBLIC ENDPOINTS (No API keys needed - great for paper trading!):
 * - GET /api/v3/brokerage/market/products - List all products
 * - GET /api/v3/brokerage/market/products/{product_id} - Get product details/ticker
 * - GET /api/v3/brokerage/market/products/{product_id}/book - Order book
 * - GET /api/v3/brokerage/market/products/{product_id}/candles - OHLCV data
 *
 * AUTHENTICATED ENDPOINTS (Require CDP API keys):
 * - GET /api/v3/brokerage/accounts - Account balances
 * - POST /api/v3/brokerage/orders - Place orders
 * - GET /api/v3/brokerage/orders - List orders
 * - DELETE /api/v3/brokerage/orders/batch_cancel - Cancel orders
 *
 * API Key Format (CDP - Coinbase Developer Platform):
 * - Key name: "organizations/{org_id}/apiKeys/{key_id}"
 * - Key secret: PEM-formatted EC private key
 */

import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
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

export interface CoinbaseOrder {
  orderId: string;
  clientOrderId: string;
  productId: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LIMIT';
  status: string;
  filledSize: string;
  filledValue: string;
  averageFilledPrice: string;
  createdTime: string;
}

export interface CreateOrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop_limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  clientOrderId?: string;
}

export interface CreateOrderResult {
  success: boolean;
  orderId?: string;
  clientOrderId?: string;
  error?: string;
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
   * Convert Coinbase product ID back to standard format: "BTC-USDT" -> "BTC/USDT"
   */
  private fromCoinbaseProductId(productId: string): string {
    return productId.replace('-', '/');
  }

  /**
   * Generate JWT token for Coinbase Advanced Trade API authentication
   *
   * Uses ES256 (ECDSA with P-256 curve) as required by Coinbase CDP API.
   * The API secret must be a PEM-formatted EC private key.
   *
   * @param apiKey - CDP API key in format "organizations/{org_id}/apiKeys/{key_id}"
   * @param apiSecret - PEM-formatted EC private key
   * @param requestMethod - HTTP method (GET, POST, DELETE, etc.)
   * @param requestPath - API path (e.g., "/api/v3/brokerage/accounts")
   */
  private generateJWT(
    apiKey: string,
    apiSecret: string,
    requestMethod: string,
    requestPath: string,
  ): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(16).toString('hex');

    // JWT Payload as per Coinbase CDP specification
    const payload = {
      iss: 'coinbase-cloud',
      nbf: timestamp,
      exp: timestamp + 120, // 2 minutes expiry
      sub: apiKey,
      uri: `${requestMethod} api.coinbase.com${requestPath}`,
    };

    // Ensure the secret is properly formatted as PEM
    let pemKey = apiSecret;
    if (!pemKey.includes('-----BEGIN')) {
      // If it's not already PEM formatted, assume it's base64 encoded
      pemKey = `-----BEGIN EC PRIVATE KEY-----\n${apiSecret}\n-----END EC PRIVATE KEY-----`;
    }

    // Sign with ES256 (ECDSA P-256) algorithm
    const token = jwt.sign(payload, pemKey, {
      algorithm: 'ES256',
      header: {
        alg: 'ES256',
        kid: apiKey,
        nonce: nonce,
        typ: 'JWT',
      },
    });

    return token;
  }

  /**
   * Make authenticated request to Coinbase Advanced Trade API
   */
  private async request(
    method: string,
    path: string,
    ctx?: ExchangeAdapterContext,
    params?: Record<string, string>,
    body?: Record<string, unknown>,
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
      const jwt = this.generateJWT(ctx.apiKey, ctx.apiSecret, method, path);
      headers['Authorization'] = `Bearer ${jwt}`;
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
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
   * Make GET request (convenience method)
   */
  private async getJson(
    path: string,
    ctx?: ExchangeAdapterContext,
    params?: Record<string, string>,
  ): Promise<any> {
    return this.request('GET', path, ctx, params);
  }

  /**
   * Make POST request (convenience method)
   */
  private async postJson(
    path: string,
    ctx: ExchangeAdapterContext,
    body: Record<string, unknown>,
  ): Promise<any> {
    return this.request('POST', path, ctx, undefined, body);
  }

  /**
   * Get ticker for a trading pair
   * PUBLIC ENDPOINT - No authentication required
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
   * PUBLIC ENDPOINT - No authentication required
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
   * PUBLIC ENDPOINT - No authentication required
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
    const start = end - this.granularityToSeconds(granularity) * limit;

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
   * Convert granularity to seconds for time calculations
   */
  private granularityToSeconds(granularity: string): number {
    const map: Record<string, number> = {
      'ONE_MINUTE': 60,
      'FIVE_MINUTE': 300,
      'FIFTEEN_MINUTE': 900,
      'THIRTY_MINUTE': 1800,
      'ONE_HOUR': 3600,
      'TWO_HOUR': 7200,
      'SIX_HOUR': 21600,
      'ONE_DAY': 86400,
    };
    return map[granularity] || 3600;
  }

  /**
   * Get all available trading symbols
   * PUBLIC ENDPOINT - No authentication required
   */
  async getSymbols(ctx: ExchangeAdapterContext): Promise<string[]> {
    const response = await this.getJson('/api/v3/brokerage/market/products', ctx);
    const products = response.products || response;

    return products
      .filter((p: any) => !p.is_disabled && p.status === 'online')
      .map((p: any) => `${p.base_currency_id}/${p.quote_currency_id}`);
  }

  /**
   * Get account balances
   * AUTHENTICATED ENDPOINT - Requires valid CDP API keys
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
   * AUTHENTICATED ENDPOINT - Returns actual fees if authenticated, defaults otherwise
   */
  async getTradingFees(ctx: ExchangeAdapterContext): Promise<TradingFees> {
    if (ctx.apiKey && ctx.apiSecret) {
      try {
        const response = await this.getJson('/api/v3/brokerage/transaction_summary', ctx);
        return {
          maker: parseFloat(response.maker_fee_rate || '0.004'),
          taker: parseFloat(response.taker_fee_rate || '0.006'),
        };
      } catch {
        // Fall through to defaults
      }
    }

    // Coinbase Advanced Trade standard fees
    return {
      maker: 0.004, // 0.4%
      taker: 0.006, // 0.6%
    };
  }

  /**
   * Get symbol trading limits
   * PUBLIC ENDPOINT - No authentication required
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
        quantityPrecision: this.getPrecision(response.base_increment),
        pricePrecision: this.getPrecision(response.quote_increment),
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
   * Get decimal precision from increment string
   */
  private getPrecision(increment?: string): number {
    if (!increment) return 8;
    const parts = increment.split('.');
    return parts.length > 1 ? parts[1].length : 0;
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
   * Create/Place an order
   * AUTHENTICATED ENDPOINT - Requires valid CDP API keys
   */
  async createOrder(
    ctx: ExchangeAdapterContext,
    params: CreateOrderParams,
  ): Promise<CreateOrderResult> {
    if (!ctx.apiKey || !ctx.apiSecret) {
      return { success: false, error: 'API credentials required for trading' };
    }

    // Validate order params first
    const validation = await this.validateOrderParams(ctx, {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: params.quantity,
      price: params.price,
    });

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const productId = this.toCoinbaseProductId(params.symbol);
    const clientOrderId = params.clientOrderId || crypto.randomUUID();

    // Build order configuration based on order type
    let orderConfiguration: Record<string, unknown>;

    if (params.type === 'market') {
      orderConfiguration = {
        market_market_ioc: {
          base_size: params.quantity.toString(),
        },
      };
    } else if (params.type === 'limit') {
      orderConfiguration = {
        limit_limit_gtc: {
          base_size: params.quantity.toString(),
          limit_price: params.price!.toString(),
          post_only: false,
        },
      };
    } else if (params.type === 'stop_limit') {
      orderConfiguration = {
        stop_limit_stop_limit_gtc: {
          base_size: params.quantity.toString(),
          limit_price: params.price!.toString(),
          stop_price: params.stopPrice!.toString(),
          stop_direction: params.side === 'buy' ? 'STOP_DIRECTION_STOP_UP' : 'STOP_DIRECTION_STOP_DOWN',
        },
      };
    } else {
      return { success: false, error: `Unsupported order type: ${params.type}` };
    }

    try {
      const response = await this.postJson('/api/v3/brokerage/orders', ctx, {
        client_order_id: clientOrderId,
        product_id: productId,
        side: params.side.toUpperCase(),
        order_configuration: orderConfiguration,
      });

      if (response.success === false || response.error_response) {
        return {
          success: false,
          error: response.error_response?.message || response.failure_reason || 'Order failed',
        };
      }

      return {
        success: true,
        orderId: response.success_response?.order_id || response.order_id,
        clientOrderId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create order',
      };
    }
  }

  /**
   * Cancel an order by ID
   * AUTHENTICATED ENDPOINT - Requires valid CDP API keys
   */
  async cancelOrder(
    ctx: ExchangeAdapterContext,
    orderId: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!ctx.apiKey || !ctx.apiSecret) {
      return { success: false, error: 'API credentials required' };
    }

    try {
      const response = await this.postJson('/api/v3/brokerage/orders/batch_cancel', ctx, {
        order_ids: [orderId],
      });

      const result = response.results?.[0];
      if (result?.success) {
        return { success: true };
      }

      return {
        success: false,
        error: result?.failure_reason || 'Cancel failed',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to cancel order',
      };
    }
  }

  /**
   * Get order by ID
   * AUTHENTICATED ENDPOINT - Requires valid CDP API keys
   */
  async getOrder(
    ctx: ExchangeAdapterContext,
    orderId: string,
  ): Promise<CoinbaseOrder | null> {
    if (!ctx.apiKey || !ctx.apiSecret) {
      return null;
    }

    try {
      const response = await this.getJson(`/api/v3/brokerage/orders/historical/${orderId}`, ctx);
      const order = response.order;

      if (!order) return null;

      return {
        orderId: order.order_id,
        clientOrderId: order.client_order_id,
        productId: order.product_id,
        side: order.side,
        type: order.order_type,
        status: order.status,
        filledSize: order.filled_size || '0',
        filledValue: order.filled_value || '0',
        averageFilledPrice: order.average_filled_price || '0',
        createdTime: order.created_time,
      };
    } catch (error) {
      console.error('Failed to get order:', error);
      return null;
    }
  }

  /**
   * Get open orders
   * AUTHENTICATED ENDPOINT - Requires valid CDP API keys
   */
  async getOpenOrders(
    ctx: ExchangeAdapterContext,
    symbol?: string,
  ): Promise<CoinbaseOrder[]> {
    if (!ctx.apiKey || !ctx.apiSecret) {
      return [];
    }

    try {
      const params: Record<string, string> = {
        order_status: 'OPEN',
      };

      if (symbol) {
        params.product_id = this.toCoinbaseProductId(symbol);
      }

      const response = await this.getJson('/api/v3/brokerage/orders/historical', ctx, params);
      const orders = response.orders || [];

      return orders.map((order: any): CoinbaseOrder => ({
        orderId: order.order_id,
        clientOrderId: order.client_order_id,
        productId: order.product_id,
        side: order.side,
        type: order.order_type,
        status: order.status,
        filledSize: order.filled_size || '0',
        filledValue: order.filled_value || '0',
        averageFilledPrice: order.average_filled_price || '0',
        createdTime: order.created_time,
      }));
    } catch (error) {
      console.error('Failed to get open orders:', error);
      return [];
    }
  }

  /**
   * Get order history
   * AUTHENTICATED ENDPOINT - Requires valid CDP API keys
   */
  async getOrderHistory(
    ctx: ExchangeAdapterContext,
    symbol?: string,
    limit: number = 100,
  ): Promise<CoinbaseOrder[]> {
    if (!ctx.apiKey || !ctx.apiSecret) {
      return [];
    }

    try {
      const params: Record<string, string> = {
        limit: limit.toString(),
      };

      if (symbol) {
        params.product_id = this.toCoinbaseProductId(symbol);
      }

      const response = await this.getJson('/api/v3/brokerage/orders/historical', ctx, params);
      const orders = response.orders || [];

      return orders.map((order: any): CoinbaseOrder => ({
        orderId: order.order_id,
        clientOrderId: order.client_order_id,
        productId: order.product_id,
        side: order.side,
        type: order.order_type,
        status: order.status,
        filledSize: order.filled_size || '0',
        filledValue: order.filled_value || '0',
        averageFilledPrice: order.average_filled_price || '0',
        createdTime: order.created_time,
      }));
    } catch (error) {
      console.error('Failed to get order history:', error);
      return [];
    }
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
