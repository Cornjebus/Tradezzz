/**
 * PostgreSQL Database Connection
 * Handles connection pooling, queries, and transactions
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
}

export interface QueryOptions {
  text: string;
  values?: any[];
}

// ============================================================================
// PostgresDatabase Implementation
// ============================================================================

export class PostgresDatabase {
  private pool: Pool;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      max: config.maxConnections || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  async query<T = any>(text: string, values?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, values);
      const duration = Date.now() - start;

      if (process.env.DEBUG_SQL === 'true') {
        console.log('Executed query', { text, duration, rows: result.rowCount });
      }

      return result;
    } catch (error) {
      console.error('Query error:', { text, error });
      throw error;
    }
  }

  async queryOne<T = any>(text: string, values?: any[]): Promise<T | null> {
    const result = await this.query<T>(text, values);
    return result.rows[0] || null;
  }

  async queryMany<T = any>(text: string, values?: any[]): Promise<T[]> {
    const result = await this.query<T>(text, values);
    return result.rows;
  }

  // ============================================================================
  // Transaction Support
  // ============================================================================

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

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    const client = await this.pool.connect();
    client.release();
    console.log('✓ Database connected');
  }

  async close(): Promise<void> {
    await this.pool.end();
    console.log('✓ Database connection closed');
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  // ============================================================================
  // Migration Support
  // ============================================================================

  async runMigrations(migrationsPath: string): Promise<void> {
    console.log('Running database migrations...');

    // Ensure migrations table exists
    await this.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get list of executed migrations
    const executedResult = await this.query<{ name: string }>(
      'SELECT name FROM migrations ORDER BY id'
    );
    const executed = new Set(executedResult.rows.map(r => r.name));

    // Get migration files
    const files = fs.readdirSync(migrationsPath)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const migrationName = file.replace('.sql', '');

      if (executed.has(migrationName)) {
        console.log(`  ✓ ${migrationName} (already executed)`);
        continue;
      }

      console.log(`  → Running ${migrationName}...`);

      const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');

      await this.transaction(async (client) => {
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migrationName]
        );
      });

      console.log(`  ✓ ${migrationName} completed`);
    }

    console.log('✓ All migrations complete');
  }

  // ============================================================================
  // Repository Factory Methods
  // ============================================================================

  // These create repository instances that work with this database

  get users() {
    return {
      findById: async (id: string) => {
        return this.queryOne(
          'SELECT * FROM users WHERE id = $1',
          [id]
        );
      },

      findByEmail: async (email: string) => {
        return this.queryOne(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );
      },

      create: async (data: {
        email: string;
        passwordHash: string;
        tier?: string;
      }) => {
        return this.queryOne(
          `INSERT INTO users (email, password_hash, tier)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [data.email, data.passwordHash, data.tier || 'free']
        );
      },

      update: async (id: string, data: Partial<any>) => {
        const fields: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined) {
            // Convert camelCase to snake_case
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            fields.push(`${snakeKey} = $${paramCount}`);
            values.push(value);
            paramCount++;
          }
        });

        if (fields.length === 0) return this.queryOne('SELECT * FROM users WHERE id = $1', [id]);

        values.push(id);
        return this.queryOne(
          `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
          values
        );
      },

      delete: async (id: string) => {
        await this.query('DELETE FROM users WHERE id = $1', [id]);
      },
    };
  }

  get strategies() {
    return {
      findById: async (id: string) => {
        return this.queryOne('SELECT * FROM strategies WHERE id = $1', [id]);
      },

      findByUserId: async (userId: string) => {
        return this.queryMany(
          'SELECT * FROM strategies WHERE user_id = $1 ORDER BY created_at DESC',
          [userId]
        );
      },

      create: async (data: any) => {
        return this.queryOne(
          `INSERT INTO strategies (user_id, name, description, type, status, config)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [data.userId, data.name, data.description, data.type, data.status || 'draft', JSON.stringify(data.config)]
        );
      },

      update: async (id: string, data: Partial<any>) => {
        const fields: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (key === 'config') {
              fields.push(`${snakeKey} = $${paramCount}`);
              values.push(JSON.stringify(value));
            } else {
              fields.push(`${snakeKey} = $${paramCount}`);
              values.push(value);
            }
            paramCount++;
          }
        });

        if (fields.length === 0) return this.queryOne('SELECT * FROM strategies WHERE id = $1', [id]);

        values.push(id);
        return this.queryOne(
          `UPDATE strategies SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
          values
        );
      },

      delete: async (id: string) => {
        await this.query('DELETE FROM strategies WHERE id = $1', [id]);
      },
    };
  }

  get orders() {
    return {
      findById: async (id: string) => {
        return this.queryOne('SELECT * FROM orders WHERE id = $1', [id]);
      },

      findByUserId: async (userId: string) => {
        return this.queryMany(
          'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
          [userId]
        );
      },

      findByStrategyId: async (strategyId: string) => {
        return this.queryMany(
          'SELECT * FROM orders WHERE strategy_id = $1 ORDER BY created_at DESC',
          [strategyId]
        );
      },

      create: async (data: any) => {
        return this.queryOne(
          `INSERT INTO orders (user_id, strategy_id, symbol, side, type, quantity, price, stop_price, status, mode)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [data.userId, data.strategyId, data.symbol, data.side, data.type,
           data.quantity, data.price, data.stopPrice, data.status || 'pending', data.mode]
        );
      },

      update: async (id: string, data: Partial<any>) => {
        const fields: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            fields.push(`${snakeKey} = $${paramCount}`);
            values.push(value);
            paramCount++;
          }
        });

        if (fields.length === 0) return this.queryOne('SELECT * FROM orders WHERE id = $1', [id]);

        values.push(id);
        return this.queryOne(
          `UPDATE orders SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
          values
        );
      },
    };
  }

  get positions() {
    return {
      findById: async (id: string) => {
        return this.queryOne('SELECT * FROM positions WHERE id = $1', [id]);
      },

      findOpenByUserId: async (userId: string) => {
        return this.queryMany(
          'SELECT * FROM positions WHERE user_id = $1 AND closed_at IS NULL',
          [userId]
        );
      },

      findClosedByUserId: async (userId: string) => {
        return this.queryMany(
          'SELECT * FROM positions WHERE user_id = $1 AND closed_at IS NOT NULL ORDER BY closed_at DESC',
          [userId]
        );
      },

      create: async (data: any) => {
        return this.queryOne(
          `INSERT INTO positions (user_id, strategy_id, symbol, side, quantity, entry_price, mode)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [data.userId, data.strategyId, data.symbol, data.side, data.quantity, data.entryPrice, data.mode]
        );
      },

      update: async (id: string, data: Partial<any>) => {
        const fields: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            fields.push(`${snakeKey} = $${paramCount}`);
            values.push(value);
            paramCount++;
          }
        });

        if (fields.length === 0) return this.queryOne('SELECT * FROM positions WHERE id = $1', [id]);

        values.push(id);
        return this.queryOne(
          `UPDATE positions SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
          values
        );
      },
    };
  }

  get trades() {
    return {
      findByStrategyId: async (strategyId: string) => {
        return this.queryMany(
          'SELECT * FROM trades WHERE strategy_id = $1 ORDER BY executed_at DESC',
          [strategyId]
        );
      },

      create: async (data: any) => {
        return this.queryOne(
          `INSERT INTO trades (user_id, strategy_id, order_id, position_id, symbol, side, quantity, price, fee, pnl, mode)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [data.userId, data.strategyId, data.orderId, data.positionId, data.symbol,
           data.side, data.quantity, data.price, data.fee, data.pnl, data.mode]
        );
      },
    };
  }

  get exchangeConnections() {
    return {
      findById: async (id: string) => {
        return this.queryOne('SELECT * FROM exchange_connections WHERE id = $1', [id]);
      },

      findByUserId: async (userId: string) => {
        return this.queryMany(
          'SELECT * FROM exchange_connections WHERE user_id = $1',
          [userId]
        );
      },

      create: async (data: any) => {
        return this.queryOne(
          `INSERT INTO exchange_connections (user_id, exchange, name, encrypted_api_key, encrypted_api_secret, encrypted_passphrase)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [data.userId, data.exchange, data.name, data.encryptedApiKey, data.encryptedApiSecret, data.encryptedPassphrase]
        );
      },

      update: async (id: string, data: Partial<any>) => {
        const fields: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            fields.push(`${snakeKey} = $${paramCount}`);
            values.push(value);
            paramCount++;
          }
        });

        if (fields.length === 0) return this.queryOne('SELECT * FROM exchange_connections WHERE id = $1', [id]);

        values.push(id);
        return this.queryOne(
          `UPDATE exchange_connections SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
          values
        );
      },

      delete: async (id: string) => {
        await this.query('DELETE FROM exchange_connections WHERE id = $1', [id]);
      },
    };
  }

  get aiProviders() {
    return {
      findById: async (id: string) => {
        return this.queryOne('SELECT * FROM ai_providers WHERE id = $1', [id]);
      },

      findByUserId: async (userId: string) => {
        return this.queryMany(
          'SELECT * FROM ai_providers WHERE user_id = $1',
          [userId]
        );
      },

      create: async (data: any) => {
        return this.queryOne(
          `INSERT INTO ai_providers (user_id, provider, name, default_model, encrypted_api_key)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [data.userId, data.provider, data.name, data.defaultModel, data.encryptedApiKey]
        );
      },

      update: async (id: string, data: Partial<any>) => {
        const fields: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            fields.push(`${snakeKey} = $${paramCount}`);
            values.push(value);
            paramCount++;
          }
        });

        if (fields.length === 0) return this.queryOne('SELECT * FROM ai_providers WHERE id = $1', [id]);

        values.push(id);
        return this.queryOne(
          `UPDATE ai_providers SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
          values
        );
      },

      delete: async (id: string) => {
        await this.query('DELETE FROM ai_providers WHERE id = $1', [id]);
      },
    };
  }

  get refreshTokens() {
    return {
      findByToken: async (token: string) => {
        return this.queryOne(
          'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
          [token]
        );
      },

      create: async (data: { userId: string; token: string; expiresAt: Date }) => {
        return this.queryOne(
          `INSERT INTO refresh_tokens (user_id, token, expires_at)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [data.userId, data.token, data.expiresAt]
        );
      },

      deleteByToken: async (token: string) => {
        await this.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
      },

      deleteByUserId: async (userId: string) => {
        await this.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPostgresDatabase(config?: Partial<DatabaseConfig>): PostgresDatabase {
  const defaultConfig: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'neural_trading',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  };

  return new PostgresDatabase({ ...defaultConfig, ...config });
}

export default PostgresDatabase;
