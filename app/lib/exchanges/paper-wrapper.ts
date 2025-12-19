/**
 * Paper Trading Wrapper
 *
 * Wraps a real exchange adapter and simulates trades using real prices.
 * - Prices come from the REAL connected exchange
 * - Orders are simulated locally
 * - Same interface, same data, just no real money movement
 */

import {
  IExchangeAdapter,
  Ticker,
  OrderBook,
  Balance,
  Order,
  OrderRequest,
  Trade,
  Position,
  OrderStatus,
} from "./types";

const INITIAL_PAPER_BALANCE: Record<string, number> = {
  USD: 100000,
  USDT: 100000,
};

export class PaperTradingWrapper implements IExchangeAdapter {
  readonly name: string;
  readonly id: string;

  private realExchange: IExchangeAdapter;
  private balances: Map<string, { available: number; locked: number }> = new Map();
  private orders: Order[] = [];
  private trades: Trade[] = [];
  private positions: Map<string, { quantity: number; totalCost: number }> = new Map();

  constructor(realExchange: IExchangeAdapter) {
    this.realExchange = realExchange;
    this.name = `${realExchange.name} (Paper)`;
    this.id = `${realExchange.id}_paper`;
    this.reset();
  }

  reset(): void {
    this.balances.clear();
    this.orders = [];
    this.trades = [];
    this.positions.clear();

    for (const [asset, amount] of Object.entries(INITIAL_PAPER_BALANCE)) {
      this.balances.set(asset, { available: amount, locked: 0 });
    }
  }

  // ============================================
  // Connection - Delegate to real exchange
  // ============================================

  isConnected(): boolean {
    return this.realExchange.isConnected();
  }

  async connect(): Promise<void> {
    return this.realExchange.connect();
  }

  async disconnect(): Promise<void> {
    return this.realExchange.disconnect();
  }

  async testConnection(): Promise<boolean> {
    return this.realExchange.testConnection();
  }

  // ============================================
  // Market Data - All from REAL exchange
  // ============================================

  async getTicker(symbol: string): Promise<Ticker> {
    return this.realExchange.getTicker(symbol);
  }

  async getTickers(symbols?: string[]): Promise<Ticker[]> {
    return this.realExchange.getTickers(symbols);
  }

  async getOrderBook(symbol: string, limit?: number): Promise<OrderBook> {
    return this.realExchange.getOrderBook(symbol, limit);
  }

  async getTradingPairs(): Promise<string[]> {
    return this.realExchange.getTradingPairs();
  }

  // ============================================
  // Account - Simulated locally
  // ============================================

  async getBalances(): Promise<Balance[]> {
    const result: Balance[] = [];
    for (const [asset, bal] of this.balances.entries()) {
      if (bal.available > 0 || bal.locked > 0) {
        result.push({
          asset,
          available: bal.available,
          locked: bal.locked,
          total: bal.available + bal.locked,
        });
      }
    }
    return result;
  }

  async getBalance(asset: string): Promise<Balance | null> {
    const bal = this.balances.get(asset);
    if (!bal) return null;
    return {
      asset,
      available: bal.available,
      locked: bal.locked,
      total: bal.available + bal.locked,
    };
  }

  // ============================================
  // Trading - Simulated with real prices
  // ============================================

  async createOrder(request: OrderRequest): Promise<Order> {
    // Get REAL price from connected exchange
    const ticker = await this.realExchange.getTicker(request.symbol);
    const executionPrice = request.price || ticker.price;

    // Parse symbol
    const [base, quote] = request.symbol.split("/");
    const cost = request.quantity * executionPrice;

    // Create order
    const order: Order = {
      id: crypto.randomUUID(),
      exchangeOrderId: `paper_${Date.now()}`,
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      status: "pending",
      quantity: request.quantity,
      filledQuantity: 0,
      price: executionPrice,
      averagePrice: 0,
      fee: 0,
      feeCurrency: quote,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Execute market orders immediately
    if (request.type === "market") {
      if (request.side === "buy") {
        // Check quote balance
        const quoteBal = this.balances.get(quote) || { available: 0, locked: 0 };
        if (quoteBal.available < cost) {
          order.status = "rejected";
          this.orders.push(order);
          throw new Error(
            `Insufficient ${quote} balance. Need $${cost.toFixed(2)}, have $${quoteBal.available.toFixed(2)}`
          );
        }

        // Deduct quote, add base
        quoteBal.available -= cost;
        this.balances.set(quote, quoteBal);

        const baseBal = this.balances.get(base) || { available: 0, locked: 0 };
        baseBal.available += request.quantity;
        this.balances.set(base, baseBal);

        // Update position
        const pos = this.positions.get(request.symbol) || { quantity: 0, totalCost: 0 };
        pos.quantity += request.quantity;
        pos.totalCost += cost;
        this.positions.set(request.symbol, pos);

        // Simulate exchange fee (0.1%)
        const fee = cost * 0.001;
        order.fee = fee;

        order.status = "filled";
        order.filledQuantity = request.quantity;
        order.averagePrice = executionPrice;
      } else {
        // Sell
        const baseBal = this.balances.get(base) || { available: 0, locked: 0 };
        if (baseBal.available < request.quantity) {
          order.status = "rejected";
          this.orders.push(order);
          throw new Error(
            `Insufficient ${base} balance. Need ${request.quantity}, have ${baseBal.available}`
          );
        }

        // Deduct base, add quote
        baseBal.available -= request.quantity;
        this.balances.set(base, baseBal);

        const quoteBal = this.balances.get(quote) || { available: 0, locked: 0 };
        quoteBal.available += cost;
        this.balances.set(quote, quoteBal);

        // Update position
        const pos = this.positions.get(request.symbol);
        if (pos && pos.quantity > 0) {
          const avgEntry = pos.totalCost / pos.quantity;
          pos.quantity -= request.quantity;
          pos.totalCost -= request.quantity * avgEntry;
          if (pos.quantity < 0.00001) {
            this.positions.delete(request.symbol);
          }
        }

        // Simulate exchange fee (0.1%)
        const fee = cost * 0.001;
        order.fee = fee;

        order.status = "filled";
        order.filledQuantity = request.quantity;
        order.averagePrice = executionPrice;
      }

      // Record trade
      const trade: Trade = {
        id: crypto.randomUUID(),
        orderId: order.id,
        symbol: request.symbol,
        side: request.side,
        quantity: request.quantity,
        price: executionPrice,
        fee: order.fee,
        feeCurrency: quote,
        timestamp: new Date(),
      };
      this.trades.push(trade);
    } else {
      // Limit orders - store as pending
      order.status = "open";
      // Would need a price monitoring system to fill limit orders
    }

    order.updatedAt = new Date();
    this.orders.push(order);
    return order;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order || !["pending", "open"].includes(order.status)) {
      return false;
    }
    order.status = "cancelled";
    order.updatedAt = new Date();
    return true;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.find((o) => o.id === orderId) || null;
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    return this.orders.filter(
      (o) =>
        ["pending", "open"].includes(o.status) &&
        (!symbol || o.symbol === symbol)
    );
  }

  async getOrderHistory(symbol?: string, limit: number = 50): Promise<Order[]> {
    return this.orders
      .filter((o) => !symbol || o.symbol === symbol)
      .slice(-limit)
      .reverse();
  }

  // ============================================
  // Positions & Trades
  // ============================================

  async getPositions(): Promise<Position[]> {
    const result: Position[] = [];

    for (const [symbol, pos] of this.positions.entries()) {
      if (pos.quantity > 0.00001) {
        // Get REAL current price
        const ticker = await this.realExchange.getTicker(symbol);
        const entryPrice = pos.totalCost / pos.quantity;
        const unrealizedPnl = (ticker.price - entryPrice) * pos.quantity;
        const unrealizedPnlPercent = ((ticker.price - entryPrice) / entryPrice) * 100;

        result.push({
          symbol,
          side: "long",
          quantity: pos.quantity,
          entryPrice,
          currentPrice: ticker.price,
          unrealizedPnl,
          unrealizedPnlPercent,
        });
      }
    }

    return result;
  }

  async getTrades(symbol?: string, limit: number = 50): Promise<Trade[]> {
    return this.trades
      .filter((t) => !symbol || t.symbol === symbol)
      .slice(-limit)
      .reverse();
  }
}
