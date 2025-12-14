/**
 * Database - Multi-User Neural Trading Platform
 * Handles all database operations with encryption for sensitive data
 */

import { Pool, PoolClient } from 'pg';
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
} from './types';

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.MASTER_ENCRYPTION_KEY || 'default-key-32-bytes-for-testing!';

export class Database {
  private pool: Pool;
  private schemaName: string;

  constructor(pool: Pool, schemaName: string = 'public') {
    this.pool = pool;
    this.schemaName = schemaName;
  }

  getPool(): Pool {
    return this.pool;
  }

  getSchemaName(): string {
    return this.schemaName;
  }

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

  // ============================================================================
  // Validation Helpers
  // ============================================================================

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

  users = {
    create: async (input: CreateUserInput): Promise<User> => {
      if (!this.isValidEmail(input.email)) {
        throw new Error('Invalid email');
      }

      if (input.tier && !this.isValidTier(input.tier)) {
        throw new Error('Invalid tier');
      }

      // Check for duplicate email
      const existing = await this.pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [input.email]
      );

      if (existing.rows.length > 0) {
        throw new Error('Email already exists');
      }

      const result = await this.pool.query(
        `INSERT INTO users (email, password_hash, tier)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [input.email, input.passwordHash, input.tier || 'free']
      );

      return this.mapUser(result.rows[0]);
    },

    findByEmail: async (email: string): Promise<User | null> => {
      const result = await this.pool.query(
        `SELECT * FROM users WHERE email = $1`,
        [email]
      );
      return result.rows[0] ? this.mapUser(result.rows[0]) : null;
    },

    findById: async (id: string): Promise<User | null> => {
      const result = await this.pool.query(
        `SELECT * FROM users WHERE id = $1`,
        [id]
      );
      return result.rows[0] ? this.mapUser(result.rows[0]) : null;
    },

    update: async (id: string, updates: Partial<User>): Promise<User> => {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.tier !== undefined) {
        setClauses.push(`tier = $${paramIndex++}`);
        values.push(updates.tier);
      }
      if (updates.emailVerified !== undefined) {
        setClauses.push(`email_verified = $${paramIndex++}`);
        values.push(updates.emailVerified);
      }
      if (updates.isActive !== undefined) {
        setClauses.push(`is_active = $${paramIndex++}`);
        values.push(updates.isActive);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const result = await this.pool.query(
        `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      return this.mapUser(result.rows[0]);
    },

    delete: async (id: string): Promise<void> => {
      await this.pool.query(`DELETE FROM users WHERE id = $1`, [id]);
    },
  };

  // ============================================================================
  // Strategies
  // ============================================================================

  strategies = {
    create: async (input: CreateStrategyInput): Promise<Strategy> => {
      const result = await this.pool.query(
        `INSERT INTO strategies (user_id, name, description, type, config, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          input.userId,
          input.name,
          input.description || null,
          input.type,
          JSON.stringify(input.config),
          input.status || 'draft',
        ]
      );

      return this.mapStrategy(result.rows[0]);
    },

    findById: async (id: string): Promise<Strategy | null> => {
      const result = await this.pool.query(
        `SELECT * FROM strategies WHERE id = $1`,
        [id]
      );
      return result.rows[0] ? this.mapStrategy(result.rows[0]) : null;
    },

    findByUserId: async (userId: string): Promise<Strategy[]> => {
      const result = await this.pool.query(
        `SELECT * FROM strategies WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      return result.rows.map(this.mapStrategy);
    },

    update: async (id: string, updates: Partial<Strategy>): Promise<Strategy> => {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.config !== undefined) {
        setClauses.push(`config = $${paramIndex++}`);
        values.push(JSON.stringify(updates.config));
      }
      if (updates.status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const result = await this.pool.query(
        `UPDATE strategies SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      return this.mapStrategy(result.rows[0]);
    },

    delete: async (id: string): Promise<void> => {
      await this.pool.query(`DELETE FROM strategies WHERE id = $1`, [id]);
    },
  };

  // ============================================================================
  // Trades
  // ============================================================================

  trades = {
    create: async (input: CreateTradeInput): Promise<Trade> => {
      const result = await this.pool.query(
        `INSERT INTO trades (user_id, strategy_id, symbol, side, quantity, price, status, mode, exchange_order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          input.userId,
          input.strategyId,
          input.symbol,
          input.side,
          input.quantity,
          input.price,
          input.status || 'pending',
          input.mode,
          input.exchangeOrderId || null,
        ]
      );

      return this.mapTrade(result.rows[0]);
    },

    findById: async (id: string): Promise<Trade | null> => {
      const result = await this.pool.query(
        `SELECT * FROM trades WHERE id = $1`,
        [id]
      );
      return result.rows[0] ? this.mapTrade(result.rows[0]) : null;
    },

    findByUserId: async (userId: string, limit: number = 100): Promise<Trade[]> => {
      const result = await this.pool.query(
        `SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [userId, limit]
      );
      return result.rows.map(this.mapTrade);
    },

    findByStrategyId: async (strategyId: string): Promise<Trade[]> => {
      const result = await this.pool.query(
        `SELECT * FROM trades WHERE strategy_id = $1 ORDER BY created_at DESC`,
        [strategyId]
      );
      return result.rows.map(this.mapTrade);
    },

    update: async (id: string, updates: Partial<Trade>): Promise<Trade> => {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }
      if (updates.executedAt !== undefined) {
        setClauses.push(`executed_at = $${paramIndex++}`);
        values.push(updates.executedAt);
      }
      if (updates.exchangeOrderId !== undefined) {
        setClauses.push(`exchange_order_id = $${paramIndex++}`);
        values.push(updates.exchangeOrderId);
      }

      values.push(id);

      const result = await this.pool.query(
        `UPDATE trades SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      return this.mapTrade(result.rows[0]);
    },
  };

  // ============================================================================
  // Exchange Connections
  // ============================================================================

  exchangeConnections = {
    create: async (input: CreateExchangeConnectionInput): Promise<ExchangeConnection> => {
      // Encrypt credentials
      const keyEncryption = this.encrypt(input.apiKey);
      const secretEncryption = this.encrypt(input.apiSecret);

      // Store with combined IV (we use same IV for both for simplicity, but store auth tags separately)
      const combinedData = JSON.stringify({
        keyEncrypted: keyEncryption.encrypted,
        keyAuthTag: keyEncryption.authTag,
        secretEncrypted: secretEncryption.encrypted,
        secretAuthTag: secretEncryption.authTag,
      });

      const result = await this.pool.query(
        `INSERT INTO exchange_connections (user_id, exchange, api_key_encrypted, api_secret_encrypted, iv, is_paper)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          input.userId,
          input.exchange,
          keyEncryption.encrypted + ':' + keyEncryption.authTag,
          secretEncryption.encrypted + ':' + secretEncryption.authTag,
          keyEncryption.iv, // Use same IV for both
          input.isPaper ?? true,
        ]
      );

      return this.mapExchangeConnection(result.rows[0]);
    },

    findById: async (id: string): Promise<ExchangeConnection | null> => {
      const result = await this.pool.query(
        `SELECT * FROM exchange_connections WHERE id = $1`,
        [id]
      );
      return result.rows[0] ? this.mapExchangeConnection(result.rows[0]) : null;
    },

    findRaw: async (id: string): Promise<any> => {
      const result = await this.pool.query(
        `SELECT * FROM exchange_connections WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    findByUserAndExchange: async (
      userId: string,
      exchange: ExchangeName,
      isPaper: boolean
    ): Promise<(ExchangeConnection & { apiKey: string; apiSecret: string }) | null> => {
      const result = await this.pool.query(
        `SELECT * FROM exchange_connections WHERE user_id = $1 AND exchange = $2 AND is_paper = $3`,
        [userId, exchange, isPaper]
      );

      if (!result.rows[0]) return null;

      const row = result.rows[0];
      const [keyEncrypted, keyAuthTag] = row.api_key_encrypted.split(':');
      const [secretEncrypted, secretAuthTag] = row.api_secret_encrypted.split(':');

      const apiKey = this.decrypt(keyEncrypted, row.iv, keyAuthTag);
      const apiSecret = this.decrypt(secretEncrypted, row.iv, secretAuthTag);

      return {
        ...this.mapExchangeConnection(row),
        apiKey,
        apiSecret,
      };
    },

    findByUserId: async (userId: string): Promise<ExchangeConnection[]> => {
      const result = await this.pool.query(
        `SELECT * FROM exchange_connections WHERE user_id = $1`,
        [userId]
      );
      return result.rows.map(this.mapExchangeConnection);
    },

    delete: async (id: string): Promise<void> => {
      await this.pool.query(`DELETE FROM exchange_connections WHERE id = $1`, [id]);
    },
  };

  // ============================================================================
  // AI Provider Connections
  // ============================================================================

  aiProviders = {
    create: async (input: CreateAIProviderInput): Promise<AIProviderConnection> => {
      const keyEncryption = this.encrypt(input.apiKey);

      const result = await this.pool.query(
        `INSERT INTO ai_provider_connections (user_id, provider, api_key_encrypted, iv, selected_model, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          input.userId,
          input.provider,
          keyEncryption.encrypted + ':' + keyEncryption.authTag,
          keyEncryption.iv,
          input.selectedModel,
          input.isPrimary ?? false,
        ]
      );

      return this.mapAIProvider(result.rows[0]);
    },

    findById: async (id: string): Promise<AIProviderConnection | null> => {
      const result = await this.pool.query(
        `SELECT * FROM ai_provider_connections WHERE id = $1`,
        [id]
      );
      return result.rows[0] ? this.mapAIProvider(result.rows[0]) : null;
    },

    findRaw: async (id: string): Promise<any> => {
      const result = await this.pool.query(
        `SELECT * FROM ai_provider_connections WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    findByUserAndProvider: async (
      userId: string,
      provider: AIProviderName
    ): Promise<(AIProviderConnection & { apiKey: string }) | null> => {
      const result = await this.pool.query(
        `SELECT * FROM ai_provider_connections WHERE user_id = $1 AND provider = $2`,
        [userId, provider]
      );

      if (!result.rows[0]) return null;

      const row = result.rows[0];
      const [keyEncrypted, keyAuthTag] = row.api_key_encrypted.split(':');
      const apiKey = this.decrypt(keyEncrypted, row.iv, keyAuthTag);

      return {
        ...this.mapAIProvider(row),
        apiKey,
      };
    },

    listProviders: async (userId: string): Promise<AIProviderName[]> => {
      const result = await this.pool.query(
        `SELECT provider FROM ai_provider_connections WHERE user_id = $1`,
        [userId]
      );
      return result.rows.map((row) => row.provider as AIProviderName);
    },

    delete: async (id: string): Promise<void> => {
      await this.pool.query(`DELETE FROM ai_provider_connections WHERE id = $1`, [id]);
    },
  };

  // ============================================================================
  // Audit Logs
  // ============================================================================

  auditLogs = {
    create: async (input: {
      userId: string;
      action: AuditAction;
      details?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    }): Promise<AuditLog> => {
      const result = await this.pool.query(
        `INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          input.userId,
          input.action,
          JSON.stringify(input.details || {}),
          input.ipAddress || null,
          input.userAgent || null,
        ]
      );

      return this.mapAuditLog(result.rows[0]);
    },

    findByUserId: async (userId: string, limit: number = 100): Promise<AuditLog[]> => {
      const result = await this.pool.query(
        `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [userId, limit]
      );
      return result.rows.map(this.mapAuditLog);
    },
  };

  // ============================================================================
  // Mappers
  // ============================================================================

  private mapUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      tier: row.tier,
      isActive: row.is_active,
      emailVerified: row.email_verified,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapStrategy(row: any): Strategy {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      type: row.type,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapTrade(row: any): Trade {
    return {
      id: row.id,
      userId: row.user_id,
      strategyId: row.strategy_id,
      symbol: row.symbol,
      side: row.side,
      quantity: parseFloat(row.quantity),
      price: parseFloat(row.price),
      status: row.status,
      mode: row.mode,
      exchangeOrderId: row.exchange_order_id,
      executedAt: row.executed_at ? new Date(row.executed_at) : undefined,
      createdAt: new Date(row.created_at),
    };
  }

  private mapExchangeConnection(row: any): ExchangeConnection {
    return {
      id: row.id,
      userId: row.user_id,
      exchange: row.exchange,
      apiKeyEncrypted: row.api_key_encrypted,
      apiSecretEncrypted: row.api_secret_encrypted,
      iv: row.iv,
      isPaper: row.is_paper,
      isActive: row.is_active,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapAIProvider(row: any): AIProviderConnection {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      apiKeyEncrypted: row.api_key_encrypted,
      iv: row.iv,
      selectedModel: row.selected_model,
      isPrimary: row.is_primary,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      userId: row.user_id,
      action: row.action,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: new Date(row.created_at),
    };
  }
}
