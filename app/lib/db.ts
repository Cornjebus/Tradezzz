/**
 * Database connection and repositories for Next.js
 * Ported from Express NeonDatabase.ts
 */

import { Pool, PoolClient } from "pg";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface User {
  id: string;
  clerk_id?: string;
  email: string;
  tier: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface ExchangeConnection {
  id: string;
  user_id: string;
  exchange: string;
  name: string;
  status: string;
  encrypted_api_key: string;
  encrypted_api_secret: string;
  encrypted_passphrase?: string;
  last_used_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AIProvider {
  id: string;
  user_id: string;
  provider: string;
  name: string;
  status: string;
  default_model?: string;
  encrypted_api_key: string;
  total_tokens_used: number;
  total_requests: number;
  last_used_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: string;
  user_id: string;
  strategy_id?: string;
  exchange_connection_id?: string;
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  price?: number;
  stop_price?: number;
  status: string;
  mode: string;
  filled_price?: number;
  filled_quantity?: number;
  fee?: number;
  exchange_order_id?: string;
  filled_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UserSettings {
  id: string;
  user_id: string;
  timezone: string;
  notifications_enabled: boolean;
  email_alerts: boolean;
  default_exchange?: string;
  default_ai_provider?: string;
  risk_level: string;
  created_at: Date;
  updated_at: Date;
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
    return result.rows;
  }

  async queryOne<T = unknown>(text: string, values?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(text, values);
    return rows[0] || null;
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
      if (data.is_active !== undefined) {
        fields.push(`is_active = $${paramIndex++}`);
        values.push(data.is_active);
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
        INSERT INTO user_settings (user_id, timezone, notifications_enabled, email_alerts, risk_level)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
          timezone = COALESCE($2, user_settings.timezone),
          notifications_enabled = COALESCE($3, user_settings.notifications_enabled),
          email_alerts = COALESCE($4, user_settings.email_alerts),
          risk_level = COALESCE($5, user_settings.risk_level),
          updated_at = NOW()
        RETURNING *
      `, [
        userId,
        data.timezone || "UTC",
        data.notifications_enabled ?? true,
        data.email_alerts ?? true,
        data.risk_level || "medium",
      ]);
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
      if (data.default_model) {
        fields.push(`default_model = $${paramIndex++}`);
        values.push(data.default_model);
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
      if (data.filled_price !== undefined) {
        fields.push(`filled_price = $${paramIndex++}`);
        values.push(data.filled_price);
      }
      if (data.filled_quantity !== undefined) {
        fields.push(`filled_quantity = $${paramIndex++}`);
        values.push(data.filled_quantity);
      }

      if (fields.length === 0) return this.orders.findById(id);

      values.push(id);
      return this.queryOne<Order>(`
        UPDATE orders SET ${fields.join(", ")}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
    },
  };
}

// Singleton instance
const db = new Database();

export default db;
