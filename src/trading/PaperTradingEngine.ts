/**
 * PaperTradingEngine - Simulated Trading for Safe Practice
 *
 * Provides a realistic trading simulation that:
 * - Tracks virtual balances
 * - Executes market and limit orders
 * - Maintains position tracking with P&L
 * - Records complete trade history
 */

import { v4 as uuidv4 } from 'uuid';

export interface PaperEngineConfig {
  initialBalance: Record<string, number>;
}

export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  filledQuantity: number;
  averagePrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: Date;
}

export interface Balance {
  available: number;
  locked: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
  unrealizedPnl: number;
  currentPrice: number;
}

export class PaperTradingEngine {
  private balances: Map<string, Balance> = new Map();
  private orders: Map<string, Order> = new Map();
  private trades: Trade[] = [];
  private positions: Map<string, { quantity: number; totalCost: number }> = new Map();
  private mockPrices: Map<string, number> = new Map();

  constructor(config: PaperEngineConfig) {
    // Initialize balances
    for (const [asset, amount] of Object.entries(config.initialBalance)) {
      this.balances.set(asset, { available: amount, locked: 0 });
    }
  }

  /**
   * Always returns true - this is paper trading
   */
  isTestnet(): boolean {
    return true;
  }

  /**
   * Set mock price for a symbol (for testing)
   */
  setMockPrice(symbol: string, price: number): void {
    this.mockPrices.set(symbol, price);
  }

  /**
   * Get current price for a symbol
   */
  getPrice(symbol: string): number {
    const price = this.mockPrices.get(symbol);
    if (!price) {
      throw new Error(`No price available for ${symbol}`);
    }
    return price;
  }

  /**
   * Get all balances
   */
  getBalances(): Record<string, Balance> {
    const result: Record<string, Balance> = {};
    for (const [asset, balance] of this.balances.entries()) {
      result[asset] = { ...balance };
    }
    return result;
  }

  /**
   * Create and execute an order
   */
  async createOrder(request: OrderRequest): Promise<Order> {
    const { symbol, side, type, quantity, price } = request;
    const [base, quote] = symbol.split('/');
    const currentPrice = this.getPrice(symbol);

    const order: Order = {
      id: uuidv4(),
      symbol,
      side,
      type,
      quantity,
      price: price ?? currentPrice,
      status: 'pending',
      filledQuantity: 0,
      averagePrice: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate and lock funds
    if (type === 'market') {
      // Market orders execute immediately
      if (side === 'buy') {
        const cost = quantity * currentPrice;
        this.validateAndLockQuote(quote, cost);
        this.executeBuy(order, base, quote, quantity, currentPrice);
      } else {
        this.validateAndLockBase(base, quantity);
        this.executeSell(order, base, quote, quantity, currentPrice);
      }
    } else {
      // Limit orders
      const orderPrice = price!;
      if (side === 'buy') {
        const cost = quantity * orderPrice;
        this.validateAndLockQuote(quote, cost);

        // Check if limit buy can fill immediately (price at or below current)
        if (orderPrice >= currentPrice) {
          this.executeBuy(order, base, quote, quantity, currentPrice);
        }
      } else {
        this.validateAndLockBase(base, quantity);

        // Check if limit sell can fill immediately (price at or above current)
        if (orderPrice <= currentPrice) {
          this.executeSell(order, base, quote, quantity, currentPrice);
        }
      }
    }

    this.orders.set(order.id, order);
    return order;
  }

  /**
   * Validate sufficient quote currency and lock it
   */
  private validateAndLockQuote(quote: string, amount: number): void {
    const balance = this.balances.get(quote);
    if (!balance || balance.available < amount) {
      throw new Error(`Insufficient ${quote} balance`);
    }
    balance.available -= amount;
    balance.locked += amount;
  }

  /**
   * Validate sufficient base currency and lock it
   */
  private validateAndLockBase(base: string, quantity: number): void {
    const balance = this.balances.get(base);
    if (!balance || balance.available < quantity) {
      throw new Error(`Insufficient ${base} balance`);
    }
    balance.available -= quantity;
    balance.locked += quantity;
  }

  /**
   * Execute a buy order
   */
  private executeBuy(
    order: Order,
    base: string,
    quote: string,
    quantity: number,
    price: number
  ): void {
    const cost = quantity * price;

    // Unlock and deduct quote
    const quoteBalance = this.balances.get(quote)!;
    quoteBalance.locked -= cost;
    // Note: available was already deducted when locked

    // Add base asset
    const baseBalance = this.balances.get(base) ?? { available: 0, locked: 0 };
    baseBalance.available += quantity;
    this.balances.set(base, baseBalance);

    // Update position
    this.updatePosition(base, quantity, price);

    // Record trade
    this.recordTrade(order.id, order.symbol, 'buy', quantity, price);

    // Update order
    order.status = 'filled';
    order.filledQuantity = quantity;
    order.averagePrice = price;
    order.updatedAt = new Date();
  }

  /**
   * Execute a sell order
   */
  private executeSell(
    order: Order,
    base: string,
    quote: string,
    quantity: number,
    price: number
  ): void {
    const proceeds = quantity * price;

    // Unlock and deduct base
    const baseBalance = this.balances.get(base)!;
    baseBalance.locked -= quantity;
    // Note: available was already deducted when locked

    // Add quote
    const quoteBalance = this.balances.get(quote) ?? { available: 0, locked: 0 };
    quoteBalance.available += proceeds;
    this.balances.set(quote, quoteBalance);

    // Update position
    this.updatePosition(base, -quantity, price);

    // Record trade
    this.recordTrade(order.id, order.symbol, 'sell', quantity, price);

    // Update order
    order.status = 'filled';
    order.filledQuantity = quantity;
    order.averagePrice = price;
    order.updatedAt = new Date();
  }

  /**
   * Update position tracking
   */
  private updatePosition(asset: string, quantityDelta: number, price: number): void {
    const current = this.positions.get(asset) ?? { quantity: 0, totalCost: 0 };

    if (quantityDelta > 0) {
      // Buying - add to position
      current.totalCost += quantityDelta * price;
      current.quantity += quantityDelta;
    } else {
      // Selling - reduce position
      const sellQuantity = Math.abs(quantityDelta);
      if (current.quantity > 0) {
        const avgPrice = current.totalCost / current.quantity;
        current.totalCost -= sellQuantity * avgPrice;
        current.quantity -= sellQuantity;
      }
    }

    if (current.quantity <= 0) {
      this.positions.delete(asset);
    } else {
      this.positions.set(asset, current);
    }
  }

  /**
   * Record a trade
   */
  private recordTrade(
    orderId: string,
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price: number
  ): void {
    this.trades.push({
      id: uuidv4(),
      orderId,
      symbol,
      side,
      quantity,
      price,
      timestamp: new Date()
    });
  }

  /**
   * Process pending limit orders
   */
  async processPendingOrders(): Promise<void> {
    for (const order of this.orders.values()) {
      if (order.status !== 'pending') continue;

      const currentPrice = this.getPrice(order.symbol);
      const [base, quote] = order.symbol.split('/');

      if (order.side === 'buy' && order.price! >= currentPrice) {
        // Limit buy fills when price drops to limit
        this.executeBuy(order, base, quote, order.quantity, currentPrice);
      } else if (order.side === 'sell' && order.price! <= currentPrice) {
        // Limit sell fills when price rises to limit
        this.executeSell(order, base, quote, order.quantity, currentPrice);
      }
    }
  }

  /**
   * Get a specific order
   */
  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get all orders
   */
  getOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  /**
   * Get open (pending) orders
   */
  getOpenOrders(): Order[] {
    return this.getOrders().filter(o => o.status === 'pending');
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'filled') {
      throw new Error('Cannot cancel filled order');
    }

    if (order.status === 'cancelled') {
      throw new Error('Order already cancelled');
    }

    // Release locked funds
    const [base, quote] = order.symbol.split('/');

    if (order.side === 'buy') {
      const cost = order.quantity * order.price!;
      const quoteBalance = this.balances.get(quote)!;
      quoteBalance.locked -= cost;
      quoteBalance.available += cost;
    } else {
      const baseBalance = this.balances.get(base)!;
      baseBalance.locked -= order.quantity;
      baseBalance.available += order.quantity;
    }

    order.status = 'cancelled';
    order.updatedAt = new Date();

    return order;
  }

  /**
   * Get all positions
   */
  getPositions(): Record<string, Position> {
    const result: Record<string, Position> = {};

    for (const [asset, position] of this.positions.entries()) {
      // Find a symbol for this asset to get current price
      const symbol = `${asset}/USDT`;
      const currentPrice = this.mockPrices.get(symbol) ?? 0;
      const avgEntryPrice = position.quantity > 0
        ? position.totalCost / position.quantity
        : 0;

      result[asset] = {
        symbol: asset,
        quantity: position.quantity,
        averageEntryPrice: avgEntryPrice,
        currentPrice,
        unrealizedPnl: (currentPrice - avgEntryPrice) * position.quantity
      };
    }

    return result;
  }

  /**
   * Get total portfolio value in USDT
   */
  getPortfolioValue(): number {
    let total = 0;

    // Add USDT balance
    const usdtBalance = this.balances.get('USDT');
    if (usdtBalance) {
      total += usdtBalance.available + usdtBalance.locked;
    }

    // Add value of other assets
    for (const [asset, balance] of this.balances.entries()) {
      if (asset === 'USDT') continue;

      const symbol = `${asset}/USDT`;
      const price = this.mockPrices.get(symbol) ?? 0;
      total += (balance.available + balance.locked) * price;
    }

    return total;
  }

  /**
   * Get trade history
   */
  getTrades(): Trade[] {
    return [...this.trades];
  }
}
