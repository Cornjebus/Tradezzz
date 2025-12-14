/**
 * Neon PostgreSQL Database Service
 * Real database connection for production use
 */

import { Pool, PoolClient } from 'pg';

export interface NeonConfig {
  connectionString: string;
  poolSize?: number;
  ssl?: boolean;
}

export class NeonDatabase {
  private pool: Pool;
  private isConnected = false;

  constructor(config?: NeonConfig) {
    const connectionString = config?.connectionString || process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    this.pool = new Pool({
      connectionString,
      max: config?.poolSize || 10,
      ssl: { rejectUnauthorized: false },
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      client.release();
      this.isConnected = true;
      console.log('✓ Connected to Neon PostgreSQL');
    } catch (error) {
      console.error('Failed to connect to Neon:', error);
      throw error;
    }
  }

  async query<T = any>(text: string, values?: any[]): Promise<T[]> {
    const result = await this.pool.query(text, values);
    return result.rows;
  }

  async queryOne<T = any>(text: string, values?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, values);
    return rows[0] || null;
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
    console.log('✓ Disconnected from Neon PostgreSQL');
  }

  // ============================================
  // USER REPOSITORY
  // ============================================

  users = {
    create: async (data: {
      clerkId: string;
      email: string;
      tier?: string;
    }) => {
      return this.queryOne<User>(`
        INSERT INTO users (clerk_id, email, tier, password_hash)
        VALUES ($1, $2, $3, 'clerk-managed')
        RETURNING *
      `, [data.clerkId, data.email, data.tier || 'free']);
    },

    findByClerkId: async (clerkId: string) => {
      return this.queryOne<User>(`
        SELECT * FROM users WHERE clerk_id = $1
      `, [clerkId]);
    },

    findById: async (id: string) => {
      return this.queryOne<User>(`
        SELECT * FROM users WHERE id = $1
      `, [id]);
    },

    findByEmail: async (email: string) => {
      return this.queryOne<User>(`
        SELECT * FROM users WHERE email = $1
      `, [email]);
    },

    update: async (id: string, data: Partial<User>) => {
      const fields: string[] = [];
      const values: any[] = [];
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
        UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
    },

    upsertFromClerk: async (clerkUser: { id: string; email: string }) => {
      return this.queryOne<User>(`
        INSERT INTO users (clerk_id, email, password_hash)
        VALUES ($1, $2, 'clerk-managed')
        ON CONFLICT (clerk_id) DO UPDATE SET
          email = EXCLUDED.email,
          updated_at = NOW()
        RETURNING *
      `, [clerkUser.id, clerkUser.email]);
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
    }) => {
      return this.queryOne<Strategy>(`
        INSERT INTO strategies (user_id, name, description, type, config)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [data.userId, data.name, data.description, data.type, JSON.stringify(data.config || {})]);
    },

    findById: async (id: string) => {
      return this.queryOne<Strategy>(`
        SELECT * FROM strategies WHERE id = $1
      `, [id]);
    },

    findByUserId: async (userId: string) => {
      return this.query<Strategy>(`
        SELECT * FROM strategies WHERE user_id = $1 ORDER BY created_at DESC
      `, [userId]);
    },

    update: async (id: string, data: Partial<Strategy>) => {
      const fields: string[] = [];
      const values: any[] = [];
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
        UPDATE strategies SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
    },

    delete: async (id: string) => {
      await this.query(`DELETE FROM strategies WHERE id = $1`, [id]);
    },

    countByUserId: async (userId: string) => {
      const result = await this.queryOne<{ count: string }>(`
        SELECT COUNT(*) FROM strategies WHERE user_id = $1
      `, [userId]);
      return parseInt(result?.count || '0', 10);
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
    }) => {
      return this.queryOne<ExchangeConnection>(`
        INSERT INTO exchange_connections (user_id, exchange, name, encrypted_api_key, encrypted_api_secret, encrypted_passphrase)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [data.userId, data.exchange, data.name, data.encryptedApiKey, data.encryptedApiSecret, data.encryptedPassphrase]);
    },

    findById: async (id: string) => {
      return this.queryOne<ExchangeConnection>(`
        SELECT * FROM exchange_connections WHERE id = $1
      `, [id]);
    },

    findByUserId: async (userId: string) => {
      return this.query<ExchangeConnection>(`
        SELECT * FROM exchange_connections WHERE user_id = $1 ORDER BY created_at DESC
      `, [userId]);
    },

    update: async (id: string, data: Partial<ExchangeConnection>) => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name) {
        fields.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.status) {
        fields.push(`status = $${paramIndex++}`);
        values.push(data.status);
      }
      if (data.lastUsedAt) {
        fields.push(`last_used_at = $${paramIndex++}`);
        values.push(data.lastUsedAt);
      }

      if (fields.length === 0) return this.exchangeConnections.findById(id);

      values.push(id);
      return this.queryOne<ExchangeConnection>(`
        UPDATE exchange_connections SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
    },

    delete: async (id: string) => {
      await this.query(`DELETE FROM exchange_connections WHERE id = $1`, [id]);
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
    }) => {
      return this.queryOne<AIProvider>(`
        INSERT INTO ai_providers (user_id, provider, name, encrypted_api_key, default_model)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [data.userId, data.provider, data.name, data.encryptedApiKey, data.defaultModel]);
    },

    findById: async (id: string) => {
      return this.queryOne<AIProvider>(`
        SELECT * FROM ai_providers WHERE id = $1
      `, [id]);
    },

    findByUserId: async (userId: string) => {
      return this.query<AIProvider>(`
        SELECT * FROM ai_providers WHERE user_id = $1 ORDER BY created_at DESC
      `, [userId]);
    },

    update: async (id: string, data: Partial<AIProvider>) => {
      const fields: string[] = [];
      const values: any[] = [];
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
        UPDATE ai_providers SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
    },

    delete: async (id: string) => {
      await this.query(`DELETE FROM ai_providers WHERE id = $1`, [id]);
    },

    incrementUsage: async (id: string, tokens: number, requests: number = 1) => {
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
    }) => {
      return this.queryOne<Order>(`
        INSERT INTO orders (user_id, strategy_id, exchange_connection_id, symbol, side, type, quantity, price, stop_price, mode)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [data.userId, data.strategyId, data.exchangeConnectionId, data.symbol, data.side, data.type, data.quantity, data.price, data.stopPrice, data.mode]);
    },

    findById: async (id: string) => {
      return this.queryOne<Order>(`
        SELECT * FROM orders WHERE id = $1
      `, [id]);
    },

    findByUserId: async (userId: string, options?: { limit?: number; status?: string; mode?: string }) => {
      let query = `SELECT * FROM orders WHERE user_id = $1`;
      const values: any[] = [userId];
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

    update: async (id: string, data: Partial<Order>) => {
      const fields: string[] = [];
      const values: any[] = [];
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
      if (data.fee !== undefined) {
        fields.push(`fee = $${paramIndex++}`);
        values.push(data.fee);
      }
      if (data.filledAt) {
        fields.push(`filled_at = $${paramIndex++}`);
        values.push(data.filledAt);
      }
      if (data.exchangeOrderId) {
        fields.push(`exchange_order_id = $${paramIndex++}`);
        values.push(data.exchangeOrderId);
      }

      if (fields.length === 0) return this.orders.findById(id);

      values.push(id);
      return this.queryOne<Order>(`
        UPDATE orders SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
    },
  };

  // ============================================
  // POSITIONS REPOSITORY
  // ============================================

  positions = {
    create: async (data: {
      userId: string;
      strategyId?: string;
      symbol: string;
      side: string;
      quantity: number;
      entryPrice: number;
      mode: string;
    }) => {
      return this.queryOne<Position>(`
        INSERT INTO positions (user_id, strategy_id, symbol, side, quantity, entry_price, mode)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [data.userId, data.strategyId, data.symbol, data.side, data.quantity, data.entryPrice, data.mode]);
    },

    findById: async (id: string) => {
      return this.queryOne<Position>(`
        SELECT * FROM positions WHERE id = $1
      `, [id]);
    },

    findOpen: async (userId: string, symbol?: string) => {
      let query = `SELECT * FROM positions WHERE user_id = $1 AND closed_at IS NULL`;
      const values: any[] = [userId];

      if (symbol) {
        query += ` AND symbol = $2`;
        values.push(symbol);
      }

      query += ` ORDER BY opened_at DESC`;
      return this.query<Position>(query, values);
    },

    update: async (id: string, data: Partial<Position>) => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.currentPrice !== undefined) {
        fields.push(`current_price = $${paramIndex++}`);
        values.push(data.currentPrice);
      }
      if (data.unrealizedPnl !== undefined) {
        fields.push(`unrealized_pnl = $${paramIndex++}`);
        values.push(data.unrealizedPnl);
      }
      if (data.realizedPnl !== undefined) {
        fields.push(`realized_pnl = $${paramIndex++}`);
        values.push(data.realizedPnl);
      }
      if (data.closedAt) {
        fields.push(`closed_at = $${paramIndex++}`);
        values.push(data.closedAt);
      }

      if (fields.length === 0) return this.positions.findById(id);

      values.push(id);
      return this.queryOne<Position>(`
        UPDATE positions SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
    },

    close: async (id: string, exitPrice: number, realizedPnl: number) => {
      return this.queryOne<Position>(`
        UPDATE positions SET
          current_price = $1,
          realized_pnl = $2,
          unrealized_pnl = 0,
          closed_at = NOW(),
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [exitPrice, realizedPnl, id]);
    },
  };

  // ============================================
  // USER SETTINGS REPOSITORY
  // ============================================

  userSettings = {
    findByUserId: async (userId: string) => {
      return this.queryOne<UserSettings>(`
        SELECT * FROM user_settings WHERE user_id = $1
      `, [userId]);
    },

    upsert: async (userId: string, data: Partial<UserSettings>) => {
      return this.queryOne<UserSettings>(`
        INSERT INTO user_settings (user_id, timezone, notifications_enabled, email_alerts, default_exchange, default_ai_provider, risk_level)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
          timezone = COALESCE($2, user_settings.timezone),
          notifications_enabled = COALESCE($3, user_settings.notifications_enabled),
          email_alerts = COALESCE($4, user_settings.email_alerts),
          default_exchange = COALESCE($5, user_settings.default_exchange),
          default_ai_provider = COALESCE($6, user_settings.default_ai_provider),
          risk_level = COALESCE($7, user_settings.risk_level),
          updated_at = NOW()
        RETURNING *
      `, [
        userId,
        data.timezone || 'UTC',
        data.notificationsEnabled ?? true,
        data.emailAlerts ?? true,
        data.defaultExchange,
        data.defaultAiProvider,
        data.riskLevel || 'medium',
      ]);
    },
  };

  // ============================================
  // AUDIT LOG REPOSITORY
  // ============================================

  auditLog = {
    log: async (data: {
      userId?: string;
      action: string;
      resourceType: string;
      resourceId?: string;
      details?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    }) => {
      return this.queryOne(`
        INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [data.userId, data.action, data.resourceType, data.resourceId, JSON.stringify(data.details || {}), data.ipAddress, data.userAgent]);
    },

    findByUserId: async (userId: string, limit = 100) => {
      return this.query(`
        SELECT * FROM audit_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2
      `, [userId, limit]);
    },
  };
}

// Type definitions
export interface User {
  id: string;
  clerk_id?: string;
  email: string;
  password_hash: string;
  tier: string;
  is_active: boolean;
  email_verified: boolean;
  token_version: number;
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

export interface Position {
  id: string;
  user_id: string;
  strategy_id?: string;
  symbol: string;
  side: string;
  quantity: number;
  entry_price: number;
  current_price?: number;
  unrealized_pnl?: number;
  realized_pnl?: number;
  mode: string;
  opened_at: Date;
  closed_at?: Date;
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

// Singleton instance
let dbInstance: NeonDatabase | null = null;

export function getDatabase(): NeonDatabase {
  if (!dbInstance) {
    dbInstance = new NeonDatabase();
  }
  return dbInstance;
}

export async function initializeDatabase(): Promise<NeonDatabase> {
  const db = getDatabase();
  await db.connect();
  return db;
}
