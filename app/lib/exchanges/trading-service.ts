/**
 * Trading Service
 *
 * Central service for all trading operations.
 * Enforces: MUST connect exchange before trading.
 *
 * Flow:
 * 1. User connects exchange (Coinbase, Binance, etc.)
 * 2. User can now paper trade using REAL prices from their exchange
 * 3. User can switch to live trading - same interface, real money
 */

import { IExchangeAdapter, ExchangeCredentials, Ticker, Balance, Order, OrderRequest, Position, Trade } from "./types";
import { CoinbaseAdapter } from "./coinbase";
import { PaperTradingWrapper } from "./paper-wrapper";
import { decryptApiKey } from "../encryption";
import db from "../db";

export type TradingMode = "paper" | "live";

export interface UserTradingState {
  userId: string;
  mode: TradingMode;
  exchangeId: string | null;
  exchangeName: string | null;
  isConnected: boolean;
  canTrade: boolean;
}

interface ConnectedUser {
  liveAdapter: IExchangeAdapter;
  paperAdapter: PaperTradingWrapper;
  mode: TradingMode;
  exchangeId: string;
}

class TradingService {
  private connectedUsers: Map<string, ConnectedUser> = new Map();

  // ============================================
  // Exchange Connection
  // ============================================

  async connectExchange(
    userId: string,
    exchangeConnectionId: string
  ): Promise<UserTradingState> {
    // Get exchange connection from database
    const connection = await db.exchangeConnections.findById(exchangeConnectionId);
    if (!connection || connection.user_id !== userId) {
      throw new Error("Exchange connection not found");
    }

    // Decrypt credentials
    const apiKey = decryptApiKey(connection.api_key_encrypted);
    const apiSecret = decryptApiKey(connection.api_secret_encrypted);
    const passphrase = connection.passphrase_encrypted
      ? decryptApiKey(connection.passphrase_encrypted)
      : undefined;

    const credentials: ExchangeCredentials = {
      apiKey,
      apiSecret,
      passphrase,
    };

    // Create appropriate adapter
    let liveAdapter: IExchangeAdapter;

    switch (connection.exchange.toLowerCase()) {
      case "coinbase":
        liveAdapter = new CoinbaseAdapter(credentials);
        break;
      // Add more exchanges here
      default:
        throw new Error(`Exchange ${connection.exchange} not yet supported`);
    }

    // Test connection
    const connected = await liveAdapter.testConnection();
    if (!connected) {
      throw new Error("Failed to connect to exchange. Please check your API credentials.");
    }

    await liveAdapter.connect();

    // Create paper trading wrapper using the live adapter
    const paperAdapter = new PaperTradingWrapper(liveAdapter);

    // Store connection
    this.connectedUsers.set(userId, {
      liveAdapter,
      paperAdapter,
      mode: "paper", // Always start in paper mode for safety
      exchangeId: exchangeConnectionId,
    });

    return this.getState(userId);
  }

  disconnectExchange(userId: string): void {
    const user = this.connectedUsers.get(userId);
    if (user) {
      user.liveAdapter.disconnect();
      this.connectedUsers.delete(userId);
    }
  }

  isConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // ============================================
  // Mode Management
  // ============================================

  getState(userId: string): UserTradingState {
    const user = this.connectedUsers.get(userId);

    if (!user) {
      return {
        userId,
        mode: "paper",
        exchangeId: null,
        exchangeName: null,
        isConnected: false,
        canTrade: false, // Cannot trade without exchange
      };
    }

    return {
      userId,
      mode: user.mode,
      exchangeId: user.exchangeId,
      exchangeName: user.liveAdapter.name,
      isConnected: true,
      canTrade: true,
    };
  }

  async switchMode(
    userId: string,
    mode: TradingMode,
    options?: { acknowledged?: boolean }
  ): Promise<UserTradingState> {
    const user = this.connectedUsers.get(userId);

    if (!user) {
      throw new Error("Connect an exchange first before trading");
    }

    if (mode === "live") {
      if (!options?.acknowledged) {
        throw new Error(
          "Switching to live trading requires explicit acknowledgment that real money will be at risk"
        );
      }
    }

    user.mode = mode;
    return this.getState(userId);
  }

  // ============================================
  // Get Active Adapter
  // ============================================

  private getAdapter(userId: string): IExchangeAdapter {
    const user = this.connectedUsers.get(userId);

    if (!user) {
      throw new Error("Connect an exchange first before trading");
    }

    return user.mode === "live" ? user.liveAdapter : user.paperAdapter;
  }

  // ============================================
  // Market Data (requires exchange connection)
  // ============================================

  async getTicker(userId: string, symbol: string): Promise<Ticker> {
    const adapter = this.getAdapter(userId);
    return adapter.getTicker(symbol);
  }

  async getTickers(userId: string, symbols?: string[]): Promise<Ticker[]> {
    const adapter = this.getAdapter(userId);
    return adapter.getTickers(symbols);
  }

  async getTradingPairs(userId: string): Promise<string[]> {
    const adapter = this.getAdapter(userId);
    return adapter.getTradingPairs();
  }

  // ============================================
  // Account
  // ============================================

  async getBalances(userId: string): Promise<Balance[]> {
    const adapter = this.getAdapter(userId);
    return adapter.getBalances();
  }

  async getBalance(userId: string, asset: string): Promise<Balance | null> {
    const adapter = this.getAdapter(userId);
    return adapter.getBalance(asset);
  }

  async getPortfolioValue(userId: string): Promise<number> {
    const adapter = this.getAdapter(userId);
    const balances = await adapter.getBalances();
    const positions = await adapter.getPositions();

    let total = 0;

    // Add USD/USDT balances
    for (const bal of balances) {
      if (bal.asset === "USD" || bal.asset === "USDT") {
        total += bal.total;
      }
    }

    // Add position values
    for (const pos of positions) {
      total += pos.quantity * pos.currentPrice;
    }

    return total;
  }

  // ============================================
  // Trading
  // ============================================

  async createOrder(userId: string, request: OrderRequest): Promise<Order> {
    const adapter = this.getAdapter(userId);
    return adapter.createOrder(request);
  }

  async cancelOrder(userId: string, orderId: string, symbol?: string): Promise<boolean> {
    const adapter = this.getAdapter(userId);
    return adapter.cancelOrder(orderId, symbol);
  }

  async getOrder(userId: string, orderId: string, symbol?: string): Promise<Order | null> {
    const adapter = this.getAdapter(userId);
    return adapter.getOrder(orderId, symbol);
  }

  async getOpenOrders(userId: string, symbol?: string): Promise<Order[]> {
    const adapter = this.getAdapter(userId);
    return adapter.getOpenOrders(symbol);
  }

  async getOrderHistory(userId: string, symbol?: string, limit?: number): Promise<Order[]> {
    const adapter = this.getAdapter(userId);
    return adapter.getOrderHistory(symbol, limit);
  }

  // ============================================
  // Positions & Trades
  // ============================================

  async getPositions(userId: string): Promise<Position[]> {
    const adapter = this.getAdapter(userId);
    return adapter.getPositions();
  }

  async getTrades(userId: string, symbol?: string, limit?: number): Promise<Trade[]> {
    const adapter = this.getAdapter(userId);
    return adapter.getTrades(symbol, limit);
  }

  // ============================================
  // Paper Trading Management
  // ============================================

  resetPaperAccount(userId: string): void {
    const user = this.connectedUsers.get(userId);
    if (user) {
      user.paperAdapter.reset();
    }
  }
}

// Singleton export
export const tradingService = new TradingService();
