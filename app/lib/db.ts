/**
 * Database connection and repositories for Next.js
 * Ported from Express NeonDatabase.ts
 */

import { Pool, PoolClient } from "pg";

// ============================================
// SNAKE_CASE TO CAMELCASE MAPPER
// ============================================

/**
 * Convert snake_case string to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert object keys from snake_case to camelCase
 */
function mapRowToCamelCase<T>(row: Record<string, unknown>): T {
  if (!row) return row as T;

  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = snakeToCamel(key);
    mapped[camelKey] = value;
  }
  return mapped as T;
}

/**
 * Convert array of objects from snake_case to camelCase
 */
function mapRowsToCamelCase<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map(row => mapRowToCamelCase<T>(row));
}

// ============================================
// TYPE DEFINITIONS (camelCase)
// ============================================

export interface User {
  id: string;
  clerkId?: string;
  email: string;
  tier: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExchangeConnection {
  id: string;
  userId: string;
  exchange: string;
  name: string;
  status: string;
  encryptedApiKey: string;
  encryptedApiSecret: string;
  encryptedPassphrase?: string;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIProvider {
  id: string;
  userId: string;
  provider: string;
  name: string;
  status: string;
  defaultModel?: string;
  encryptedApiKey: string;
  totalTokensUsed: number;
  totalRequests: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  strategyId?: string;
  exchangeConnectionId?: string;
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: string;
  mode: string;
  filledPrice?: number;
  filledQuantity?: number;
  fee?: number;
  exchangeOrderId?: string;
  filledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  userId: string;
  keyType: string;
  providerId: string;
  encryptedKey: string;
  keyVersion: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string;
  keyId?: string;
  action: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  timestamp: Date;
}

export interface UsageRecord {
  id: string;
  userId: string;
  providerId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  operation: string;
  estimatedCost: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface UsageLimit {
  id: string;
  userId: string;
  dailyTokenLimit: number;
  dailyCostLimit: number;
  monthlyTokenLimit?: number;
  monthlyCostLimit?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSettings {
  id: string;
  userId: string;
  timezone: string;
  notificationsEnabled: boolean;
  emailAlerts: boolean;
  defaultExchange?: string;
  defaultAiProvider?: string;
  riskLevel: string;
  graphRiskMode?: "off" | "warn" | "block";
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DATABASE CLASS
// ============================================

class Database {
  private pool: Pool | null = null;

  private getPool(): Pool {
    if (!this.pool) {
      const connectionString = process.env.DATABASE_URL;

      if (!connectionString) {
        throw new Error("DATABASE_URL is required");
      }

      this.pool = new Pool({
        connectionString,
        max: 10,
        ssl: { rejectUnauthorized: false },
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      this.pool.on("error", (err) => {
        console.error("Database pool error:", err);
      });
    }

    return this.pool;
  }

  async query<T = unknown>(text: string, values?: unknown[]): Promise<T[]> {
    const result = await this.getPool().query(text, values);
    return mapRowsToCamelCase<T>(result.rows);
  }

  async queryOne<T = unknown>(text: string, values?: unknown[]): Promise<T | null> {
    const result = await this.getPool().query(text, values);
    const row = result.rows[0];
    return row ? mapRowToCamelCase<T>(row) : null;
  }

  // ============================================
  // USER REPOSITORY
  // ============================================

  users = {
    findByClerkId: async (clerkId: string): Promise<User | null> => {
      return this.queryOne<User>(
        `SELECT * FROM users WHERE clerk_id = $1`,
        [clerkId]
      );
    },

    findById: async (id: string): Promise<User | null> => {
      return this.queryOne<User>(
        `SELECT * FROM users WHERE id = $1`,
        [id]
      );
    },

    upsertFromClerk: async (clerkUser: { id: string; email: string }): Promise<User | null> => {
      return this.queryOne<User>(`
        INSERT INTO users (clerk_id, email, password_hash)
        VALUES ($1, $2, 'clerk-managed')
        ON CONFLICT (clerk_id) DO UPDATE SET
          email = EXCLUDED.email,
          updated_at = NOW()
        RETURNING *
      `, [clerkUser.id, clerkUser.email]);
    },

    update: async (id: string, data: Partial<User>): Promise<User | null> => {
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (data.email) {
        fields.push(`email = $${paramIndex++}`);
        values.push(data.email);
      }
      if (data.tier) {
        fields.push(`tier = $${paramIndex++}`);
        values.push(data.tier);
      }
      if (data.isActive !== undefined) {
        fields.push(`is_active = $${paramIndex++}`);
        values.push(data.isActive);
      }

      if (fields.length === 0) return this.users.findById(id);

      values.push(id);
      return this.queryOne<User>(`
        UPDATE users SET ${fields.join(", ")}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
    },
  };

  // ============================================
  // USER SETTINGS REPOSITORY
  // ============================================

  userSettings = {
    findByUserId: async (userId: string): Promise<UserSettings | null> => {
      return this.queryOne<UserSettings>(
        `SELECT * FROM user_settings WHERE user_id = $1`,
        [userId]
      );
    },

    upsert: async (userId: string, data: Partial<UserSettings>): Promise<UserSettings | null> => {
      return this.queryOne<UserSettings>(`
        INSERT INTO user_settings (user_id, timezone, notifications_enabled, email_alerts, risk_level, graph_risk_mode)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET
          timezone = COALESCE($2, user_settings.timezone),
          notifications_enabled = COALESCE($3, user_settings.notifications_enabled),
          email_alerts = COALESCE($4, user_settings.email_alerts),
          risk_level = COALESCE($5, user_settings.risk_level),
          graph_risk_mode = COALESCE($6, user_settings.graph_risk_mode),
          updated_at = NOW()
        RETURNING *
      `, [
        userId,
        data.timezone || "UTC",
        data.notificationsEnabled ?? true,
        data.emailAlerts ?? true,
        data.riskLevel || "medium",
        data.graphRiskMode || "warn",
      ]);
    },

    deleteByUserId: async (userId: string): Promise<void> => {
      await this.query(`DELETE FROM user_settings WHERE user_id = $1`, [userId]);
    },
  };

  // ============================================
  // EXCHANGE CONNECTIONS REPOSITORY
  // ============================================

  exchangeConnections = {
    create: async (data: {
      userId: string;
      exchange: string;
      name: string;
      encryptedApiKey: string;
      encryptedApiSecret: string;
      encryptedPassphrase?: string;
    }): Promise<ExchangeConnection | null> => {
      return this.queryOne<ExchangeConnection>(`
        INSERT INTO exchange_connections (user_id, exchange, name, encrypted_api_key, encrypted_api_secret, encrypted_passphrase)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [data.userId, data.exchange, data.name, data.encryptedApiKey, data.encryptedApiSecret, data.encryptedPassphrase]);
    },

    findById: async (id: string): Promise<ExchangeConnection | null> => {
      return this.queryOne<ExchangeConnection>(
        `SELECT * FROM exchange_connections WHERE id = $1`,
        [id]
      );
    },

    findByUserId: async (userId: string): Promise<ExchangeConnection[]> => {
      return this.query<ExchangeConnection>(
        `SELECT * FROM exchange_connections WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
    },

    delete: async (id: string): Promise<void> => {
      await this.query(`DELETE FROM exchange_connections WHERE id = $1`, [id]);
    },

    update: async (id: string, data: Partial<ExchangeConnection>): Promise<ExchangeConnection | null> => {
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (data.name) {
        fields.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.status) {
        fields.push(`status = $${paramIndex++}`);
        values.push(data.status);
      }

      if (fields.length === 0) return this.exchangeConnections.findById(id);

      values.push(id);
      return this.queryOne<ExchangeConnection>(`
        UPDATE exchange_connections SET ${fields.join(", ")}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
    },
  };

  // ============================================
  // AI PROVIDERS REPOSITORY
  // ============================================

  aiProviders = {
    create: async (data: {
      userId: string;
      provider: string;
      name: string;
      encryptedApiKey: string;
      defaultModel?: string;
    }): Promise<AIProvider | null> => {
      return this.queryOne<AIProvider>(`
        INSERT INTO ai_providers (user_id, provider, name, encrypted_api_key, default_model)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [data.userId, data.provider, data.name, data.encryptedApiKey, data.defaultModel]);
    },

    findById: async (id: string): Promise<AIProvider | null> => {
      return this.queryOne<AIProvider>(
        `SELECT * FROM ai_providers WHERE id = $1`,
        [id]
      );
    },

    findByUserId: async (userId: string): Promise<AIProvider[]> => {
      return this.query<AIProvider>(
        `SELECT * FROM ai_providers WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
    },

    delete: async (id: string): Promise<void> => {
      await this.query(`DELETE FROM ai_providers WHERE id = $1`, [id]);
    },

    update: async (id: string, data: Partial<AIProvider>): Promise<AIProvider | null> => {
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (data.name) {
        fields.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.status) {
        fields.push(`status = $${paramIndex++}`);
        values.push(data.status);
      }
      if (data.defaultModel) {
        fields.push(`default_model = $${paramIndex++}`);
        values.push(data.defaultModel);
      }

      if (fields.length === 0) return this.aiProviders.findById(id);

      values.push(id);
      return this.queryOne<AIProvider>(`
        UPDATE ai_providers SET ${fields.join(", ")}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
    },

    incrementUsage: async (id: string, tokens: number, requests: number = 1): Promise<AIProvider | null> => {
      return this.queryOne<AIProvider>(`
        UPDATE ai_providers SET
          total_tokens_used = total_tokens_used + $1,
          total_requests = total_requests + $2,
          last_used_at = NOW(),
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [tokens, requests, id]);
    },
  };

  // ============================================
  // STRATEGIES REPOSITORY
  // ============================================

  strategies = {
    create: async (data: {
      userId: string;
      name: string;
      description?: string;
      type: string;
      config?: Record<string, unknown>;
    }): Promise<Strategy | null> => {
      return this.queryOne<Strategy>(`
        INSERT INTO strategies (user_id, name, description, type, config)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [data.userId, data.name, data.description, data.type, JSON.stringify(data.config || {})]);
    },

    findById: async (id: string): Promise<Strategy | null> => {
      return this.queryOne<Strategy>(
        `SELECT * FROM strategies WHERE id = $1`,
        [id]
      );
    },

    findByUserId: async (userId: string): Promise<Strategy[]> => {
      return this.query<Strategy>(
        `SELECT * FROM strategies WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
    },

    delete: async (id: string): Promise<void> => {
      await this.query(`DELETE FROM strategies WHERE id = $1`, [id]);
    },

    update: async (id: string, data: Partial<Strategy>): Promise<Strategy | null> => {
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (data.name) {
        fields.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        fields.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }
      if (data.status) {
        fields.push(`status = $${paramIndex++}`);
        values.push(data.status);
      }
      if (data.config) {
        fields.push(`config = $${paramIndex++}`);
        values.push(JSON.stringify(data.config));
      }

      if (fields.length === 0) return this.strategies.findById(id);

      values.push(id);
      return this.queryOne<Strategy>(`
        UPDATE strategies SET ${fields.join(", ")}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
    },
  };

  // ============================================
  // ORDERS REPOSITORY
  // ============================================

  orders = {
    create: async (data: {
      userId: string;
      strategyId?: string;
      exchangeConnectionId?: string;
      symbol: string;
      side: string;
      type: string;
      quantity: number;
      price?: number;
      stopPrice?: number;
      mode: string;
    }): Promise<Order | null> => {
      return this.queryOne<Order>(`
        INSERT INTO orders (user_id, strategy_id, exchange_connection_id, symbol, side, type, quantity, price, stop_price, mode)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [data.userId, data.strategyId, data.exchangeConnectionId, data.symbol, data.side, data.type, data.quantity, data.price, data.stopPrice, data.mode]);
    },

    findById: async (id: string): Promise<Order | null> => {
      return this.queryOne<Order>(
        `SELECT * FROM orders WHERE id = $1`,
        [id]
      );
    },

    findByUserId: async (userId: string, options?: { limit?: number; status?: string; mode?: string }): Promise<Order[]> => {
      let query = `SELECT * FROM orders WHERE user_id = $1`;
      const values: unknown[] = [userId];
      let paramIndex = 2;

      if (options?.status) {
        query += ` AND status = $${paramIndex++}`;
        values.push(options.status);
      }
      if (options?.mode) {
        query += ` AND mode = $${paramIndex++}`;
        values.push(options.mode);
      }

      query += ` ORDER BY created_at DESC`;

      if (options?.limit) {
        query += ` LIMIT $${paramIndex}`;
        values.push(options.limit);
      }

      return this.query<Order>(query, values);
    },

    update: async (id: string, data: Partial<Order>): Promise<Order | null> => {
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (data.status) {
        fields.push(`status = $${paramIndex++}`);
        values.push(data.status);
      }
      if (data.filledPrice !== undefined) {
        fields.push(`filled_price = $${paramIndex++}`);
        values.push(data.filledPrice);
      }
      if (data.filledQuantity !== undefined) {
        fields.push(`filled_quantity = $${paramIndex++}`);
        values.push(data.filledQuantity);
      }

      if (fields.length === 0) return this.orders.findById(id);

      values.push(id);
      return this.queryOne<Order>(`
        UPDATE orders SET ${fields.join(", ")}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
    },

    delete: async (id: string): Promise<void> => {
      await this.query(`DELETE FROM orders WHERE id = $1`, [id]);
    },

    deleteByUserId: async (userId: string): Promise<void> => {
      await this.query(`DELETE FROM orders WHERE user_id = $1`, [userId]);
    },
  };

  // ============================================
  // API KEYS (KEYVAULT) REPOSITORY
  // ============================================

  apiKeys = {
    create: async (data: {
      id?: string;
      userId: string;
      keyType: string;
      providerId: string;
      encryptedKey: string;
      metadata?: Record<string, unknown>;
    }): Promise<ApiKey | null> => {
      const id = data.id || uuidv4();
      return this.queryOne<ApiKey>(`
        INSERT INTO api_keys (id, user_id, key_type, provider_id, encrypted_key, key_version, metadata)
        VALUES ($1, $2, $3, $4, $5, 1, $6)
        ON CONFLICT (user_id, key_type, provider_id) DO UPDATE SET
          encrypted_key = EXCLUDED.encrypted_key,
          key_version = api_keys.key_version + 1,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING *
      `, [id, data.userId, data.keyType, data.providerId, data.encryptedKey, data.metadata ? JSON.stringify(data.metadata) : null]);
    },

    findById: async (id: string): Promise<ApiKey | null> => {
      return this.queryOne<ApiKey>(
        `SELECT * FROM api_keys WHERE id = $1`,
        [id]
      );
    },

    findByUserId: async (userId: string, options?: { keyType?: string; providerId?: string }): Promise<ApiKey[]> => {
      let query = `SELECT * FROM api_keys WHERE user_id = $1`;
      const values: unknown[] = [userId];
      let paramIndex = 2;

      if (options?.keyType) {
        query += ` AND key_type = $${paramIndex++}`;
        values.push(options.keyType);
      }
      if (options?.providerId) {
        query += ` AND provider_id = $${paramIndex++}`;
        values.push(options.providerId);
      }

      query += ` ORDER BY created_at DESC`;
      return this.query<ApiKey>(query, values);
    },

    update: async (id: string, data: { encryptedKey?: string; metadata?: Record<string, unknown> }): Promise<ApiKey | null> => {
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (data.encryptedKey) {
        fields.push(`encrypted_key = $${paramIndex++}`);
        values.push(data.encryptedKey);
        fields.push(`key_version = key_version + 1`);
      }
      if (data.metadata !== undefined) {
        fields.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(data.metadata));
      }

      if (fields.length === 0) return this.apiKeys.findById(id);

      values.push(id);
      return this.queryOne<ApiKey>(`
        UPDATE api_keys SET ${fields.join(", ")}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
    },

    delete: async (id: string): Promise<void> => {
      await this.query(`DELETE FROM api_keys WHERE id = $1`, [id]);
    },
  };

  // ============================================
  // AUDIT LOGS REPOSITORY
  // ============================================

  auditLogs = {
    create: async (data: {
      userId: string;
      keyId?: string;
      action: string;
      details?: Record<string, unknown>;
      ipAddress?: string;
    }): Promise<AuditLog | null> => {
      return this.queryOne<AuditLog>(`
        INSERT INTO audit_logs (id, user_id, key_id, action, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [uuidv4(), data.userId, data.keyId, data.action, data.details ? JSON.stringify(data.details) : null, data.ipAddress]);
    },

    findByUserId: async (userId: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]> => {
      const limit = options?.limit || 100;
      const offset = options?.offset || 0;
      return this.query<AuditLog>(
        `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
    },
  };

  // ============================================
  // USAGE RECORDS REPOSITORY
  // ============================================

  usageRecords = {
    create: async (data: {
      userId: string;
      providerId: string;
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      operation: string;
      estimatedCost: number;
      latencyMs?: number;
      metadata?: Record<string, unknown>;
    }): Promise<UsageRecord | null> => {
      return this.queryOne<UsageRecord>(`
        INSERT INTO usage_records (id, user_id, provider_id, provider, model, input_tokens, output_tokens, total_tokens, operation, estimated_cost, latency_ms, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [uuidv4(), data.userId, data.providerId, data.provider, data.model, data.inputTokens, data.outputTokens, data.totalTokens, data.operation, data.estimatedCost, data.latencyMs, data.metadata ? JSON.stringify(data.metadata) : null]);
    },

    findByUserId: async (userId: string, startDate?: Date, endDate?: Date): Promise<UsageRecord[]> => {
      let query = `SELECT * FROM usage_records WHERE user_id = $1`;
      const values: unknown[] = [userId];
      let paramIndex = 2;

      if (startDate) {
        query += ` AND created_at >= $${paramIndex++}`;
        values.push(startDate);
      }
      if (endDate) {
        query += ` AND created_at <= $${paramIndex++}`;
        values.push(endDate);
      }

      query += ` ORDER BY created_at DESC`;
      return this.query<UsageRecord>(query, values);
    },

    findByProviderId: async (userId: string, providerId: string): Promise<UsageRecord[]> => {
      return this.query<UsageRecord>(
        `SELECT * FROM usage_records WHERE user_id = $1 AND provider_id = $2 ORDER BY created_at DESC`,
        [userId, providerId]
      );
    },
  };

  // ============================================
  // USAGE LIMITS REPOSITORY
  // ============================================

  usageLimits = {
    findByUserId: async (userId: string): Promise<UsageLimit | null> => {
      return this.queryOne<UsageLimit>(
        `SELECT * FROM usage_limits WHERE user_id = $1`,
        [userId]
      );
    },

    upsert: async (userId: string, data: {
      dailyTokenLimit: number;
      dailyCostLimit: number;
      monthlyTokenLimit?: number;
      monthlyCostLimit?: number;
    }): Promise<UsageLimit | null> => {
      return this.queryOne<UsageLimit>(`
        INSERT INTO usage_limits (id, user_id, daily_token_limit, daily_cost_limit, monthly_token_limit, monthly_cost_limit)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET
          daily_token_limit = EXCLUDED.daily_token_limit,
          daily_cost_limit = EXCLUDED.daily_cost_limit,
          monthly_token_limit = EXCLUDED.monthly_token_limit,
          monthly_cost_limit = EXCLUDED.monthly_cost_limit,
          updated_at = NOW()
        RETURNING *
      `, [uuidv4(), userId, data.dailyTokenLimit, data.dailyCostLimit, data.monthlyTokenLimit, data.monthlyCostLimit]);
    },
  };
}

// Helper for uuidv4
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Singleton instance
const db = new Database();

export default db;
