// Database Factory
// Creates either mock or PostgreSQL database based on configuration

import { getDatabaseConfig } from '../config/database.config';
import { PostgresDatabase } from './PostgresDatabase';

// Interface that both mock and real database implement
export interface IDatabase {
  users: IUserRepository;
  strategies: IStrategyRepository;
  orders: IOrderRepository;
  positions: IPositionRepository;
  trades: ITradeRepository;
  exchangeConnections: IExchangeConnectionRepository;
  aiProviders: IAIProviderRepository;
  refreshTokens: IRefreshTokenRepository;
  userSettings: IUserSettingsRepository;
  backtests: IBacktestRepository;
  auditLog: IAuditLogRepository;
  close(): Promise<void>;
}

// Repository interfaces
export interface IUserRepository {
  create(user: CreateUserDTO): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
  incrementTokenVersion(id: string): Promise<number>;
}

export interface IStrategyRepository {
  create(strategy: CreateStrategyDTO): Promise<Strategy>;
  findById(id: string): Promise<Strategy | null>;
  findByUserId(userId: string): Promise<Strategy[]>;
  update(id: string, data: Partial<Strategy>): Promise<Strategy>;
  delete(id: string): Promise<void>;
}

export interface IOrderRepository {
  create(order: CreateOrderDTO): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByUserId(userId: string, filters?: OrderFilters): Promise<Order[]>;
  update(id: string, data: Partial<Order>): Promise<Order>;
}

export interface IPositionRepository {
  create(position: CreatePositionDTO): Promise<Position>;
  findById(id: string): Promise<Position | null>;
  findByUserId(userId: string, filters?: PositionFilters): Promise<Position[]>;
  findOpen(userId: string, symbol?: string): Promise<Position[]>;
  update(id: string, data: Partial<Position>): Promise<Position>;
  close(id: string, exitPrice: number, realizedPnl: number): Promise<Position>;
}

export interface ITradeRepository {
  create(trade: CreateTradeDTO): Promise<Trade>;
  findByUserId(userId: string, filters?: TradeFilters): Promise<Trade[]>;
  findByPositionId(positionId: string): Promise<Trade[]>;
}

export interface IExchangeConnectionRepository {
  create(connection: CreateExchangeConnectionDTO): Promise<ExchangeConnection>;
  findById(id: string): Promise<ExchangeConnection | null>;
  findByUserId(userId: string): Promise<ExchangeConnection[]>;
  update(id: string, data: Partial<ExchangeConnection>): Promise<ExchangeConnection>;
  delete(id: string): Promise<void>;
}

export interface IAIProviderRepository {
  create(provider: CreateAIProviderDTO): Promise<AIProvider>;
  findById(id: string): Promise<AIProvider | null>;
  findByUserId(userId: string): Promise<AIProvider[]>;
  update(id: string, data: Partial<AIProvider>): Promise<AIProvider>;
  delete(id: string): Promise<void>;
  incrementUsage(id: string, tokens: number, requests: number): Promise<void>;
}

export interface IRefreshTokenRepository {
  create(userId: string, token: string, expiresAt: Date): Promise<RefreshToken>;
  findByToken(token: string): Promise<RefreshToken | null>;
  deleteByUserId(userId: string): Promise<void>;
  deleteExpired(): Promise<number>;
}

export interface IUserSettingsRepository {
  findByUserId(userId: string): Promise<UserSettings | null>;
  upsert(userId: string, settings: Partial<UserSettings>): Promise<UserSettings>;
}

export interface IBacktestRepository {
  create(backtest: CreateBacktestDTO): Promise<Backtest>;
  findById(id: string): Promise<Backtest | null>;
  findByUserId(userId: string): Promise<Backtest[]>;
  findByStrategyId(strategyId: string): Promise<Backtest[]>;
  update(id: string, data: Partial<Backtest>): Promise<Backtest>;
}

export interface IAuditLogRepository {
  log(entry: AuditLogEntry): Promise<void>;
  findByUserId(userId: string, limit?: number): Promise<AuditLogEntry[]>;
}

// Data types
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  tier: 'free' | 'pro' | 'elite' | 'institutional';
  isActive: boolean;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  email: string;
  passwordHash: string;
  tier?: 'free' | 'pro' | 'elite' | 'institutional';
}

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  description?: string;
  type: 'momentum' | 'mean_reversion' | 'sentiment' | 'arbitrage' | 'trend_following' | 'custom';
  status: 'draft' | 'backtesting' | 'paper' | 'active' | 'paused' | 'archived';
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStrategyDTO {
  userId: string;
  name: string;
  description?: string;
  type: Strategy['type'];
  config?: Record<string, unknown>;
  executionMode?: 'manual' | 'auto';
}

export interface Order {
  id: string;
  userId: string;
  strategyId?: string;
  exchangeConnectionId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop_loss' | 'take_profit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected' | 'expired';
  mode: 'paper' | 'live';
  filledPrice?: number;
  filledQuantity?: number;
  fee?: number;
  exchangeOrderId?: string;
  filledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderDTO {
  userId: string;
  strategyId?: string;
  exchangeConnectionId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop_loss' | 'take_profit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  mode: 'paper' | 'live';
}

export interface OrderFilters {
  status?: Order['status'];
  symbol?: string;
  mode?: Order['mode'];
  strategyId?: string;
  limit?: number;
  offset?: number;
}

export interface Position {
  id: string;
  userId: string;
  strategyId?: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice?: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
  mode: 'paper' | 'live';
  openedAt: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePositionDTO {
  userId: string;
  strategyId?: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  mode: 'paper' | 'live';
}

export interface PositionFilters {
  symbol?: string;
  mode?: Position['mode'];
  isOpen?: boolean;
  strategyId?: string;
}

export interface Trade {
  id: string;
  userId: string;
  strategyId?: string;
  orderId?: string;
  positionId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee: number;
  pnl?: number;
  mode: 'paper' | 'live';
  executedAt: Date;
  createdAt: Date;
}

export interface CreateTradeDTO {
  userId: string;
  strategyId?: string;
  orderId?: string;
  positionId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee?: number;
  pnl?: number;
  mode: 'paper' | 'live';
}

export interface TradeFilters {
  symbol?: string;
  mode?: Trade['mode'];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface ExchangeConnection {
  id: string;
  userId: string;
  exchange: 'binance' | 'coinbase' | 'kraken' | 'kucoin' | 'bybit' | 'okx' | 'gate';
  name: string;
  status: 'active' | 'inactive' | 'error';
  encryptedApiKey: string;
  encryptedApiSecret: string;
  encryptedPassphrase?: string;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExchangeConnectionDTO {
  userId: string;
  exchange: ExchangeConnection['exchange'];
  name: string;
  encryptedApiKey: string;
  encryptedApiSecret: string;
  encryptedPassphrase?: string;
}

export interface AIProvider {
  id: string;
  userId: string;
  provider: 'openai' | 'anthropic' | 'deepseek' | 'google' | 'cohere' | 'mistral';
  name: string;
  status: 'active' | 'inactive' | 'error';
  defaultModel?: string;
  encryptedApiKey: string;
  totalTokensUsed: number;
  totalRequests: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAIProviderDTO {
  userId: string;
  provider: AIProvider['provider'];
  name: string;
  encryptedApiKey: string;
  defaultModel?: string;
}

export interface RefreshToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface UserSettings {
  id: string;
  userId: string;
  timezone: string;
  notificationsEnabled: boolean;
  emailAlerts: boolean;
  defaultExchange?: string;
  defaultAiProvider?: string;
  riskLevel: 'conservative' | 'medium' | 'aggressive';
  maxPositionPercent: number;
  defaultStopLossPercent: number;
  defaultTakeProfitPercent: number;
  settingsJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Backtest {
  id: string;
  userId: string;
  strategyId: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalCapital?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  metrics?: Record<string, unknown>;
  trades?: Record<string, unknown>[];
  equityCurve?: number[];
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface CreateBacktestDTO {
  userId: string;
  strategyId: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
}

export interface AuditLogEntry {
  id?: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
}

// Mock Database implementation
class MockDatabase implements IDatabase {
  private data = {
    users: new Map<string, User>(),
    strategies: new Map<string, Strategy>(),
    orders: new Map<string, Order>(),
    positions: new Map<string, Position>(),
    trades: new Map<string, Trade>(),
    exchangeConnections: new Map<string, ExchangeConnection>(),
    aiProviders: new Map<string, AIProvider>(),
    refreshTokens: new Map<string, RefreshToken>(),
    userSettings: new Map<string, UserSettings>(),
    backtests: new Map<string, Backtest>(),
    auditLog: [] as AuditLogEntry[],
  };

  users: IUserRepository = {
    create: async (dto: CreateUserDTO): Promise<User> => {
      const id = crypto.randomUUID();
      const user: User = {
        id,
        email: dto.email,
        passwordHash: dto.passwordHash,
        tier: dto.tier || 'free',
        isActive: true,
        emailVerified: false,
        tokenVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.data.users.set(id, user);
      return user;
    },
    findById: async (id: string): Promise<User | null> => {
      return this.data.users.get(id) || null;
    },
    findByEmail: async (email: string): Promise<User | null> => {
      for (const user of this.data.users.values()) {
        if (user.email === email) return user;
      }
      return null;
    },
    update: async (id: string, data: Partial<User>): Promise<User> => {
      const user = this.data.users.get(id);
      if (!user) throw new Error('User not found');
      const updated = { ...user, ...data, updatedAt: new Date() };
      this.data.users.set(id, updated);
      return updated;
    },
    delete: async (id: string): Promise<void> => {
      this.data.users.delete(id);
    },
    incrementTokenVersion: async (id: string): Promise<number> => {
      const user = this.data.users.get(id);
      if (!user) throw new Error('User not found');
      user.tokenVersion += 1;
      user.updatedAt = new Date();
      return user.tokenVersion;
    },
  };

  strategies: IStrategyRepository = {
    create: async (dto: CreateStrategyDTO): Promise<Strategy> => {
      const id = crypto.randomUUID();
      const strategy: Strategy = {
        id,
        userId: dto.userId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        status: 'draft',
        config: dto.config || {},
        executionMode: dto.executionMode || 'manual',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.data.strategies.set(id, strategy);
      return strategy;
    },
    findById: async (id: string): Promise<Strategy | null> => {
      return this.data.strategies.get(id) || null;
    },
    findByUserId: async (userId: string): Promise<Strategy[]> => {
      return Array.from(this.data.strategies.values()).filter(s => s.userId === userId);
    },
    update: async (id: string, data: Partial<Strategy>): Promise<Strategy> => {
      const strategy = this.data.strategies.get(id);
      if (!strategy) throw new Error('Strategy not found');
      const updated = { ...strategy, ...data, updatedAt: new Date() };
      this.data.strategies.set(id, updated);
      return updated;
    },
    delete: async (id: string): Promise<void> => {
      this.data.strategies.delete(id);
    },
  };

  orders: IOrderRepository = {
    create: async (dto: CreateOrderDTO): Promise<Order> => {
      const id = crypto.randomUUID();
      const order: Order = {
        id,
        ...dto,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.data.orders.set(id, order);
      return order;
    },
    findById: async (id: string): Promise<Order | null> => {
      return this.data.orders.get(id) || null;
    },
    findByUserId: async (userId: string, filters?: OrderFilters): Promise<Order[]> => {
      let orders = Array.from(this.data.orders.values()).filter(o => o.userId === userId);
      if (filters?.status) orders = orders.filter(o => o.status === filters.status);
      if (filters?.symbol) orders = orders.filter(o => o.symbol === filters.symbol);
      if (filters?.mode) orders = orders.filter(o => o.mode === filters.mode);
      if (filters?.strategyId) orders = orders.filter(o => o.strategyId === filters.strategyId);
      if (filters?.limit) orders = orders.slice(0, filters.limit);
      return orders;
    },
    update: async (id: string, data: Partial<Order>): Promise<Order> => {
      const order = this.data.orders.get(id);
      if (!order) throw new Error('Order not found');
      const updated = { ...order, ...data, updatedAt: new Date() };
      this.data.orders.set(id, updated);
      return updated;
    },
  };

  positions: IPositionRepository = {
    create: async (dto: CreatePositionDTO): Promise<Position> => {
      const id = crypto.randomUUID();
      const position: Position = {
        id,
        ...dto,
        openedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.data.positions.set(id, position);
      return position;
    },
    findById: async (id: string): Promise<Position | null> => {
      return this.data.positions.get(id) || null;
    },
    findByUserId: async (userId: string, filters?: PositionFilters): Promise<Position[]> => {
      let positions = Array.from(this.data.positions.values()).filter(p => p.userId === userId);
      if (filters?.symbol) positions = positions.filter(p => p.symbol === filters.symbol);
      if (filters?.mode) positions = positions.filter(p => p.mode === filters.mode);
      if (filters?.isOpen !== undefined) {
        positions = positions.filter(p => filters.isOpen ? !p.closedAt : !!p.closedAt);
      }
      if (filters?.strategyId) positions = positions.filter(p => p.strategyId === filters.strategyId);
      return positions;
    },
    findOpen: async (userId: string, symbol?: string): Promise<Position[]> => {
      let positions = Array.from(this.data.positions.values())
        .filter(p => p.userId === userId && !p.closedAt);
      if (symbol) positions = positions.filter(p => p.symbol === symbol);
      return positions;
    },
    update: async (id: string, data: Partial<Position>): Promise<Position> => {
      const position = this.data.positions.get(id);
      if (!position) throw new Error('Position not found');
      const updated = { ...position, ...data, updatedAt: new Date() };
      this.data.positions.set(id, updated);
      return updated;
    },
    close: async (id: string, exitPrice: number, realizedPnl: number): Promise<Position> => {
      const position = this.data.positions.get(id);
      if (!position) throw new Error('Position not found');
      const updated = {
        ...position,
        currentPrice: exitPrice,
        realizedPnl,
        unrealizedPnl: 0,
        closedAt: new Date(),
        updatedAt: new Date(),
      };
      this.data.positions.set(id, updated);
      return updated;
    },
  };

  trades: ITradeRepository = {
    create: async (dto: CreateTradeDTO): Promise<Trade> => {
      const id = crypto.randomUUID();
      const trade: Trade = {
        id,
        ...dto,
        fee: dto.fee || 0,
        executedAt: new Date(),
        createdAt: new Date(),
      };
      this.data.trades.set(id, trade);
      return trade;
    },
    findByUserId: async (userId: string, filters?: TradeFilters): Promise<Trade[]> => {
      let trades = Array.from(this.data.trades.values()).filter(t => t.userId === userId);
      if (filters?.symbol) trades = trades.filter(t => t.symbol === filters.symbol);
      if (filters?.mode) trades = trades.filter(t => t.mode === filters.mode);
      if (filters?.startDate) trades = trades.filter(t => t.executedAt >= filters.startDate!);
      if (filters?.endDate) trades = trades.filter(t => t.executedAt <= filters.endDate!);
      if (filters?.limit) trades = trades.slice(0, filters.limit);
      return trades;
    },
    findByPositionId: async (positionId: string): Promise<Trade[]> => {
      return Array.from(this.data.trades.values()).filter(t => t.positionId === positionId);
    },
  };

  exchangeConnections: IExchangeConnectionRepository = {
    create: async (dto: CreateExchangeConnectionDTO): Promise<ExchangeConnection> => {
      const id = crypto.randomUUID();
      const connection: ExchangeConnection = {
        id,
        ...dto,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.data.exchangeConnections.set(id, connection);
      return connection;
    },
    findById: async (id: string): Promise<ExchangeConnection | null> => {
      return this.data.exchangeConnections.get(id) || null;
    },
    findByUserId: async (userId: string): Promise<ExchangeConnection[]> => {
      return Array.from(this.data.exchangeConnections.values()).filter(c => c.userId === userId);
    },
    update: async (id: string, data: Partial<ExchangeConnection>): Promise<ExchangeConnection> => {
      const connection = this.data.exchangeConnections.get(id);
      if (!connection) throw new Error('Exchange connection not found');
      const updated = { ...connection, ...data, updatedAt: new Date() };
      this.data.exchangeConnections.set(id, updated);
      return updated;
    },
    delete: async (id: string): Promise<void> => {
      this.data.exchangeConnections.delete(id);
    },
  };

  aiProviders: IAIProviderRepository = {
    create: async (dto: CreateAIProviderDTO): Promise<AIProvider> => {
      const id = crypto.randomUUID();
      const provider: AIProvider = {
        id,
        ...dto,
        status: 'active',
        totalTokensUsed: 0,
        totalRequests: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.data.aiProviders.set(id, provider);
      return provider;
    },
    findById: async (id: string): Promise<AIProvider | null> => {
      return this.data.aiProviders.get(id) || null;
    },
    findByUserId: async (userId: string): Promise<AIProvider[]> => {
      return Array.from(this.data.aiProviders.values()).filter(p => p.userId === userId);
    },
    update: async (id: string, data: Partial<AIProvider>): Promise<AIProvider> => {
      const provider = this.data.aiProviders.get(id);
      if (!provider) throw new Error('AI provider not found');
      const updated = { ...provider, ...data, updatedAt: new Date() };
      this.data.aiProviders.set(id, updated);
      return updated;
    },
    delete: async (id: string): Promise<void> => {
      this.data.aiProviders.delete(id);
    },
    incrementUsage: async (id: string, tokens: number, requests: number): Promise<void> => {
      const provider = this.data.aiProviders.get(id);
      if (!provider) throw new Error('AI provider not found');
      provider.totalTokensUsed += tokens;
      provider.totalRequests += requests;
      provider.lastUsedAt = new Date();
      provider.updatedAt = new Date();
    },
  };

  refreshTokens: IRefreshTokenRepository = {
    create: async (userId: string, token: string, expiresAt: Date): Promise<RefreshToken> => {
      const id = crypto.randomUUID();
      const refreshToken: RefreshToken = {
        id,
        userId,
        token,
        expiresAt,
        createdAt: new Date(),
      };
      this.data.refreshTokens.set(token, refreshToken);
      return refreshToken;
    },
    findByToken: async (token: string): Promise<RefreshToken | null> => {
      return this.data.refreshTokens.get(token) || null;
    },
    deleteByUserId: async (userId: string): Promise<void> => {
      for (const [token, rt] of this.data.refreshTokens.entries()) {
        if (rt.userId === userId) {
          this.data.refreshTokens.delete(token);
        }
      }
    },
    deleteExpired: async (): Promise<number> => {
      const now = new Date();
      let count = 0;
      for (const [token, rt] of this.data.refreshTokens.entries()) {
        if (rt.expiresAt < now) {
          this.data.refreshTokens.delete(token);
          count++;
        }
      }
      return count;
    },
  };

  userSettings: IUserSettingsRepository = {
    findByUserId: async (userId: string): Promise<UserSettings | null> => {
      return this.data.userSettings.get(userId) || null;
    },
    upsert: async (userId: string, settings: Partial<UserSettings>): Promise<UserSettings> => {
      const existing = this.data.userSettings.get(userId);
      const updated: UserSettings = {
        id: existing?.id || crypto.randomUUID(),
        userId,
        timezone: settings.timezone || existing?.timezone || 'UTC',
        notificationsEnabled: settings.notificationsEnabled ?? existing?.notificationsEnabled ?? true,
        emailAlerts: settings.emailAlerts ?? existing?.emailAlerts ?? true,
        defaultExchange: settings.defaultExchange || existing?.defaultExchange,
        defaultAiProvider: settings.defaultAiProvider || existing?.defaultAiProvider,
        riskLevel: settings.riskLevel || existing?.riskLevel || 'medium',
        maxPositionPercent: settings.maxPositionPercent ?? existing?.maxPositionPercent ?? 10,
        defaultStopLossPercent: settings.defaultStopLossPercent ?? existing?.defaultStopLossPercent ?? 2,
        defaultTakeProfitPercent: settings.defaultTakeProfitPercent ?? existing?.defaultTakeProfitPercent ?? 4,
        settingsJson: settings.settingsJson || existing?.settingsJson || {},
        createdAt: existing?.createdAt || new Date(),
        updatedAt: new Date(),
      };
      this.data.userSettings.set(userId, updated);
      return updated;
    },
  };

  backtests: IBacktestRepository = {
    create: async (dto: CreateBacktestDTO): Promise<Backtest> => {
      const id = crypto.randomUUID();
      const backtest: Backtest = {
        id,
        ...dto,
        status: 'pending',
        createdAt: new Date(),
      };
      this.data.backtests.set(id, backtest);
      return backtest;
    },
    findById: async (id: string): Promise<Backtest | null> => {
      return this.data.backtests.get(id) || null;
    },
    findByUserId: async (userId: string): Promise<Backtest[]> => {
      return Array.from(this.data.backtests.values()).filter(b => b.userId === userId);
    },
    findByStrategyId: async (strategyId: string): Promise<Backtest[]> => {
      return Array.from(this.data.backtests.values()).filter(b => b.strategyId === strategyId);
    },
    update: async (id: string, data: Partial<Backtest>): Promise<Backtest> => {
      const backtest = this.data.backtests.get(id);
      if (!backtest) throw new Error('Backtest not found');
      const updated = { ...backtest, ...data };
      this.data.backtests.set(id, updated);
      return updated;
    },
  };

  auditLog: IAuditLogRepository = {
    log: async (entry: AuditLogEntry): Promise<void> => {
      this.data.auditLog.push({
        ...entry,
        id: crypto.randomUUID(),
        createdAt: new Date(),
      });
    },
    findByUserId: async (userId: string, limit = 100): Promise<AuditLogEntry[]> => {
      return this.data.auditLog
        .filter(e => e.userId === userId)
        .slice(-limit)
        .reverse();
    },
  };

  async close(): Promise<void> {
    // Nothing to close for mock database
  }
}

// Singleton instances
let mockDb: MockDatabase | null = null;
let postgresDb: PostgresDatabase | null = null;

export async function getDatabase(): Promise<IDatabase> {
  const config = getDatabaseConfig();

  if (config.type === 'postgres' && config.postgres) {
    if (!postgresDb) {
      postgresDb = new PostgresDatabase(config.postgres);
      await postgresDb.connect();
    }
    return postgresDb as unknown as IDatabase;
  }

  if (!mockDb) {
    mockDb = new MockDatabase();
  }
  return mockDb;
}

export function getMockDatabase(): MockDatabase {
  if (!mockDb) {
    mockDb = new MockDatabase();
  }
  return mockDb;
}

export async function closeDatabase(): Promise<void> {
  if (postgresDb) {
    await postgresDb.close();
    postgresDb = null;
  }
  mockDb = null;
}
