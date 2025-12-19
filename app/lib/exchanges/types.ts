/**
 * Exchange Types - Shared types for all exchange adapters
 */

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop_loss" | "take_profit";
export type OrderStatus = "pending" | "open" | "filled" | "partially_filled" | "cancelled" | "rejected";

export interface Ticker {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume24h: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  timestamp: Date;
}

export interface OrderBook {
  symbol: string;
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
  timestamp: Date;
}

export interface Balance {
  asset: string;
  available: number;
  locked: number;
  total: number;
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  clientOrderId?: string;
}

export interface Order {
  id: string;
  exchangeOrderId: string;
  clientOrderId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  quantity: number;
  filledQuantity: number;
  price: number;
  averagePrice: number;
  fee: number;
  feeCurrency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  fee: number;
  feeCurrency: string;
  timestamp: Date;
}

export interface Position {
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  marginUsed?: number;
}

export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // Coinbase, KuCoin
  sandbox?: boolean;
}

export interface ExchangeInfo {
  name: string;
  id: string;
  supportedFeatures: string[];
  tradingPairs: string[];
  makerFee: number;
  takerFee: number;
}

/**
 * Exchange Adapter Interface
 * All exchanges implement this same interface
 */
export interface IExchangeAdapter {
  // Info
  readonly name: string;
  readonly id: string;
  isConnected(): boolean;

  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;

  // Market Data (Real-time from exchange)
  getTicker(symbol: string): Promise<Ticker>;
  getTickers(symbols?: string[]): Promise<Ticker[]>;
  getOrderBook(symbol: string, limit?: number): Promise<OrderBook>;
  getTradingPairs(): Promise<string[]>;

  // Account
  getBalances(): Promise<Balance[]>;
  getBalance(asset: string): Promise<Balance | null>;

  // Trading
  createOrder(request: OrderRequest): Promise<Order>;
  cancelOrder(orderId: string, symbol?: string): Promise<boolean>;
  getOrder(orderId: string, symbol?: string): Promise<Order | null>;
  getOpenOrders(symbol?: string): Promise<Order[]>;
  getOrderHistory(symbol?: string, limit?: number): Promise<Order[]>;

  // Positions & Trades
  getPositions(): Promise<Position[]>;
  getTrades(symbol?: string, limit?: number): Promise<Trade[]>;
}
