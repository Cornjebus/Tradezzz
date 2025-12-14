# Multi-User Neural Trading Platform - TDD Implementation Plan

## 🎯 Overview

This document outlines the Test-Driven Development (TDD) approach for building a multi-user crypto trading platform. Every component is designed **test-first** following the Red-Green-Refactor cycle.

**Core Principle**: Write failing tests → Write minimal code to pass → Refactor → Repeat

---

## 📋 Table of Contents

1. [TDD Philosophy & Standards](#tdd-philosophy--standards)
2. [Phase 1: Foundation Layer](#phase-1-foundation-layer)
3. [Phase 2: User Management](#phase-2-user-management)
4. [Phase 3: Strategy Engine](#phase-3-strategy-engine)
5. [Phase 4: Execution Service](#phase-4-execution-service)
6. [Phase 5: AI/ML Integration](#phase-5-aiml-integration)
7. [Phase 6: Real-Time Systems](#phase-6-real-time-systems)
8. [Phase 7: Platform Features](#phase-7-platform-features)
9. [Test Infrastructure](#test-infrastructure)
10. [Continuous Integration](#continuous-integration)

---

## 🧪 TDD Philosophy & Standards

### The Red-Green-Refactor Cycle

```
┌─────────────────────────────────────────────────────────────┐
│                    TDD CYCLE                                 │
│                                                              │
│     ┌──────────┐                                            │
│     │   RED    │  Write a failing test                      │
│     │  (Fail)  │  that defines desired behavior             │
│     └────┬─────┘                                            │
│          │                                                   │
│          ▼                                                   │
│     ┌──────────┐                                            │
│     │  GREEN   │  Write minimal code                        │
│     │  (Pass)  │  to make the test pass                     │
│     └────┬─────┘                                            │
│          │                                                   │
│          ▼                                                   │
│     ┌──────────┐                                            │
│     │ REFACTOR │  Improve code quality                      │
│     │ (Clean)  │  while keeping tests green                 │
│     └────┬─────┘                                            │
│          │                                                   │
│          └──────────────► Repeat                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Testing Pyramid

```
                    ┌───────────┐
                    │    E2E    │  10% - Full user flows
                    │   Tests   │  (Playwright/Cypress)
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │Integration│  20% - Service interactions
                    │   Tests   │  (Supertest + Test DB)
                    └─────┬─────┘
                          │
              ┌───────────▼───────────┐
              │      Unit Tests       │  70% - Individual functions
              │   (Jest/Vitest)       │  Fast, isolated, many
              └───────────────────────┘
```

### Test Standards

| Standard | Requirement |
|----------|-------------|
| Coverage | Minimum 80% line coverage |
| Speed | Unit tests < 10ms each |
| Isolation | No test depends on another |
| Naming | `should_[expected]_when_[condition]` |
| Assertions | One logical assertion per test |
| Mocking | Mock external dependencies only |

### Test File Structure

```
src/
├── users/
│   ├── UserService.ts
│   ├── UserService.test.ts        # Unit tests (same directory)
│   └── UserService.integration.ts # Integration tests
├── strategies/
│   ├── StrategyEngine.ts
│   └── StrategyEngine.test.ts
└── ...

tests/
├── e2e/
│   ├── user-registration.e2e.ts
│   ├── strategy-deployment.e2e.ts
│   └── trading-flow.e2e.ts
├── fixtures/
│   ├── users.fixture.ts
│   ├── strategies.fixture.ts
│   └── market-data.fixture.ts
└── helpers/
    ├── test-db.ts
    ├── mock-exchange.ts
    └── test-utils.ts
```

---

## 🏗️ Phase 1: Foundation Layer

### 1.1 Database Schema (Test-First)

**Test File**: `src/database/schema.test.ts`

```typescript
// RED: Write failing tests first
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase, destroyTestDatabase } from '../tests/helpers/test-db';
import { Database } from './Database';

describe('Database Schema', () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await destroyTestDatabase(db);
  });

  describe('Users Table', () => {
    it('should_create_user_with_required_fields', async () => {
      const user = await db.users.create({
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        tier: 'free'
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.tier).toBe('free');
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should_reject_duplicate_email', async () => {
      await db.users.create({
        email: 'duplicate@example.com',
        passwordHash: 'hash1',
        tier: 'free'
      });

      await expect(
        db.users.create({
          email: 'duplicate@example.com',
          passwordHash: 'hash2',
          tier: 'free'
        })
      ).rejects.toThrow('Email already exists');
    });

    it('should_enforce_valid_tier_enum', async () => {
      await expect(
        db.users.create({
          email: 'tier@example.com',
          passwordHash: 'hash',
          tier: 'invalid_tier' as any
        })
      ).rejects.toThrow('Invalid tier');
    });
  });

  describe('Strategies Table', () => {
    it('should_create_strategy_linked_to_user', async () => {
      const user = await db.users.create({
        email: 'strategy@example.com',
        passwordHash: 'hash',
        tier: 'pro'
      });

      const strategy = await db.strategies.create({
        userId: user.id,
        name: 'My Strategy',
        type: 'mean_reversion',
        config: { rsiPeriod: 14, threshold: 30 },
        status: 'draft'
      });

      expect(strategy.id).toBeDefined();
      expect(strategy.userId).toBe(user.id);
      expect(strategy.config.rsiPeriod).toBe(14);
    });

    it('should_cascade_delete_strategies_when_user_deleted', async () => {
      const user = await db.users.create({
        email: 'cascade@example.com',
        passwordHash: 'hash',
        tier: 'free'
      });

      await db.strategies.create({
        userId: user.id,
        name: 'Will Be Deleted',
        type: 'momentum',
        config: {},
        status: 'draft'
      });

      await db.users.delete(user.id);

      const strategies = await db.strategies.findByUserId(user.id);
      expect(strategies).toHaveLength(0);
    });
  });

  describe('Trades Table', () => {
    it('should_store_trade_with_all_required_fields', async () => {
      const user = await db.users.create({
        email: 'trader@example.com',
        passwordHash: 'hash',
        tier: 'pro'
      });

      const strategy = await db.strategies.create({
        userId: user.id,
        name: 'Trade Strategy',
        type: 'momentum',
        config: {},
        status: 'active'
      });

      const trade = await db.trades.create({
        userId: user.id,
        strategyId: strategy.id,
        symbol: 'BTC/USDT',
        side: 'buy',
        quantity: 0.5,
        price: 45000,
        status: 'filled',
        exchangeOrderId: 'binance_123'
      });

      expect(trade.id).toBeDefined();
      expect(trade.symbol).toBe('BTC/USDT');
      expect(trade.side).toBe('buy');
      expect(trade.quantity).toBe(0.5);
    });

    it('should_calculate_pnl_on_closed_trades', async () => {
      // Setup user and strategy...
      const entryTrade = await db.trades.create({
        /* buy trade */
      });

      const exitTrade = await db.trades.create({
        /* sell trade */
        linkedTradeId: entryTrade.id
      });

      const pnl = await db.trades.calculatePnL(entryTrade.id, exitTrade.id);
      expect(pnl.realized).toBeDefined();
      expect(pnl.percentage).toBeDefined();
    });
  });

  describe('Exchange Connections Table', () => {
    it('should_store_encrypted_api_keys', async () => {
      const user = await db.users.create({
        email: 'exchange@example.com',
        passwordHash: 'hash',
        tier: 'pro'
      });

      const connection = await db.exchangeConnections.create({
        userId: user.id,
        exchange: 'binance',
        apiKey: 'my_api_key',      // Should be encrypted
        apiSecret: 'my_secret',     // Should be encrypted
        isPaper: true
      });

      // Verify encryption (raw value should not match)
      const rawConnection = await db.exchangeConnections.findRaw(connection.id);
      expect(rawConnection.apiKey).not.toBe('my_api_key');
      expect(rawConnection.apiSecret).not.toBe('my_secret');

      // Verify decryption works
      const decrypted = await db.exchangeConnections.findById(connection.id);
      expect(decrypted.apiKey).toBe('my_api_key');
    });
  });
});
```

**Implementation**: `src/database/Database.ts`

```typescript
// GREEN: Write minimal code to pass tests
import { Pool } from 'pg';
import { encrypt, decrypt } from '../utils/crypto';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  tier: 'free' | 'pro' | 'elite' | 'institutional';
  createdAt: Date;
  updatedAt: Date;
}

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  type: string;
  config: Record<string, any>;
  status: 'draft' | 'backtesting' | 'paper' | 'active' | 'paused';
  createdAt: Date;
}

export interface Trade {
  id: string;
  userId: string;
  strategyId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  exchangeOrderId?: string;
  createdAt: Date;
}

export class Database {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  users = {
    create: async (data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> => {
      // Check for duplicate email
      const existing = await this.pool.query(
        'SELECT id FROM users WHERE email = $1',
        [data.email]
      );
      if (existing.rows.length > 0) {
        throw new Error('Email already exists');
      }

      // Validate tier
      const validTiers = ['free', 'pro', 'elite', 'institutional'];
      if (!validTiers.includes(data.tier)) {
        throw new Error('Invalid tier');
      }

      const result = await this.pool.query(
        `INSERT INTO users (email, password_hash, tier)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [data.email, data.passwordHash, data.tier]
      );

      return this.mapUser(result.rows[0]);
    },

    delete: async (id: string): Promise<void> => {
      await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
    },

    findByEmail: async (email: string): Promise<User | null> => {
      const result = await this.pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0] ? this.mapUser(result.rows[0]) : null;
    }
  };

  strategies = {
    create: async (data: Omit<Strategy, 'id' | 'createdAt'>): Promise<Strategy> => {
      const result = await this.pool.query(
        `INSERT INTO strategies (user_id, name, type, config, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [data.userId, data.name, data.type, JSON.stringify(data.config), data.status]
      );
      return this.mapStrategy(result.rows[0]);
    },

    findByUserId: async (userId: string): Promise<Strategy[]> => {
      const result = await this.pool.query(
        'SELECT * FROM strategies WHERE user_id = $1',
        [userId]
      );
      return result.rows.map(this.mapStrategy);
    }
  };

  trades = {
    create: async (data: Omit<Trade, 'id' | 'createdAt'>): Promise<Trade> => {
      const result = await this.pool.query(
        `INSERT INTO trades (user_id, strategy_id, symbol, side, quantity, price, status, exchange_order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [data.userId, data.strategyId, data.symbol, data.side, data.quantity, data.price, data.status, data.exchangeOrderId]
      );
      return this.mapTrade(result.rows[0]);
    },

    calculatePnL: async (entryId: string, exitId: string) => {
      const entry = await this.trades.findById(entryId);
      const exit = await this.trades.findById(exitId);

      const realized = (exit.price - entry.price) * entry.quantity;
      const percentage = ((exit.price - entry.price) / entry.price) * 100;

      return { realized, percentage };
    }
  };

  exchangeConnections = {
    create: async (data: {
      userId: string;
      exchange: string;
      apiKey: string;
      apiSecret: string;
      isPaper: boolean;
    }) => {
      const encryptedKey = encrypt(data.apiKey);
      const encryptedSecret = encrypt(data.apiSecret);

      const result = await this.pool.query(
        `INSERT INTO exchange_connections (user_id, exchange, api_key, api_secret, is_paper)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [data.userId, data.exchange, encryptedKey, encryptedSecret, data.isPaper]
      );

      return {
        ...result.rows[0],
        apiKey: data.apiKey,  // Return decrypted
        apiSecret: data.apiSecret
      };
    },

    findById: async (id: string) => {
      const result = await this.pool.query(
        'SELECT * FROM exchange_connections WHERE id = $1',
        [id]
      );
      const row = result.rows[0];
      return {
        ...row,
        apiKey: decrypt(row.api_key),
        apiSecret: decrypt(row.api_secret)
      };
    },

    findRaw: async (id: string) => {
      const result = await this.pool.query(
        'SELECT * FROM exchange_connections WHERE id = $1',
        [id]
      );
      return result.rows[0];
    }
  };

  private mapUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      tier: row.tier,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapStrategy(row: any): Strategy {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type,
      config: row.config,
      status: row.status,
      createdAt: row.created_at
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
      exchangeOrderId: row.exchange_order_id,
      createdAt: row.created_at
    };
  }
}
```

---

## 👤 Phase 2: User Management

### 2.1 Authentication Service (Test-First)

**Test File**: `src/auth/AuthService.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './AuthService';
import { Database } from '../database/Database';
import { createMockDatabase } from '../../tests/helpers/mock-database';

describe('AuthService', () => {
  let authService: AuthService;
  let mockDb: Database;

  beforeEach(() => {
    mockDb = createMockDatabase();
    authService = new AuthService(mockDb);
  });

  describe('register', () => {
    it('should_create_user_with_hashed_password', async () => {
      const result = await authService.register({
        email: 'new@example.com',
        password: 'SecurePass123!'
      });

      expect(result.user.email).toBe('new@example.com');
      expect(result.user.passwordHash).not.toBe('SecurePass123!');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should_reject_weak_password', async () => {
      await expect(
        authService.register({
          email: 'weak@example.com',
          password: '123'
        })
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should_reject_invalid_email', async () => {
      await expect(
        authService.register({
          email: 'not-an-email',
          password: 'SecurePass123!'
        })
      ).rejects.toThrow('Invalid email format');
    });

    it('should_reject_duplicate_email', async () => {
      await authService.register({
        email: 'existing@example.com',
        password: 'SecurePass123!'
      });

      await expect(
        authService.register({
          email: 'existing@example.com',
          password: 'AnotherPass123!'
        })
      ).rejects.toThrow('Email already exists');
    });

    it('should_set_default_tier_to_free', async () => {
      const result = await authService.register({
        email: 'free@example.com',
        password: 'SecurePass123!'
      });

      expect(result.user.tier).toBe('free');
    });
  });

  describe('login', () => {
    it('should_return_tokens_on_valid_credentials', async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'SecurePass123!'
      });

      const result = await authService.login({
        email: 'login@example.com',
        password: 'SecurePass123!'
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('login@example.com');
    });

    it('should_reject_wrong_password', async () => {
      await authService.register({
        email: 'wrong@example.com',
        password: 'SecurePass123!'
      });

      await expect(
        authService.login({
          email: 'wrong@example.com',
          password: 'WrongPassword!'
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should_reject_nonexistent_email', async () => {
      await expect(
        authService.login({
          email: 'ghost@example.com',
          password: 'AnyPass123!'
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should_track_last_login_timestamp', async () => {
      await authService.register({
        email: 'timestamp@example.com',
        password: 'SecurePass123!'
      });

      const beforeLogin = new Date();
      const result = await authService.login({
        email: 'timestamp@example.com',
        password: 'SecurePass123!'
      });

      expect(result.user.lastLoginAt).toBeDefined();
      expect(result.user.lastLoginAt.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });
  });

  describe('verifyToken', () => {
    it('should_return_user_for_valid_token', async () => {
      const { accessToken } = await authService.register({
        email: 'verify@example.com',
        password: 'SecurePass123!'
      });

      const user = await authService.verifyToken(accessToken);

      expect(user.email).toBe('verify@example.com');
    });

    it('should_reject_expired_token', async () => {
      const expiredToken = authService.generateToken({ userId: '123' }, '-1s');

      await expect(
        authService.verifyToken(expiredToken)
      ).rejects.toThrow('Token expired');
    });

    it('should_reject_malformed_token', async () => {
      await expect(
        authService.verifyToken('not.a.valid.token')
      ).rejects.toThrow('Invalid token');
    });
  });

  describe('refreshToken', () => {
    it('should_return_new_access_token', async () => {
      const { refreshToken } = await authService.register({
        email: 'refresh@example.com',
        password: 'SecurePass123!'
      });

      const result = await authService.refreshToken(refreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.accessToken).not.toBe(refreshToken);
    });

    it('should_invalidate_used_refresh_token', async () => {
      const { refreshToken } = await authService.register({
        email: 'invalidate@example.com',
        password: 'SecurePass123!'
      });

      await authService.refreshToken(refreshToken);

      await expect(
        authService.refreshToken(refreshToken)
      ).rejects.toThrow('Refresh token already used');
    });
  });

  describe('logout', () => {
    it('should_invalidate_all_tokens', async () => {
      const { accessToken, refreshToken, user } = await authService.register({
        email: 'logout@example.com',
        password: 'SecurePass123!'
      });

      await authService.logout(user.id);

      await expect(authService.verifyToken(accessToken)).rejects.toThrow();
      await expect(authService.refreshToken(refreshToken)).rejects.toThrow();
    });
  });
});
```

**Implementation**: `src/auth/AuthService.ts`

```typescript
// GREEN: Implement to pass tests
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Database, User } from '../database/Database';

interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private db: Database;
  private jwtSecret: string;
  private invalidatedTokens: Set<string> = new Set();

  constructor(db: Database) {
    this.db = db;
    this.jwtSecret = process.env.JWT_SECRET || 'dev-secret';
  }

  async register(data: { email: string; password: string }): Promise<AuthResult> {
    // Validate email
    if (!this.isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    // Validate password
    if (data.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await this.db.users.create({
      email: data.email,
      passwordHash,
      tier: 'free'
    });

    // Generate tokens
    const accessToken = this.generateToken({ userId: user.id }, '15m');
    const refreshToken = this.generateToken({ userId: user.id, type: 'refresh' }, '7d');

    return { user, accessToken, refreshToken };
  }

  async login(data: { email: string; password: string }): Promise<AuthResult> {
    const user = await this.db.users.findByEmail(data.email);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await this.db.users.update(user.id, { lastLoginAt: new Date() });
    user.lastLoginAt = new Date();

    const accessToken = this.generateToken({ userId: user.id }, '15m');
    const refreshToken = this.generateToken({ userId: user.id, type: 'refresh' }, '7d');

    return { user, accessToken, refreshToken };
  }

  async verifyToken(token: string): Promise<User> {
    if (this.invalidatedTokens.has(token)) {
      throw new Error('Token expired');
    }

    try {
      const payload = jwt.verify(token, this.jwtSecret) as { userId: string };
      const user = await this.db.users.findById(payload.userId);

      if (!user) {
        throw new Error('Invalid token');
      }

      return user;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      throw new Error('Invalid token');
    }
  }

  async refreshToken(token: string): Promise<{ accessToken: string }> {
    if (this.invalidatedTokens.has(token)) {
      throw new Error('Refresh token already used');
    }

    const payload = jwt.verify(token, this.jwtSecret) as { userId: string; type: string };

    if (payload.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    // Invalidate used refresh token
    this.invalidatedTokens.add(token);

    const accessToken = this.generateToken({ userId: payload.userId }, '15m');
    return { accessToken };
  }

  async logout(userId: string): Promise<void> {
    // In production, invalidate all tokens for this user
    // For now, we track in memory (use Redis in production)
    await this.db.sessions.deleteByUserId(userId);
  }

  generateToken(payload: object, expiresIn: string): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
```

### 2.2 User Profile Service (Test-First)

**Test File**: `src/users/UserProfileService.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { UserProfileService } from './UserProfileService';
import { createMockDatabase } from '../../tests/helpers/mock-database';

describe('UserProfileService', () => {
  let service: UserProfileService;
  let userId: string;

  beforeEach(async () => {
    const db = createMockDatabase();
    service = new UserProfileService(db);

    // Create test user
    const user = await db.users.create({
      email: 'profile@example.com',
      passwordHash: 'hash',
      tier: 'free'
    });
    userId = user.id;
  });

  describe('getRiskProfile', () => {
    it('should_return_default_risk_profile_for_new_user', async () => {
      const profile = await service.getRiskProfile(userId);

      expect(profile.maxPositionSize).toBe(0.1);  // 10% default
      expect(profile.maxDrawdown).toBe(0.2);       // 20% default
      expect(profile.stopLossDefault).toBe(0.03);  // 3% default
    });

    it('should_return_custom_risk_profile_if_set', async () => {
      await service.updateRiskProfile(userId, {
        maxPositionSize: 0.25,
        maxDrawdown: 0.15,
        stopLossDefault: 0.05
      });

      const profile = await service.getRiskProfile(userId);

      expect(profile.maxPositionSize).toBe(0.25);
      expect(profile.maxDrawdown).toBe(0.15);
    });
  });

  describe('updateRiskProfile', () => {
    it('should_reject_invalid_position_size', async () => {
      await expect(
        service.updateRiskProfile(userId, { maxPositionSize: 1.5 })
      ).rejects.toThrow('Position size must be between 0 and 1');
    });

    it('should_reject_zero_stop_loss', async () => {
      await expect(
        service.updateRiskProfile(userId, { stopLossDefault: 0 })
      ).rejects.toThrow('Stop loss must be greater than 0');
    });
  });

  describe('getTierLimits', () => {
    it('should_return_free_tier_limits', async () => {
      const limits = await service.getTierLimits(userId);

      expect(limits.maxStrategies).toBe(1);
      expect(limits.maxBacktestsPerDay).toBe(5);
      expect(limits.liveTrading).toBe(false);
    });

    it('should_return_pro_tier_limits', async () => {
      await service.upgradeTier(userId, 'pro');
      const limits = await service.getTierLimits(userId);

      expect(limits.maxStrategies).toBe(5);
      expect(limits.maxBacktestsPerDay).toBe(50);
      expect(limits.liveTrading).toBe(true);
    });

    it('should_return_elite_tier_limits', async () => {
      await service.upgradeTier(userId, 'elite');
      const limits = await service.getTierLimits(userId);

      expect(limits.maxStrategies).toBe(20);
      expect(limits.maxBacktestsPerDay).toBe(-1);  // Unlimited
      expect(limits.priorityExecution).toBe(true);
    });
  });

  describe('connectExchange', () => {
    it('should_store_encrypted_credentials', async () => {
      await service.connectExchange(userId, {
        exchange: 'binance',
        apiKey: 'my_api_key',
        apiSecret: 'my_secret',
        isPaper: true
      });

      const connections = await service.getExchangeConnections(userId);

      expect(connections).toHaveLength(1);
      expect(connections[0].exchange).toBe('binance');
      expect(connections[0].isPaper).toBe(true);
    });

    it('should_validate_credentials_before_saving', async () => {
      await expect(
        service.connectExchange(userId, {
          exchange: 'binance',
          apiKey: 'invalid_key',
          apiSecret: 'invalid_secret',
          isPaper: false  // Live mode validates
        })
      ).rejects.toThrow('Invalid API credentials');
    });

    it('should_limit_connections_by_tier', async () => {
      // Free tier: 1 connection
      await service.connectExchange(userId, {
        exchange: 'binance',
        apiKey: 'key1',
        apiSecret: 'secret1',
        isPaper: true
      });

      await expect(
        service.connectExchange(userId, {
          exchange: 'coinbase',
          apiKey: 'key2',
          apiSecret: 'secret2',
          isPaper: true
        })
      ).rejects.toThrow('Free tier limited to 1 exchange connection');
    });
  });
});
```

---

## ⚙️ Phase 3: Strategy Engine

### 3.1 Strategy Builder (Test-First)

**Test File**: `src/strategies/StrategyBuilder.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { StrategyBuilder, StrategyConfig } from './StrategyBuilder';

describe('StrategyBuilder', () => {
  let builder: StrategyBuilder;

  beforeEach(() => {
    builder = new StrategyBuilder();
  });

  describe('build', () => {
    it('should_create_valid_mean_reversion_strategy', () => {
      const config: StrategyConfig = {
        name: 'My Mean Reversion',
        type: 'mean_reversion',
        symbols: ['BTC/USDT'],
        rules: {
          entry: {
            conditions: [
              { indicator: 'rsi', operator: '<', value: 30 },
              { indicator: 'price', operator: '<', value: 'bb_lower' }
            ],
            logic: 'AND'
          },
          exit: {
            conditions: [
              { indicator: 'rsi', operator: '>', value: 70 },
              { indicator: 'profit_pct', operator: '>', value: 5 }
            ],
            logic: 'OR'
          }
        },
        riskManagement: {
          positionSize: 0.1,
          stopLoss: 0.03,
          takeProfit: 0.06
        }
      };

      const strategy = builder.build(config);

      expect(strategy.isValid()).toBe(true);
      expect(strategy.getName()).toBe('My Mean Reversion');
      expect(strategy.getSymbols()).toContain('BTC/USDT');
    });

    it('should_reject_strategy_without_entry_rules', () => {
      const config: StrategyConfig = {
        name: 'Invalid',
        type: 'custom',
        symbols: ['ETH/USDT'],
        rules: {
          exit: {
            conditions: [{ indicator: 'profit_pct', operator: '>', value: 5 }],
            logic: 'OR'
          }
        },
        riskManagement: { positionSize: 0.1 }
      };

      expect(() => builder.build(config)).toThrow('Strategy must have entry rules');
    });

    it('should_reject_strategy_without_stop_loss', () => {
      const config: StrategyConfig = {
        name: 'No Stop Loss',
        type: 'momentum',
        symbols: ['SOL/USDT'],
        rules: {
          entry: {
            conditions: [{ indicator: 'rsi', operator: '<', value: 30 }],
            logic: 'AND'
          }
        },
        riskManagement: {
          positionSize: 0.1
          // Missing stopLoss
        }
      };

      expect(() => builder.build(config)).toThrow('Strategy must have stop loss defined');
    });

    it('should_validate_indicator_names', () => {
      const config: StrategyConfig = {
        name: 'Invalid Indicator',
        type: 'custom',
        symbols: ['BTC/USDT'],
        rules: {
          entry: {
            conditions: [{ indicator: 'fake_indicator', operator: '<', value: 50 }],
            logic: 'AND'
          }
        },
        riskManagement: { positionSize: 0.1, stopLoss: 0.03 }
      };

      expect(() => builder.build(config)).toThrow('Unknown indicator: fake_indicator');
    });
  });

  describe('serialize/deserialize', () => {
    it('should_serialize_strategy_to_json', () => {
      const strategy = builder.build({
        name: 'Serializable',
        type: 'momentum',
        symbols: ['BTC/USDT'],
        rules: {
          entry: {
            conditions: [{ indicator: 'rsi', operator: '<', value: 30 }],
            logic: 'AND'
          }
        },
        riskManagement: { positionSize: 0.1, stopLoss: 0.03 }
      });

      const json = strategy.serialize();
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('Serializable');
      expect(parsed.rules.entry.conditions).toHaveLength(1);
    });

    it('should_deserialize_strategy_from_json', () => {
      const json = JSON.stringify({
        name: 'Deserialized',
        type: 'mean_reversion',
        symbols: ['ETH/USDT'],
        rules: {
          entry: {
            conditions: [{ indicator: 'bb_position', operator: '<', value: 0 }],
            logic: 'AND'
          }
        },
        riskManagement: { positionSize: 0.15, stopLoss: 0.02 }
      });

      const strategy = builder.deserialize(json);

      expect(strategy.getName()).toBe('Deserialized');
      expect(strategy.isValid()).toBe(true);
    });
  });
});
```

### 3.2 Strategy Executor (Test-First)

**Test File**: `src/strategies/StrategyExecutor.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrategyExecutor } from './StrategyExecutor';
import { Strategy } from './Strategy';
import { MarketDataService } from '../data/MarketDataService';
import { OrderService } from '../execution/OrderService';
import { createMockStrategy, createMockMarketData } from '../../tests/fixtures';

describe('StrategyExecutor', () => {
  let executor: StrategyExecutor;
  let mockStrategy: Strategy;
  let mockMarketData: MarketDataService;
  let mockOrderService: OrderService;

  beforeEach(() => {
    mockStrategy = createMockStrategy();
    mockMarketData = {
      getLatest: vi.fn(),
      getHistorical: vi.fn(),
      subscribe: vi.fn()
    } as any;
    mockOrderService = {
      createOrder: vi.fn(),
      cancelOrder: vi.fn(),
      getOpenOrders: vi.fn()
    } as any;

    executor = new StrategyExecutor(mockMarketData, mockOrderService);
  });

  describe('evaluate', () => {
    it('should_return_buy_signal_when_entry_conditions_met', async () => {
      // Setup market data where RSI < 30 and price < BB lower
      mockMarketData.getLatest = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT',
        price: 42000,
        indicators: {
          rsi: 25,
          bb_lower: 43000,
          bb_upper: 47000
        }
      });

      const signal = await executor.evaluate(mockStrategy, 'BTC/USDT');

      expect(signal.type).toBe('buy');
      expect(signal.confidence).toBeGreaterThan(0.5);
      expect(signal.reasoning).toContain('RSI');
    });

    it('should_return_sell_signal_when_exit_conditions_met', async () => {
      // Setup: has open position with 5% profit
      mockOrderService.getOpenOrders = vi.fn().mockResolvedValue([
        { symbol: 'BTC/USDT', side: 'buy', price: 40000, quantity: 0.1 }
      ]);

      mockMarketData.getLatest = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT',
        price: 42000,  // 5% profit
        indicators: { rsi: 75 }
      });

      const signal = await executor.evaluate(mockStrategy, 'BTC/USDT');

      expect(signal.type).toBe('sell');
      expect(signal.reasoning).toContain('profit');
    });

    it('should_return_hold_signal_when_no_conditions_met', async () => {
      mockMarketData.getLatest = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT',
        price: 45000,
        indicators: { rsi: 50 }  // Neutral
      });

      const signal = await executor.evaluate(mockStrategy, 'BTC/USDT');

      expect(signal.type).toBe('hold');
    });

    it('should_respect_position_limits', async () => {
      // Already at max position
      mockOrderService.getOpenOrders = vi.fn().mockResolvedValue([
        { symbol: 'BTC/USDT', side: 'buy', quantity: 1.0, value: 45000 }
      ]);

      mockMarketData.getLatest = vi.fn().mockResolvedValue({
        symbol: 'BTC/USDT',
        price: 42000,
        indicators: { rsi: 20 }  // Strong buy signal
      });

      const signal = await executor.evaluate(mockStrategy, 'BTC/USDT');

      // Should not buy more even with strong signal
      expect(signal.type).toBe('hold');
      expect(signal.reasoning).toContain('position limit');
    });
  });

  describe('execute', () => {
    it('should_create_order_for_buy_signal', async () => {
      const signal = { type: 'buy', symbol: 'BTC/USDT', quantity: 0.1, confidence: 0.8 };

      await executor.execute(signal, mockStrategy);

      expect(mockOrderService.createOrder).toHaveBeenCalledWith({
        symbol: 'BTC/USDT',
        side: 'buy',
        quantity: 0.1,
        type: 'market'
      });
    });

    it('should_set_stop_loss_after_entry', async () => {
      const signal = { type: 'buy', symbol: 'BTC/USDT', quantity: 0.1, confidence: 0.8 };

      mockOrderService.createOrder = vi.fn().mockResolvedValue({
        id: 'order_123',
        filledPrice: 45000
      });

      await executor.execute(signal, mockStrategy);

      // Should create stop loss order
      expect(mockOrderService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC/USDT',
          side: 'sell',
          type: 'stop_loss',
          stopPrice: 43650  // 3% below entry
        })
      );
    });

    it('should_not_execute_low_confidence_signals', async () => {
      const signal = { type: 'buy', symbol: 'BTC/USDT', quantity: 0.1, confidence: 0.3 };

      await executor.execute(signal, mockStrategy);

      expect(mockOrderService.createOrder).not.toHaveBeenCalled();
    });
  });
});
```

### 3.3 Backtesting Engine (Test-First)

**Test File**: `src/backtesting/BacktestEngine.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BacktestEngine, BacktestConfig, BacktestResult } from './BacktestEngine';
import { Strategy } from '../strategies/Strategy';
import { loadHistoricalData } from '../../tests/fixtures/market-data.fixture';

describe('BacktestEngine', () => {
  let engine: BacktestEngine;
  let testStrategy: Strategy;
  let historicalData: any[];

  beforeEach(async () => {
    engine = new BacktestEngine();
    testStrategy = createTestMeanReversionStrategy();
    historicalData = await loadHistoricalData('BTC/USDT', '2023-01-01', '2023-12-31');
  });

  describe('run', () => {
    it('should_return_complete_backtest_results', async () => {
      const config: BacktestConfig = {
        strategy: testStrategy,
        symbol: 'BTC/USDT',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        initialCapital: 10000,
        fees: 0.001,  // 0.1% per trade
        slippage: 0.0005  // 0.05%
      };

      const result = await engine.run(config, historicalData);

      expect(result.totalReturn).toBeDefined();
      expect(result.sharpeRatio).toBeDefined();
      expect(result.maxDrawdown).toBeDefined();
      expect(result.winRate).toBeDefined();
      expect(result.totalTrades).toBeGreaterThan(0);
      expect(result.trades).toBeInstanceOf(Array);
    });

    it('should_calculate_accurate_pnl_with_fees', async () => {
      const config: BacktestConfig = {
        strategy: testStrategy,
        symbol: 'BTC/USDT',
        startDate: new Date('2023-06-01'),
        endDate: new Date('2023-06-30'),
        initialCapital: 10000,
        fees: 0.001,
        slippage: 0
      };

      const result = await engine.run(config, historicalData);

      // Verify each trade includes fees
      for (const trade of result.trades) {
        if (trade.type === 'buy') {
          expect(trade.feePaid).toBe(trade.value * 0.001);
        }
      }

      // Total fees should match sum of individual fees
      const totalFees = result.trades.reduce((sum, t) => sum + t.feePaid, 0);
      expect(result.totalFeesPaid).toBeCloseTo(totalFees, 2);
    });

    it('should_respect_position_sizing_rules', async () => {
      testStrategy.riskManagement.positionSize = 0.1;  // 10% max

      const config: BacktestConfig = {
        strategy: testStrategy,
        symbol: 'BTC/USDT',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-03-31'),
        initialCapital: 10000,
        fees: 0.001,
        slippage: 0
      };

      const result = await engine.run(config, historicalData);

      // No single trade should exceed 10% of capital at time of trade
      for (const trade of result.trades.filter(t => t.type === 'buy')) {
        expect(trade.value / trade.capitalAtTime).toBeLessThanOrEqual(0.1);
      }
    });

    it('should_trigger_stop_losses', async () => {
      testStrategy.riskManagement.stopLoss = 0.03;  // 3%

      const config: BacktestConfig = {
        strategy: testStrategy,
        symbol: 'BTC/USDT',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        initialCapital: 10000,
        fees: 0.001,
        slippage: 0
      };

      const result = await engine.run(config, historicalData);

      // Find trades that were stopped out
      const stoppedTrades = result.trades.filter(t => t.exitReason === 'stop_loss');

      // All stopped trades should have ~3% loss (accounting for slippage)
      for (const trade of stoppedTrades) {
        expect(trade.pnlPercent).toBeGreaterThanOrEqual(-0.035);
        expect(trade.pnlPercent).toBeLessThanOrEqual(-0.025);
      }
    });

    it('should_calculate_sharpe_ratio_correctly', async () => {
      const config: BacktestConfig = {
        strategy: testStrategy,
        symbol: 'BTC/USDT',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        initialCapital: 10000,
        fees: 0.001,
        slippage: 0
      };

      const result = await engine.run(config, historicalData);

      // Sharpe ratio should be calculated as:
      // (avg_return - risk_free_rate) / std_dev_returns
      // With annualization factor

      // Verify it's a reasonable number
      expect(result.sharpeRatio).toBeGreaterThan(-5);
      expect(result.sharpeRatio).toBeLessThan(10);
    });

    it('should_track_maximum_drawdown', async () => {
      const config: BacktestConfig = {
        strategy: testStrategy,
        symbol: 'BTC/USDT',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        initialCapital: 10000,
        fees: 0.001,
        slippage: 0
      };

      const result = await engine.run(config, historicalData);

      // Max drawdown should be negative (or zero)
      expect(result.maxDrawdown).toBeLessThanOrEqual(0);

      // Should have drawdown periods tracked
      expect(result.drawdownPeriods).toBeDefined();
      expect(result.drawdownPeriods.length).toBeGreaterThanOrEqual(0);
    });

    it('should_handle_no_trades_scenario', async () => {
      // Strategy with impossible conditions
      const impossibleStrategy = createImpossibleStrategy();

      const config: BacktestConfig = {
        strategy: impossibleStrategy,
        symbol: 'BTC/USDT',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31'),
        initialCapital: 10000,
        fees: 0.001,
        slippage: 0
      };

      const result = await engine.run(config, historicalData);

      expect(result.totalTrades).toBe(0);
      expect(result.totalReturn).toBe(0);
      expect(result.sharpeRatio).toBe(0);
    });
  });

  describe('compare', () => {
    it('should_compare_multiple_strategies', async () => {
      const strategies = [
        createTestMeanReversionStrategy(),
        createTestMomentumStrategy(),
        createTestSentimentStrategy()
      ];

      const comparison = await engine.compare({
        strategies,
        symbol: 'BTC/USDT',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        initialCapital: 10000
      }, historicalData);

      expect(comparison.results).toHaveLength(3);
      expect(comparison.bestByReturn).toBeDefined();
      expect(comparison.bestBySharpe).toBeDefined();
      expect(comparison.bestByWinRate).toBeDefined();
    });
  });

  describe('walkForward', () => {
    it('should_perform_walk_forward_optimization', async () => {
      const config: BacktestConfig = {
        strategy: testStrategy,
        symbol: 'BTC/USDT',
        startDate: new Date('2022-01-01'),
        endDate: new Date('2023-12-31'),
        initialCapital: 10000,
        fees: 0.001,
        slippage: 0
      };

      const result = await engine.walkForward(config, historicalData, {
        trainPeriod: 180,  // 6 months training
        testPeriod: 30,    // 1 month testing
        step: 30           // Move forward 1 month each iteration
      });

      expect(result.periods).toBeInstanceOf(Array);
      expect(result.periods.length).toBeGreaterThan(0);

      // Each period should have in-sample and out-of-sample results
      for (const period of result.periods) {
        expect(period.inSample).toBeDefined();
        expect(period.outOfSample).toBeDefined();
      }

      // Out-of-sample performance should be tracked
      expect(result.aggregateOutOfSample).toBeDefined();
    });
  });
});
```

---

## 🔄 Phase 4: Execution Service

### 4.1 Order Management (Test-First)

**Test File**: `src/execution/OrderService.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderService } from './OrderService';
import { ExchangeConnector } from './ExchangeConnector';
import { createMockExchange } from '../../tests/helpers/mock-exchange';

describe('OrderService', () => {
  let orderService: OrderService;
  let mockExchange: ExchangeConnector;

  beforeEach(() => {
    mockExchange = createMockExchange();
    orderService = new OrderService(mockExchange);
  });

  describe('createOrder', () => {
    it('should_create_market_buy_order', async () => {
      mockExchange.createOrder = vi.fn().mockResolvedValue({
        id: 'order_123',
        status: 'filled',
        filledPrice: 45000,
        filledQuantity: 0.1
      });

      const order = await orderService.createOrder({
        userId: 'user_1',
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });

      expect(order.id).toBe('order_123');
      expect(order.status).toBe('filled');
      expect(mockExchange.createOrder).toHaveBeenCalledWith({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });
    });

    it('should_create_limit_order', async () => {
      mockExchange.createOrder = vi.fn().mockResolvedValue({
        id: 'order_456',
        status: 'open',
        price: 44000
      });

      const order = await orderService.createOrder({
        userId: 'user_1',
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 44000
      });

      expect(order.status).toBe('open');
      expect(order.price).toBe(44000);
    });

    it('should_create_stop_loss_order', async () => {
      const order = await orderService.createOrder({
        userId: 'user_1',
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'stop_loss',
        quantity: 0.1,
        stopPrice: 43000
      });

      expect(mockExchange.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stop_loss',
          stopPrice: 43000
        })
      );
    });

    it('should_validate_minimum_order_size', async () => {
      await expect(
        orderService.createOrder({
          userId: 'user_1',
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0.00001  // Too small
        })
      ).rejects.toThrow('Order quantity below minimum');
    });

    it('should_check_available_balance', async () => {
      mockExchange.getBalance = vi.fn().mockResolvedValue({
        USDT: { free: 100, locked: 0 }  // Only $100
      });

      await expect(
        orderService.createOrder({
          userId: 'user_1',
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 1  // Would cost ~$45,000
        })
      ).rejects.toThrow('Insufficient balance');
    });
  });

  describe('cancelOrder', () => {
    it('should_cancel_open_order', async () => {
      mockExchange.cancelOrder = vi.fn().mockResolvedValue({
        id: 'order_123',
        status: 'cancelled'
      });

      const result = await orderService.cancelOrder('user_1', 'order_123');

      expect(result.status).toBe('cancelled');
    });

    it('should_fail_to_cancel_filled_order', async () => {
      mockExchange.getOrder = vi.fn().mockResolvedValue({
        id: 'order_123',
        status: 'filled'
      });

      await expect(
        orderService.cancelOrder('user_1', 'order_123')
      ).rejects.toThrow('Cannot cancel filled order');
    });
  });

  describe('getOpenOrders', () => {
    it('should_return_all_open_orders_for_user', async () => {
      mockExchange.getOpenOrders = vi.fn().mockResolvedValue([
        { id: 'order_1', symbol: 'BTC/USDT', status: 'open' },
        { id: 'order_2', symbol: 'ETH/USDT', status: 'open' }
      ]);

      const orders = await orderService.getOpenOrders('user_1');

      expect(orders).toHaveLength(2);
    });

    it('should_filter_by_symbol', async () => {
      mockExchange.getOpenOrders = vi.fn().mockResolvedValue([
        { id: 'order_1', symbol: 'BTC/USDT', status: 'open' }
      ]);

      const orders = await orderService.getOpenOrders('user_1', 'BTC/USDT');

      expect(orders).toHaveLength(1);
      expect(orders[0].symbol).toBe('BTC/USDT');
    });
  });

  describe('Position Management', () => {
    it('should_track_open_positions', async () => {
      // Simulate buy order filled
      await orderService.createOrder({
        userId: 'user_1',
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.5
      });

      const positions = await orderService.getPositions('user_1');

      expect(positions).toHaveLength(1);
      expect(positions[0].symbol).toBe('BTC/USDT');
      expect(positions[0].quantity).toBe(0.5);
    });

    it('should_close_position_on_sell', async () => {
      // Open position
      await orderService.createOrder({
        userId: 'user_1',
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.5
      });

      // Close position
      await orderService.createOrder({
        userId: 'user_1',
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'market',
        quantity: 0.5
      });

      const positions = await orderService.getPositions('user_1');

      expect(positions).toHaveLength(0);
    });

    it('should_calculate_unrealized_pnl', async () => {
      mockExchange.createOrder = vi.fn().mockResolvedValue({
        id: 'order_123',
        status: 'filled',
        filledPrice: 40000,
        filledQuantity: 0.5
      });

      await orderService.createOrder({
        userId: 'user_1',
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.5
      });

      // Current price is 45000
      mockExchange.getTicker = vi.fn().mockResolvedValue({ last: 45000 });

      const pnl = await orderService.getUnrealizedPnL('user_1');

      // 0.5 BTC * (45000 - 40000) = $2500 profit
      expect(pnl.total).toBe(2500);
      expect(pnl.percentage).toBeCloseTo(12.5);  // 12.5% gain
    });
  });
});
```

### 4.2 Risk Management (Test-First)

**Test File**: `src/execution/RiskManager.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RiskManager } from './RiskManager';
import { OrderService } from './OrderService';
import { PortfolioService } from './PortfolioService';

describe('RiskManager', () => {
  let riskManager: RiskManager;
  let mockOrderService: OrderService;
  let mockPortfolio: PortfolioService;

  beforeEach(() => {
    mockOrderService = {
      getPositions: vi.fn(),
      createOrder: vi.fn(),
      cancelOrder: vi.fn()
    } as any;

    mockPortfolio = {
      getValue: vi.fn(),
      getDrawdown: vi.fn()
    } as any;

    riskManager = new RiskManager(mockOrderService, mockPortfolio);
  });

  describe('validateOrder', () => {
    it('should_reject_order_exceeding_position_limit', async () => {
      const userSettings = {
        maxPositionSize: 0.1,  // 10% max
        maxDrawdown: 0.2
      };

      mockPortfolio.getValue = vi.fn().mockResolvedValue(10000);

      // Trying to buy $2000 worth (20% of portfolio)
      const order = {
        symbol: 'BTC/USDT',
        side: 'buy',
        quantity: 0.05,
        estimatedValue: 2000
      };

      const result = await riskManager.validateOrder('user_1', order, userSettings);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('position limit');
    });

    it('should_allow_order_within_limits', async () => {
      const userSettings = {
        maxPositionSize: 0.2,
        maxDrawdown: 0.2
      };

      mockPortfolio.getValue = vi.fn().mockResolvedValue(10000);
      mockOrderService.getPositions = vi.fn().mockResolvedValue([]);

      const order = {
        symbol: 'BTC/USDT',
        side: 'buy',
        quantity: 0.02,
        estimatedValue: 900  // 9% of portfolio
      };

      const result = await riskManager.validateOrder('user_1', order, userSettings);

      expect(result.allowed).toBe(true);
    });

    it('should_check_total_exposure', async () => {
      const userSettings = {
        maxPositionSize: 0.3,
        maxTotalExposure: 0.5,  // 50% max in market
        maxDrawdown: 0.2
      };

      mockPortfolio.getValue = vi.fn().mockResolvedValue(10000);
      mockOrderService.getPositions = vi.fn().mockResolvedValue([
        { symbol: 'BTC/USDT', value: 3000 },  // 30% already
        { symbol: 'ETH/USDT', value: 1500 }   // 15% already
      ]);

      // New order would bring total to 55%
      const order = {
        symbol: 'SOL/USDT',
        side: 'buy',
        quantity: 50,
        estimatedValue: 1000
      };

      const result = await riskManager.validateOrder('user_1', order, userSettings);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('total exposure');
    });
  });

  describe('checkDrawdown', () => {
    it('should_pause_trading_when_max_drawdown_hit', async () => {
      const userSettings = { maxDrawdown: 0.2 };

      mockPortfolio.getDrawdown = vi.fn().mockResolvedValue({
        current: -0.22,  // 22% drawdown
        peak: 12000,
        current: 9360
      });

      const result = await riskManager.checkDrawdown('user_1', userSettings);

      expect(result.shouldPause).toBe(true);
      expect(result.reason).toContain('drawdown limit');
    });

    it('should_allow_trading_within_drawdown_limit', async () => {
      const userSettings = { maxDrawdown: 0.2 };

      mockPortfolio.getDrawdown = vi.fn().mockResolvedValue({
        current: -0.15,
        peak: 10000,
        value: 8500
      });

      const result = await riskManager.checkDrawdown('user_1', userSettings);

      expect(result.shouldPause).toBe(false);
    });
  });

  describe('emergencyStop', () => {
    it('should_close_all_positions', async () => {
      mockOrderService.getPositions = vi.fn().mockResolvedValue([
        { symbol: 'BTC/USDT', quantity: 0.5, side: 'buy' },
        { symbol: 'ETH/USDT', quantity: 2, side: 'buy' }
      ]);

      await riskManager.emergencyStop('user_1');

      // Should create sell orders for all positions
      expect(mockOrderService.createOrder).toHaveBeenCalledTimes(2);
      expect(mockOrderService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC/USDT',
          side: 'sell',
          quantity: 0.5,
          type: 'market'
        })
      );
    });

    it('should_cancel_all_pending_orders', async () => {
      mockOrderService.getOpenOrders = vi.fn().mockResolvedValue([
        { id: 'order_1', status: 'open' },
        { id: 'order_2', status: 'open' }
      ]);
      mockOrderService.getPositions = vi.fn().mockResolvedValue([]);

      await riskManager.emergencyStop('user_1');

      expect(mockOrderService.cancelOrder).toHaveBeenCalledTimes(2);
    });
  });

  describe('calculatePositionSize', () => {
    it('should_size_position_based_on_risk_per_trade', async () => {
      mockPortfolio.getValue = vi.fn().mockResolvedValue(10000);

      const size = await riskManager.calculatePositionSize('user_1', {
        symbol: 'BTC/USDT',
        entryPrice: 45000,
        stopLoss: 43650,  // 3% stop
        riskPerTrade: 0.01  // Risk 1% of portfolio per trade
      });

      // Risk $100 (1% of $10k)
      // Stop loss = 3% = $1350 per BTC
      // Position size = $100 / $1350 = 0.074 BTC
      expect(size).toBeCloseTo(0.074, 2);
    });

    it('should_cap_position_at_max_size', async () => {
      mockPortfolio.getValue = vi.fn().mockResolvedValue(10000);

      const size = await riskManager.calculatePositionSize('user_1', {
        symbol: 'BTC/USDT',
        entryPrice: 45000,
        stopLoss: 44550,  // 1% stop (tight)
        riskPerTrade: 0.05,  // 5% risk per trade
        maxPositionSize: 0.1  // But max 10% position
      });

      // Without cap: would be ~2.2 BTC ($100k)
      // With 10% cap: max $1000 = 0.022 BTC
      expect(size).toBeLessThanOrEqual(0.022);
    });
  });
});
```

---

## 🧠 Phase 5: AI/ML Integration

### 5.1 AgentDB Pattern Storage (Test-First)

**Test File**: `src/ai/PatternStorage.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PatternStorage } from './PatternStorage';
import { createTestAgentDB } from '../../tests/helpers/test-agentdb';

describe('PatternStorage', () => {
  let storage: PatternStorage;
  let agentDb: any;

  beforeEach(async () => {
    agentDb = await createTestAgentDB();
    storage = new PatternStorage(agentDb);
  });

  afterEach(async () => {
    await agentDb.close();
  });

  describe('storePattern', () => {
    it('should_store_trading_pattern_with_embedding', async () => {
      const pattern = {
        type: 'mean_reversion_entry',
        conditions: {
          rsi: 25,
          bbPosition: -0.8,
          volume: 'above_average'
        },
        outcome: 'success',
        profitPct: 4.2,
        timestamp: Date.now()
      };

      const id = await storage.storePattern('user_1', pattern);

      expect(id).toBeDefined();

      const retrieved = await storage.getPattern(id);
      expect(retrieved.type).toBe('mean_reversion_entry');
      expect(retrieved.outcome).toBe('success');
    });

    it('should_generate_vector_embedding', async () => {
      const pattern = {
        type: 'momentum_entry',
        conditions: { rsi: 65, trend: 'up' },
        outcome: 'success',
        profitPct: 3.1
      };

      await storage.storePattern('user_1', pattern);

      // Verify embedding was stored
      const embedding = await storage.getEmbedding(pattern);
      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding.length).toBe(384);  // MiniLM dimension
    });
  });

  describe('findSimilarPatterns', () => {
    it('should_find_patterns_similar_to_current_market', async () => {
      // Store multiple patterns
      await storage.storePattern('user_1', {
        type: 'mean_reversion_entry',
        conditions: { rsi: 22, bbPosition: -0.9 },
        outcome: 'success',
        profitPct: 5.1
      });

      await storage.storePattern('user_1', {
        type: 'mean_reversion_entry',
        conditions: { rsi: 28, bbPosition: -0.7 },
        outcome: 'success',
        profitPct: 3.2
      });

      await storage.storePattern('user_1', {
        type: 'momentum_entry',
        conditions: { rsi: 70, trend: 'up' },
        outcome: 'failure',
        profitPct: -2.1
      });

      // Search for similar to current oversold conditions
      const currentConditions = { rsi: 25, bbPosition: -0.85 };
      const similar = await storage.findSimilarPatterns(currentConditions, 5);

      expect(similar.length).toBeGreaterThan(0);
      // Mean reversion patterns should rank higher
      expect(similar[0].type).toBe('mean_reversion_entry');
    });

    it('should_return_patterns_with_similarity_scores', async () => {
      await storage.storePattern('user_1', {
        type: 'test',
        conditions: { rsi: 30 },
        outcome: 'success'
      });

      const similar = await storage.findSimilarPatterns({ rsi: 30 }, 5);

      expect(similar[0].similarity).toBeDefined();
      expect(similar[0].similarity).toBeGreaterThan(0);
      expect(similar[0].similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('learnFromOutcome', () => {
    it('should_update_pattern_success_rate', async () => {
      const patternId = await storage.storePattern('user_1', {
        type: 'test',
        conditions: { rsi: 30 },
        outcome: 'pending'
      });

      await storage.learnFromOutcome(patternId, {
        success: true,
        profitPct: 4.5
      });

      const updated = await storage.getPattern(patternId);
      expect(updated.successCount).toBe(1);
      expect(updated.totalUses).toBe(1);
      expect(updated.avgProfit).toBeCloseTo(4.5);
    });

    it('should_update_shared_learning_pool', async () => {
      // Enable sharing
      await storage.enableSharing('user_1');

      const patternId = await storage.storePattern('user_1', {
        type: 'shared_pattern',
        conditions: { rsi: 25, volume: 'high' },
        outcome: 'pending'
      });

      await storage.learnFromOutcome(patternId, {
        success: true,
        profitPct: 6.2
      });

      // Pattern should be in shared pool (anonymized)
      const sharedPatterns = await storage.getSharedPatterns('mean_reversion');
      expect(sharedPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('getPatternStats', () => {
    it('should_return_aggregated_pattern_statistics', async () => {
      // Store multiple patterns with outcomes
      for (let i = 0; i < 10; i++) {
        const id = await storage.storePattern('user_1', {
          type: 'mean_reversion_entry',
          conditions: { rsi: 20 + i },
          outcome: 'pending'
        });

        await storage.learnFromOutcome(id, {
          success: i < 7,  // 70% success
          profitPct: i < 7 ? 3 + Math.random() * 2 : -2 - Math.random()
        });
      }

      const stats = await storage.getPatternStats('user_1', 'mean_reversion_entry');

      expect(stats.totalPatterns).toBe(10);
      expect(stats.successRate).toBeCloseTo(0.7, 1);
      expect(stats.avgProfit).toBeGreaterThan(0);
    });
  });
});
```

### 5.2 SAFLA Learning Integration (Test-First)

**Test File**: `src/ai/SAFLALearner.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SAFLALearner } from './SAFLALearner';
import { PatternStorage } from './PatternStorage';
import { createMockPatternStorage } from '../../tests/helpers/mock-pattern-storage';

describe('SAFLALearner', () => {
  let learner: SAFLALearner;
  let mockStorage: PatternStorage;

  beforeEach(() => {
    mockStorage = createMockPatternStorage();
    learner = new SAFLALearner(mockStorage);
  });

  describe('selectAction', () => {
    it('should_explore_with_epsilon_probability', async () => {
      learner.setExplorationRate(1.0);  // Always explore

      const actions = ['buy', 'sell', 'hold'];
      const selectedActions = new Set<string>();

      // Run multiple times
      for (let i = 0; i < 100; i++) {
        const action = await learner.selectAction('user_1', {
          rsi: 50,
          price: 45000
        }, actions);
        selectedActions.add(action);
      }

      // Should have selected all actions at some point
      expect(selectedActions.size).toBe(3);
    });

    it('should_exploit_best_action_when_not_exploring', async () => {
      learner.setExplorationRate(0);  // Never explore

      // Setup: 'buy' has highest historical success
      mockStorage.findSimilarPatterns = vi.fn().mockResolvedValue([
        { action: 'buy', successRate: 0.8, avgProfit: 4 },
        { action: 'sell', successRate: 0.3, avgProfit: -1 },
        { action: 'hold', successRate: 0.5, avgProfit: 0 }
      ]);

      const action = await learner.selectAction('user_1', {
        rsi: 25,
        bbPosition: -0.8
      }, ['buy', 'sell', 'hold']);

      expect(action).toBe('buy');
    });

    it('should_decay_exploration_rate_over_time', async () => {
      learner.setExplorationRate(0.5);
      learner.setDecayRate(0.99);

      const initialRate = learner.getExplorationRate();

      // Simulate 100 decisions
      for (let i = 0; i < 100; i++) {
        await learner.selectAction('user_1', { rsi: 50 }, ['buy', 'hold']);
      }

      const finalRate = learner.getExplorationRate();

      expect(finalRate).toBeLessThan(initialRate);
      expect(finalRate).toBeCloseTo(initialRate * Math.pow(0.99, 100), 2);
    });
  });

  describe('processFeedback', () => {
    it('should_update_action_values_on_positive_feedback', async () => {
      const feedback = {
        userId: 'user_1',
        action: 'buy',
        state: { rsi: 25, bbPosition: -0.8 },
        reward: 1.0,  // Profitable trade
        outcome: { profitPct: 5.2 }
      };

      await learner.processFeedback(feedback);

      // Verify value was updated
      const value = await learner.getActionValue('user_1', 'buy', feedback.state);
      expect(value).toBeGreaterThan(0);
    });

    it('should_decrease_action_values_on_negative_feedback', async () => {
      // First, establish a positive baseline
      await learner.processFeedback({
        userId: 'user_1',
        action: 'buy',
        state: { rsi: 65 },
        reward: 1.0,
        outcome: { profitPct: 3 }
      });

      const valueBefore = await learner.getActionValue('user_1', 'buy', { rsi: 65 });

      // Now negative feedback
      await learner.processFeedback({
        userId: 'user_1',
        action: 'buy',
        state: { rsi: 65 },
        reward: -1.0,
        outcome: { profitPct: -4 }
      });

      const valueAfter = await learner.getActionValue('user_1', 'buy', { rsi: 65 });

      expect(valueAfter).toBeLessThan(valueBefore);
    });

    it('should_propagate_learning_to_similar_states', async () => {
      // Learn from one state
      await learner.processFeedback({
        userId: 'user_1',
        action: 'buy',
        state: { rsi: 25, bbPosition: -0.8 },
        reward: 1.0,
        outcome: { profitPct: 5 }
      });

      // Similar state should also have updated value
      const valueSimilar = await learner.getActionValue('user_1', 'buy', {
        rsi: 27,
        bbPosition: -0.75  // Similar conditions
      });

      expect(valueSimilar).toBeGreaterThan(0);
    });
  });

  describe('adaptLearningRate', () => {
    it('should_increase_learning_rate_when_inconsistent', async () => {
      const initialRate = learner.getLearningRate();

      // Simulate inconsistent feedback (alternating wins/losses)
      for (let i = 0; i < 20; i++) {
        await learner.processFeedback({
          userId: 'user_1',
          action: 'buy',
          state: { rsi: 30 },
          reward: i % 2 === 0 ? 1 : -1,
          outcome: { profitPct: i % 2 === 0 ? 3 : -3 }
        });
      }

      const finalRate = learner.getLearningRate();

      // Should have increased to learn faster from new data
      expect(finalRate).toBeGreaterThan(initialRate);
    });

    it('should_decrease_learning_rate_when_consistent', async () => {
      learner.setLearningRate(0.2);

      // Simulate consistent positive feedback
      for (let i = 0; i < 20; i++) {
        await learner.processFeedback({
          userId: 'user_1',
          action: 'buy',
          state: { rsi: 25 },
          reward: 1.0,
          outcome: { profitPct: 4 + Math.random() }
        });
      }

      const finalRate = learner.getLearningRate();

      // Should have decreased (converging)
      expect(finalRate).toBeLessThan(0.2);
    });
  });

  describe('getConfidence', () => {
    it('should_return_low_confidence_with_few_samples', async () => {
      const confidence = await learner.getConfidence('user_1', 'buy', {
        rsi: 25
      });

      expect(confidence).toBeLessThan(0.5);
    });

    it('should_return_high_confidence_with_consistent_history', async () => {
      // Build up consistent history
      for (let i = 0; i < 50; i++) {
        await learner.processFeedback({
          userId: 'user_1',
          action: 'buy',
          state: { rsi: 25 + Math.random() * 5 },
          reward: 1.0,
          outcome: { profitPct: 3 + Math.random() * 2 }
        });
      }

      const confidence = await learner.getConfidence('user_1', 'buy', {
        rsi: 27
      });

      expect(confidence).toBeGreaterThan(0.7);
    });
  });
});
```

### 5.3 GOAP Trading Planner (Test-First)

**Test File**: `src/ai/GOAPPlanner.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GOAPPlanner, Goal, Action, WorldState } from './GOAPPlanner';

describe('GOAPPlanner', () => {
  let planner: GOAPPlanner;

  beforeEach(() => {
    planner = new GOAPPlanner();

    // Register trading actions
    planner.registerAction({
      name: 'buy',
      cost: 1,
      preconditions: {
        hasCash: true,
        hasPosition: false,
        signalBullish: true
      },
      effects: {
        hasPosition: true,
        hasCash: false
      }
    });

    planner.registerAction({
      name: 'sell',
      cost: 1,
      preconditions: {
        hasPosition: true
      },
      effects: {
        hasPosition: false,
        hasCash: true,
        profitRealized: true
      }
    });

    planner.registerAction({
      name: 'setStopLoss',
      cost: 0.5,
      preconditions: {
        hasPosition: true,
        hasStopLoss: false
      },
      effects: {
        hasStopLoss: true
      }
    });

    planner.registerAction({
      name: 'wait',
      cost: 0.1,
      preconditions: {},
      effects: {}
    });
  });

  describe('createPlan', () => {
    it('should_create_plan_to_achieve_profit_goal', () => {
      const goal: Goal = {
        name: 'realize_profit',
        conditions: {
          profitRealized: true,
          hasStopLoss: true
        }
      };

      const initialState: WorldState = {
        hasCash: true,
        hasPosition: false,
        signalBullish: true,
        hasStopLoss: false,
        profitRealized: false
      };

      const plan = planner.createPlan(goal, initialState);

      expect(plan).not.toBeNull();
      expect(plan.length).toBeGreaterThan(0);

      // Should include: buy -> setStopLoss -> sell
      const actionNames = plan.map(a => a.name);
      expect(actionNames).toContain('buy');
      expect(actionNames).toContain('setStopLoss');
      expect(actionNames).toContain('sell');
    });

    it('should_return_empty_plan_if_goal_already_met', () => {
      const goal: Goal = {
        name: 'have_cash',
        conditions: { hasCash: true }
      };

      const initialState: WorldState = {
        hasCash: true
      };

      const plan = planner.createPlan(goal, initialState);

      expect(plan).toHaveLength(0);
    });

    it('should_return_null_for_impossible_goal', () => {
      const goal: Goal = {
        name: 'impossible',
        conditions: {
          hasCash: true,
          hasPosition: true  // Can't have both without more cash
        }
      };

      const initialState: WorldState = {
        hasCash: true,
        hasPosition: false
      };

      const plan = planner.createPlan(goal, initialState);

      expect(plan).toBeNull();
    });

    it('should_find_lowest_cost_plan', () => {
      // Register alternative expensive action
      planner.registerAction({
        name: 'buyExpensive',
        cost: 10,  // Much more expensive
        preconditions: { hasCash: true },
        effects: { hasPosition: true, hasCash: false }
      });

      const goal: Goal = {
        name: 'get_position',
        conditions: { hasPosition: true }
      };

      const initialState: WorldState = {
        hasCash: true,
        hasPosition: false,
        signalBullish: true
      };

      const plan = planner.createPlan(goal, initialState);

      // Should prefer cheaper 'buy' over 'buyExpensive'
      expect(plan[0].name).toBe('buy');
    });
  });

  describe('Dynamic Replanning', () => {
    it('should_replan_when_conditions_change', () => {
      const goal: Goal = {
        name: 'protect_position',
        conditions: { hasStopLoss: true }
      };

      // Initially no position
      let state: WorldState = {
        hasCash: true,
        hasPosition: false,
        signalBullish: true,
        hasStopLoss: false
      };

      let plan = planner.createPlan(goal, state);

      // Plan should include buying first
      expect(plan.map(a => a.name)).toContain('buy');

      // After buying, state changes
      state = {
        hasCash: false,
        hasPosition: true,
        hasStopLoss: false
      };

      plan = planner.createPlan(goal, state);

      // Now should just set stop loss
      expect(plan).toHaveLength(1);
      expect(plan[0].name).toBe('setStopLoss');
    });
  });

  describe('Risk-Aware Planning', () => {
    it('should_include_risk_actions_in_plan', () => {
      planner.registerAction({
        name: 'hedge',
        cost: 2,
        preconditions: {
          hasPosition: true,
          riskHigh: true
        },
        effects: {
          isHedged: true,
          riskHigh: false
        }
      });

      const goal: Goal = {
        name: 'safe_profit',
        conditions: {
          profitRealized: true,
          riskHigh: false
        }
      };

      const initialState: WorldState = {
        hasCash: true,
        hasPosition: false,
        signalBullish: true,
        riskHigh: true,
        hasStopLoss: false,
        isHedged: false,
        profitRealized: false
      };

      const plan = planner.createPlan(goal, initialState);

      // Plan should include hedging due to high risk
      expect(plan.map(a => a.name)).toContain('hedge');
    });
  });
});
```

---

## 🔴 Phase 6: Real-Time Systems

### 6.1 WebSocket Handler (Test-First)

**Test File**: `src/realtime/WebSocketHandler.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketHandler } from './WebSocketHandler';
import { WebSocket, WebSocketServer } from 'ws';
import { createTestServer } from '../../tests/helpers/test-server';

describe('WebSocketHandler', () => {
  let handler: WebSocketHandler;
  let server: any;
  let client: WebSocket;

  beforeEach(async () => {
    server = await createTestServer();
    handler = new WebSocketHandler(server.wss);
    await handler.initialize();
  });

  afterEach(async () => {
    if (client) client.close();
    await server.close();
  });

  describe('Connection Management', () => {
    it('should_accept_authenticated_connections', async () => {
      const token = 'valid_jwt_token';

      client = new WebSocket(`ws://localhost:${server.port}?token=${token}`);

      await new Promise<void>((resolve, reject) => {
        client.on('open', resolve);
        client.on('error', reject);
      });

      expect(client.readyState).toBe(WebSocket.OPEN);
    });

    it('should_reject_unauthenticated_connections', async () => {
      client = new WebSocket(`ws://localhost:${server.port}`);

      await new Promise<void>((resolve) => {
        client.on('close', (code) => {
          expect(code).toBe(4001);  // Unauthorized
          resolve();
        });
      });
    });

    it('should_track_connected_users', async () => {
      const token = 'valid_jwt_token';
      client = new WebSocket(`ws://localhost:${server.port}?token=${token}`);

      await new Promise<void>((resolve) => client.on('open', resolve));

      const connections = handler.getConnections('user_1');
      expect(connections).toHaveLength(1);
    });
  });

  describe('Subscriptions', () => {
    it('should_allow_subscribing_to_market_data', async () => {
      client = await connectClient(server.port);

      client.send(JSON.stringify({
        type: 'subscribe',
        channel: 'market',
        symbols: ['BTC/USDT', 'ETH/USDT']
      }));

      const response = await waitForMessage(client);

      expect(response.type).toBe('subscribed');
      expect(response.channel).toBe('market');
      expect(response.symbols).toContain('BTC/USDT');
    });

    it('should_receive_market_updates_after_subscribing', async () => {
      client = await connectClient(server.port);

      // Subscribe
      client.send(JSON.stringify({
        type: 'subscribe',
        channel: 'market',
        symbols: ['BTC/USDT']
      }));

      await waitForMessage(client);  // Subscription confirmation

      // Simulate market update
      handler.broadcastMarketUpdate({
        symbol: 'BTC/USDT',
        price: 45123.45,
        volume: 1234567,
        timestamp: Date.now()
      });

      const update = await waitForMessage(client);

      expect(update.type).toBe('market_update');
      expect(update.data.symbol).toBe('BTC/USDT');
      expect(update.data.price).toBe(45123.45);
    });

    it('should_allow_subscribing_to_portfolio_updates', async () => {
      client = await connectClient(server.port);

      client.send(JSON.stringify({
        type: 'subscribe',
        channel: 'portfolio'
      }));

      // Simulate portfolio update
      handler.sendPortfolioUpdate('user_1', {
        totalValue: 12500,
        pnl: 500,
        positions: [
          { symbol: 'BTC/USDT', quantity: 0.2, pnl: 300 }
        ]
      });

      const updates = await collectMessages(client, 2);

      const portfolioUpdate = updates.find(u => u.type === 'portfolio_update');
      expect(portfolioUpdate).toBeDefined();
      expect(portfolioUpdate.data.totalValue).toBe(12500);
    });
  });

  describe('Trading Commands', () => {
    it('should_accept_start_strategy_command', async () => {
      client = await connectClient(server.port);

      client.send(JSON.stringify({
        type: 'command',
        action: 'start_strategy',
        strategyId: 'strategy_123'
      }));

      const response = await waitForMessage(client);

      expect(response.type).toBe('command_result');
      expect(response.success).toBe(true);
    });

    it('should_accept_stop_strategy_command', async () => {
      client = await connectClient(server.port);

      client.send(JSON.stringify({
        type: 'command',
        action: 'stop_strategy',
        strategyId: 'strategy_123'
      }));

      const response = await waitForMessage(client);

      expect(response.type).toBe('command_result');
      expect(response.success).toBe(true);
    });

    it('should_accept_emergency_stop_command', async () => {
      client = await connectClient(server.port);

      client.send(JSON.stringify({
        type: 'command',
        action: 'emergency_stop'
      }));

      const response = await waitForMessage(client);

      expect(response.type).toBe('command_result');
      expect(response.action).toBe('emergency_stop');
      expect(response.success).toBe(true);
    });
  });

  describe('Heartbeat', () => {
    it('should_respond_to_ping_with_pong', async () => {
      client = await connectClient(server.port);

      client.send(JSON.stringify({ type: 'ping' }));

      const response = await waitForMessage(client);

      expect(response.type).toBe('pong');
      expect(response.timestamp).toBeDefined();
    });

    it('should_disconnect_idle_clients', async () => {
      handler.setIdleTimeout(100);  // 100ms for test

      client = await connectClient(server.port);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(client.readyState).toBe(WebSocket.CLOSED);
    });
  });
});

// Helper functions
async function connectClient(port: number): Promise<WebSocket> {
  const client = new WebSocket(`ws://localhost:${port}?token=valid_jwt`);
  await new Promise<void>((resolve) => client.on('open', resolve));
  return client;
}

async function waitForMessage(client: WebSocket): Promise<any> {
  return new Promise((resolve) => {
    client.once('message', (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });
}

async function collectMessages(client: WebSocket, count: number): Promise<any[]> {
  const messages: any[] = [];
  return new Promise((resolve) => {
    client.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
      if (messages.length >= count) resolve(messages);
    });
  });
}
```

---

## 📊 Phase 7: Platform Features

### 7.1 Strategy Marketplace (Test-First)

**Test File**: `src/marketplace/Marketplace.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Marketplace } from './Marketplace';
import { createTestDatabase } from '../../tests/helpers/test-db';

describe('Marketplace', () => {
  let marketplace: Marketplace;
  let db: any;

  beforeEach(async () => {
    db = await createTestDatabase();
    marketplace = new Marketplace(db);
  });

  describe('publishStrategy', () => {
    it('should_publish_strategy_with_performance_stats', async () => {
      const listing = await marketplace.publishStrategy({
        userId: 'user_1',
        strategyId: 'strategy_123',
        name: 'My Awesome Strategy',
        description: 'Mean reversion on BTC',
        price: 49.99,
        priceModel: 'subscription',
        backtestResults: {
          totalReturn: 147,
          sharpeRatio: 1.8,
          maxDrawdown: -18,
          winRate: 58
        }
      });

      expect(listing.id).toBeDefined();
      expect(listing.status).toBe('pending_review');
    });

    it('should_require_minimum_backtest_period', async () => {
      await expect(
        marketplace.publishStrategy({
          userId: 'user_1',
          strategyId: 'strategy_123',
          name: 'Short Backtest',
          backtestResults: {
            periodDays: 30  // Too short
          }
        })
      ).rejects.toThrow('Minimum 90 days backtest required');
    });

    it('should_reject_negative_sharpe_strategies', async () => {
      await expect(
        marketplace.publishStrategy({
          userId: 'user_1',
          strategyId: 'strategy_123',
          name: 'Bad Strategy',
          backtestResults: {
            sharpeRatio: -0.5,
            periodDays: 365
          }
        })
      ).rejects.toThrow('Strategy must have positive Sharpe ratio');
    });
  });

  describe('copyStrategy', () => {
    it('should_create_copy_for_subscriber', async () => {
      // Publish strategy
      const listing = await marketplace.publishStrategy({
        userId: 'creator_1',
        strategyId: 'original_123',
        name: 'Copyable Strategy',
        price: 29.99
      });

      // Approve listing
      await marketplace.approveListing(listing.id);

      // User copies strategy
      const copy = await marketplace.copyStrategy({
        listingId: listing.id,
        userId: 'subscriber_1'
      });

      expect(copy.id).toBeDefined();
      expect(copy.originalListingId).toBe(listing.id);
      expect(copy.userId).toBe('subscriber_1');
    });

    it('should_track_revenue_for_creator', async () => {
      const listing = await marketplace.publishStrategy({
        userId: 'creator_1',
        strategyId: 'original_123',
        price: 49.99
      });

      await marketplace.approveListing(listing.id);

      // Multiple users copy
      await marketplace.copyStrategy({ listingId: listing.id, userId: 'user_1' });
      await marketplace.copyStrategy({ listingId: listing.id, userId: 'user_2' });
      await marketplace.copyStrategy({ listingId: listing.id, userId: 'user_3' });

      const revenue = await marketplace.getCreatorRevenue('creator_1');

      // Platform takes 30% cut
      expect(revenue.total).toBeCloseTo(49.99 * 3 * 0.7, 2);
      expect(revenue.copiesCount).toBe(3);
    });
  });

  describe('getTopStrategies', () => {
    it('should_return_strategies_sorted_by_performance', async () => {
      // Create multiple strategies with different performance
      await createAndApproveStrategy(marketplace, {
        name: 'Best',
        sharpeRatio: 2.5,
        totalReturn: 200
      });

      await createAndApproveStrategy(marketplace, {
        name: 'Worst',
        sharpeRatio: 0.5,
        totalReturn: 20
      });

      await createAndApproveStrategy(marketplace, {
        name: 'Medium',
        sharpeRatio: 1.5,
        totalReturn: 100
      });

      const top = await marketplace.getTopStrategies({
        sortBy: 'sharpeRatio',
        limit: 10
      });

      expect(top[0].name).toBe('Best');
      expect(top[1].name).toBe('Medium');
      expect(top[2].name).toBe('Worst');
    });

    it('should_filter_by_asset_type', async () => {
      await createAndApproveStrategy(marketplace, {
        name: 'BTC Strategy',
        assets: ['BTC/USDT']
      });

      await createAndApproveStrategy(marketplace, {
        name: 'ETH Strategy',
        assets: ['ETH/USDT']
      });

      const btcStrategies = await marketplace.getTopStrategies({
        assetFilter: 'BTC'
      });

      expect(btcStrategies).toHaveLength(1);
      expect(btcStrategies[0].name).toBe('BTC Strategy');
    });
  });

  describe('ratings', () => {
    it('should_allow_users_to_rate_copied_strategies', async () => {
      const listing = await createAndApproveStrategy(marketplace, {
        name: 'Rateable'
      });

      await marketplace.copyStrategy({
        listingId: listing.id,
        userId: 'user_1'
      });

      await marketplace.rateStrategy({
        listingId: listing.id,
        userId: 'user_1',
        rating: 5,
        review: 'Great strategy!'
      });

      const updated = await marketplace.getListing(listing.id);

      expect(updated.averageRating).toBe(5);
      expect(updated.reviewCount).toBe(1);
    });

    it('should_prevent_rating_without_copying', async () => {
      const listing = await createAndApproveStrategy(marketplace, {
        name: 'Not Copied'
      });

      await expect(
        marketplace.rateStrategy({
          listingId: listing.id,
          userId: 'user_1',
          rating: 5
        })
      ).rejects.toThrow('Must copy strategy before rating');
    });
  });
});

// Helper
async function createAndApproveStrategy(marketplace: Marketplace, data: any) {
  const listing = await marketplace.publishStrategy({
    userId: 'creator_1',
    strategyId: `strategy_${Date.now()}`,
    name: data.name,
    backtestResults: {
      sharpeRatio: data.sharpeRatio || 1.5,
      totalReturn: data.totalReturn || 100,
      periodDays: 365
    },
    assets: data.assets || ['BTC/USDT']
  });

  await marketplace.approveListing(listing.id);
  return marketplace.getListing(listing.id);
}
```

---

## 🔧 Test Infrastructure

### Test Helpers

**File**: `tests/helpers/test-db.ts`

```typescript
import { Pool } from 'pg';
import { Database } from '../../src/database/Database';
import { v4 as uuid } from 'uuid';

export async function createTestDatabase(): Promise<Database> {
  const testDbName = `test_neural_trading_${uuid().replace(/-/g, '_')}`;

  // Create test database
  const adminPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  await adminPool.query(`CREATE DATABASE ${testDbName}`);
  await adminPool.end();

  // Connect to test database
  const db = new Database(
    process.env.DATABASE_URL.replace(/\/[^/]+$/, `/${testDbName}`)
  );

  // Run migrations
  await db.migrate();

  return db;
}

export async function destroyTestDatabase(db: Database): Promise<void> {
  const dbName = db.getDatabaseName();
  await db.close();

  const adminPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  await adminPool.query(`DROP DATABASE IF EXISTS ${dbName}`);
  await adminPool.end();
}
```

**File**: `tests/helpers/mock-exchange.ts`

```typescript
import { vi } from 'vitest';

export function createMockExchange() {
  return {
    createOrder: vi.fn().mockResolvedValue({
      id: `order_${Date.now()}`,
      status: 'filled',
      filledPrice: 45000,
      filledQuantity: 0.1
    }),

    cancelOrder: vi.fn().mockResolvedValue({
      id: 'order_123',
      status: 'cancelled'
    }),

    getOrder: vi.fn().mockResolvedValue({
      id: 'order_123',
      status: 'filled'
    }),

    getOpenOrders: vi.fn().mockResolvedValue([]),

    getBalance: vi.fn().mockResolvedValue({
      USDT: { free: 10000, locked: 0 },
      BTC: { free: 0.5, locked: 0 }
    }),

    getTicker: vi.fn().mockResolvedValue({
      symbol: 'BTC/USDT',
      last: 45000,
      bid: 44990,
      ask: 45010,
      volume: 12345
    }),

    getHistoricalCandles: vi.fn().mockResolvedValue([
      { open: 44000, high: 45500, low: 43800, close: 45000, volume: 1000 },
      { open: 45000, high: 46000, low: 44500, close: 45800, volume: 1200 }
    ])
  };
}
```

**File**: `tests/fixtures/market-data.fixture.ts`

```typescript
export async function loadHistoricalData(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  // Load from fixtures or generate synthetic data
  const data: any[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let price = 40000;  // Starting price

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Simulate random walk
    const change = (Math.random() - 0.5) * 0.03 * price;
    price += change;

    // Calculate indicators
    const rsi = 30 + Math.random() * 40;  // Random RSI between 30-70

    data.push({
      timestamp: d.getTime(),
      symbol,
      open: price * (1 - Math.random() * 0.01),
      high: price * (1 + Math.random() * 0.02),
      low: price * (1 - Math.random() * 0.02),
      close: price,
      volume: Math.floor(1000 + Math.random() * 9000),
      indicators: {
        rsi,
        sma20: price * (1 + (Math.random() - 0.5) * 0.02),
        bb_upper: price * 1.02,
        bb_lower: price * 0.98
      }
    });
  }

  return data;
}

export function createMockStrategy() {
  return {
    getName: () => 'Mock Strategy',
    getType: () => 'mean_reversion',
    getSymbols: () => ['BTC/USDT'],
    isValid: () => true,
    riskManagement: {
      positionSize: 0.1,
      stopLoss: 0.03,
      takeProfit: 0.06
    },
    rules: {
      entry: {
        conditions: [
          { indicator: 'rsi', operator: '<', value: 30 }
        ],
        logic: 'AND'
      },
      exit: {
        conditions: [
          { indicator: 'rsi', operator: '>', value: 70 }
        ],
        logic: 'OR'
      }
    }
  };
}
```

---

## 🔄 Continuous Integration

**File**: `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: neural_trading_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/neural_trading_test

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/neural_trading_test
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 📋 Implementation Order

### Sprint 1: Foundation (Weeks 1-2)
```
1. ✅ Write database schema tests
2. ⏳ Implement database schema
3. ✅ Write auth service tests
4. ⏳ Implement auth service
5. ✅ Write user profile tests
6. ⏳ Implement user profile service
```

### Sprint 2: Strategy Engine (Weeks 3-4)
```
1. ✅ Write strategy builder tests
2. ⏳ Implement strategy builder
3. ✅ Write strategy executor tests
4. ⏳ Implement strategy executor
5. ✅ Write backtesting tests
6. ⏳ Implement backtesting engine
```

### Sprint 3: Execution (Weeks 5-6)
```
1. ✅ Write order service tests
2. ⏳ Implement order service
3. ✅ Write risk manager tests
4. ⏳ Implement risk manager
5. ✅ Write exchange connector tests
6. ⏳ Implement exchange connectors
```

### Sprint 4: AI/ML (Weeks 7-8)
```
1. ✅ Write pattern storage tests
2. ⏳ Implement AgentDB integration
3. ✅ Write SAFLA learner tests
4. ⏳ Implement SAFLA learning
5. ✅ Write GOAP planner tests
6. ⏳ Implement GOAP planning
```

### Sprint 5: Real-Time (Weeks 9-10)
```
1. ✅ Write WebSocket tests
2. ⏳ Implement WebSocket handler
3. ✅ Write market data tests
4. ⏳ Implement market data service
5. ⏳ Implement real-time dashboard
```

### Sprint 6: Platform (Weeks 11-12)
```
1. ✅ Write marketplace tests
2. ⏳ Implement marketplace
3. ⏳ Implement billing integration
4. ⏳ Implement admin dashboard
5. ⏳ Deploy to production
```

---

## 📊 Success Metrics

| Metric | Target |
|--------|--------|
| Unit Test Coverage | > 80% |
| Integration Test Coverage | > 70% |
| E2E Test Coverage | > 50% |
| Test Execution Time (Unit) | < 30 seconds |
| Test Execution Time (Integration) | < 5 minutes |
| Test Execution Time (E2E) | < 15 minutes |
| Build Success Rate | > 95% |
| Code Quality Score | A rating |

---

**Version**: 1.0.0
**Created**: 2024-12-12
**Methodology**: Test-Driven Development (TDD)
**Testing Framework**: Vitest + Playwright
