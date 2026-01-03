# Coinbase Exchange Connection Fix - TDD Implementation Plan

## Overview

This plan addresses 7 critical issues preventing Coinbase exchange connections from working. Each phase follows strict Test-Driven Development (Red-Green-Refactor) methodology.

**Total Estimated Tests:** 85+
**Phases:** 6

---

## Phase 1: Frontend Passphrase Field (UI Layer)

### Problem
The exchange connection dialog lacks a passphrase input field, but Coinbase requires `apiKey`, `apiSecret`, AND `passphrase`.

### TDD Approach

#### 1.1 Write Failing Tests First

**File:** `app/tests/exchanges-page.spec.ts`

```typescript
// Test 1: Passphrase field appears for Coinbase
test('should show passphrase field when Coinbase is selected', async ({ page }) => {
  await page.goto('/dashboard/exchanges');
  await page.click('button:has-text("Connect Exchange")');
  await page.selectOption('[data-testid="exchange-select"]', 'coinbase');

  const passphraseField = page.locator('[data-testid="passphrase-input"]');
  await expect(passphraseField).toBeVisible();
});

// Test 2: Passphrase field hidden for Binance
test('should hide passphrase field when Binance is selected', async ({ page }) => {
  await page.goto('/dashboard/exchanges');
  await page.click('button:has-text("Connect Exchange")');
  await page.selectOption('[data-testid="exchange-select"]', 'binance');

  const passphraseField = page.locator('[data-testid="passphrase-input"]');
  await expect(passphraseField).not.toBeVisible();
});

// Test 3: Passphrase required validation for Coinbase
test('should require passphrase for Coinbase connection', async ({ page }) => {
  await page.goto('/dashboard/exchanges');
  await page.click('button:has-text("Connect Exchange")');
  await page.selectOption('[data-testid="exchange-select"]', 'coinbase');
  await page.fill('[data-testid="api-key-input"]', 'test-key');
  await page.fill('[data-testid="api-secret-input"]', 'test-secret');
  // Don't fill passphrase

  const connectButton = page.locator('button:has-text("Connect")');
  await expect(connectButton).toBeDisabled();
});

// Test 4: Passphrase sent in POST request
test('should include passphrase in connection request for Coinbase', async ({ page }) => {
  let requestBody: any;
  await page.route('/api/exchanges', (route) => {
    requestBody = route.request().postDataJSON();
    route.fulfill({ status: 201, body: JSON.stringify({ connection: { id: '1' } }) });
  });

  await page.goto('/dashboard/exchanges');
  await page.click('button:has-text("Connect Exchange")');
  await page.selectOption('[data-testid="exchange-select"]', 'coinbase');
  await page.fill('[data-testid="api-key-input"]', 'test-key');
  await page.fill('[data-testid="api-secret-input"]', 'test-secret');
  await page.fill('[data-testid="passphrase-input"]', 'test-passphrase');
  await page.click('button:has-text("Connect")');

  expect(requestBody.passphrase).toBe('test-passphrase');
});
```

#### 1.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 1.2.1 | `app/app/dashboard/exchanges/page.tsx` | Add `passphrase` state variable |
| 1.2.2 | `app/app/dashboard/exchanges/page.tsx` | Add exchanges requiring passphrase constant |
| 1.2.3 | `app/app/dashboard/exchanges/page.tsx` | Add conditional passphrase input field |
| 1.2.4 | `app/app/dashboard/exchanges/page.tsx` | Update form validation logic |
| 1.2.5 | `app/app/dashboard/exchanges/page.tsx` | Include passphrase in POST body |
| 1.2.6 | `app/app/dashboard/exchanges/page.tsx` | Reset passphrase on dialog close |

#### 1.3 Acceptance Criteria

- [ ] Passphrase field visible when Coinbase/KuCoin/OKX selected
- [ ] Passphrase field hidden when Binance/Kraken/Bybit selected
- [ ] Connect button disabled if Coinbase selected without passphrase
- [ ] Passphrase included in API request body
- [ ] All 4 Playwright tests pass

---

## Phase 2: API Route Validation (Backend Layer)

### Problem
The API route accepts connections without validating passphrase requirements per exchange.

### TDD Approach

#### 2.1 Write Failing Tests First

**File:** `app/tests/api/exchanges.test.ts`

```typescript
import { POST } from '@/app/api/exchanges/route';
import { NextRequest } from 'next/server';

// Test 1: Reject Coinbase without passphrase
test('POST /api/exchanges should reject Coinbase without passphrase', async () => {
  const req = new NextRequest('http://localhost/api/exchanges', {
    method: 'POST',
    body: JSON.stringify({
      exchange: 'coinbase',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      // Missing passphrase
    }),
  });

  const res = await POST(req);
  expect(res.status).toBe(400);

  const body = await res.json();
  expect(body.error).toContain('passphrase');
});

// Test 2: Accept Coinbase with passphrase
test('POST /api/exchanges should accept Coinbase with passphrase', async () => {
  const req = new NextRequest('http://localhost/api/exchanges', {
    method: 'POST',
    body: JSON.stringify({
      exchange: 'coinbase',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      passphrase: 'test-passphrase',
      name: 'My Coinbase',
    }),
  });

  const res = await POST(req);
  expect(res.status).toBe(201);
});

// Test 3: Accept Binance without passphrase
test('POST /api/exchanges should accept Binance without passphrase', async () => {
  const req = new NextRequest('http://localhost/api/exchanges', {
    method: 'POST',
    body: JSON.stringify({
      exchange: 'binance',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      name: 'My Binance',
    }),
  });

  const res = await POST(req);
  expect(res.status).toBe(201);
});

// Test 4: Passphrase encrypted in database
test('POST /api/exchanges should encrypt passphrase', async () => {
  // Mock db to capture encrypted value
  const createSpy = jest.spyOn(db.exchangeConnections, 'create');

  const req = new NextRequest('http://localhost/api/exchanges', {
    method: 'POST',
    body: JSON.stringify({
      exchange: 'coinbase',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      passphrase: 'test-passphrase',
    }),
  });

  await POST(req);

  expect(createSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      encryptedPassphrase: expect.stringMatching(/^[a-zA-Z0-9+/=]+$/), // Base64 pattern
    })
  );
});
```

#### 2.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 2.2.1 | `app/app/api/exchanges/route.ts` | Add EXCHANGES_REQUIRING_PASSPHRASE constant |
| 2.2.2 | `app/app/api/exchanges/route.ts` | Add passphrase validation in POST handler |
| 2.2.3 | `app/app/api/exchanges/route.ts` | Return 400 with clear error message |
| 2.2.4 | `app/lib/db.ts` | Ensure encrypted_passphrase column used |

#### 2.3 Acceptance Criteria

- [ ] Coinbase/KuCoin/OKX rejected without passphrase (400 error)
- [ ] Binance/Kraken/Bybit accepted without passphrase
- [ ] Passphrase encrypted before database storage
- [ ] All 4 API tests pass

---

## Phase 3: Real Connection Testing (Test Connection Flow)

### Problem
`testConnection()` returns mock success without validating credentials against Coinbase API.

### TDD Approach

#### 3.1 Write Failing Tests First

**File:** `src/exchanges/ExchangeService.test.ts` (extend existing)

```typescript
describe('ExchangeService.testConnection', () => {
  // Test 1: Invalid credentials return failure
  test('should return invalid for bad credentials', async () => {
    const connection = await exchangeService.createConnection({
      userId: 'user-1',
      exchange: 'coinbase',
      name: 'Test',
      apiKey: 'invalid-key',
      apiSecret: 'invalid-secret',
      passphrase: 'invalid-passphrase',
    });

    const result = await exchangeService.testConnection(connection.id);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('authentication');
  });

  // Test 2: Valid credentials return success with permissions
  test('should return valid with permissions for good credentials', async () => {
    // Mock Coinbase API response
    mockCoinbaseApi.accounts.mockResolvedValue({ accounts: [] });

    const connection = await exchangeService.createConnection({
      userId: 'user-1',
      exchange: 'coinbase',
      name: 'Test',
      apiKey: process.env.TEST_COINBASE_KEY!,
      apiSecret: process.env.TEST_COINBASE_SECRET!,
      passphrase: process.env.TEST_COINBASE_PASSPHRASE!,
    });

    const result = await exchangeService.testConnection(connection.id);

    expect(result.valid).toBe(true);
    expect(result.permissions).toContain('read');
  });

  // Test 3: Network error marked as retryable
  test('should mark network errors as retryable', async () => {
    mockCoinbaseApi.accounts.mockRejectedValue(new Error('ECONNREFUSED'));

    const connection = await exchangeService.createConnection({...});
    const result = await exchangeService.testConnection(connection.id);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('network');
  });

  // Test 4: Rate limit error marked as retryable
  test('should mark rate limit errors as retryable', async () => {
    mockCoinbaseApi.accounts.mockRejectedValue(new Error('rate limit exceeded'));

    const connection = await exchangeService.createConnection({...});
    const result = await exchangeService.testConnection(connection.id);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('rate');
  });
});
```

**File:** `src/exchanges/adapters/CoinbaseAdapter.test.ts`

```typescript
describe('CoinbaseAdapter.testConnection', () => {
  // Test 1: Calls /accounts endpoint
  test('should call /accounts to verify credentials', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accounts: [] }),
    } as Response);

    const adapter = new CoinbaseAdapter({
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      passphrase: 'test-passphrase',
    });

    await adapter.testConnection();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/accounts'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'CB-ACCESS-KEY': 'test-key',
        }),
      })
    );
  });

  // Test 2: Generates correct signature
  test('should generate valid HMAC-SHA256 signature', async () => {
    const adapter = new CoinbaseAdapter({
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      passphrase: 'test-passphrase',
    });

    // Mock Date.now for consistent timestamps
    jest.spyOn(Date, 'now').mockReturnValue(1704067200000);

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accounts: [] }),
    } as Response);

    await adapter.testConnection();

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers['CB-ACCESS-SIGN']).toBeDefined();
    expect(options.headers['CB-ACCESS-TIMESTAMP']).toBe('1704067200');
  });
});
```

#### 3.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 3.2.1 | `src/exchanges/ExchangeService.ts` | Refactor `testConnection()` to use adapter |
| 3.2.2 | `src/exchanges/ExchangeService.ts` | Add adapter instantiation with decrypted creds |
| 3.2.3 | `src/exchanges/adapters/CoinbaseAdapter.ts` | Implement real `testConnection()` |
| 3.2.4 | `src/exchanges/adapters/CoinbaseAdapter.ts` | Handle API error responses |
| 3.2.5 | `src/exchanges/ExchangeService.ts` | Categorize errors (auth/network/rate_limit) |

#### 3.3 Acceptance Criteria

- [ ] `testConnection()` makes real API call to Coinbase
- [ ] Invalid credentials return `{ valid: false, error: '...' }`
- [ ] Valid credentials return `{ valid: true, permissions: [...] }`
- [ ] Errors categorized correctly (auth, network, rate_limit)
- [ ] All 7 tests pass

---

## Phase 4: Adapter Factory Integration (Service Layer)

### Problem
`ExchangeService` returns simulated data because `adapterFactory` is never provided.

### TDD Approach

#### 4.1 Write Failing Tests First

**File:** `src/exchanges/ExchangeService.adapter.test.ts`

```typescript
describe('ExchangeService with real adapters', () => {
  let exchangeService: ExchangeService;
  let mockCoinbaseAdapter: jest.Mocked<CoinbaseAdapter>;

  beforeEach(() => {
    mockCoinbaseAdapter = {
      getTicker: jest.fn(),
      getBalances: jest.fn(),
      testConnection: jest.fn(),
    } as any;

    exchangeService = new ExchangeService({
      db: mockDb,
      configService,
      encryptionKey: 'test-key-32-characters-long!!',
      adapterFactory: (exchange) => {
        if (exchange === 'coinbase') return mockCoinbaseAdapter;
        throw new Error(`No adapter for ${exchange}`);
      },
    });
  });

  // Test 1: getTicker uses real adapter
  test('getTicker should use CoinbaseAdapter for coinbase connections', async () => {
    mockCoinbaseAdapter.getTicker.mockResolvedValue({
      symbol: 'BTC/USD',
      price: 45000,
      bid: 44990,
      ask: 45010,
      volume24h: 1000,
      change24h: 500,
      changePercent24h: 1.1,
      high24h: 46000,
      low24h: 44000,
      timestamp: new Date(),
    });

    const connection = await exchangeService.createConnection({
      userId: 'user-1',
      exchange: 'coinbase',
      name: 'Test',
      apiKey: 'key',
      apiSecret: 'secret',
      passphrase: 'pass',
    });

    const ticker = await exchangeService.getTicker(connection.id, 'BTC/USD');

    expect(mockCoinbaseAdapter.getTicker).toHaveBeenCalled();
    expect(ticker.price).toBe(45000);
  });

  // Test 2: getBalance uses real adapter
  test('getBalance should return real Coinbase balances', async () => {
    mockCoinbaseAdapter.getBalances.mockResolvedValue([
      { asset: 'BTC', available: 0.5, locked: 0.1, total: 0.6 },
      { asset: 'USD', available: 10000, locked: 0, total: 10000 },
    ]);

    const connection = await exchangeService.createConnection({...});
    const balance = await exchangeService.getBalance(connection.id);

    expect(mockCoinbaseAdapter.getBalances).toHaveBeenCalled();
    expect(balance.assets).toHaveLength(2);
  });

  // Test 3: Credentials decrypted before passing to adapter
  test('should decrypt credentials before passing to adapter', async () => {
    let receivedCredentials: any;

    const captureAdapter = {
      testConnection: jest.fn().mockImplementation(function(this: any) {
        receivedCredentials = this.credentials;
        return Promise.resolve(true);
      }),
    } as any;

    const service = new ExchangeService({
      ...options,
      adapterFactory: () => captureAdapter,
    });

    const connection = await service.createConnection({
      userId: 'user-1',
      exchange: 'coinbase',
      name: 'Test',
      apiKey: 'my-api-key',
      apiSecret: 'my-api-secret',
      passphrase: 'my-passphrase',
    });

    await service.testConnection(connection.id);

    expect(receivedCredentials.apiKey).toBe('my-api-key');
    expect(receivedCredentials.apiSecret).toBe('my-api-secret');
    expect(receivedCredentials.passphrase).toBe('my-passphrase');
  });
});
```

#### 4.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 4.2.1 | `src/exchanges/adapters/index.ts` | Create adapter factory function |
| 4.2.2 | `src/exchanges/adapters/index.ts` | Export all adapters with type registry |
| 4.2.3 | `src/exchanges/ExchangeService.ts` | Update `getTicker()` to use adapter |
| 4.2.4 | `src/exchanges/ExchangeService.ts` | Update `getBalance()` to use adapter |
| 4.2.5 | `src/exchanges/ExchangeService.ts` | Update `getOrderBook()` to use adapter |
| 4.2.6 | `src/api/server.ts` | Wire adapter factory into service init |

#### 4.3 Acceptance Criteria

- [ ] Adapter factory creates correct adapter per exchange type
- [ ] Credentials decrypted before adapter instantiation
- [ ] Market data methods delegate to adapter
- [ ] Fallback to simulated data if no adapter (dev mode)
- [ ] All 3 integration tests pass

---

## Phase 5: Coinbase Signature Fix (Authentication Layer)

### Problem
The HMAC signature generation may be incorrect for Coinbase Advanced Trade API.

### TDD Approach

#### 5.1 Write Failing Tests First

**File:** `src/exchanges/adapters/CoinbaseAdapter.test.ts`

```typescript
describe('CoinbaseAdapter signature generation', () => {
  // Test 1: Signature matches Coinbase spec
  test('should generate correct signature per Coinbase docs', () => {
    const adapter = new CoinbaseAdapter({
      apiKey: 'test-api-key',
      apiSecret: 'dGVzdC1hcGktc2VjcmV0', // base64 encoded 'test-api-secret'
      passphrase: 'test-passphrase',
    });

    const timestamp = '1704067200';
    const method = 'GET';
    const path = '/api/v3/brokerage/accounts';
    const body = '';

    const signature = adapter['generateSignature'](timestamp, method, path, body);

    // Expected signature calculated manually using Coinbase spec
    const expectedMessage = timestamp + method + path + body;
    const expectedSignature = crypto
      .createHmac('sha256', Buffer.from('dGVzdC1hcGktc2VjcmV0', 'base64'))
      .update(expectedMessage)
      .digest('base64');

    expect(signature).toBe(expectedSignature);
  });

  // Test 2: POST request includes body in signature
  test('should include body in signature for POST requests', async () => {
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

    const [url, options] = fetchSpy.mock.calls[0];
    const body = options.body;

    // Verify signature was calculated with body included
    expect(options.headers['CB-ACCESS-SIGN']).toBeDefined();
    expect(body).toBeTruthy();
  });

  // Test 3: Headers include all required fields
  test('should include all required headers', async () => {
    const adapter = new CoinbaseAdapter({
      apiKey: 'my-key',
      apiSecret: 'my-secret',
      passphrase: 'my-pass',
    });

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ accounts: [] }),
    } as Response);

    await adapter.getBalances();

    const [, options] = fetchSpy.mock.calls[0];

    expect(options.headers).toMatchObject({
      'CB-ACCESS-KEY': 'my-key',
      'CB-ACCESS-SIGN': expect.any(String),
      'CB-ACCESS-TIMESTAMP': expect.any(String),
      'Content-Type': 'application/json',
    });
  });

  // Test 4: Error parsing extracts message
  test('should extract error message from Coinbase response', async () => {
    const adapter = new CoinbaseAdapter({...});

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: 'UNAUTHORIZED',
        message: 'Invalid API key',
        error_details: 'The API key provided is invalid or expired',
      }),
    } as Response);

    await expect(adapter.getBalances()).rejects.toThrow('Invalid API key');
  });
});
```

#### 5.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 5.2.1 | `app/lib/exchanges/coinbase.ts` | Fix signature to use base64 encoding |
| 5.2.2 | `app/lib/exchanges/coinbase.ts` | Handle base64-encoded API secret |
| 5.2.3 | `app/lib/exchanges/coinbase.ts` | Add request timeout (15s) |
| 5.2.4 | `app/lib/exchanges/coinbase.ts` | Improve error message parsing |
| 5.2.5 | `src/exchanges/adapters/CoinbaseAdapter.ts` | Sync signature logic |

#### 5.3 Acceptance Criteria

- [ ] Signature matches Coinbase Advanced Trade API spec
- [ ] POST requests include body in signature calculation
- [ ] All required headers present in requests
- [ ] Errors parsed with meaningful messages
- [ ] All 4 signature tests pass

---

## Phase 6: End-to-End Integration (Full Flow)

### Problem
Need to verify complete flow from UI to Coinbase API works.

### TDD Approach

#### 6.1 Write Failing Tests First

**File:** `app/tests/e2e/coinbase-connection.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Coinbase Exchange Connection E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/sign-in');
    await page.fill('[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  // Test 1: Full connection flow with valid credentials
  test('should connect Coinbase with valid credentials', async ({ page }) => {
    await page.goto('/dashboard/exchanges');
    await page.click('button:has-text("Connect Exchange")');

    // Fill form
    await page.selectOption('[data-testid="exchange-select"]', 'coinbase');
    await page.fill('[data-testid="api-key-input"]', process.env.TEST_COINBASE_KEY!);
    await page.fill('[data-testid="api-secret-input"]', process.env.TEST_COINBASE_SECRET!);
    await page.fill('[data-testid="passphrase-input"]', process.env.TEST_COINBASE_PASSPHRASE!);
    await page.fill('[data-testid="connection-name-input"]', 'E2E Test Account');

    await page.click('button:has-text("Connect")');

    // Verify success
    await expect(page.locator('text=Exchange connected successfully')).toBeVisible();
    await expect(page.locator('text=E2E Test Account')).toBeVisible();
    await expect(page.locator('[data-testid="connection-status-active"]')).toBeVisible();
  });

  // Test 2: Test connection button validates credentials
  test('should test connection and show real status', async ({ page }) => {
    // Assume connection already exists
    await page.goto('/dashboard/exchanges');

    const testButton = page.locator('[data-testid="test-connection-btn"]').first();
    await testButton.click();

    // Should show real test result
    await expect(
      page.locator('text=Exchange connection is working').or(
        page.locator('text=Connection test failed')
      )
    ).toBeVisible({ timeout: 10000 });
  });

  // Test 3: Invalid credentials show meaningful error
  test('should show authentication error for invalid credentials', async ({ page }) => {
    await page.goto('/dashboard/exchanges');
    await page.click('button:has-text("Connect Exchange")');

    await page.selectOption('[data-testid="exchange-select"]', 'coinbase');
    await page.fill('[data-testid="api-key-input"]', 'invalid-key');
    await page.fill('[data-testid="api-secret-input"]', 'invalid-secret');
    await page.fill('[data-testid="passphrase-input"]', 'invalid-pass');

    await page.click('button:has-text("Connect")');

    // Should show auth error, not generic error
    await expect(
      page.locator('text=/authentication|invalid|unauthorized/i')
    ).toBeVisible({ timeout: 10000 });
  });

  // Test 4: Market data loads from real Coinbase
  test('should fetch real market data from Coinbase', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for market data to load
    await page.waitForResponse((res) =>
      res.url().includes('/api/') && res.url().includes('ticker')
    );

    // Verify real prices (not simulated round numbers)
    const priceElement = page.locator('[data-testid="btc-price"]');
    const priceText = await priceElement.textContent();
    const price = parseFloat(priceText!.replace(/[$,]/g, ''));

    // Real BTC price should be between $20k and $200k (reasonable range)
    expect(price).toBeGreaterThan(20000);
    expect(price).toBeLessThan(200000);
  });
});
```

#### 6.2 Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 6.2.1 | `app/playwright.config.ts` | Configure E2E test environment |
| 6.2.2 | `.env.test` | Add test credentials (encrypted) |
| 6.2.3 | All components | Add data-testid attributes |
| 6.2.4 | `app/tests/e2e/setup.ts` | Create test user setup script |
| 6.2.5 | `package.json` | Add E2E test scripts |

#### 6.3 Acceptance Criteria

- [ ] Full connection flow works with real Coinbase credentials
- [ ] Test connection validates real credentials
- [ ] Invalid credentials show meaningful errors
- [ ] Market data displays real prices
- [ ] All 4 E2E tests pass

---

## Test Summary

| Phase | Unit Tests | Integration Tests | E2E Tests | Total |
|-------|------------|-------------------|-----------|-------|
| Phase 1: UI Passphrase | 4 | - | - | 4 |
| Phase 2: API Validation | 4 | - | - | 4 |
| Phase 3: Test Connection | 7 | - | - | 7 |
| Phase 4: Adapter Factory | - | 3 | - | 3 |
| Phase 5: Signature Fix | 4 | - | - | 4 |
| Phase 6: E2E Integration | - | - | 4 | 4 |
| **Total** | **19** | **3** | **4** | **26** |

Plus existing tests that must continue passing: ~60 tests

---

## Execution Order

```
Phase 1 ─────────────────────────────────┐
                                         │
Phase 2 ─────────────────────────────────┼──► Phase 4 ──► Phase 6
                                         │
Phase 3 ─────────────────────────────────┤
                                         │
Phase 5 ─────────────────────────────────┘
```

**Parallel execution possible:**
- Phases 1, 2, 3, 5 can run in parallel (independent)
- Phase 4 depends on Phase 3 and 5
- Phase 6 depends on all previous phases

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Coinbase API changes | Pin to specific API version, monitor deprecation notices |
| Rate limiting during tests | Use test account with higher limits, implement retry logic |
| Credential exposure | Use encrypted env vars, never commit real keys |
| Flaky E2E tests | Add retries, use test isolation, mock network calls |

---

## Success Metrics

1. **All 26 new tests pass** (Red → Green)
2. **Existing 60+ tests still pass** (No regression)
3. **Coinbase connection works in production** with real credentials
4. **Error messages are user-friendly** and actionable
5. **Test connection shows real validation status**

---

## Next Steps

1. Review and approve this plan
2. Set up test credentials (Coinbase sandbox/test account)
3. Begin Phase 1 (UI) and Phase 5 (Signature) in parallel
4. Daily test runs to catch regressions
