/**
 * Test Database Helpers
 * Provides isolated test database instances for unit and integration tests
 */

import { Pool } from 'pg';
import { Database } from '../../src/database/Database';
import { v4 as uuidv4 } from 'uuid';

// Test database configuration
const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
  database: process.env.TEST_DB_NAME || 'neural_trading_test',
};

/**
 * Creates an isolated test database instance
 */
export async function createTestDatabase(): Promise<Database> {
  const pool = new Pool(TEST_DB_CONFIG);

  // Create schema for test isolation
  const schemaName = `test_${uuidv4().replace(/-/g, '_')}`;

  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
  await pool.query(`SET search_path TO ${schemaName}`);

  // Run migrations
  await runMigrations(pool);

  const db = new Database(pool, schemaName);
  return db;
}

/**
 * Destroys the test database instance and cleans up
 */
export async function destroyTestDatabase(db: Database): Promise<void> {
  const schemaName = db.getSchemaName();
  const pool = db.getPool();

  await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  await pool.end();
}

/**
 * Runs all database migrations
 */
async function runMigrations(pool: Pool): Promise<void> {
  // Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      tier VARCHAR(50) NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'elite', 'institutional')),
      is_active BOOLEAN DEFAULT true,
      email_verified BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Strategies table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS strategies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(50) NOT NULL CHECK (type IN ('momentum', 'mean_reversion', 'sentiment', 'arbitrage', 'trend_following', 'custom')),
      config JSONB NOT NULL DEFAULT '{}',
      status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'backtesting', 'paper', 'active', 'paused', 'archived')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Trades table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
      symbol VARCHAR(50) NOT NULL,
      side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
      quantity DECIMAL(20, 8) NOT NULL CHECK (quantity > 0),
      price DECIMAL(20, 8) NOT NULL CHECK (price > 0),
      status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'partially_filled', 'cancelled', 'failed')),
      mode VARCHAR(10) NOT NULL CHECK (mode IN ('paper', 'live')),
      exchange_order_id VARCHAR(255),
      executed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Exchange connections table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exchange_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      exchange VARCHAR(50) NOT NULL CHECK (exchange IN ('binance', 'coinbase', 'kraken', 'bybit', 'okx')),
      api_key_encrypted TEXT NOT NULL,
      api_secret_encrypted TEXT NOT NULL,
      iv VARCHAR(64) NOT NULL,
      is_paper BOOLEAN DEFAULT true,
      is_active BOOLEAN DEFAULT true,
      last_used_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, exchange, is_paper)
    )
  `);

  // AI provider connections table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_provider_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'deepseek', 'groq', 'mistral', 'xai', 'ollama')),
      api_key_encrypted TEXT NOT NULL,
      iv VARCHAR(64) NOT NULL,
      selected_model VARCHAR(100) NOT NULL,
      is_primary BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, provider)
    )
  `);

  // AI usage logs table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider VARCHAR(50) NOT NULL,
      model VARCHAR(100) NOT NULL,
      tokens_input INTEGER NOT NULL DEFAULT 0,
      tokens_output INTEGER NOT NULL DEFAULT 0,
      tokens_reasoning INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER,
      estimated_cost DECIMAL(10, 6) DEFAULT 0,
      request_type VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Audit logs table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action VARCHAR(100) NOT NULL,
      details JSONB DEFAULT '{}',
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Create indexes
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_strategies_user_id ON strategies(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_trades_strategy_id ON trades(strategy_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage_logs(user_id, created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`);
}

/**
 * Creates mock encrypted credentials for testing
 */
export function createMockEncryptedCredentials() {
  return {
    encrypted: 'mock_encrypted_data_' + uuidv4(),
    iv: uuidv4().replace(/-/g, '').substring(0, 32),
  };
}
