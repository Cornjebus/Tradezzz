/**
 * Mock Database for Unit Testing
 * In-memory implementation that mimics PostgreSQL behavior
 */

import { v4 as uuidv4 } from 'uuid';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import {
  User,
  CreateUserInput,
  Strategy,
  CreateStrategyInput,
  Trade,
  CreateTradeInput,
  ExchangeConnection,
  CreateExchangeConnectionInput,
  AIProviderConnection,
  CreateAIProviderInput,
  AuditLog,
  AuditAction,
  UserTier,
  ExchangeName,
  AIProviderName,
} from '../../src/database/types';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = 'test-key-32-bytes-for-testing!!';

export class MockDatabase {
  private _users: Map<string, User> = new Map();
  private _strategies: Map<string, Strategy> = new Map();
  private _trades: Map<string, Trade> = new Map();
  private _exchangeConnections: Map<string, any> = new Map();
  private _aiProviderConnections: Map<string, any> = new Map();
  private _auditLogs: Map<string, AuditLog> = new Map();

  // ============================================================================
  // Encryption Helpers
  // ============================================================================

  private encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
    const iv = randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag,
    };
  }

  private decrypt(encrypted: string, iv: string, authTag: string): string {
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidTier(tier: string): tier is UserTier {
    return ['free', 'pro', 'elite', 'institutional'].includes(tier);
  }

  // ============================================================================
  // Users
  // ============================================================================

  userOps = {
    create: async (input: CreateUserInput): Promise<User> => {
      if (!this.isValidEmail(input.email)) {
        throw new Error('Invalid email');
      }

      if (input.tier && !this.isValidTier(input.tier)) {
        throw new Error('Invalid tier');
      }

      // Check for duplicate email
      for (const user of this._users.values()) {
        if (user.email === input.email) {
          throw new Error('Email already exists');
        }
      }

      const now = new Date();
      const user: User = {
        id: uuidv4(),
        email: input.email,
        passwordHash: input.passwordHash,
        tier: input.tier || 'free',
        isActive: true,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      };

      this._users.set(user.id, user);
      return user;
    },

    findByEmail: async (email: string): Promise<User | null> => {
      for (const user of this._users.values()) {
        if (user.email === email) {
          return user;
        }
      }
      return null;
    },

    findById: async (id: string): Promise<User | null> => {
      return this._users.get(id) || null;
    },

    update: async (id: string, updates: Partial<User>): Promise<User> => {
      const user = this._users.get(id);
      if (!user) throw new Error('User not found');

      const updated: User = {
        ...user,
        ...updates,
        updatedAt: new Date(),
      };

      this._users.set(id, updated);
      return updated;
    },

    delete: async (id: string): Promise<void> => {
      this._users.delete(id);
      // Cascade delete
      for (const [stratId, strategy] of this._strategies) {
        if (strategy.userId === id) {
          this._strategies.delete(stratId);
        }
      }
      for (const [tradeId, trade] of this._trades) {
        if (trade.userId === id) {
          this._trades.delete(tradeId);
        }
      }
    },
  };

  // ============================================================================
  // Strategies
  // ============================================================================

  strategyOps = {
    create: async (input: CreateStrategyInput): Promise<Strategy> => {
      const validTypes = ['momentum', 'mean_reversion', 'sentiment', 'arbitrage', 'trend_following', 'custom'];
      if (!validTypes.includes(input.type)) {
        throw new Error('Invalid strategy type');
      }

      // Check user exists
      const user = this._users.get(input.userId);
      if (!user) {
        throw new Error('User not found');
      }

      const now = new Date();
      const strategy: Strategy = {
        id: uuidv4(),
        userId: input.userId,
        name: input.name,
        description: input.description,
        type: input.type,
        config: input.config,
        status: input.status || 'draft',
        executionMode: input.executionMode,
        createdAt: now,
        updatedAt: now,
      };

      this._strategies.set(strategy.id, strategy);
      return strategy;
    },

    findById: async (id: string): Promise<Strategy | null> => {
      return this._strategies.get(id) || null;
    },

    findByUserId: async (userId: string): Promise<Strategy[]> => {
      const result: Strategy[] = [];
      for (const strategy of this._strategies.values()) {
        if (strategy.userId === userId) {
          result.push(strategy);
        }
      }
      return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    update: async (id: string, updates: Partial<Strategy>): Promise<Strategy> => {
      const strategy = this._strategies.get(id);
      if (!strategy) throw new Error('Strategy not found');

      const updated: Strategy = {
        ...strategy,
        ...updates,
        updatedAt: new Date(),
      };

      this._strategies.set(id, updated);
      return updated;
    },

    delete: async (id: string): Promise<void> => {
      this._strategies.delete(id);
    },
  };

  // ============================================================================
  // Trades
  // ============================================================================

  tradeOps = {
    create: async (input: CreateTradeInput): Promise<Trade> => {
      if (input.quantity <= 0) {
        throw new Error('Quantity must be positive');
      }
      if (input.price <= 0) {
        throw new Error('Price must be positive');
      }

      const trade: Trade = {
        id: uuidv4(),
        userId: input.userId,
        strategyId: input.strategyId,
        symbol: input.symbol,
        side: input.side,
        quantity: input.quantity,
        price: input.price,
        status: input.status || 'pending',
        mode: input.mode,
        exchangeOrderId: input.exchangeOrderId,
        createdAt: new Date(),
      };

      this._trades.set(trade.id, trade);
      return trade;
    },

    findById: async (id: string): Promise<Trade | null> => {
      return this._trades.get(id) || null;
    },

    findByUserId: async (userId: string, limit: number = 100): Promise<Trade[]> => {
      const result: Trade[] = [];
      for (const trade of this._trades.values()) {
        if (trade.userId === userId) {
          result.push(trade);
        }
      }
      return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
    },

    findByStrategyId: async (strategyId: string): Promise<Trade[]> => {
      const result: Trade[] = [];
      for (const trade of this._trades.values()) {
        if (trade.strategyId === strategyId) {
          result.push(trade);
        }
      }
      return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    update: async (id: string, updates: Partial<Trade>): Promise<Trade> => {
      const trade = this._trades.get(id);
      if (!trade) throw new Error('Trade not found');

      const updated: Trade = {
        ...trade,
        ...updates,
      };

      this._trades.set(id, updated);
      return updated;
    },
  };

  // ============================================================================
  // Exchange Connections
  // ============================================================================

  exchangeOps = {
    create: async (input: CreateExchangeConnectionInput): Promise<ExchangeConnection> => {
      // Check for duplicate
      for (const conn of this._exchangeConnections.values()) {
        if (conn.userId === input.userId && conn.exchange === input.exchange && conn.isPaper === (input.isPaper ?? true)) {
          throw new Error('Duplicate exchange connection');
        }
      }

      const keyEncryption = this.encrypt(input.apiKey);
      const secretEncryption = this.encrypt(input.apiSecret);

      const now = new Date();
      const connection = {
        id: uuidv4(),
        userId: input.userId,
        exchange: input.exchange,
        apiKeyEncrypted: keyEncryption.encrypted + ':' + keyEncryption.authTag,
        apiSecretEncrypted: secretEncryption.encrypted + ':' + secretEncryption.authTag,
        iv: keyEncryption.iv,
        isPaper: input.isPaper ?? true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        // Store original for testing
        _originalKey: input.apiKey,
        _originalSecret: input.apiSecret,
      };

      this._exchangeConnections.set(connection.id, connection);

      return {
        id: connection.id,
        userId: connection.userId,
        exchange: connection.exchange,
        apiKeyEncrypted: connection.apiKeyEncrypted,
        apiSecretEncrypted: connection.apiSecretEncrypted,
        iv: connection.iv,
        isPaper: connection.isPaper,
        isActive: connection.isActive,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      };
    },

    findById: async (id: string): Promise<ExchangeConnection | null> => {
      const conn = this._exchangeConnections.get(id);
      if (!conn) return null;
      const { _originalKey, _originalSecret, ...rest } = conn;
      return rest;
    },

    findRaw: async (id: string): Promise<any> => {
      const conn = this._exchangeConnections.get(id);
      if (!conn) return null;
      return {
        id: conn.id,
        user_id: conn.userId,
        exchange: conn.exchange,
        api_key_encrypted: conn.apiKeyEncrypted,
        api_secret_encrypted: conn.apiSecretEncrypted,
        iv: conn.iv,
        is_paper: conn.isPaper,
        is_active: conn.isActive,
      };
    },

    findByUserAndExchange: async (
      userId: string,
      exchange: ExchangeName,
      isPaper: boolean
    ): Promise<(ExchangeConnection & { apiKey: string; apiSecret: string }) | null> => {
      for (const conn of this._exchangeConnections.values()) {
        if (conn.userId === userId && conn.exchange === exchange && conn.isPaper === isPaper) {
          return {
            id: conn.id,
            userId: conn.userId,
            exchange: conn.exchange,
            apiKeyEncrypted: conn.apiKeyEncrypted,
            apiSecretEncrypted: conn.apiSecretEncrypted,
            iv: conn.iv,
            isPaper: conn.isPaper,
            isActive: conn.isActive,
            createdAt: conn.createdAt,
            updatedAt: conn.updatedAt,
            apiKey: conn._originalKey,
            apiSecret: conn._originalSecret,
          };
        }
      }
      return null;
    },

    findByUserId: async (userId: string): Promise<ExchangeConnection[]> => {
      const result: ExchangeConnection[] = [];
      for (const conn of this._exchangeConnections.values()) {
        if (conn.userId === userId) {
          const { _originalKey, _originalSecret, ...rest } = conn;
          result.push(rest);
        }
      }
      return result;
    },

    delete: async (id: string): Promise<void> => {
      this._exchangeConnections.delete(id);
    },
  };

  // ============================================================================
  // AI Provider Connections
  // ============================================================================

  aiProviderOps = {
    create: async (input: CreateAIProviderInput): Promise<AIProviderConnection> => {
      // Check for duplicate
      for (const conn of this._aiProviderConnections.values()) {
        if (conn.userId === input.userId && conn.provider === input.provider) {
          throw new Error('Duplicate AI provider connection');
        }
      }

      const keyEncryption = this.encrypt(input.apiKey);

      const now = new Date();
      const connection = {
        id: uuidv4(),
        userId: input.userId,
        provider: input.provider,
        apiKeyEncrypted: keyEncryption.encrypted + ':' + keyEncryption.authTag,
        iv: keyEncryption.iv,
        selectedModel: input.selectedModel,
        isPrimary: input.isPrimary ?? false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        _originalKey: input.apiKey,
      };

      this._aiProviderConnections.set(connection.id, connection);

      return {
        id: connection.id,
        userId: connection.userId,
        provider: connection.provider,
        apiKeyEncrypted: connection.apiKeyEncrypted,
        iv: connection.iv,
        selectedModel: connection.selectedModel,
        isPrimary: connection.isPrimary,
        isActive: connection.isActive,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      };
    },

    findById: async (id: string): Promise<AIProviderConnection | null> => {
      const conn = this._aiProviderConnections.get(id);
      if (!conn) return null;
      const { _originalKey, ...rest } = conn;
      return rest;
    },

    findRaw: async (id: string): Promise<any> => {
      const conn = this._aiProviderConnections.get(id);
      if (!conn) return null;
      return {
        id: conn.id,
        user_id: conn.userId,
        provider: conn.provider,
        api_key_encrypted: conn.apiKeyEncrypted,
        iv: conn.iv,
        selected_model: conn.selectedModel,
        is_primary: conn.isPrimary,
        is_active: conn.isActive,
      };
    },

    listProviders: async (userId: string): Promise<AIProviderName[]> => {
      const result: AIProviderName[] = [];
      for (const conn of this._aiProviderConnections.values()) {
        if (conn.userId === userId) {
          result.push(conn.provider);
        }
      }
      return result;
    },

    delete: async (id: string): Promise<void> => {
      this._aiProviderConnections.delete(id);
    },
  };

  // ============================================================================
  // Audit Logs
  // ============================================================================

  auditLogOps = {
    create: async (input: {
      userId: string;
      action: AuditAction;
      details?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    }): Promise<AuditLog> => {
      const log: AuditLog = {
        id: uuidv4(),
        userId: input.userId,
        action: input.action,
        details: input.details || {},
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        createdAt: new Date(),
      };

      this._auditLogs.set(log.id, log);
      return log;
    },

    findByUserId: async (userId: string, limit: number = 100): Promise<AuditLog[]> => {
      const result: AuditLog[] = [];
      for (const log of this._auditLogs.values()) {
        if (log.userId === userId) {
          result.push(log);
        }
      }
      return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
    },
  };

  // Expose as db-like interface
  get users() { return this.userOps; }
  get strategies() { return this.strategyOps; }
  get trades() { return this.tradeOps; }
  get exchangeConnections() { return this.exchangeOps; }
  get aiProviders() { return this.aiProviderOps; }
  get auditLogs() { return this.auditLogOps; }

  // Clear all data (for test isolation)
  clear() {
    this._users.clear();
    this._strategies.clear();
    this._trades.clear();
    this._exchangeConnections.clear();
    this._aiProviderConnections.clear();
    this._auditLogs.clear();
  }
}

// Factory function for tests
export function createMockDatabase(): MockDatabase {
  return new MockDatabase();
}

export function destroyMockDatabase(db: MockDatabase): void {
  db.clear();
}
