/**
 * Coinbase Exchange Adapter
 *
 * Connects to Coinbase Advanced Trade API for real-time data and trading.
 * All prices, balances, and order data come directly from your Coinbase account.
 */

import {
  IExchangeAdapter,
  ExchangeCredentials,
  Ticker,
  OrderBook,
  Balance,
  Order,
  OrderRequest,
  Trade,
  Position,
} from "./types";
import crypto from "crypto";

// Coinbase API endpoints
const COINBASE_API_URL = "https://api.coinbase.com";
const COINBASE_ADVANCED_API_URL = "https://api.coinbase.com/api/v3/brokerage";

// Symbol mapping: Our format -> Coinbase format
const SYMBOL_TO_COINBASE: Record<string, string> = {
  "BTC/USDT": "BTC-USDT",
  "BTC/USD": "BTC-USD",
  "ETH/USDT": "ETH-USDT",
  "ETH/USD": "ETH-USD",
  "SOL/USDT": "SOL-USDT",
  "SOL/USD": "SOL-USD",
  "DOGE/USDT": "DOGE-USDT",
  "DOGE/USD": "DOGE-USD",
  "XRP/USD": "XRP-USD",
  "ADA/USD": "ADA-USD",
  "AVAX/USD": "AVAX-USD",
  "LINK/USD": "LINK-USD",
  "DOT/USD": "DOT-USD",
  "MATIC/USD": "MATIC-USD",
  "LTC/USD": "LTC-USD",
  "UNI/USD": "UNI-USD",
  "ATOM/USD": "ATOM-USD",
};

// Reverse mapping
const COINBASE_TO_SYMBOL: Record<string, string> = Object.entries(SYMBOL_TO_COINBASE).reduce(
  (acc, [key, value]) => ({ ...acc, [value]: key }),
  {}
);

export class CoinbaseAdapter implements IExchangeAdapter {
  readonly name = "Coinbase";
  readonly id = "coinbase";

  private credentials: ExchangeCredentials;
  private connected: boolean = false;
  private cachedProducts: string[] = [];

  constructor(credentials: ExchangeCredentials) {
    this.credentials = credentials;
  }

  // ============================================
  // Authentication & Signing
  // ============================================

  private generateSignature(
    timestamp: string,
    method: string,
    path: string,
    body: string = ""
  ): string {
    const message = timestamp + method + path + body;
    return crypto
      .createHmac("sha256", this.credentials.apiSecret)
      .update(message)
      .digest("hex");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: object,
    isPublic: boolean = false
  ): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyString = body ? JSON.stringify(body) : "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!isPublic) {
      const signature = this.generateSignature(timestamp, method, path, bodyString);
      headers["CB-ACCESS-KEY"] = this.credentials.apiKey;
      headers["CB-ACCESS-SIGN"] = signature;
      headers["CB-ACCESS-TIMESTAMP"] = timestamp;
    }

    const url = path.startsWith("/api/v3")
      ? `${COINBASE_API_URL}${path}`
      : `${COINBASE_ADVANCED_API_URL}${path}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? bodyString : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Coinbase API error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  // ============================================
  // Connection
  // ============================================

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    // Test connection by fetching accounts
    await this.testConnection();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request("GET", "/accounts");
      return true;
    } catch (error) {
      console.error("Coinbase connection test failed:", error);
      return false;
    }
  }

  // ============================================
  // Market Data
  // ============================================

  async getTicker(symbol: string): Promise<Ticker> {
    const productId = SYMBOL_TO_COINBASE[symbol] || symbol.replace("/", "-");

    // Get product ticker
    const ticker = await this.request<{
      trades: Array<{
        price: string;
        size: string;
        time: string;
        side: string;
      }>;
    }>("GET", `/products/${productId}/ticker`, undefined, true);

    // Get 24hr stats
    const stats = await this.request<{
      open: string;
      high: string;
      low: string;
      volume: string;
      last: string;
    }>("GET", `/products/${productId}/stats`, undefined, true);

    const price = parseFloat(stats.last || ticker.trades?.[0]?.price || "0");
    const open = parseFloat(stats.open || "0");
    const change24h = price - open;
    const changePercent24h = open > 0 ? (change24h / open) * 100 : 0;

    return {
      symbol,
      price,
      bid: price * 0.9999, // Approximate - would need order book for real bid
      ask: price * 1.0001, // Approximate
      volume24h: parseFloat(stats.volume || "0"),
      change24h,
      changePercent24h,
      high24h: parseFloat(stats.high || "0"),
      low24h: parseFloat(stats.low || "0"),
      timestamp: new Date(),
    };
  }

  async getTickers(symbols?: string[]): Promise<Ticker[]> {
    const pairs = symbols || Object.keys(SYMBOL_TO_COINBASE);
    const tickers: Ticker[] = [];

    // Fetch in parallel with rate limiting
    const batchSize = 5;
    for (let i = 0; i < pairs.length; i += batchSize) {
      const batch = pairs.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((symbol) =>
          this.getTicker(symbol).catch((err) => {
            console.warn(`Failed to get ticker for ${symbol}:`, err.message);
            return null;
          })
        )
      );
      tickers.push(...results.filter((t): t is Ticker => t !== null));
    }

    return tickers;
  }

  async getOrderBook(symbol: string, limit: number = 50): Promise<OrderBook> {
    const productId = SYMBOL_TO_COINBASE[symbol] || symbol.replace("/", "-");

    const book = await this.request<{
      bids: Array<[string, string, number]>;
      asks: Array<[string, string, number]>;
    }>("GET", `/products/${productId}/book?level=2`, undefined, true);

    return {
      symbol,
      bids: book.bids.slice(0, limit).map(([price, quantity]) => ({
        price: parseFloat(price),
        quantity: parseFloat(quantity),
      })),
      asks: book.asks.slice(0, limit).map(([price, quantity]) => ({
        price: parseFloat(price),
        quantity: parseFloat(quantity),
      })),
      timestamp: new Date(),
    };
  }

  async getTradingPairs(): Promise<string[]> {
    if (this.cachedProducts.length > 0) {
      return this.cachedProducts;
    }

    const products = await this.request<{
      products: Array<{ product_id: string; status: string }>;
    }>("GET", "/products", undefined, true);

    this.cachedProducts = products.products
      .filter((p) => p.status === "online")
      .map((p) => COINBASE_TO_SYMBOL[p.product_id] || p.product_id.replace("-", "/"));

    return this.cachedProducts;
  }

  // ============================================
  // Account
  // ============================================

  async getBalances(): Promise<Balance[]> {
    const accounts = await this.request<{
      accounts: Array<{
        currency: string;
        available_balance: { value: string };
        hold: { value: string };
      }>;
    }>("GET", "/accounts");

    return accounts.accounts
      .map((acc) => ({
        asset: acc.currency,
        available: parseFloat(acc.available_balance?.value || "0"),
        locked: parseFloat(acc.hold?.value || "0"),
        total: parseFloat(acc.available_balance?.value || "0") + parseFloat(acc.hold?.value || "0"),
      }))
      .filter((b) => b.total > 0);
  }

  async getBalance(asset: string): Promise<Balance | null> {
    const balances = await this.getBalances();
    return balances.find((b) => b.asset === asset) || null;
  }

  // ============================================
  // Trading
  // ============================================

  async createOrder(request: OrderRequest): Promise<Order> {
    const productId = SYMBOL_TO_COINBASE[request.symbol] || request.symbol.replace("/", "-");
    const clientOrderId = request.clientOrderId || crypto.randomUUID();

    const orderConfig: Record<string, unknown> = {
      client_order_id: clientOrderId,
      product_id: productId,
      side: request.side.toUpperCase(),
    };

    if (request.type === "market") {
      orderConfig.order_configuration = {
        market_market_ioc: {
          quote_size: request.side === "buy"
            ? (request.quantity * (request.price || 0)).toString()
            : undefined,
          base_size: request.side === "sell" ? request.quantity.toString() : undefined,
        },
      };
    } else if (request.type === "limit") {
      orderConfig.order_configuration = {
        limit_limit_gtc: {
          base_size: request.quantity.toString(),
          limit_price: request.price?.toString(),
        },
      };
    }

    const result = await this.request<{
      success: boolean;
      order_id: string;
      client_order_id: string;
      failure_reason?: string;
    }>("POST", "/orders", orderConfig);

    if (!result.success) {
      throw new Error(`Order failed: ${result.failure_reason || "Unknown error"}`);
    }

    // Fetch the created order
    const order = await this.getOrder(result.order_id);
    if (!order) {
      throw new Error("Order created but could not be retrieved");
    }

    return order;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      await this.request("POST", "/orders/batch_cancel", {
        order_ids: [orderId],
      });
      return true;
    } catch {
      return false;
    }
  }

  async getOrder(orderId: string): Promise<Order | null> {
    try {
      const result = await this.request<{
        order: {
          order_id: string;
          client_order_id: string;
          product_id: string;
          side: string;
          status: string;
          order_type: string;
          created_time: string;
          filled_size: string;
          average_filled_price: string;
          total_fees: string;
          order_configuration: {
            limit_limit_gtc?: { base_size: string; limit_price: string };
            market_market_ioc?: { quote_size?: string; base_size?: string };
          };
        };
      }>("GET", `/orders/historical/${orderId}`);

      const order = result.order;
      const symbol = COINBASE_TO_SYMBOL[order.product_id] || order.product_id.replace("-", "/");

      return {
        id: order.order_id,
        exchangeOrderId: order.order_id,
        clientOrderId: order.client_order_id,
        symbol,
        side: order.side.toLowerCase() as "buy" | "sell",
        type: order.order_type.includes("LIMIT") ? "limit" : "market",
        status: this.mapOrderStatus(order.status),
        quantity: parseFloat(
          order.order_configuration.limit_limit_gtc?.base_size ||
          order.order_configuration.market_market_ioc?.base_size ||
          "0"
        ),
        filledQuantity: parseFloat(order.filled_size || "0"),
        price: parseFloat(order.order_configuration.limit_limit_gtc?.limit_price || "0"),
        averagePrice: parseFloat(order.average_filled_price || "0"),
        fee: parseFloat(order.total_fees || "0"),
        feeCurrency: "USD",
        createdAt: new Date(order.created_time),
        updatedAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const productId = symbol
      ? SYMBOL_TO_COINBASE[symbol] || symbol.replace("/", "-")
      : undefined;

    const params = productId ? `?product_id=${productId}` : "";
    const result = await this.request<{
      orders: Array<{
        order_id: string;
        client_order_id: string;
        product_id: string;
        side: string;
        status: string;
        order_type: string;
        created_time: string;
        filled_size: string;
        average_filled_price: string;
        total_fees: string;
        order_configuration: Record<string, unknown>;
      }>;
    }>("GET", `/orders/historical/batch${params}&order_status=OPEN`);

    return result.orders.map((o) => ({
      id: o.order_id,
      exchangeOrderId: o.order_id,
      clientOrderId: o.client_order_id,
      symbol: COINBASE_TO_SYMBOL[o.product_id] || o.product_id.replace("-", "/"),
      side: o.side.toLowerCase() as "buy" | "sell",
      type: o.order_type.includes("LIMIT") ? "limit" as const : "market" as const,
      status: this.mapOrderStatus(o.status),
      quantity: 0, // Would need to parse from order_configuration
      filledQuantity: parseFloat(o.filled_size || "0"),
      price: 0,
      averagePrice: parseFloat(o.average_filled_price || "0"),
      fee: parseFloat(o.total_fees || "0"),
      feeCurrency: "USD",
      createdAt: new Date(o.created_time),
      updatedAt: new Date(),
    }));
  }

  async getOrderHistory(symbol?: string, limit: number = 50): Promise<Order[]> {
    const productId = symbol
      ? SYMBOL_TO_COINBASE[symbol] || symbol.replace("/", "-")
      : undefined;

    const params = productId ? `?product_id=${productId}&limit=${limit}` : `?limit=${limit}`;
    const result = await this.request<{
      orders: Array<{
        order_id: string;
        client_order_id: string;
        product_id: string;
        side: string;
        status: string;
        order_type: string;
        created_time: string;
        filled_size: string;
        average_filled_price: string;
        total_fees: string;
      }>;
    }>("GET", `/orders/historical/batch${params}`);

    return result.orders.map((o) => ({
      id: o.order_id,
      exchangeOrderId: o.order_id,
      clientOrderId: o.client_order_id,
      symbol: COINBASE_TO_SYMBOL[o.product_id] || o.product_id.replace("-", "/"),
      side: o.side.toLowerCase() as "buy" | "sell",
      type: o.order_type.includes("LIMIT") ? "limit" as const : "market" as const,
      status: this.mapOrderStatus(o.status),
      quantity: 0,
      filledQuantity: parseFloat(o.filled_size || "0"),
      price: 0,
      averagePrice: parseFloat(o.average_filled_price || "0"),
      fee: parseFloat(o.total_fees || "0"),
      feeCurrency: "USD",
      createdAt: new Date(o.created_time),
      updatedAt: new Date(),
    }));
  }

  // ============================================
  // Positions & Trades
  // ============================================

  async getPositions(): Promise<Position[]> {
    // Coinbase doesn't have margin/positions in the traditional sense
    // We calculate positions from balances and their USD value
    const balances = await this.getBalances();
    const positions: Position[] = [];

    for (const balance of balances) {
      if (balance.asset === "USD" || balance.asset === "USDT" || balance.total === 0) {
        continue;
      }

      try {
        const ticker = await this.getTicker(`${balance.asset}/USD`);
        positions.push({
          symbol: `${balance.asset}/USD`,
          side: "long",
          quantity: balance.total,
          entryPrice: 0, // Would need trade history to calculate
          currentPrice: ticker.price,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
        });
      } catch {
        // Skip assets without USD pairs
      }
    }

    return positions;
  }

  async getTrades(symbol?: string, limit: number = 50): Promise<Trade[]> {
    const productId = symbol
      ? SYMBOL_TO_COINBASE[symbol] || symbol.replace("/", "-")
      : undefined;

    const params = productId ? `?product_id=${productId}&limit=${limit}` : `?limit=${limit}`;
    const result = await this.request<{
      fills: Array<{
        entry_id: string;
        order_id: string;
        product_id: string;
        side: string;
        size: string;
        price: string;
        commission: string;
        trade_time: string;
      }>;
    }>("GET", `/orders/historical/fills${params}`);

    return result.fills.map((f) => ({
      id: f.entry_id,
      orderId: f.order_id,
      symbol: COINBASE_TO_SYMBOL[f.product_id] || f.product_id.replace("-", "/"),
      side: f.side.toLowerCase() as "buy" | "sell",
      quantity: parseFloat(f.size),
      price: parseFloat(f.price),
      fee: parseFloat(f.commission || "0"),
      feeCurrency: "USD",
      timestamp: new Date(f.trade_time),
    }));
  }

  // ============================================
  // Helpers
  // ============================================

  private mapOrderStatus(status: string): Order["status"] {
    switch (status) {
      case "PENDING":
        return "pending";
      case "OPEN":
        return "open";
      case "FILLED":
        return "filled";
      case "CANCELLED":
        return "cancelled";
      case "EXPIRED":
      case "FAILED":
        return "rejected";
      default:
        return "pending";
    }
  }
}
