/**
 * Database Tests - TDD Red Phase
 * These tests define the expected behavior of the Database class
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Database } from './Database';
import { createTestDatabase, destroyTestDatabase } from '../../tests/helpers/test-db';
import { User, Strategy, Trade, ExchangeConnection } from './types';

describe('Database', () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await destroyTestDatabase(db);
  });

  // ============================================================================
  // Users Table Tests
  // ============================================================================

  describe('Users', () => {
    describe('create', () => {
      it('should_create_user_with_required_fields', async () => {
        const user = await db.users.create({
          email: 'test@example.com',
          passwordHash: 'hashed_password_123',
        });

        expect(user.id).toBeDefined();
        expect(user.email).toBe('test@example.com');
        expect(user.passwordHash).toBe('hashed_password_123');
        expect(user.tier).toBe('free');
        expect(user.isActive).toBe(true);
        expect(user.emailVerified).toBe(false);
        expect(user.createdAt).toBeInstanceOf(Date);
        expect(user.updatedAt).toBeInstanceOf(Date);
      });

      it('should_create_user_with_specified_tier', async () => {
        const user = await db.users.create({
          email: 'pro@example.com',
          passwordHash: 'hashed_password',
          tier: 'pro',
        });

        expect(user.tier).toBe('pro');
      });

      it('should_reject_duplicate_email', async () => {
        await db.users.create({
          email: 'duplicate@example.com',
          passwordHash: 'hash1',
        });

        await expect(
          db.users.create({
            email: 'duplicate@example.com',
            passwordHash: 'hash2',
          })
        ).rejects.toThrow('Email already exists');
      });

      it('should_reject_invalid_tier', async () => {
        await expect(
          db.users.create({
            email: 'invalid@example.com',
            passwordHash: 'hash',
            tier: 'invalid_tier' as any,
          })
        ).rejects.toThrow();
      });

      it('should_reject_invalid_email_format', async () => {
        await expect(
          db.users.create({
            email: 'not-an-email',
            passwordHash: 'hash',
          })
        ).rejects.toThrow('Invalid email');
      });
    });

    describe('findByEmail', () => {
      it('should_find_user_by_email', async () => {
        await db.users.create({
          email: 'findme@example.com',
          passwordHash: 'hash',
        });

        const user = await db.users.findByEmail('findme@example.com');

        expect(user).not.toBeNull();
        expect(user?.email).toBe('findme@example.com');
      });

      it('should_return_null_for_nonexistent_email', async () => {
        const user = await db.users.findByEmail('nonexistent@example.com');
        expect(user).toBeNull();
      });
    });

    describe('findById', () => {
      it('should_find_user_by_id', async () => {
        const created = await db.users.create({
          email: 'findbyid@example.com',
          passwordHash: 'hash',
        });

        const user = await db.users.findById(created.id);

        expect(user).not.toBeNull();
        expect(user?.id).toBe(created.id);
      });
    });

    describe('update', () => {
      it('should_update_user_tier', async () => {
        const user = await db.users.create({
          email: 'upgrade@example.com',
          passwordHash: 'hash',
          tier: 'free',
        });

        const updated = await db.users.update(user.id, { tier: 'pro' });

        expect(updated.tier).toBe('pro');
        expect(updated.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime());
      });

      it('should_update_email_verified_status', async () => {
        const user = await db.users.create({
          email: 'verify@example.com',
          passwordHash: 'hash',
        });

        const updated = await db.users.update(user.id, { emailVerified: true });

        expect(updated.emailVerified).toBe(true);
      });
    });

    describe('delete', () => {
      it('should_delete_user', async () => {
        const user = await db.users.create({
          email: 'deleteme@example.com',
          passwordHash: 'hash',
        });

        await db.users.delete(user.id);

        const found = await db.users.findById(user.id);
        expect(found).toBeNull();
      });

      it('should_cascade_delete_strategies', async () => {
        const user = await db.users.create({
          email: 'cascade@example.com',
          passwordHash: 'hash',
        });

        await db.strategies.create({
          userId: user.id,
          name: 'Will Be Deleted',
          type: 'momentum',
          config: {},
        });

        await db.users.delete(user.id);

        const strategies = await db.strategies.findByUserId(user.id);
        expect(strategies).toHaveLength(0);
      });
    });
  });

  // ============================================================================
  // Strategies Table Tests
  // ============================================================================

  describe('Strategies', () => {
    let testUser: User;

    beforeEach(async () => {
      testUser = await db.users.create({
        email: `strategy-test-${Date.now()}@example.com`,
        passwordHash: 'hash',
        tier: 'pro',
      });
    });

    describe('create', () => {
      it('should_create_strategy_with_required_fields', async () => {
        const strategy = await db.strategies.create({
          userId: testUser.id,
          name: 'My Momentum Strategy',
          type: 'momentum',
          config: { rsiPeriod: 14, threshold: 30 },
        });

        expect(strategy.id).toBeDefined();
        expect(strategy.userId).toBe(testUser.id);
        expect(strategy.name).toBe('My Momentum Strategy');
        expect(strategy.type).toBe('momentum');
        expect(strategy.config).toEqual({ rsiPeriod: 14, threshold: 30 });
        expect(strategy.status).toBe('draft');
      });

      it('should_create_strategy_with_description', async () => {
        const strategy = await db.strategies.create({
          userId: testUser.id,
          name: 'Described Strategy',
          description: 'This is a test strategy',
          type: 'mean_reversion',
          config: {},
        });

        expect(strategy.description).toBe('This is a test strategy');
      });

      it('should_reject_invalid_strategy_type', async () => {
        await expect(
          db.strategies.create({
            userId: testUser.id,
            name: 'Invalid',
            type: 'invalid_type' as any,
            config: {},
          })
        ).rejects.toThrow();
      });

      it('should_reject_strategy_for_nonexistent_user', async () => {
        await expect(
          db.strategies.create({
            userId: '00000000-0000-0000-0000-000000000000',
            name: 'Orphan Strategy',
            type: 'momentum',
            config: {},
          })
        ).rejects.toThrow();
      });
    });

    describe('findByUserId', () => {
      it('should_find_all_strategies_for_user', async () => {
        await db.strategies.create({
          userId: testUser.id,
          name: 'Strategy 1',
          type: 'momentum',
          config: {},
        });

        await db.strategies.create({
          userId: testUser.id,
          name: 'Strategy 2',
          type: 'mean_reversion',
          config: {},
        });

        const strategies = await db.strategies.findByUserId(testUser.id);

        expect(strategies).toHaveLength(2);
      });
    });

    describe('update', () => {
      it('should_update_strategy_status', async () => {
        const strategy = await db.strategies.create({
          userId: testUser.id,
          name: 'Status Test',
          type: 'momentum',
          config: {},
        });

        const updated = await db.strategies.update(strategy.id, { status: 'active' });

        expect(updated.status).toBe('active');
      });

      it('should_update_strategy_config', async () => {
        const strategy = await db.strategies.create({
          userId: testUser.id,
          name: 'Config Test',
          type: 'momentum',
          config: { rsiPeriod: 14 },
        });

        const updated = await db.strategies.update(strategy.id, {
          config: { rsiPeriod: 21, threshold: 25 },
        });

        expect(updated.config).toEqual({ rsiPeriod: 21, threshold: 25 });
      });
    });
  });

  // ============================================================================
  // Trades Table Tests
  // ============================================================================

  describe('Trades', () => {
    let testUser: User;
    let testStrategy: Strategy;

    beforeEach(async () => {
      testUser = await db.users.create({
        email: `trade-test-${Date.now()}@example.com`,
        passwordHash: 'hash',
        tier: 'pro',
      });

      testStrategy = await db.strategies.create({
        userId: testUser.id,
        name: 'Trade Test Strategy',
        type: 'momentum',
        config: {},
        status: 'active',
      });
    });

    describe('create', () => {
      it('should_create_trade_with_required_fields', async () => {
        const trade = await db.trades.create({
          userId: testUser.id,
          strategyId: testStrategy.id,
          symbol: 'BTC/USDT',
          side: 'buy',
          quantity: 0.5,
          price: 45000,
          mode: 'paper',
        });

        expect(trade.id).toBeDefined();
        expect(trade.userId).toBe(testUser.id);
        expect(trade.strategyId).toBe(testStrategy.id);
        expect(trade.symbol).toBe('BTC/USDT');
        expect(trade.side).toBe('buy');
        expect(trade.quantity).toBe(0.5);
        expect(trade.price).toBe(45000);
        expect(trade.status).toBe('pending');
        expect(trade.mode).toBe('paper');
      });

      it('should_create_live_trade', async () => {
        const trade = await db.trades.create({
          userId: testUser.id,
          strategyId: testStrategy.id,
          symbol: 'ETH/USDT',
          side: 'sell',
          quantity: 1.0,
          price: 2500,
          mode: 'live',
          exchangeOrderId: 'binance_order_123',
        });

        expect(trade.mode).toBe('live');
        expect(trade.exchangeOrderId).toBe('binance_order_123');
      });

      it('should_reject_negative_quantity', async () => {
        await expect(
          db.trades.create({
            userId: testUser.id,
            strategyId: testStrategy.id,
            symbol: 'BTC/USDT',
            side: 'buy',
            quantity: -1,
            price: 45000,
            mode: 'paper',
          })
        ).rejects.toThrow();
      });

      it('should_reject_negative_price', async () => {
        await expect(
          db.trades.create({
            userId: testUser.id,
            strategyId: testStrategy.id,
            symbol: 'BTC/USDT',
            side: 'buy',
            quantity: 1,
            price: -100,
            mode: 'paper',
          })
        ).rejects.toThrow();
      });
    });

    describe('findByUserId', () => {
      it('should_find_trades_by_user_id', async () => {
        await db.trades.create({
          userId: testUser.id,
          strategyId: testStrategy.id,
          symbol: 'BTC/USDT',
          side: 'buy',
          quantity: 1,
          price: 45000,
          mode: 'paper',
        });

        const trades = await db.trades.findByUserId(testUser.id);

        expect(trades.length).toBeGreaterThan(0);
      });
    });

    describe('update', () => {
      it('should_update_trade_status', async () => {
        const trade = await db.trades.create({
          userId: testUser.id,
          strategyId: testStrategy.id,
          symbol: 'BTC/USDT',
          side: 'buy',
          quantity: 1,
          price: 45000,
          mode: 'paper',
        });

        const updated = await db.trades.update(trade.id, {
          status: 'filled',
          executedAt: new Date(),
        });

        expect(updated.status).toBe('filled');
        expect(updated.executedAt).toBeInstanceOf(Date);
      });
    });
  });

  // ============================================================================
  // Exchange Connections Tests
  // ============================================================================

  describe('Exchange Connections', () => {
    let testUser: User;

    beforeEach(async () => {
      testUser = await db.users.create({
        email: `exchange-test-${Date.now()}@example.com`,
        passwordHash: 'hash',
        tier: 'pro',
      });
    });

    describe('create', () => {
      it('should_store_encrypted_credentials', async () => {
        const connection = await db.exchangeConnections.create({
          userId: testUser.id,
          exchange: 'binance',
          apiKey: 'my_api_key_12345',
          apiSecret: 'my_secret_67890',
          isPaper: true,
        });

        expect(connection.id).toBeDefined();
        expect(connection.exchange).toBe('binance');
        expect(connection.isPaper).toBe(true);
        expect(connection.isActive).toBe(true);

        // Verify encryption (should not contain plaintext)
        const raw = await db.exchangeConnections.findRaw(connection.id);
        expect(raw.api_key_encrypted).not.toBe('my_api_key_12345');
        expect(raw.api_secret_encrypted).not.toBe('my_secret_67890');
        expect(raw.iv).toBeDefined();
      });

      it('should_allow_same_exchange_for_paper_and_live', async () => {
        await db.exchangeConnections.create({
          userId: testUser.id,
          exchange: 'binance',
          apiKey: 'paper_key',
          apiSecret: 'paper_secret',
          isPaper: true,
        });

        const liveConnection = await db.exchangeConnections.create({
          userId: testUser.id,
          exchange: 'binance',
          apiKey: 'live_key',
          apiSecret: 'live_secret',
          isPaper: false,
        });

        expect(liveConnection.isPaper).toBe(false);
      });

      it('should_reject_duplicate_paper_connection_for_same_exchange', async () => {
        await db.exchangeConnections.create({
          userId: testUser.id,
          exchange: 'coinbase',
          apiKey: 'key1',
          apiSecret: 'secret1',
          isPaper: true,
        });

        await expect(
          db.exchangeConnections.create({
            userId: testUser.id,
            exchange: 'coinbase',
            apiKey: 'key2',
            apiSecret: 'secret2',
            isPaper: true,
          })
        ).rejects.toThrow();
      });
    });

    describe('retrieve', () => {
      it('should_decrypt_credentials', async () => {
        await db.exchangeConnections.create({
          userId: testUser.id,
          exchange: 'kraken',
          apiKey: 'original_key',
          apiSecret: 'original_secret',
          isPaper: true,
        });

        const retrieved = await db.exchangeConnections.findByUserAndExchange(
          testUser.id,
          'kraken',
          true
        );

        expect(retrieved?.apiKey).toBe('original_key');
        expect(retrieved?.apiSecret).toBe('original_secret');
      });
    });

    describe('delete', () => {
      it('should_delete_connection', async () => {
        const connection = await db.exchangeConnections.create({
          userId: testUser.id,
          exchange: 'bybit',
          apiKey: 'key',
          apiSecret: 'secret',
          isPaper: true,
        });

        await db.exchangeConnections.delete(connection.id);

        const found = await db.exchangeConnections.findById(connection.id);
        expect(found).toBeNull();
      });
    });
  });

  // ============================================================================
  // AI Provider Connections Tests
  // ============================================================================

  describe('AI Provider Connections', () => {
    let testUser: User;

    beforeEach(async () => {
      testUser = await db.users.create({
        email: `ai-test-${Date.now()}@example.com`,
        passwordHash: 'hash',
        tier: 'pro',
      });
    });

    describe('create', () => {
      it('should_store_encrypted_ai_key', async () => {
        const connection = await db.aiProviders.create({
          userId: testUser.id,
          provider: 'openai',
          apiKey: 'sk-proj-my-openai-key',
          selectedModel: 'gpt-4o',
          isPrimary: true,
        });

        expect(connection.id).toBeDefined();
        expect(connection.provider).toBe('openai');
        expect(connection.selectedModel).toBe('gpt-4o');
        expect(connection.isPrimary).toBe(true);

        // Verify encryption
        const raw = await db.aiProviders.findRaw(connection.id);
        expect(raw.api_key_encrypted).not.toContain('sk-proj');
      });

      it('should_only_allow_one_connection_per_provider', async () => {
        await db.aiProviders.create({
          userId: testUser.id,
          provider: 'anthropic',
          apiKey: 'key1',
          selectedModel: 'claude-3-opus',
        });

        await expect(
          db.aiProviders.create({
            userId: testUser.id,
            provider: 'anthropic',
            apiKey: 'key2',
            selectedModel: 'claude-3-sonnet',
          })
        ).rejects.toThrow();
      });
    });

    describe('listProviders', () => {
      it('should_list_all_providers_for_user', async () => {
        await db.aiProviders.create({
          userId: testUser.id,
          provider: 'openai',
          apiKey: 'key',
          selectedModel: 'gpt-4o',
        });

        await db.aiProviders.create({
          userId: testUser.id,
          provider: 'anthropic',
          apiKey: 'key',
          selectedModel: 'claude-3-opus',
        });

        const providers = await db.aiProviders.listProviders(testUser.id);

        expect(providers).toContain('openai');
        expect(providers).toContain('anthropic');
      });
    });
  });

  // ============================================================================
  // Audit Logs Tests
  // ============================================================================

  describe('Audit Logs', () => {
    let testUser: User;

    beforeEach(async () => {
      testUser = await db.users.create({
        email: `audit-test-${Date.now()}@example.com`,
        passwordHash: 'hash',
      });
    });

    describe('create', () => {
      it('should_create_audit_log_entry', async () => {
        const log = await db.auditLogs.create({
          userId: testUser.id,
          action: 'user_login',
          details: { method: 'password' },
          ipAddress: '192.168.1.1',
        });

        expect(log.id).toBeDefined();
        expect(log.action).toBe('user_login');
        expect(log.details).toEqual({ method: 'password' });
        expect(log.ipAddress).toBe('192.168.1.1');
      });
    });

    describe('findByUserId', () => {
      it('should_find_audit_logs_for_user', async () => {
        await db.auditLogs.create({
          userId: testUser.id,
          action: 'user_login',
          details: {},
        });

        await db.auditLogs.create({
          userId: testUser.id,
          action: 'password_changed',
          details: {},
        });

        const logs = await db.auditLogs.findByUserId(testUser.id);

        expect(logs.length).toBe(2);
      });
    });
  });
});
