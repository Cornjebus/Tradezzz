/**
 * Trading Services for Next.js
 * Paper Trading Engine and Trading Mode Manager
 */

// ============================================
// TYPES
// ============================================

export type TradingMode = "paper" | "live";
export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop_loss" | "take_profit";
export type OrderStatus = "pending" | "filled" | "cancelled" | "rejected";

export interface Balance {
  available: number;
  locked: number;
}

export interface PaperOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  status: OrderStatus;
  filledQuantity: number;
  averagePrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Position {
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
  unrealizedPnl: number;
  currentPrice: number;
}

export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  timestamp: Date;
}

// ============================================
// PAPER TRADING ENGINE
// ============================================

const DEFAULT_INITIAL_BALANCE: Record<string, number> = {
  USDT: 100000,
  USD: 100000,
};

class PaperTradingEngine {
  private userBalances: Map<string, Map<string, Balance>> = new Map();
  private userOrders: Map<string, PaperOrder[]> = new Map();
  private userTrades: Map<string, Trade[]> = new Map();
  private userPositions: Map<string, Map<string, { quantity: number; totalCost: number }>> = new Map();
  private mockPrices: Map<string, number> = new Map();

  constructor() {
    // Set some default mock prices
    this.mockPrices.set("BTC/USDT", 45000);
    this.mockPrices.set("ETH/USDT", 2500);
    this.mockPrices.set("SOL/USDT", 100);
    this.mockPrices.set("AAPL", 175);
    this.mockPrices.set("GOOGL", 140);
  }

  private getUserBalances(userId: string): Map<string, Balance> {
    if (!this.userBalances.has(userId)) {
      const balances = new Map<string, Balance>();
      for (const [asset, amount] of Object.entries(DEFAULT_INITIAL_BALANCE)) {
        balances.set(asset, { available: amount, locked: 0 });
      }
      this.userBalances.set(userId, balances);
    }
    return this.userBalances.get(userId)!;
  }

  private getUserOrders(userId: string): PaperOrder[] {
    if (!this.userOrders.has(userId)) {
      this.userOrders.set(userId, []);
    }
    return this.userOrders.get(userId)!;
  }

  private getUserTrades(userId: string): Trade[] {
    if (!this.userTrades.has(userId)) {
      this.userTrades.set(userId, []);
    }
    return this.userTrades.get(userId)!;
  }

  private getUserPositions(userId: string): Map<string, { quantity: number; totalCost: number }> {
    if (!this.userPositions.has(userId)) {
      this.userPositions.set(userId, new Map());
    }
    return this.userPositions.get(userId)!;
  }

  setMockPrice(symbol: string, price: number): void {
    this.mockPrices.set(symbol, price);
  }

  getPrice(symbol: string): number {
    return this.mockPrices.get(symbol) || 100; // Default price if not set
  }

  getBalances(userId: string): Record<string, Balance> {
    const balances = this.getUserBalances(userId);
    const result: Record<string, Balance> = {};
    for (const [asset, balance] of balances.entries()) {
      result[asset] = { ...balance };
    }
    return result;
  }

  async createOrder(
    userId: string,
    request: {
      symbol: string;
      side: OrderSide;
      type: OrderType;
      quantity: number;
      price?: number;
    }
  ): Promise<PaperOrder> {
    const { symbol, side, type, quantity, price } = request;
    const balances = this.getUserBalances(userId);
    const positions = this.getUserPositions(userId);
    const orders = this.getUserOrders(userId);
    const trades = this.getUserTrades(userId);

    // Parse symbol (e.g., "BTC/USDT" -> base="BTC", quote="USDT")
    const parts = symbol.split("/");
    const base = parts[0] || symbol;
    const quote = parts[1] || "USDT";

    const currentPrice = price || this.getPrice(symbol);

    const order: PaperOrder = {
      id: crypto.randomUUID(),
      symbol,
      side,
      type,
      quantity,
      price: currentPrice,
      status: "pending",
      filledQuantity: 0,
      averagePrice: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Execute market orders immediately
    if (type === "market") {
      const cost = quantity * currentPrice;

      if (side === "buy") {
        // Check if user has enough quote currency
        const quoteBalance = balances.get(quote) || { available: 0, locked: 0 };
        if (quoteBalance.available < cost) {
          order.status = "rejected";
          orders.push(order);
          throw new Error(`Insufficient ${quote} balance. Need ${cost}, have ${quoteBalance.available}`);
        }

        // Deduct quote currency
        quoteBalance.available -= cost;
        balances.set(quote, quoteBalance);

        // Add base currency
        const baseBalance = balances.get(base) || { available: 0, locked: 0 };
        baseBalance.available += quantity;
        balances.set(base, baseBalance);

        // Update position
        const position = positions.get(symbol) || { quantity: 0, totalCost: 0 };
        position.quantity += quantity;
        position.totalCost += cost;
        positions.set(symbol, position);

        order.status = "filled";
        order.filledQuantity = quantity;
        order.averagePrice = currentPrice;
      } else {
        // Sell
        const baseBalance = balances.get(base) || { available: 0, locked: 0 };
        if (baseBalance.available < quantity) {
          order.status = "rejected";
          orders.push(order);
          throw new Error(`Insufficient ${base} balance. Need ${quantity}, have ${baseBalance.available}`);
        }

        // Deduct base currency
        baseBalance.available -= quantity;
        balances.set(base, baseBalance);

        // Add quote currency
        const quoteBalance = balances.get(quote) || { available: 0, locked: 0 };
        quoteBalance.available += cost;
        balances.set(quote, quoteBalance);

        // Update position
        const position = positions.get(symbol);
        if (position) {
          position.quantity -= quantity;
          position.totalCost -= quantity * (position.totalCost / (position.quantity + quantity));
          if (position.quantity <= 0) {
            positions.delete(symbol);
          } else {
            positions.set(symbol, position);
          }
        }

        order.status = "filled";
        order.filledQuantity = quantity;
        order.averagePrice = currentPrice;
      }

      // Record trade
      const trade: Trade = {
        id: crypto.randomUUID(),
        orderId: order.id,
        symbol,
        side,
        quantity,
        price: currentPrice,
        timestamp: new Date(),
      };
      trades.push(trade);
    }

    order.updatedAt = new Date();
    orders.push(order);

    return order;
  }

  cancelOrder(userId: string, orderId: string): PaperOrder | null {
    const orders = this.getUserOrders(userId);
    const order = orders.find((o) => o.id === orderId);

    if (!order || order.status !== "pending") {
      return null;
    }

    order.status = "cancelled";
    order.updatedAt = new Date();
    return order;
  }

  getOrders(userId: string): PaperOrder[] {
    return [...this.getUserOrders(userId)];
  }

  getTrades(userId: string): Trade[] {
    return [...this.getUserTrades(userId)];
  }

  getPositions(userId: string): Position[] {
    const positions = this.getUserPositions(userId);
    const result: Position[] = [];

    for (const [symbol, pos] of positions.entries()) {
      if (pos.quantity > 0) {
        const currentPrice = this.getPrice(symbol);
        const averageEntryPrice = pos.totalCost / pos.quantity;
        const unrealizedPnl = (currentPrice - averageEntryPrice) * pos.quantity;

        result.push({
          symbol,
          quantity: pos.quantity,
          averageEntryPrice,
          currentPrice,
          unrealizedPnl,
        });
      }
    }

    return result;
  }

  getPortfolioValue(userId: string): number {
    const balances = this.getBalances(userId);
    const positions = this.getPositions(userId);

    let total = 0;

    // Add quote currency balances
    total += balances["USDT"]?.available || 0;
    total += balances["USD"]?.available || 0;

    // Add position values
    for (const position of positions) {
      total += position.quantity * position.currentPrice;
    }

    return total;
  }

  resetAccount(userId: string): void {
    // Reset to default balances
    const balances = new Map<string, Balance>();
    for (const [asset, amount] of Object.entries(DEFAULT_INITIAL_BALANCE)) {
      balances.set(asset, { available: amount, locked: 0 });
    }
    this.userBalances.set(userId, balances);
    this.userOrders.set(userId, []);
    this.userTrades.set(userId, []);
    this.userPositions.set(userId, new Map());
  }
}

// ============================================
// TRADING MODE MANAGER
// ============================================

class TradingModeManager {
  private userModes: Map<string, { mode: TradingMode; startedAt: Date }> = new Map();

  getCurrentMode(userId: string): TradingMode {
    const state = this.userModes.get(userId);
    return state?.mode ?? "paper"; // Default to paper
  }

  getModeStatus(userId: string): {
    mode: TradingMode;
    isLive: boolean;
    canSwitchToLive: boolean;
    startedAt: Date;
  } {
    const state = this.userModes.get(userId) || {
      mode: "paper" as TradingMode,
      startedAt: new Date(),
    };

    return {
      mode: state.mode,
      isLive: state.mode === "live",
      canSwitchToLive: true, // TODO: Add validation logic
      startedAt: state.startedAt,
    };
  }

  async switchMode(
    userId: string,
    newMode: TradingMode,
    confirmation?: { acknowledged: boolean }
  ): Promise<void> {
    // Switching to live requires confirmation
    if (newMode === "live" && !confirmation?.acknowledged) {
      throw new Error("Live trading requires explicit acknowledgment of risks");
    }

    this.userModes.set(userId, {
      mode: newMode,
      startedAt: new Date(),
    });
  }
}

// ============================================
// SINGLETON INSTANCES
// ============================================

export const paperTradingEngine = new PaperTradingEngine();
export const tradingModeManager = new TradingModeManager();
