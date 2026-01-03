# Tradezzz Platform - Master TDD Implementation Plan

## Executive Summary

This plan consolidates **ALL 104+ identified issues** into a structured, phased remediation approach using Test-Driven Development. Each phase has clear deliverables, test requirements, and acceptance criteria.

**Total Phases:** 12
**Total New Tests:** ~350+
**Existing Tests:** 855 passing, 2 failing, 36 skipped

---

## Phase Overview

| Phase | Category | Issues | Priority | Tests |
|-------|----------|--------|----------|-------|
| 1 | Security & Auth Critical | 8 | IMMEDIATE | 35 |
| 2 | Database Foundation | 14 | IMMEDIATE | 40 |
| 3 | Type System Alignment | 6 | HIGH | 25 |
| 4 | API Layer Standardization | 15 | HIGH | 45 |
| 5 | Exchange Integration (Coinbase) | 7 | HIGH | 30 |
| 6 | AI Provider Integration | 15 | MEDIUM | 35 |
| 7 | Trading & Order Execution | 14 | MEDIUM | 40 |
| 8 | Frontend Components | 20 | MEDIUM | 35 |
| 9 | Configuration & Environment | 12 | MEDIUM | 20 |
| 10 | Error Handling & Resilience | 10 | LOW | 25 |
| 11 | Performance & Optimization | 8 | LOW | 15 |
| 12 | Test Infrastructure & E2E | 5 | LOW | 20 |

---

# Phase 1: Security & Authentication Critical Fixes

## Priority: IMMEDIATE
## Estimated Tests: 35
## Dependencies: None

### Issues Addressed

| ID | Issue | Severity |
|----|-------|----------|
| 1.1 | Dev auth bypass allows unauthenticated access | CRITICAL |
| 1.2 | Missing auth token forwarding in proxy routes | CRITICAL |
| 1.3 | Express server has no Clerk integration | CRITICAL |
| 7.1 | Hardcoded default encryption keys | CRITICAL |
| 7.2 | Test credentials exposed in version control | CRITICAL |
| 7.3 | Dev auth bypass in production code path | CRITICAL |
| 1.7 | Encryption key hardcoded in .env files | HIGH |
| 1.8 | Missing ownership verification in PUT endpoints | HIGH |

### 1.1 Tests First (Red Phase)

**File:** `src/api/middleware/clerk.middleware.test.ts`

```typescript
describe('ClerkMiddleware Security', () => {
  describe('Authentication Enforcement', () => {
    it('should reject requests without Authorization header in production', async () => {
      process.env.NODE_ENV = 'production';
      const req = mockRequest({ headers: {} });
      const res = mockResponse();
      const next = jest.fn();

      await clerkMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid JWT token', async () => {
      const req = mockRequest({
        headers: { authorization: 'Bearer invalid-token' }
      });
      const res = mockResponse();
      const next = jest.fn();

      await clerkMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid') })
      );
    });

    it('should attach user to request with valid Clerk token', async () => {
      const req = mockRequest({
        headers: { authorization: `Bearer ${validClerkToken}` }
      });
      const res = mockResponse();
      const next = jest.fn();

      await clerkMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.auth).toBeDefined();
      expect(req.auth.userId).toBeTruthy();
    });

    it('should NOT have dev bypass code in production build', () => {
      const middlewareCode = fs.readFileSync(
        'src/api/middleware/clerk.middleware.ts',
        'utf8'
      );
      expect(middlewareCode).not.toContain('dev-user');
      expect(middlewareCode).not.toContain('dev-session');
      expect(middlewareCode).not.toContain('dev_clerk_id');
    });
  });
});
```

**File:** `app/app/api/__tests__/proxy-auth.test.ts`

```typescript
describe('Proxy Route Authentication Forwarding', () => {
  const proxyRoutes = [
    '/api/patterns/risk/graph',
    '/api/ai/auto/chat',
    '/api/ai/status',
    '/api/swarm/agents/summary',
    '/api/patterns/strategies/recommend',
  ];

  proxyRoutes.forEach((route) => {
    it(`${route} should forward Authorization header to backend`, async () => {
      const mockFetch = jest.spyOn(global, 'fetch');
      const authToken = 'Bearer test-clerk-token';

      await fetch(route, {
        headers: { Authorization: authToken }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: authToken
          })
        })
      );
    });
  });

  it('should reject proxy requests without authentication', async () => {
    const res = await fetch('/api/patterns/risk/graph');
    expect(res.status).toBe(401);
  });
});
```

**File:** `src/config/__tests__/encryption.test.ts`

```typescript
describe('Encryption Key Security', () => {
  it('should reject default/weak encryption keys in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_KEY = 'default-dev-encryption-key-32!!';

    expect(() => validateEncryptionKey()).toThrow(/weak|default|insecure/i);
  });

  it('should require encryption key minimum 32 bytes', () => {
    process.env.ENCRYPTION_KEY = 'short-key';

    expect(() => validateEncryptionKey()).toThrow(/32.*bytes|length/i);
  });

  it('should accept strong encryption key', () => {
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');

    expect(() => validateEncryptionKey()).not.toThrow();
  });

  it('should NOT have hardcoded keys in source files', () => {
    const sourceFiles = glob.sync('src/**/*.ts');
    const patterns = [
      /neural-trading-encryption/,
      /default-dev-secret/,
      /default-key-32-bytes/,
    ];

    sourceFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');
      patterns.forEach((pattern) => {
        expect(content).not.toMatch(pattern);
      });
    });
  });
});
```

**File:** `tests/security/ownership.test.ts`

```typescript
describe('Resource Ownership Verification', () => {
  const endpoints = [
    { method: 'PUT', path: '/api/exchanges', idField: 'id' },
    { method: 'PUT', path: '/api/ai-providers', idField: 'id' },
    { method: 'DELETE', path: '/api/strategies', idField: 'id' },
  ];

  endpoints.forEach(({ method, path, idField }) => {
    it(`${method} ${path} should reject access to other user's resources`, async () => {
      // Create resource as user A
      const userAToken = await getTokenForUser('user-a@test.com');
      const resource = await createResource(path, userAToken);

      // Try to modify as user B
      const userBToken = await getTokenForUser('user-b@test.com');
      const res = await fetch(`${path}?${idField}=${resource.id}`, {
        method,
        headers: { Authorization: `Bearer ${userBToken}` },
        body: JSON.stringify({ action: 'test' }),
      });

      expect(res.status).toBe(403);
    });
  });
});
```

### 1.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 1.2.1 | `src/api/middleware/clerk.middleware.ts` | Remove lines 36-78 (dev bypass) |
| 1.2.2 | `src/api/middleware/clerk.middleware.ts` | Add production check that throws on missing auth |
| 1.2.3 | `app/app/api/patterns/risk/graph/route.ts` | Add auth header forwarding |
| 1.2.4 | `app/app/api/ai/auto/chat/route.ts` | Add auth header forwarding |
| 1.2.5 | `app/app/api/ai/status/route.ts` | Add auth header forwarding |
| 1.2.6 | `app/app/api/swarm/agents/summary/route.ts` | Add auth header forwarding |
| 1.2.7 | All proxy routes | Create shared `forwardAuth()` utility |
| 1.2.8 | `src/config/ConfigService.ts` | Remove hardcoded fallback keys (lines 393, 396) |
| 1.2.9 | `src/api/server.ts` | Remove hardcoded fallback keys (lines 31-32) |
| 1.2.10 | `src/database/Database.ts` | Remove hardcoded fallback key (line 29) |
| 1.2.11 | `.env`, `app/.env.local` | Remove from git, add to .gitignore |
| 1.2.12 | `.env.example` | Create template with placeholder values |
| 1.2.13 | `app/app/api/ai-providers/route.ts` | Add `getAuthenticatedUser()` to PUT |
| 1.2.14 | `app/app/api/exchanges/route.ts` | Add ownership check to PUT |

### 1.3 Deliverables

- [ ] **35 security tests passing**
- [ ] Dev auth bypass completely removed
- [ ] All proxy routes forward Authorization header
- [ ] No hardcoded encryption keys in source
- [ ] Sensitive .env files removed from git history
- [ ] All PUT/DELETE endpoints verify resource ownership
- [ ] Production startup fails without proper ENCRYPTION_KEY

### 1.4 Acceptance Criteria

```bash
# All security tests pass
npm test -- --grep "Security|Authentication|Ownership"

# No hardcoded secrets in source
grep -r "default-dev\|neural-trading-encryption" src/ && exit 1 || echo "Clean"

# .env files not tracked
git ls-files | grep -E "^\.env$|\.env\.local$" && exit 1 || echo "Clean"
```

---

# Phase 2: Database Foundation

## Priority: IMMEDIATE
## Estimated Tests: 40
## Dependencies: Phase 1

### Issues Addressed

| ID | Issue | Severity |
|----|-------|----------|
| 2.1 | Type definition mismatch (snake_case vs camelCase) | CRITICAL |
| 2.2 | Missing DELETE method for orders repository | CRITICAL |
| 2.3 | Missing updated_at triggers for backtests/trades | HIGH |
| 2.4 | DATABASE_URL not in .env.example | HIGH |
| 2.5 | Missing trigger for order_approvals.updated_at | HIGH |
| 2.6 | Password not URL encoded in connection string | HIGH |
| 2.7 | No transactions for related inserts | MEDIUM |
| 2.8 | Missing index on order_id in order_approvals | MEDIUM |
| 2.9 | Excessive connection pooling in serverless | MEDIUM |
| 2.10 | Hardcoded 'clerk-managed' password hash | MEDIUM |
| 2.11 | SSL certificate validation disabled | HIGH |
| 6.1 | entryPrice not updateable in positions | CRITICAL |
| 6.5 | entry_price not in position update fields | HIGH |

### 2.1 Tests First (Red Phase)

**File:** `src/database/__tests__/type-consistency.test.ts`

```typescript
describe('Database Type Consistency', () => {
  it('should return user with snake_case properties from database', async () => {
    const user = await db.users.findById('test-user-id');

    // Database columns are snake_case
    expect(user).toHaveProperty('clerk_id');
    expect(user).toHaveProperty('is_active');
    expect(user).toHaveProperty('created_at');
    expect(user).toHaveProperty('updated_at');

    // Should NOT have camelCase (that's TypeScript interface responsibility)
    expect(user).not.toHaveProperty('clerkId');
    expect(user).not.toHaveProperty('isActive');
  });

  it('should have consistent type definitions across all repositories', () => {
    // Get all exported types
    const dbTypes = require('../types');
    const neonTypes = require('../NeonDatabase');
    const appTypes = require('../../app/lib/db');

    // User type
    expect(dbTypes.User).toMatchObject(neonTypes.User);
    expect(appTypes.User).toMatchObject(neonTypes.User);
  });
});
```

**File:** `src/database/__tests__/orders-repository.test.ts`

```typescript
describe('Orders Repository', () => {
  describe('delete()', () => {
    it('should delete order by ID', async () => {
      const order = await db.orders.create({
        userId: 'test-user',
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });

      await db.orders.delete(order.id);

      const deleted = await db.orders.findById(order.id);
      expect(deleted).toBeNull();
    });

    it('should not throw when deleting non-existent order', async () => {
      await expect(db.orders.delete('non-existent-id')).resolves.not.toThrow();
    });
  });
});
```

**File:** `src/database/__tests__/positions-repository.test.ts`

```typescript
describe('Positions Repository', () => {
  describe('update()', () => {
    it('should update entry_price field', async () => {
      const position = await db.positions.create({
        userId: 'test-user',
        symbol: 'BTC/USD',
        side: 'long',
        quantity: 1.0,
        entryPrice: 50000,
      });

      const updated = await db.positions.update(position.id, {
        entryPrice: 51000,
      });

      expect(updated.entry_price).toBe(51000);
    });

    it('should update quantity field', async () => {
      const position = await db.positions.create({...});

      const updated = await db.positions.update(position.id, {
        quantity: 2.0,
      });

      expect(updated.quantity).toBe(2.0);
    });

    it('should calculate new entry price when averaging position', async () => {
      // Existing: 1 BTC @ $50,000
      // Adding: 1 BTC @ $52,000
      // New avg: 2 BTC @ $51,000
      const position = await db.positions.create({
        userId: 'test-user',
        symbol: 'BTC/USD',
        side: 'long',
        quantity: 1.0,
        entryPrice: 50000,
      });

      const newEntry = (50000 * 1 + 52000 * 1) / 2;
      const updated = await db.positions.update(position.id, {
        entryPrice: newEntry,
        quantity: 2.0,
      });

      expect(updated.entry_price).toBe(51000);
      expect(updated.quantity).toBe(2.0);
    });
  });
});
```

**File:** `src/database/__tests__/triggers.test.ts`

```typescript
describe('Database Triggers', () => {
  const tablesWithUpdatedAt = [
    'users', 'user_settings', 'strategies', 'exchange_connections',
    'ai_providers', 'orders', 'positions', 'backtests', 'trades', 'order_approvals'
  ];

  tablesWithUpdatedAt.forEach((table) => {
    it(`${table} should auto-update updated_at on modification`, async () => {
      const record = await createRecord(table);
      const originalUpdatedAt = record.updated_at;

      await sleep(100); // Ensure time difference

      await updateRecord(table, record.id, { name: 'Modified' });
      const updated = await findRecord(table, record.id);

      expect(new Date(updated.updated_at).getTime())
        .toBeGreaterThan(new Date(originalUpdatedAt).getTime());
    });
  });
});
```

**File:** `src/database/__tests__/transactions.test.ts`

```typescript
describe('Database Transactions', () => {
  it('should rollback order and trade on failure', async () => {
    const orderCountBefore = await db.orders.count();
    const tradeCountBefore = await db.trades.count();

    await expect(
      db.transaction(async (tx) => {
        await tx.orders.create({...});
        // Force failure
        throw new Error('Simulated failure');
      })
    ).rejects.toThrow();

    const orderCountAfter = await db.orders.count();
    const tradeCountAfter = await db.trades.count();

    expect(orderCountAfter).toBe(orderCountBefore);
    expect(tradeCountAfter).toBe(tradeCountBefore);
  });

  it('should commit order and trade together', async () => {
    const result = await db.transaction(async (tx) => {
      const order = await tx.orders.create({...});
      const trade = await tx.trades.create({ orderId: order.id, ...});
      return { order, trade };
    });

    expect(result.order.id).toBeTruthy();
    expect(result.trade.order_id).toBe(result.order.id);
  });
});
```

### 2.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 2.2.1 | `src/database/types.ts` | Standardize ALL types to snake_case (match DB) |
| 2.2.2 | `app/lib/db.ts` | Update types to match src/database/types.ts |
| 2.2.3 | `app/lib/db.ts` | Add `orders.delete()` method |
| 2.2.4 | `src/database/NeonDatabase.ts` | Add `positions.update()` support for entry_price, quantity |
| 2.2.5 | `src/database/migrations/006_add_missing_triggers.sql` | Create migration for missing triggers |
| 2.2.6 | `src/database/migrations/007_add_missing_indexes.sql` | Add index on order_approvals.order_id |
| 2.2.7 | `src/config/database.config.ts` | Add URL encoding for password |
| 2.2.8 | `src/database/NeonDatabase.ts` | Enable SSL certificate validation |
| 2.2.9 | `app/lib/db.ts` | Enable SSL certificate validation |
| 2.2.10 | `app/lib/db.ts` | Reduce pool size for serverless (max: 2) |
| 2.2.11 | `src/database/NeonDatabase.ts` | Add transaction support |
| 2.2.12 | `.env.example` | Add all DATABASE_* variables |

### 2.3 Migration File

**File:** `src/database/migrations/006_add_missing_triggers.sql`

```sql
-- Add missing updated_at triggers
CREATE TRIGGER update_backtests_updated_at
  BEFORE UPDATE ON backtests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_approvals_updated_at
  BEFORE UPDATE ON order_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add missing index
CREATE INDEX IF NOT EXISTS idx_order_approvals_order_id
  ON order_approvals(order_id);
```

### 2.4 Deliverables

- [ ] **40 database tests passing**
- [ ] All type definitions use consistent snake_case
- [ ] `orders.delete()` method implemented
- [ ] `positions.update()` supports entry_price and quantity
- [ ] All tables have updated_at triggers
- [ ] Transaction support for related operations
- [ ] SSL validation enabled
- [ ] Connection pooling optimized for serverless

### 2.5 Acceptance Criteria

```bash
# All database tests pass
npm test -- --grep "Database|Repository|Trigger|Transaction"

# Migrations run successfully
npm run migrate

# Type consistency check
npx tsc --noEmit
```

---

# Phase 3: Type System Alignment

## Priority: HIGH
## Estimated Tests: 25
## Dependencies: Phase 2

### Issues Addressed

| ID | Issue | Severity |
|----|-------|----------|
| 2.1 | Type mismatch snake_case vs camelCase | CRITICAL |
| 4.2 | Exchange connection is_active vs status | CRITICAL |
| 4.20 | camelCase vs snake_case inconsistency | MEDIUM |
| 3.8 | Database column case mismatch | MEDIUM |
| 3.10 | Property name mismatch in responses | MEDIUM |

### 3.1 Tests First (Red Phase)

**File:** `tests/types/api-response-consistency.test.ts`

```typescript
describe('API Response Type Consistency', () => {
  describe('Exchange Connections', () => {
    it('GET /api/exchanges should return is_active boolean', async () => {
      const res = await authenticatedFetch('/api/exchanges');
      const data = await res.json();

      data.connections.forEach((conn: any) => {
        expect(typeof conn.is_active).toBe('boolean');
        expect(conn).toHaveProperty('created_at');
        expect(conn).toHaveProperty('last_used_at');
      });
    });

    it('frontend ExchangeConnection interface should match API response', () => {
      // This is a compile-time check
      type APIResponse = {
        id: string;
        exchange: string;
        name: string;
        status: string;
        is_active: boolean;
        created_at: string;
        last_used_at: string | null;
      };

      type FrontendType = ExchangeConnection;

      // These should be assignable to each other
      const apiToFrontend: FrontendType = {} as APIResponse;
      const frontendToApi: APIResponse = {} as FrontendType;
    });
  });

  describe('AI Providers', () => {
    it('GET /api/ai-providers should return consistent property names', async () => {
      const res = await authenticatedFetch('/api/ai-providers');
      const data = await res.json();

      data.providers.forEach((provider: any) => {
        expect(provider).toHaveProperty('total_tokens_used');
        expect(provider).toHaveProperty('total_requests');
        expect(provider).toHaveProperty('default_model');
        expect(provider).toHaveProperty('created_at');
      });
    });
  });

  describe('Orders', () => {
    it('GET /api/orders should return consistent property names', async () => {
      const res = await authenticatedFetch('/api/orders');
      const data = await res.json();

      data.orders.forEach((order: any) => {
        expect(order).toHaveProperty('user_id');
        expect(order).toHaveProperty('strategy_id');
        expect(order).toHaveProperty('exchange_connection_id');
        expect(order).toHaveProperty('filled_price');
        expect(order).toHaveProperty('filled_quantity');
        expect(order).toHaveProperty('created_at');
      });
    });
  });
});
```

**File:** `tests/types/shared-types.test.ts`

```typescript
describe('Shared Type Definitions', () => {
  it('should have single source of truth for all entity types', () => {
    // Import from shared types
    const { User, Strategy, Order, ExchangeConnection, AIProvider } = require('@/types/entities');

    // All modules should re-export from shared
    const dbTypes = require('app/lib/db');
    const apiTypes = require('src/database/types');

    expect(dbTypes.User).toBe(User);
    expect(apiTypes.User).toBe(User);
  });
});
```

### 3.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 3.2.1 | `types/entities.ts` | Create single source of truth for all entity types |
| 3.2.2 | `app/lib/db.ts` | Import and re-export from shared types |
| 3.2.3 | `src/database/types.ts` | Import and re-export from shared types |
| 3.2.4 | `app/app/api/exchanges/route.ts` | Return `is_active` derived from status |
| 3.2.5 | `app/app/dashboard/exchanges/page.tsx` | Update interface to match API |
| 3.2.6 | `app/app/api/ai-providers/route.ts` | Standardize property names |
| 3.2.7 | `app/app/api/orders/route.ts` | Standardize property names |
| 3.2.8 | `app/app/api/strategies/route.ts` | Standardize property names |

### 3.3 Shared Types File

**File:** `types/entities.ts`

```typescript
/**
 * Single source of truth for all entity types.
 * All properties use snake_case to match database columns.
 */

export interface User {
  id: string;
  clerk_id?: string;
  email: string;
  tier: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ExchangeConnection {
  id: string;
  user_id: string;
  exchange: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  is_active: boolean; // Derived: status === 'active'
  encrypted_api_key?: string;
  encrypted_api_secret?: string;
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

export interface Order {
  id: string;
  user_id: string;
  strategy_id?: string;
  exchange_connection_id?: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop_loss' | 'take_profit';
  quantity: number;
  price?: number;
  stop_price?: number;
  status: 'pending' | 'open' | 'filled' | 'cancelled' | 'rejected';
  mode: 'paper' | 'live';
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
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entry_price: number;
  current_price?: number;
  unrealized_pnl?: number;
  realized_pnl?: number;
  closed_at?: Date;
  created_at: Date;
  updated_at: Date;
}
```

### 3.4 Deliverables

- [ ] **25 type consistency tests passing**
- [ ] Single `types/entities.ts` file as source of truth
- [ ] All DB repositories use shared types
- [ ] All API routes return consistent property names
- [ ] All frontend interfaces match API response shapes
- [ ] TypeScript compilation passes with strict mode

### 3.5 Acceptance Criteria

```bash
# Type tests pass
npm test -- --grep "Type|Consistency"

# TypeScript strict compilation
npx tsc --noEmit --strict

# No type errors
npm run typecheck
```

---

# Phase 4: API Layer Standardization

## Priority: HIGH
## Estimated Tests: 45
## Dependencies: Phase 3

### Issues Addressed

| ID | Issue | Severity |
|----|-------|----------|
| 3.1 | Response format inconsistency (Express vs Next.js) | CRITICAL |
| 3.2 | Missing routes that frontend expects | CRITICAL |
| 3.3 | CORS headers incomplete | HIGH |
| 3.4 | Auth forwarding missing in proxy | HIGH |
| 3.5 | HTTP method mismatch | HIGH |
| 3.6 | Validation inconsistency | HIGH |
| 3.7 | Proxy routes depend on backend running | HIGH |
| 3.9 | No timeout handling for proxy requests | MEDIUM |
| 3.11 | Missing error context in catch blocks | MEDIUM |
| 3.12 | Request validation incomplete | MEDIUM |

### 4.1 Tests First (Red Phase)

**File:** `tests/api/response-format.test.ts`

```typescript
describe('API Response Format', () => {
  const endpoints = [
    { method: 'GET', path: '/api/strategies' },
    { method: 'GET', path: '/api/orders' },
    { method: 'GET', path: '/api/exchanges' },
    { method: 'GET', path: '/api/ai-providers' },
    { method: 'GET', path: '/api/user' },
  ];

  endpoints.forEach(({ method, path }) => {
    it(`${method} ${path} should return standard response format`, async () => {
      const res = await authenticatedFetch(path, { method });
      const data = await res.json();

      // All responses should have success flag
      expect(data).toHaveProperty('success');
      expect(typeof data.success).toBe('boolean');

      if (data.success) {
        expect(data).toHaveProperty('data');
      } else {
        expect(data).toHaveProperty('error');
        expect(typeof data.error).toBe('string');
      }
    });
  });

  it('error responses should include error code', async () => {
    const res = await fetch('/api/strategies', {
      method: 'POST',
      body: JSON.stringify({}), // Invalid - missing required fields
    });
    const data = await res.json();

    expect(data.success).toBe(false);
    expect(data.error).toBeTruthy();
    expect(data.code).toBeTruthy(); // e.g., 'VALIDATION_ERROR'
  });
});
```

**File:** `tests/api/individual-resources.test.ts`

```typescript
describe('Individual Resource Endpoints', () => {
  describe('Strategies', () => {
    it('GET /api/strategies/:id should return single strategy', async () => {
      const strategy = await createStrategy();
      const res = await authenticatedFetch(`/api/strategies/${strategy.id}`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(strategy.id);
    });

    it('PUT /api/strategies/:id should update strategy', async () => {
      const strategy = await createStrategy();
      const res = await authenticatedFetch(`/api/strategies/${strategy.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.name).toBe('Updated Name');
    });

    it('DELETE /api/strategies/:id should delete strategy', async () => {
      const strategy = await createStrategy();
      const res = await authenticatedFetch(`/api/strategies/${strategy.id}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);

      const getRes = await authenticatedFetch(`/api/strategies/${strategy.id}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('Orders', () => {
    it('GET /api/orders/:id should return single order', async () => {
      const order = await createOrder();
      const res = await authenticatedFetch(`/api/orders/${order.id}`);

      expect(res.status).toBe(200);
    });

    it('POST /api/orders/:id/cancel should cancel order', async () => {
      const order = await createOrder({ status: 'open' });
      const res = await authenticatedFetch(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('cancelled');
    });
  });

  describe('Exchanges', () => {
    it('GET /api/exchanges/:id should return single connection', async () => {
      const conn = await createExchangeConnection();
      const res = await authenticatedFetch(`/api/exchanges/${conn.id}`);

      expect(res.status).toBe(200);
    });

    it('DELETE /api/exchanges/:id should delete connection', async () => {
      const conn = await createExchangeConnection();
      const res = await authenticatedFetch(`/api/exchanges/${conn.id}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
    });
  });
});
```

**File:** `tests/api/cors.test.ts`

```typescript
describe('CORS Configuration', () => {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://tradezzz.vercel.app',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  it('should return correct CORS headers for allowed origins', async () => {
    for (const origin of allowedOrigins) {
      const res = await fetch('/api/strategies', {
        method: 'OPTIONS',
        headers: { Origin: origin },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    }
  });

  it('should reject requests from unknown origins', async () => {
    const res = await fetch('/api/strategies', {
      headers: { Origin: 'https://evil-site.com' },
    });

    expect(res.headers.get('Access-Control-Allow-Origin')).not.toBe('https://evil-site.com');
  });
});
```

**File:** `tests/api/validation.test.ts`

```typescript
describe('Request Validation', () => {
  describe('POST /api/orders', () => {
    it('should require symbol field', async () => {
      const res = await authenticatedFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ side: 'buy', type: 'market', quantity: 1 }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('symbol');
    });

    it('should validate side is buy or sell', async () => {
      const res = await authenticatedFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          symbol: 'BTC/USD',
          side: 'invalid',
          type: 'market',
          quantity: 1,
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('side');
    });

    it('should validate quantity is positive number', async () => {
      const res = await authenticatedFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          symbol: 'BTC/USD',
          side: 'buy',
          type: 'market',
          quantity: -1,
        }),
      });

      expect(res.status).toBe(400);
    });
  });
});
```

### 4.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 4.2.1 | `app/lib/api-response.ts` | Create standard response wrapper utility |
| 4.2.2 | All Next.js routes | Apply standard response wrapper |
| 4.2.3 | `app/app/api/strategies/[id]/route.ts` | Create individual strategy endpoints |
| 4.2.4 | `app/app/api/orders/[id]/route.ts` | Create individual order endpoints |
| 4.2.5 | `app/app/api/orders/[id]/cancel/route.ts` | Create cancel order endpoint |
| 4.2.6 | `app/app/api/exchanges/[id]/route.ts` | Create individual exchange endpoints |
| 4.2.7 | `app/app/api/ai-providers/[id]/route.ts` | Create individual provider endpoints |
| 4.2.8 | `app/middleware.ts` | Fix CORS with origin validation |
| 4.2.9 | `app/lib/validation.ts` | Create Zod schemas for all endpoints |
| 4.2.10 | All POST/PUT routes | Apply validation middleware |
| 4.2.11 | `app/lib/proxy.ts` | Create proxy utility with timeout and auth forwarding |

### 4.3 Standard Response Wrapper

**File:** `app/lib/api-response.ts`

```typescript
import { NextResponse } from 'next/server';

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'RATE_LIMITED';

interface SuccessResponse<T> {
  success: true;
  data: T;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
  details?: unknown;
}

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data } as SuccessResponse<T>, { status });
}

export function error(message: string, code: ErrorCode, status: number, details?: unknown) {
  return NextResponse.json({ success: false, error: message, code, details } as ErrorResponse, { status });
}

export const ApiResponse = {
  success,
  error,
  badRequest: (message: string, details?: unknown) => error(message, 'VALIDATION_ERROR', 400, details),
  unauthorized: (message = 'Unauthorized') => error(message, 'UNAUTHORIZED', 401),
  forbidden: (message = 'Forbidden') => error(message, 'FORBIDDEN', 403),
  notFound: (message = 'Not found') => error(message, 'NOT_FOUND', 404),
  internal: (message = 'Internal server error') => error(message, 'INTERNAL_ERROR', 500),
};
```

### 4.4 Deliverables

- [ ] **45 API tests passing**
- [ ] All routes use standard response format `{ success, data/error }`
- [ ] Individual resource endpoints for all entities
- [ ] CORS properly configured with origin validation
- [ ] Request validation using Zod on all POST/PUT
- [ ] Proxy utility with timeout and auth forwarding
- [ ] Error responses include error codes

### 4.5 Acceptance Criteria

```bash
# All API tests pass
npm test -- --grep "API|Response|CORS|Validation"

# Manual CORS check
curl -I -X OPTIONS http://localhost:3000/api/strategies \
  -H "Origin: http://localhost:3000"
# Should return Access-Control-Allow-Origin: http://localhost:3000
```

---

# Phase 5: Exchange Integration (Coinbase Fix)

## Priority: HIGH
## Estimated Tests: 30
## Dependencies: Phase 4

### Issues Addressed

| ID | Issue | Severity |
|----|-------|----------|
| 4.4 | Missing passphrase field for Coinbase | CRITICAL |
| - | API route passphrase validation | HIGH |
| - | testConnection() returns mock success | CRITICAL |
| - | Adapter factory not wired | HIGH |
| - | Coinbase HMAC signature fix | HIGH |
| - | Two adapter implementations | MEDIUM |
| - | Rate limiting (10 RPS) | MEDIUM |

### 5.1 Tests First (Red Phase)

**File:** `app/tests/exchanges-page.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Exchange Connection - Coinbase', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/exchanges');
  });

  test('should show passphrase field when Coinbase selected', async ({ page }) => {
    await page.click('button:has-text("Connect Exchange")');
    await page.selectOption('[data-testid="exchange-select"]', 'coinbase');

    const passphraseField = page.locator('[data-testid="passphrase-input"]');
    await expect(passphraseField).toBeVisible();
  });

  test('should hide passphrase field when Binance selected', async ({ page }) => {
    await page.click('button:has-text("Connect Exchange")');
    await page.selectOption('[data-testid="exchange-select"]', 'binance');

    const passphraseField = page.locator('[data-testid="passphrase-input"]');
    await expect(passphraseField).not.toBeVisible();
  });

  test('should require passphrase for Coinbase', async ({ page }) => {
    await page.click('button:has-text("Connect Exchange")');
    await page.selectOption('[data-testid="exchange-select"]', 'coinbase');
    await page.fill('[data-testid="api-key-input"]', 'test-key');
    await page.fill('[data-testid="api-secret-input"]', 'test-secret');
    // Don't fill passphrase

    const connectButton = page.locator('button:has-text("Connect")');
    await expect(connectButton).toBeDisabled();
  });

  test('should include passphrase in request', async ({ page }) => {
    let requestBody: any;
    await page.route('/api/exchanges', (route) => {
      if (route.request().method() === 'POST') {
        requestBody = route.request().postDataJSON();
        route.fulfill({ status: 201, body: JSON.stringify({ success: true, data: { id: '1' } }) });
      } else {
        route.continue();
      }
    });

    await page.click('button:has-text("Connect Exchange")');
    await page.selectOption('[data-testid="exchange-select"]', 'coinbase');
    await page.fill('[data-testid="api-key-input"]', 'test-key');
    await page.fill('[data-testid="api-secret-input"]', 'test-secret');
    await page.fill('[data-testid="passphrase-input"]', 'test-passphrase');
    await page.click('button:has-text("Connect")');

    await expect.poll(() => requestBody?.passphrase).toBe('test-passphrase');
  });
});
```

**File:** `tests/api/exchanges-validation.test.ts`

```typescript
describe('Exchange API Validation', () => {
  const EXCHANGES_REQUIRING_PASSPHRASE = ['coinbase', 'kucoin', 'okx'];

  EXCHANGES_REQUIRING_PASSPHRASE.forEach((exchange) => {
    it(`POST /api/exchanges should reject ${exchange} without passphrase`, async () => {
      const res = await authenticatedFetch('/api/exchanges', {
        method: 'POST',
        body: JSON.stringify({
          exchange,
          apiKey: 'test-key',
          apiSecret: 'test-secret',
          // Missing passphrase
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/passphrase/i);
    });

    it(`POST /api/exchanges should accept ${exchange} with passphrase`, async () => {
      const res = await authenticatedFetch('/api/exchanges', {
        method: 'POST',
        body: JSON.stringify({
          exchange,
          apiKey: 'test-key',
          apiSecret: 'test-secret',
          passphrase: 'test-passphrase',
          name: 'Test Account',
        }),
      });

      expect(res.status).toBe(201);
    });
  });

  it('POST /api/exchanges should accept binance without passphrase', async () => {
    const res = await authenticatedFetch('/api/exchanges', {
      method: 'POST',
      body: JSON.stringify({
        exchange: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        name: 'Test Account',
      }),
    });

    expect(res.status).toBe(201);
  });
});
```

**File:** `src/exchanges/__tests__/test-connection.test.ts`

```typescript
describe('Exchange testConnection()', () => {
  it('should make real API call to validate credentials', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    const connection = await exchangeService.createConnection({
      userId: 'user-1',
      exchange: 'coinbase',
      name: 'Test',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      passphrase: 'test-passphrase',
    });

    await exchangeService.testConnection(connection.id);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('api.coinbase.com'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'CB-ACCESS-KEY': expect.any(String),
        }),
      })
    );
  });

  it('should return invalid for bad credentials', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid API key' }),
    } as Response);

    const connection = await exchangeService.createConnection({...});
    const result = await exchangeService.testConnection(connection.id);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/authentication|invalid/i);
  });

  it('should return valid for good credentials', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accounts: [] }),
    } as Response);

    const connection = await exchangeService.createConnection({...});
    const result = await exchangeService.testConnection(connection.id);

    expect(result.valid).toBe(true);
  });
});
```

**File:** `src/exchanges/adapters/__tests__/coinbase-signature.test.ts`

```typescript
describe('Coinbase Signature Generation', () => {
  it('should generate correct HMAC-SHA256 signature', () => {
    const adapter = new CoinbaseAdapter({
      apiKey: 'test-api-key',
      apiSecret: 'dGVzdC1zZWNyZXQ=', // base64 encoded
      passphrase: 'test-passphrase',
    });

    const timestamp = '1704067200';
    const method = 'GET';
    const path = '/api/v3/brokerage/accounts';
    const body = '';

    const signature = adapter['generateSignature'](timestamp, method, path, body);

    // Verify signature format (should be hex or base64 depending on Coinbase spec)
    expect(signature).toMatch(/^[a-zA-Z0-9+/=]+$/);
  });

  it('should include body in POST signature', async () => {
    const adapter = new CoinbaseAdapter({...});
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await adapter.createOrder({
      symbol: 'BTC/USD',
      side: 'buy',
      type: 'market',
      quantity: 0.01,
    });

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers['CB-ACCESS-SIGN']).toBeTruthy();
  });
});
```

**File:** `src/exchanges/__tests__/adapter-factory.test.ts`

```typescript
describe('Exchange Adapter Factory', () => {
  it('should return CoinbaseAdapter for coinbase exchange', () => {
    const adapter = createExchangeAdapter('coinbase', {
      apiKey: 'key',
      apiSecret: 'secret',
      passphrase: 'pass',
    });

    expect(adapter).toBeInstanceOf(CoinbaseAdapter);
  });

  it('should return BinanceAdapter for binance exchange', () => {
    const adapter = createExchangeAdapter('binance', {
      apiKey: 'key',
      apiSecret: 'secret',
    });

    expect(adapter).toBeInstanceOf(BinanceAdapter);
  });

  it('ExchangeService should use adapter for getTicker', async () => {
    const mockAdapter = {
      getTicker: jest.fn().mockResolvedValue({ price: 50000 }),
    };

    const service = new ExchangeService({
      ...options,
      adapterFactory: () => mockAdapter,
    });

    const connection = await service.createConnection({...});
    await service.getTicker(connection.id, 'BTC/USD');

    expect(mockAdapter.getTicker).toHaveBeenCalled();
  });
});
```

### 5.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 5.2.1 | `app/app/dashboard/exchanges/page.tsx` | Add passphrase state variable |
| 5.2.2 | `app/app/dashboard/exchanges/page.tsx` | Add EXCHANGES_REQUIRING_PASSPHRASE constant |
| 5.2.3 | `app/app/dashboard/exchanges/page.tsx` | Add conditional passphrase input |
| 5.2.4 | `app/app/dashboard/exchanges/page.tsx` | Update form validation |
| 5.2.5 | `app/app/dashboard/exchanges/page.tsx` | Include passphrase in POST |
| 5.2.6 | `app/app/api/exchanges/route.ts` | Add passphrase validation |
| 5.2.7 | `src/exchanges/ExchangeService.ts` | Implement real testConnection() |
| 5.2.8 | `src/exchanges/ExchangeService.ts` | Wire adapter factory |
| 5.2.9 | `app/lib/exchanges/coinbase.ts` | Fix signature generation |
| 5.2.10 | `src/exchanges/adapters/index.ts` | Create unified adapter factory |
| 5.2.11 | `src/exchanges/adapters/CoinbaseAdapter.ts` | Ensure signature matches spec |
| 5.2.12 | `src/api/server.ts` | Pass adapterFactory to ExchangeService |

### 5.3 Deliverables

- [ ] **30 exchange tests passing**
- [ ] Passphrase field visible for Coinbase/KuCoin/OKX
- [ ] API rejects Coinbase without passphrase
- [ ] testConnection() makes real API call
- [ ] Adapter factory wired to ExchangeService
- [ ] Coinbase signature generation correct
- [ ] Real market data from Coinbase API

### 5.4 Acceptance Criteria

```bash
# All exchange tests pass
npm test -- --grep "Exchange|Coinbase|Adapter"

# Playwright E2E tests pass
npx playwright test exchanges

# Manual test with real Coinbase sandbox credentials
curl -X POST http://localhost:3000/api/exchanges \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"exchange":"coinbase","apiKey":"...","apiSecret":"...","passphrase":"..."}'
```

---

# Phase 6: AI Provider Integration

## Priority: MEDIUM
## Estimated Tests: 35
## Dependencies: Phase 4

### Issues Addressed

| ID | Issue | Severity |
|----|-------|----------|
| 5.1 | Missing Cohere and Mistral adapters | CRITICAL |
| 5.2 | Three different encryption implementations | CRITICAL |
| 5.3 | Inconsistent provider definitions | HIGH |
| 5.4 | Response parsing greedy regex | HIGH |
| 5.5 | No rate limiting implementation | HIGH |
| 5.6 | Silent error swallowing | HIGH |
| 5.7 | testProvider() always returns valid | HIGH |
| 5.8 | Hardcoded token estimates | MEDIUM |
| 5.9 | Sentiment analysis keyword-only | MEDIUM |
| 5.10 | Division by zero risk | MEDIUM |

### 6.1 Tests First (Red Phase)

**File:** `src/ai/adapters/__tests__/cohere.test.ts`

```typescript
describe('CohereAdapter', () => {
  it('should be exported from adapters index', () => {
    const { CohereAdapter } = require('../index');
    expect(CohereAdapter).toBeDefined();
  });

  it('should implement chat method', async () => {
    const adapter = new CohereAdapter({ apiKey: 'test-key' });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        text: 'Hello!',
        meta: { tokens: { input_tokens: 10, output_tokens: 5 } },
      }),
    } as Response);

    const result = await adapter.chat({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.content).toBe('Hello!');
    expect(result.usage.totalTokens).toBe(15);
  });

  it('should implement sentiment analysis', async () => {
    const adapter = new CohereAdapter({ apiKey: 'test-key' });
    // ... mock response

    const result = await adapter.analyzeSentiment('Bitcoin is going up!');

    expect(result.sentiment).toMatch(/bullish|bearish|neutral/);
    expect(result.score).toBeGreaterThanOrEqual(-1);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
```

**File:** `src/ai/adapters/__tests__/mistral.test.ts`

```typescript
describe('MistralAdapter', () => {
  it('should be exported from adapters index', () => {
    const { MistralAdapter } = require('../index');
    expect(MistralAdapter).toBeDefined();
  });

  it('should implement chat method', async () => {
    const adapter = new MistralAdapter({ apiKey: 'test-key' });
    // ... similar tests
  });
});
```

**File:** `src/ai/__tests__/provider-definitions.test.ts`

```typescript
describe('Provider Definitions Consistency', () => {
  const expectedProviders = ['openai', 'anthropic', 'deepseek', 'google', 'cohere', 'mistral', 'grok', 'ollama'];

  it('API route should list all providers', () => {
    const { SUPPORTED_PROVIDERS } = require('app/app/api/ai-providers/route');
    expectedProviders.forEach((p) => {
      expect(SUPPORTED_PROVIDERS.map((sp: any) => sp.id)).toContain(p);
    });
  });

  it('Adapter index should export all providers', () => {
    const { SupportedProvider } = require('src/ai/adapters/index');
    expectedProviders.forEach((p) => {
      expect(SupportedProvider).toContain(p);
    });
  });

  it('createAdapter should handle all providers', () => {
    const { createAdapter } = require('src/ai/adapters/index');
    expectedProviders.forEach((p) => {
      expect(() => createAdapter(p, { apiKey: 'test' })).not.toThrow();
    });
  });
});
```

**File:** `src/ai/adapters/__tests__/response-parsing.test.ts`

```typescript
describe('Response Parsing', () => {
  it('should handle single JSON object in response', () => {
    const content = 'Here is the analysis: {"sentiment": "bullish", "score": 0.8}';
    const result = parseJsonFromResponse(content);

    expect(result.sentiment).toBe('bullish');
    expect(result.score).toBe(0.8);
  });

  it('should handle multiple JSON objects (take first)', () => {
    const content = '{"first": 1} some text {"second": 2}';
    const result = parseJsonFromResponse(content);

    expect(result.first).toBe(1);
    expect(result).not.toHaveProperty('second');
  });

  it('should validate required fields exist', () => {
    const content = '{"sentiment": "bullish"}'; // Missing score

    expect(() => parseJsonFromResponse(content, ['sentiment', 'score']))
      .toThrow(/missing.*score/i);
  });

  it('should throw clear error for invalid JSON', () => {
    const content = '{invalid json}';

    expect(() => parseJsonFromResponse(content))
      .toThrow(/parse|invalid|json/i);
  });
});
```

**File:** `src/ai/__tests__/rate-limiting.test.ts`

```typescript
describe('AI Provider Rate Limiting', () => {
  it('should queue requests when rate limited', async () => {
    const adapter = new OpenAIAdapter({ apiKey: 'test' });

    // Simulate rate limit response
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({...}) } as Response);

    const result = await adapter.chat({ messages: [...] });

    expect(result).toBeDefined();
    // Should have retried
  });

  it('should implement exponential backoff', async () => {
    const startTime = Date.now();
    const adapter = new OpenAIAdapter({ apiKey: 'test' });

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({...}) } as Response);

    await adapter.chat({ messages: [...] });

    const elapsed = Date.now() - startTime;
    // Should have waited ~1s + ~2s = ~3s total
    expect(elapsed).toBeGreaterThan(2000);
  });

  it('should fail after max retries', async () => {
    const adapter = new OpenAIAdapter({ apiKey: 'test', maxRetries: 2 });

    jest.spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 429 } as Response);

    await expect(adapter.chat({ messages: [...] }))
      .rejects.toThrow(/rate.*limit|retry/i);
  });
});
```

### 6.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 6.2.1 | `src/ai/adapters/CohereAdapter.ts` | Create Cohere adapter |
| 6.2.2 | `src/ai/adapters/MistralAdapter.ts` | Create Mistral adapter |
| 6.2.3 | `src/ai/adapters/index.ts` | Export all 8 providers |
| 6.2.4 | `app/app/api/ai-providers/route.ts` | Update SUPPORTED_PROVIDERS |
| 6.2.5 | `src/ai/AIProviderService.ts` | Update PROVIDER_INFO |
| 6.2.6 | `src/ai/adapters/base.ts` | Create base adapter with rate limiting |
| 6.2.7 | All adapters | Extend base adapter |
| 6.2.8 | `src/ai/utils/parse-json.ts` | Create robust JSON parsing utility |
| 6.2.9 | All adapters | Use new parsing utility |
| 6.2.10 | `src/ai/AIProviderService.ts` | Fix testProvider() to use adapter |
| 6.2.11 | `src/ai/AIProviderService.ts` | Use actual token counts from adapter |
| 6.2.12 | `src/ai/AIProviderService.ts` | Fix division by zero in sentiment |
| 6.2.13 | `app/lib/encryption.ts` | Consolidate to single encryption impl |

### 6.3 Deliverables

- [ ] **35 AI provider tests passing**
- [ ] Cohere and Mistral adapters implemented
- [ ] All 8 providers consistently defined
- [ ] Rate limiting with exponential backoff
- [ ] Robust JSON response parsing
- [ ] testProvider() makes real API call
- [ ] Actual token usage tracked
- [ ] Single encryption implementation

### 6.4 Acceptance Criteria

```bash
# All AI tests pass
npm test -- --grep "AI|Provider|Adapter|Cohere|Mistral"

# All providers can be created
npm run test:providers
```

---

# Phase 7: Trading & Order Execution

## Priority: MEDIUM
## Estimated Tests: 40
## Dependencies: Phase 5, Phase 6

### Issues Addressed

| ID | Issue | Severity |
|----|-------|----------|
| 6.1 | entryPrice not updateable in positions | CRITICAL |
| 6.2 | Approval status never updated | CRITICAL |
| 6.3 | No re-validation on approval | HIGH |
| 6.4 | Non-transactional order + trade | HIGH |
| 6.6 | Graph risk gating skipped for approvals | HIGH |
| 6.7 | filledAt tracking issues | MEDIUM |
| 6.8 | Partial close entry price not preserved | MEDIUM |
| 6.9 | No price bounds validation | MEDIUM |
| 6.10 | Two paper trading implementations | LOW |

### 7.1 Tests First (Red Phase)

**File:** `src/execution/__tests__/position-averaging.test.ts`

```typescript
describe('Position Averaging', () => {
  it('should calculate new entry price when adding to position', async () => {
    // Create initial position: 1 BTC @ $50,000
    const position = await createPosition({
      symbol: 'BTC/USD',
      quantity: 1,
      entryPrice: 50000,
    });

    // Add to position: 1 BTC @ $52,000
    const result = await tradingService.executeOrder({
      userId: position.user_id,
      symbol: 'BTC/USD',
      side: 'buy',
      quantity: 1,
      price: 52000,
    });

    // New average: 2 BTC @ $51,000
    const updated = await db.positions.findById(position.id);
    expect(updated.quantity).toBe(2);
    expect(updated.entry_price).toBe(51000);
  });

  it('should calculate partial close correctly', async () => {
    // Position: 2 BTC @ $50,000
    const position = await createPosition({
      symbol: 'BTC/USD',
      side: 'long',
      quantity: 2,
      entryPrice: 50000,
    });

    // Sell 1 BTC @ $55,000
    await tradingService.executeOrder({
      userId: position.user_id,
      symbol: 'BTC/USD',
      side: 'sell',
      quantity: 1,
      price: 55000,
    });

    // Remaining: 1 BTC @ $50,000 (entry price unchanged)
    // Realized PnL: $5,000
    const updated = await db.positions.findById(position.id);
    expect(updated.quantity).toBe(1);
    expect(updated.entry_price).toBe(50000);
    expect(updated.realized_pnl).toBe(5000);
  });
});
```

**File:** `src/execution/__tests__/order-approval.test.ts`

```typescript
describe('Order Approval Flow', () => {
  it('should update approval status after order creation', async () => {
    const approval = await createPendingApproval({...});

    await approvalService.approve(approval.id, 'user-1');

    const updated = await db.orderApprovals.findById(approval.id);
    expect(updated.status).toBe('approved');
    expect(updated.order_id).toBeTruthy();
  });

  it('should prevent double approval', async () => {
    const approval = await createPendingApproval({...});
    await approvalService.approve(approval.id, 'user-1');

    await expect(approvalService.approve(approval.id, 'user-1'))
      .rejects.toThrow(/already.*approved/i);
  });

  it('should re-validate risk limits on approval', async () => {
    const approval = await createPendingApproval({
      quantity: 100000, // $100k position
    });

    // User has hit daily loss limit since approval was created
    await simulateDailyLoss('user-1', 5000);

    await expect(approvalService.approve(approval.id, 'user-1'))
      .rejects.toThrow(/risk.*limit/i);
  });

  it('should apply graph risk gating on approval', async () => {
    const approval = await createPendingApproval({...});

    // Set user's graph risk mode to 'block'
    await db.userSettings.update('user-1', { graph_risk_mode: 'block' });

    // Graph risk score is high
    jest.spyOn(riskGraphService, 'calculateScore').mockResolvedValue(0.9);

    await expect(approvalService.approve(approval.id, 'user-1'))
      .rejects.toThrow(/risk.*graph|blocked/i);
  });

  it('should create order and trade in transaction', async () => {
    const approval = await createPendingApproval({...});

    // Mock trade creation to fail
    jest.spyOn(db.trades, 'create').mockRejectedValue(new Error('DB error'));

    await expect(approvalService.approve(approval.id, 'user-1'))
      .rejects.toThrow();

    // Order should NOT exist (rolled back)
    const orders = await db.orders.findByApprovalId(approval.id);
    expect(orders).toHaveLength(0);
  });
});
```

**File:** `src/execution/__tests__/price-validation.test.ts`

```typescript
describe('Order Price Validation', () => {
  it('should reject fill price too far from market', async () => {
    const order = await createOrder({
      symbol: 'BTC/USD',
      type: 'market',
    });

    // Current market: $50,000
    jest.spyOn(exchangeService, 'getTicker').mockResolvedValue({
      last: 50000,
    });

    // Try to fill at $40,000 (20% away)
    await expect(orderService.fill(order.id, { price: 40000 }))
      .rejects.toThrow(/price.*deviation|slippage/i);
  });

  it('should accept fill price within tolerance', async () => {
    const order = await createOrder({
      symbol: 'BTC/USD',
      type: 'market',
    });

    jest.spyOn(exchangeService, 'getTicker').mockResolvedValue({
      last: 50000,
    });

    // Fill at $50,500 (1% away) - should be OK
    const result = await orderService.fill(order.id, { price: 50500 });
    expect(result.status).toBe('filled');
  });
});
```

### 7.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 7.2.1 | `src/database/NeonDatabase.ts` | Add entry_price and quantity to positions.update() |
| 7.2.2 | `src/execution/NeonLiveTradingService.ts` | Fix position averaging logic |
| 7.2.3 | `src/api/server.new.ts` | Update approval status after order creation |
| 7.2.4 | `src/api/server.new.ts` | Add re-validation on approval |
| 7.2.5 | `src/api/server.new.ts` | Add graph risk check on approval |
| 7.2.6 | `src/api/server.new.ts` | Wrap order+trade in transaction |
| 7.2.7 | `src/execution/NeonLiveTradingService.ts` | Fix partial close entry price |
| 7.2.8 | `src/api/server.new.ts` | Add price deviation check on fill |
| 7.2.9 | `src/execution/OrderService.ts` | Consolidate paper trading to single impl |
| 7.2.10 | `src/api/routes/trading.routes.ts` | Use OrderService for paper trading |

### 7.3 Deliverables

- [ ] **40 trading tests passing**
- [ ] Position entry_price updateable
- [ ] Approval status updated correctly
- [ ] Risk re-validated on approval
- [ ] Order + trade atomic (transaction)
- [ ] Price deviation validation
- [ ] Single paper trading implementation

### 7.4 Acceptance Criteria

```bash
# All trading tests pass
npm test -- --grep "Trading|Order|Position|Approval"

# Position averaging works
npm run test:positions
```

---

# Phase 8: Frontend Components

## Priority: MEDIUM
## Estimated Tests: 35
## Dependencies: Phase 4, Phase 5

### Issues Addressed

| ID | Issue | Severity |
|----|-------|----------|
| 4.1 | Save buttons not implemented in Settings | CRITICAL |
| 4.3 | Trading mode state not persisted | CRITICAL |
| 4.5 | Delete account not implemented | HIGH |
| 4.6 | Strategy buttons non-functional | HIGH |
| 4.7 | Recommendations format mismatch | HIGH |
| 4.8 | Price loading no error feedback | HIGH |
| 4.9 | Order stats race condition | HIGH |
| 4.10-4.20 | Various UI issues | MEDIUM-LOW |

### 8.1 Tests First (Red Phase)

**File:** `app/tests/settings-page.spec.ts`

```typescript
describe('Settings Page', () => {
  test('should save profile changes', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await page.fill('[data-testid="first-name-input"]', 'John');
    await page.fill('[data-testid="last-name-input"]', 'Doe');
    await page.click('button:has-text("Save Changes")');

    await expect(page.locator('text=Settings saved')).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await expect(page.locator('[data-testid="first-name-input"]')).toHaveValue('John');
  });

  test('should save trading preferences', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await page.selectOption('[data-testid="timezone-select"]', 'America/New_York');
    await page.selectOption('[data-testid="risk-level-select"]', 'high');
    await page.click('button:has-text("Save Preferences")');

    await expect(page.locator('text=Preferences saved')).toBeVisible();
  });

  test('should delete account with confirmation', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await page.click('button:has-text("Delete Account")');
    await page.click('button:has-text("Confirm Delete")');

    // Should redirect to home
    await expect(page).toHaveURL('/');
  });
});
```

**File:** `app/tests/trading-mode.spec.ts`

```typescript
describe('Trading Mode', () => {
  test('should persist mode selection to backend', async ({ page }) => {
    let savedMode: string;
    await page.route('/api/user/settings', (route) => {
      if (route.request().method() === 'PUT') {
        savedMode = route.request().postDataJSON().tradingMode;
        route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      } else {
        route.continue();
      }
    });

    await page.goto('/dashboard');
    await page.selectOption('[data-testid="trading-mode-select"]', 'live');

    await expect.poll(() => savedMode).toBe('live');
  });

  test('should show warning when switching to live mode', async ({ page }) => {
    await page.goto('/dashboard');
    await page.selectOption('[data-testid="trading-mode-select"]', 'live');

    await expect(page.locator('text=Live trading')).toBeVisible();
    await expect(page.locator('text=real funds')).toBeVisible();
  });
});
```

### 8.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 8.2.1 | `app/app/dashboard/settings/page.tsx` | Implement handleSaveProfile() |
| 8.2.2 | `app/app/dashboard/settings/page.tsx` | Implement handleSavePreferences() |
| 8.2.3 | `app/app/dashboard/settings/page.tsx` | Implement handleDeleteAccount() |
| 8.2.4 | `app/app/api/user/settings/route.ts` | Create settings update endpoint |
| 8.2.5 | `app/app/api/user/route.ts` | Add DELETE method for account |
| 8.2.6 | `app/app/dashboard/layout.tsx` | Persist trading mode to backend |
| 8.2.7 | `app/app/dashboard/strategies/page.tsx` | Implement strategy copy/settings |
| 8.2.8 | `app/app/dashboard/strategies/page.tsx` | Fix recommendations parsing |
| 8.2.9 | `app/app/dashboard/page.tsx` | Add error states for price loading |
| 8.2.10 | `app/app/dashboard/orders/page.tsx` | Fix stats race condition |
| 8.2.11 | All pages | Add data-testid attributes |

### 8.3 Deliverables

- [ ] **35 frontend tests passing**
- [ ] Settings save buttons work
- [ ] Trading mode persists
- [ ] Account deletion works
- [ ] Strategy copy/settings work
- [ ] Error states displayed
- [ ] All data-testid attributes added

### 8.4 Acceptance Criteria

```bash
# Playwright tests pass
npx playwright test settings trading-mode

# Manual verification
# - Settings save works
# - Trading mode persists across refresh
# - Delete account works
```

---

# Phase 9: Configuration & Environment

## Priority: MEDIUM
## Estimated Tests: 20
## Dependencies: Phase 1

### Issues Addressed

| ID | Issue | Severity |
|----|-------|----------|
| 7.4 | Hardcoded localhost:3001 | HIGH |
| 7.5 | CORS only allows localhost | HIGH |
| 7.6 | Default password 'postgres' | HIGH |
| 7.7 | SSL validation disabled | HIGH |
| 7.8-7.12 | Various config issues | MEDIUM |

### 9.1 Tests First (Red Phase)

**File:** `tests/config/environment.test.ts`

```typescript
describe('Environment Configuration', () => {
  it('should require all critical env vars in production', () => {
    process.env.NODE_ENV = 'production';

    const required = [
      'DATABASE_URL',
      'ENCRYPTION_KEY',
      'CLERK_SECRET_KEY',
      'NEURAL_TRADING_API_URL',
    ];

    required.forEach((key) => {
      delete process.env[key];
      expect(() => validateEnvironment()).toThrow(new RegExp(key));
    });
  });

  it('should not allow default values in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_KEY = 'default-dev-encryption-key-32!!';

    expect(() => validateEnvironment()).toThrow(/default|insecure/i);
  });

  it('should parse CORS_ORIGINS as array', () => {
    process.env.CORS_ORIGINS = 'http://localhost:3000,https://app.tradezzz.com';

    const config = loadConfig();

    expect(config.corsOrigins).toEqual([
      'http://localhost:3000',
      'https://app.tradezzz.com',
    ]);
  });
});
```

### 9.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 9.2.1 | `src/config/environment.ts` | Create environment validation |
| 9.2.2 | All proxy routes | Use NEURAL_TRADING_API_URL from env |
| 9.2.3 | `src/api/server.ts` | Read CORS_ORIGINS from env |
| 9.2.4 | `src/database/PostgresDatabase.ts` | Remove default password |
| 9.2.5 | `src/database/NeonDatabase.ts` | Enable SSL validation |
| 9.2.6 | `.env.example` | Document all required variables |
| 9.2.7 | `app/next.config.ts` | Add environment validation |
| 9.2.8 | `src/api/server.ts` | Validate env on startup |

### 9.3 Deliverables

- [ ] **20 config tests passing**
- [ ] All env vars documented in .env.example
- [ ] Production startup validates all required vars
- [ ] CORS configurable via environment
- [ ] No hardcoded localhost URLs
- [ ] SSL validation enabled

---

# Phase 10: Error Handling & Resilience

## Priority: LOW
## Estimated Tests: 25
## Dependencies: Phase 4, Phase 6

### Issues Addressed

- Circuit breaker for backend proxies
- Retry logic with exponential backoff
- Comprehensive error logging
- User-friendly error messages
- Error boundaries in React

### 10.1 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 10.1.1 | `app/lib/circuit-breaker.ts` | Create circuit breaker utility |
| 10.1.2 | `app/lib/retry.ts` | Create retry with backoff utility |
| 10.1.3 | All proxy routes | Apply circuit breaker |
| 10.1.4 | `app/lib/logger.ts` | Create structured logging |
| 10.1.5 | `app/components/error-boundary.tsx` | Create React error boundary |
| 10.1.6 | All dashboard pages | Wrap in error boundary |

---

# Phase 11: Performance & Optimization

## Priority: LOW
## Estimated Tests: 15
## Dependencies: Phase 2

### Issues Addressed

- Connection pooling optimization
- Caching for market data
- Lazy loading components
- Bundle size optimization

---

# Phase 12: Test Infrastructure & E2E

## Priority: LOW
## Estimated Tests: 20
## Dependencies: All previous phases

### Issues Addressed

- Fix 2 failing test suites
- Add E2E tests for critical flows
- Set up CI/CD test pipeline

### 12.1 Fix Failing Tests

**File:** `tests/helpers/test-db.ts`

```typescript
// Fix: role "postgres" does not exist
export async function createTestDatabase(): Promise<Database> {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL required for tests');
  }
  // Use provided connection instead of assuming postgres role
  // ...
}
```

**File:** `src/swarm/SwarmCoordinator.test.ts`

```typescript
// Fix: Expected ")" but found end of file
// Add missing closing bracket at line 101
```

---

## Implementation Schedule

```
Week 1: Phase 1 (Security) + Phase 2 (Database)
Week 2: Phase 3 (Types) + Phase 4 (API)
Week 3: Phase 5 (Exchanges) + Phase 6 (AI)
Week 4: Phase 7 (Trading) + Phase 8 (Frontend)
Week 5: Phase 9 (Config) + Phase 10-12 (Polish)
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Test Coverage | >80% |
| All Tests Passing | 100% |
| Security Issues | 0 Critical/High |
| Build Time | <2 minutes |
| E2E Tests | All critical flows |

---

## Rollback Plan

Each phase is independent. If issues arise:
1. Revert phase branch
2. Run full test suite
3. Identify regression
4. Fix and re-deploy

---

## Sign-off Checklist

- [ ] All phases complete
- [ ] All tests passing (900+)
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Production deployment verified
