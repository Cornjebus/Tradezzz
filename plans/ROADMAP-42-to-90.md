# TradeZZZ: Roadmap from 42/100 to 90/100

## TDD-First Development Plan

**Current Score:** 42/100
**Target Score:** 90/100
**Methodology:** Test-Driven Development (Red → Green → Refactor)

---

## Score Breakdown: Current vs Target

| Category | Current | Target | Delta | Priority |
|----------|---------|--------|-------|----------|
| Core Architecture | 15/20 | 18/20 | +3 | Medium |
| User Experience | 6/20 | 18/20 | +12 | **CRITICAL** |
| Feature Completeness | 8/20 | 18/20 | +10 | **HIGH** |
| Code Quality | 8/15 | 13/15 | +5 | Medium |
| Testing | 3/10 | 9/10 | +6 | **HIGH** |
| Security | 2/10 | 9/10 | +7 | **HIGH** |
| Documentation | 0/5 | 5/5 | +5 | Medium |
| **TOTAL** | **42/100** | **90/100** | **+48** | |

---

## Phase Overview

```
Phase 1: Anonymous Explore     [UX +4]  [Features +2]  = +6 points
Phase 2: Paper Trading Engine  [UX +4]  [Features +4]  = +8 points
Phase 3: AI Optional Flow      [UX +2]  [Features +2]  = +4 points
Phase 4: Multi-Strategy        [UX +2]  [Features +2]  = +4 points
Phase 5: Code Quality          [Arch +3] [Quality +5] [Security +7] = +15 points
Phase 6: Testing & Docs        [Testing +6] [Docs +5] = +11 points
                                                        ─────────
                                               TOTAL:   +48 points
```

---

# PHASE 1: Anonymous Explore Mode
**Score Impact:** +6 points (UX +4, Features +2)
**Duration:** ~2-3 days

## Goal
Allow users to see live prices, charts, and order books WITHOUT signing up.

## User Story
> As a visitor, I want to see real crypto prices and explore the platform before creating an account, so I can evaluate if this tool is worth my time.

## TDD Test Cases (Write First)

### 1.1 Public Market Data API Tests
```typescript
// src/api/routes/__tests__/public-market.test.ts

describe('Public Market API', () => {
  describe('GET /api/public/prices', () => {
    it('should return prices without authentication', async () => {
      const response = await request(app).get('/api/public/prices');
      expect(response.status).toBe(200);
      expect(response.body.prices).toBeInstanceOf(Array);
      expect(response.body.prices[0]).toHaveProperty('symbol');
      expect(response.body.prices[0]).toHaveProperty('price');
      expect(response.body.prices[0]).toHaveProperty('change24h');
    });

    it('should return at least BTC, ETH, SOL prices', async () => {
      const response = await request(app).get('/api/public/prices');
      const symbols = response.body.prices.map(p => p.symbol);
      expect(symbols).toContain('BTC/USD');
      expect(symbols).toContain('ETH/USD');
    });

    it('should cache prices for 5 seconds', async () => {
      // First call
      const first = await request(app).get('/api/public/prices');
      // Second call within 5s
      const second = await request(app).get('/api/public/prices');
      expect(first.body.timestamp).toBe(second.body.timestamp);
    });
  });

  describe('GET /api/public/orderbook/:symbol', () => {
    it('should return order book without authentication', async () => {
      const response = await request(app).get('/api/public/orderbook/BTC-USD');
      expect(response.status).toBe(200);
      expect(response.body.bids).toBeInstanceOf(Array);
      expect(response.body.asks).toBeInstanceOf(Array);
    });

    it('should return 404 for invalid symbol', async () => {
      const response = await request(app).get('/api/public/orderbook/INVALID');
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/public/candles/:symbol', () => {
    it('should return OHLCV data without authentication', async () => {
      const response = await request(app)
        .get('/api/public/candles/BTC-USD')
        .query({ timeframe: '1h', limit: 24 });
      expect(response.status).toBe(200);
      expect(response.body.candles).toHaveLength(24);
      expect(response.body.candles[0]).toHaveProperty('open');
      expect(response.body.candles[0]).toHaveProperty('high');
      expect(response.body.candles[0]).toHaveProperty('low');
      expect(response.body.candles[0]).toHaveProperty('close');
      expect(response.body.candles[0]).toHaveProperty('volume');
    });
  });

  describe('GET /api/public/symbols', () => {
    it('should return available trading symbols', async () => {
      const response = await request(app).get('/api/public/symbols');
      expect(response.status).toBe(200);
      expect(response.body.symbols.length).toBeGreaterThan(10);
    });
  });
});
```

### 1.2 Explore Page Component Tests
```typescript
// app/app/explore/__tests__/page.test.tsx

describe('Explore Page', () => {
  it('should render without authentication', () => {
    render(<ExplorePage />);
    expect(screen.getByText(/Live Prices/i)).toBeInTheDocument();
  });

  it('should display price ticker for multiple coins', async () => {
    render(<ExplorePage />);
    await waitFor(() => {
      expect(screen.getByText('BTC/USD')).toBeInTheDocument();
      expect(screen.getByText('ETH/USD')).toBeInTheDocument();
    });
  });

  it('should show price chart when coin is selected', async () => {
    render(<ExplorePage />);
    fireEvent.click(screen.getByText('BTC/USD'));
    await waitFor(() => {
      expect(screen.getByTestId('price-chart')).toBeInTheDocument();
    });
  });

  it('should show order book for selected coin', async () => {
    render(<ExplorePage />);
    fireEvent.click(screen.getByText('BTC/USD'));
    await waitFor(() => {
      expect(screen.getByTestId('order-book')).toBeInTheDocument();
    });
  });

  it('should prompt sign up when trying to trade', async () => {
    render(<ExplorePage />);
    fireEvent.click(screen.getByText(/Paper Trade/i));
    expect(screen.getByText(/Sign up to start trading/i)).toBeInTheDocument();
  });

  it('should auto-refresh prices every 5 seconds', async () => {
    jest.useFakeTimers();
    render(<ExplorePage />);
    const initialPrice = screen.getByTestId('btc-price').textContent;
    jest.advanceTimersByTime(5000);
    await waitFor(() => {
      // Price should have been fetched again
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
```

### 1.3 Landing Page Modification Tests
```typescript
// app/app/__tests__/page.test.tsx

describe('Landing Page', () => {
  it('should NOT redirect authenticated users away from explore', async () => {
    // Even logged in users can see explore
    const response = await request(app).get('/explore');
    expect(response.status).toBe(200);
  });

  it('should show "Explore Live Prices" CTA', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Explore Live Prices/i)).toBeInTheDocument();
  });

  it('should link to /explore not /sign-in for primary action', () => {
    render(<LandingPage />);
    const exploreButton = screen.getByRole('link', { name: /Explore/i });
    expect(exploreButton).toHaveAttribute('href', '/explore');
  });
});
```

## Implementation Files

```
src/api/routes/public-market.ts     # Public API endpoints
app/app/explore/page.tsx            # Explore page component
app/app/explore/components/         # Explore UI components
  ├── PriceTicker.tsx
  ├── PriceChart.tsx
  ├── OrderBookDisplay.tsx
  └── CoinSelector.tsx
app/app/page.tsx                    # Updated landing page
```

## Deliverables Checklist

- [ ] **Test Suite:** 15+ tests for public market API
- [ ] **API Endpoints:**
  - [ ] `GET /api/public/prices` - Live prices (no auth)
  - [ ] `GET /api/public/orderbook/:symbol` - Order book (no auth)
  - [ ] `GET /api/public/candles/:symbol` - OHLCV data (no auth)
  - [ ] `GET /api/public/symbols` - Available symbols (no auth)
- [ ] **UI Components:**
  - [ ] `/explore` page accessible without login
  - [ ] Live price ticker with 5s refresh
  - [ ] Interactive price chart (TradingView lightweight)
  - [ ] Order book visualization
  - [ ] "Sign up to trade" CTA (not wall)
- [ ] **Landing Page Updates:**
  - [ ] "Explore Live Prices" button
  - [ ] Remove immediate sign-in redirect
  - [ ] Show mini price preview on landing

## Acceptance Criteria

1. User can visit `/explore` without signing in
2. Prices update every 5 seconds
3. Order book shows real bids/asks
4. Charts show 24h of data
5. "Paper Trade" button prompts sign-up (not blocks)
6. All 15+ tests pass

---

# PHASE 2: Exchange-Free Paper Trading
**Score Impact:** +8 points (UX +4, Features +4)
**Duration:** ~3-4 days

## Goal
Enable paper trading with simulated exchange using real market data, without requiring API keys.

## User Story
> As a new user, I want to practice trading with fake money and real prices, so I can learn without risking my exchange API keys.

## TDD Test Cases (Write First)

### 2.1 Mock Exchange Adapter Tests
```typescript
// src/exchanges/adapters/__tests__/MockExchangeAdapter.test.ts

describe('MockExchangeAdapter', () => {
  let adapter: MockExchangeAdapter;
  let ctx: ExchangeAdapterContext;

  beforeEach(() => {
    adapter = new MockExchangeAdapter({
      initialBalance: { USD: 10000, BTC: 0, ETH: 0 }
    });
    ctx = { connectionId: 'mock', userId: 'user1', exchange: 'mock' };
  });

  describe('getBalance', () => {
    it('should return initial balance', async () => {
      const balance = await adapter.getBalance(ctx);
      expect(balance.free['USD']).toBe(10000);
      expect(balance.free['BTC']).toBe(0);
    });
  });

  describe('getTicker', () => {
    it('should fetch real prices from Coinbase public API', async () => {
      const ticker = await adapter.getTicker(ctx, 'BTC/USD');
      expect(ticker.price).toBeGreaterThan(0);
      expect(ticker.bid).toBeGreaterThan(0);
      expect(ticker.ask).toBeGreaterThan(0);
    });
  });

  describe('createOrder', () => {
    it('should execute market buy and update balance', async () => {
      const result = await adapter.createOrder(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();

      const balance = await adapter.getBalance(ctx);
      expect(balance.free['BTC']).toBe(0.1);
      expect(balance.free['USD']).toBeLessThan(10000);
    });

    it('should reject order with insufficient balance', async () => {
      const result = await adapter.createOrder(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 1000 // Way too much
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient');
    });

    it('should execute limit order when price is reached', async () => {
      // Set limit buy below current price
      const ticker = await adapter.getTicker(ctx, 'BTC/USD');
      const limitPrice = ticker.price * 0.95;

      const result = await adapter.createOrder(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: limitPrice
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
    });

    it('should track order history', async () => {
      await adapter.createOrder(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });

      const orders = await adapter.getOrderHistory(ctx);
      expect(orders).toHaveLength(1);
      expect(orders[0].symbol).toBe('BTC/USD');
    });
  });

  describe('positions', () => {
    it('should track open positions after buy', async () => {
      await adapter.createOrder(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });

      const positions = await adapter.getPositions(ctx);
      expect(positions).toHaveLength(1);
      expect(positions[0].symbol).toBe('BTC/USD');
      expect(positions[0].quantity).toBe(0.1);
    });

    it('should calculate unrealized PnL', async () => {
      await adapter.createOrder(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });

      const positions = await adapter.getPositions(ctx);
      expect(positions[0].unrealizedPnl).toBeDefined();
    });

    it('should close position on sell', async () => {
      await adapter.createOrder(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });

      await adapter.createOrder(ctx, {
        symbol: 'BTC/USD',
        side: 'sell',
        type: 'market',
        quantity: 0.1
      });

      const positions = await adapter.getPositions(ctx);
      expect(positions).toHaveLength(0);
    });
  });

  describe('persistence', () => {
    it('should persist state to database', async () => {
      await adapter.createOrder(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });

      // Create new adapter instance for same user
      const newAdapter = new MockExchangeAdapter({});
      await newAdapter.loadState(ctx.userId);

      const balance = await newAdapter.getBalance(ctx);
      expect(balance.free['BTC']).toBe(0.1);
    });
  });
});
```

### 2.2 Paper Trading Service Tests
```typescript
// src/trading/__tests__/PaperTradingService.test.ts

describe('PaperTradingService', () => {
  let service: PaperTradingService;

  beforeEach(async () => {
    service = new PaperTradingService();
  });

  describe('createPaperAccount', () => {
    it('should create account with $10,000 starting balance', async () => {
      const account = await service.createPaperAccount('user1');
      expect(account.balance.USD).toBe(10000);
      expect(account.id).toBeDefined();
    });

    it('should not create duplicate accounts', async () => {
      await service.createPaperAccount('user1');
      await expect(service.createPaperAccount('user1'))
        .rejects.toThrow('Account exists');
    });
  });

  describe('executeTrade', () => {
    it('should execute trade against real market prices', async () => {
      await service.createPaperAccount('user1');

      const trade = await service.executeTrade('user1', {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 0.01
      });

      expect(trade.success).toBe(true);
      expect(trade.executedPrice).toBeGreaterThan(0);
      expect(trade.mode).toBe('paper');
    });
  });

  describe('getPortfolioValue', () => {
    it('should calculate total portfolio value in USD', async () => {
      await service.createPaperAccount('user1');
      await service.executeTrade('user1', {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });

      const value = await service.getPortfolioValue('user1');
      expect(value.total).toBeGreaterThan(0);
      expect(value.positions).toHaveLength(1);
    });
  });
});
```

### 2.3 Dashboard Paper Trading UI Tests
```typescript
// app/app/dashboard/__tests__/paper-trading.test.tsx

describe('Dashboard Paper Trading', () => {
  it('should allow trading without exchange connection', async () => {
    // User has no exchanges connected
    mockApiResponse('/api/exchanges', { exchanges: [] });

    render(<DashboardPage />);

    // Should NOT show "Connect Exchange" as blocker
    expect(screen.queryByText(/Connect Exchange to start/i)).not.toBeInTheDocument();

    // Should show paper trading panel
    expect(screen.getByText(/Paper Trading/i)).toBeInTheDocument();
  });

  it('should show paper balance of $10,000 for new users', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    });
  });

  it('should execute paper trade and update balance', async () => {
    render(<DashboardPage />);

    // Fill trade form
    fireEvent.change(screen.getByLabelText(/Quantity/i), { target: { value: '0.01' } });
    fireEvent.click(screen.getByText(/Buy/i));

    await waitFor(() => {
      expect(screen.getByText(/PAPER/i)).toBeInTheDocument();
      expect(screen.getByText(/BUY 0.01 BTC/i)).toBeInTheDocument();
    });
  });

  it('should show "Go Live" prompt after successful paper trades', async () => {
    // Simulate 5 successful paper trades
    mockPaperTradeHistory(5);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to trade with real money/i)).toBeInTheDocument();
      expect(screen.getByText(/Connect Exchange/i)).toBeInTheDocument();
    });
  });
});
```

## Implementation Files

```
src/exchanges/adapters/MockExchangeAdapter.ts   # Simulated exchange
src/trading/PaperTradingService.ts              # Paper trading logic
src/database/repositories/PaperAccountRepo.ts   # Persistence
app/app/dashboard/components/
  ├── PaperTradingPanel.tsx                     # Paper trade UI
  ├── PaperBalance.tsx                          # Virtual balance display
  └── GoLivePrompt.tsx                          # Upgrade prompt
```

## Database Schema Additions

```sql
-- Paper trading accounts
CREATE TABLE paper_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance JSONB NOT NULL DEFAULT '{"USD": 10000}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Paper trades
CREATE TABLE paper_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paper_account_id UUID NOT NULL REFERENCES paper_accounts(id),
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
  type VARCHAR(10) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  fee DECIMAL(20, 8) DEFAULT 0,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Paper positions
CREATE TABLE paper_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paper_account_id UUID NOT NULL REFERENCES paper_accounts(id),
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(5) NOT NULL CHECK (side IN ('long', 'short')),
  quantity DECIMAL(20, 8) NOT NULL,
  entry_price DECIMAL(20, 8) NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(paper_account_id, symbol)
);
```

## Deliverables Checklist

- [ ] **Test Suite:** 25+ tests for paper trading
- [ ] **MockExchangeAdapter:**
  - [ ] Uses real Coinbase public prices
  - [ ] Simulates order execution
  - [ ] Tracks positions and PnL
  - [ ] Persists state per user
- [ ] **PaperTradingService:**
  - [ ] Creates accounts with $10k
  - [ ] Executes trades
  - [ ] Calculates portfolio value
- [ ] **Database:**
  - [ ] paper_accounts table
  - [ ] paper_trades table
  - [ ] paper_positions table
  - [ ] Migration file
- [ ] **UI:**
  - [ ] Paper trading works without exchange
  - [ ] Shows virtual balance
  - [ ] "Go Live" prompt after 5 trades

## Acceptance Criteria

1. New user can paper trade immediately (no exchange)
2. Paper balance starts at $10,000
3. Trades execute at real market prices
4. Positions and PnL are tracked
5. State persists across sessions
6. All 25+ tests pass

---

# PHASE 3: AI as Optional Enhancement
**Score Impact:** +4 points (UX +2, Features +2)
**Duration:** ~2 days

## Goal
Restructure AI from "required step" to "optional enhancement" that improves trading.

## User Story
> As a trader, I want to trade manually first and add AI assistance later if I choose, so I don't feel forced into using AI.

## TDD Test Cases (Write First)

### 3.1 Manual Strategy Tests
```typescript
// src/strategies/__tests__/ManualStrategy.test.ts

describe('ManualStrategy', () => {
  it('should create strategy without AI provider', async () => {
    const strategy = await strategyService.create({
      userId: 'user1',
      name: 'My BTC Strategy',
      type: 'manual',
      config: {
        symbol: 'BTC/USD',
        entryRules: [{ type: 'price_below', value: 50000 }],
        exitRules: [{ type: 'take_profit', percent: 10 }]
      }
      // NO aiProviderId required!
    });

    expect(strategy.id).toBeDefined();
    expect(strategy.aiProviderId).toBeNull();
    expect(strategy.type).toBe('manual');
  });

  it('should execute manual strategy without AI', async () => {
    const strategy = await strategyService.create({
      userId: 'user1',
      name: 'Simple DCA',
      type: 'manual',
      config: {
        symbol: 'BTC/USD',
        action: 'buy',
        amount: 100, // $100 per execution
        frequency: 'daily'
      }
    });

    const execution = await strategyService.execute(strategy.id);
    expect(execution.success).toBe(true);
    expect(execution.aiUsed).toBe(false);
  });
});
```

### 3.2 AI Enhancement Tests
```typescript
// src/strategies/__tests__/AIEnhancement.test.ts

describe('AI Strategy Enhancement', () => {
  it('should enhance existing manual strategy with AI', async () => {
    // Create manual strategy first
    const manual = await strategyService.create({
      userId: 'user1',
      name: 'BTC Momentum',
      type: 'manual',
      config: { symbol: 'BTC/USD' }
    });

    // Later, add AI enhancement
    const enhanced = await strategyService.addAIEnhancement(manual.id, {
      aiProviderId: 'provider1',
      features: ['sentiment_analysis', 'entry_optimization']
    });

    expect(enhanced.aiProviderId).toBe('provider1');
    expect(enhanced.aiFeatures).toContain('sentiment_analysis');
  });

  it('should work without AI if provider fails', async () => {
    const strategy = await strategyService.create({
      userId: 'user1',
      name: 'Resilient Strategy',
      type: 'ai_enhanced',
      aiProviderId: 'failing_provider',
      config: { symbol: 'BTC/USD' }
    });

    // AI provider fails
    mockAIProviderFailure('failing_provider');

    // Strategy should still execute with fallback
    const execution = await strategyService.execute(strategy.id);
    expect(execution.success).toBe(true);
    expect(execution.aiUsed).toBe(false);
    expect(execution.fallbackReason).toBe('AI provider unavailable');
  });
});
```

### 3.3 Dashboard AI Section Tests
```typescript
// app/app/dashboard/__tests__/ai-optional.test.tsx

describe('Dashboard AI Optional', () => {
  it('should NOT show AI as required step', () => {
    render(<GettingStartedSection />);

    // AI should be in "Enhance" section, not "Required"
    expect(screen.queryByText(/Required.*AI/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Enhance with AI/i)).toBeInTheDocument();
  });

  it('should show AI benefits without being pushy', () => {
    render(<AIEnhancementCard />);

    expect(screen.getByText(/Optional/i)).toBeInTheDocument();
    expect(screen.getByText(/Get smarter entry points/i)).toBeInTheDocument();
    expect(screen.queryByText(/Required/i)).not.toBeInTheDocument();
  });

  it('should show strategies working without AI', async () => {
    // User has strategies but no AI
    mockApiResponse('/api/strategies', { strategies: [{ id: '1', aiProviderId: null }] });
    mockApiResponse('/api/ai-providers', { providers: [] });

    render(<DashboardPage />);

    await waitFor(() => {
      // Should show strategy is active, not "needs AI"
      expect(screen.getByText(/1 Active Strategy/i)).toBeInTheDocument();
      expect(screen.queryByText(/Add AI to activate/i)).not.toBeInTheDocument();
    });
  });
});
```

## Implementation Changes

```
src/strategies/StrategyService.ts       # Allow null aiProviderId
src/strategies/ManualStrategyExecutor.ts # Execute without AI
app/app/dashboard/components/
  ├── GettingStarted.tsx                # Reorder steps
  └── AIEnhancementCard.tsx             # Optional AI prompt
```

## Deliverables Checklist

- [ ] **Test Suite:** 15+ tests for manual strategies
- [ ] **Strategy Service:**
  - [ ] Create strategies without AI
  - [ ] Execute strategies without AI
  - [ ] Add AI enhancement to existing strategy
  - [ ] Graceful fallback when AI fails
- [ ] **UI Reorder:**
  - [ ] Step 1: Paper Trade (no requirements)
  - [ ] Step 2: Create Strategy (optional AI)
  - [ ] Step 3: Connect Exchange (for live)
  - [ ] Step 4: Enhance with AI (optional)
- [ ] **AI Enhancement Card:**
  - [ ] Shows benefits
  - [ ] Clearly marked "Optional"
  - [ ] Easy to skip

## Acceptance Criteria

1. Users can create and run strategies without AI
2. AI is presented as enhancement, not requirement
3. Strategies continue working if AI fails
4. "Getting Started" reordered correctly
5. All 15+ tests pass

---

# PHASE 4: Multi-Strategy Support
**Score Impact:** +4 points (UX +2, Features +2)
**Duration:** ~2-3 days

## Goal
Allow users to run multiple strategies on the same trading pair simultaneously.

## User Story
> As an advanced trader, I want to run both a momentum strategy and a DCA strategy on BTC at the same time, so I can diversify my approach.

## TDD Test Cases (Write First)

### 4.1 Multi-Strategy Engine Tests
```typescript
// src/strategies/__tests__/MultiStrategyEngine.test.ts

describe('MultiStrategyEngine', () => {
  it('should run multiple strategies on same symbol', async () => {
    const momentum = await strategyService.create({
      userId: 'user1',
      name: 'BTC Momentum',
      symbol: 'BTC/USD',
      type: 'momentum'
    });

    const dca = await strategyService.create({
      userId: 'user1',
      name: 'BTC DCA',
      symbol: 'BTC/USD',
      type: 'dca'
    });

    // Both should be active
    const activeStrategies = await strategyService.getActiveBySymbol('user1', 'BTC/USD');
    expect(activeStrategies).toHaveLength(2);
  });

  it('should track PnL per strategy independently', async () => {
    const s1 = await createAndExecuteStrategy('user1', 'BTC/USD', 'momentum');
    const s2 = await createAndExecuteStrategy('user1', 'BTC/USD', 'mean_reversion');

    const pnl1 = await strategyService.getPnL(s1.id);
    const pnl2 = await strategyService.getPnL(s2.id);

    // PnL should be independent
    expect(pnl1).not.toBe(pnl2);
  });

  it('should allocate capital per strategy', async () => {
    const s1 = await strategyService.create({
      userId: 'user1',
      symbol: 'BTC/USD',
      capitalAllocation: 5000 // $5k for this strategy
    });

    const s2 = await strategyService.create({
      userId: 'user1',
      symbol: 'BTC/USD',
      capitalAllocation: 3000 // $3k for this strategy
    });

    // Total allocated should not exceed balance
    const totalAllocated = await strategyService.getTotalAllocated('user1');
    expect(totalAllocated).toBe(8000);
  });

  it('should prevent over-allocation', async () => {
    // User has $10k paper balance
    await strategyService.create({
      userId: 'user1',
      symbol: 'BTC/USD',
      capitalAllocation: 8000
    });

    await expect(
      strategyService.create({
        userId: 'user1',
        symbol: 'BTC/USD',
        capitalAllocation: 5000 // Would exceed $10k
      })
    ).rejects.toThrow(/Insufficient capital/);
  });

  it('should aggregate positions across strategies', async () => {
    // Strategy 1 buys 0.1 BTC
    // Strategy 2 buys 0.05 BTC
    // Total position should be 0.15 BTC

    const positions = await strategyService.getAggregatedPositions('user1');
    expect(positions['BTC/USD'].totalQuantity).toBe(0.15);
    expect(positions['BTC/USD'].strategies).toHaveLength(2);
  });
});
```

### 4.2 Multi-Strategy UI Tests
```typescript
// app/app/dashboard/strategies/__tests__/multi-strategy.test.tsx

describe('Multi-Strategy UI', () => {
  it('should show strategies grouped by symbol', async () => {
    mockApiResponse('/api/strategies', {
      strategies: [
        { id: '1', name: 'BTC Momentum', symbol: 'BTC/USD' },
        { id: '2', name: 'BTC DCA', symbol: 'BTC/USD' },
        { id: '3', name: 'ETH Swing', symbol: 'ETH/USD' }
      ]
    });

    render(<StrategiesPage />);

    await waitFor(() => {
      // Should have grouped view
      expect(screen.getByText('BTC/USD')).toBeInTheDocument();
      expect(screen.getByText('2 strategies')).toBeInTheDocument();
      expect(screen.getByText('ETH/USD')).toBeInTheDocument();
      expect(screen.getByText('1 strategy')).toBeInTheDocument();
    });
  });

  it('should show combined PnL for symbol', async () => {
    render(<SymbolStrategyGroup symbol="BTC/USD" />);

    await waitFor(() => {
      expect(screen.getByText(/Combined P&L/i)).toBeInTheDocument();
      expect(screen.getByTestId('combined-pnl')).toBeInTheDocument();
    });
  });

  it('should allow creating strategy for same symbol', async () => {
    // User already has BTC strategy
    mockApiResponse('/api/strategies', {
      strategies: [{ symbol: 'BTC/USD' }]
    });

    render(<CreateStrategyPage />);

    // Select BTC/USD
    fireEvent.change(screen.getByLabelText(/Symbol/i), { target: { value: 'BTC/USD' } });

    // Should NOT show warning, should allow it
    expect(screen.queryByText(/already have a strategy/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Add Another Strategy/i)).toBeInTheDocument();
  });

  it('should show capital allocation breakdown', async () => {
    render(<StrategyDetailPage strategyId="1" />);

    await waitFor(() => {
      expect(screen.getByText(/Capital Allocated/i)).toBeInTheDocument();
      expect(screen.getByText('$5,000')).toBeInTheDocument();
      expect(screen.getByText(/of \$10,000 total/i)).toBeInTheDocument();
    });
  });
});
```

## Implementation Files

```
src/strategies/MultiStrategyEngine.ts           # Multi-strategy execution
src/strategies/CapitalAllocationService.ts      # Capital management
app/app/dashboard/strategies/
  ├── SymbolStrategyGroup.tsx                   # Grouped view
  ├── CombinedPnL.tsx                           # Aggregated metrics
  └── CapitalAllocationWidget.tsx               # Allocation UI
```

## Database Changes

```sql
-- Add capital allocation to strategies
ALTER TABLE strategies
ADD COLUMN capital_allocation DECIMAL(20, 2),
ADD COLUMN max_position_size DECIMAL(20, 8);

-- Strategy performance tracking per strategy
CREATE TABLE strategy_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES strategies(id),
  date DATE NOT NULL,
  pnl DECIMAL(20, 8) NOT NULL,
  trades_count INT DEFAULT 0,
  win_rate DECIMAL(5, 2),
  UNIQUE(strategy_id, date)
);
```

## Deliverables Checklist

- [ ] **Test Suite:** 20+ tests for multi-strategy
- [ ] **MultiStrategyEngine:**
  - [ ] Run multiple strategies per symbol
  - [ ] Track PnL independently
  - [ ] Aggregate positions
  - [ ] Capital allocation per strategy
- [ ] **UI:**
  - [ ] Strategies grouped by symbol
  - [ ] Combined PnL view
  - [ ] Capital allocation breakdown
  - [ ] "Add Another Strategy" flow

## Acceptance Criteria

1. Multiple strategies can run on same coin
2. PnL tracked per strategy
3. UI shows grouped view
4. Capital allocation prevents over-leveraging
5. All 20+ tests pass

---

# PHASE 5: Code Quality & Security
**Score Impact:** +15 points (Arch +3, Quality +5, Security +7)
**Duration:** ~3-4 days

## Goal
Harden the codebase with proper typing, error handling, and security measures.

## TDD Test Cases (Write First)

### 5.1 Type Safety Tests
```typescript
// src/__tests__/type-safety.test.ts

describe('Type Safety', () => {
  it('should compile with strict TypeScript', () => {
    // This test passes if compilation succeeds
    // tsconfig.json should have "strict": true
    expect(true).toBe(true);
  });

  it('should have no any types in service layer', () => {
    const serviceFiles = glob.sync('src/**/*Service.ts');
    for (const file of serviceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const anyCount = (content.match(/: any/g) || []).length;
      expect(anyCount).toBe(0);
    }
  });
});
```

### 5.2 Security Tests
```typescript
// src/__tests__/security.test.ts

describe('Security', () => {
  describe('Encryption', () => {
    it('should use environment encryption key, not default', () => {
      expect(process.env.ENCRYPTION_KEY).toBeDefined();
      expect(process.env.ENCRYPTION_KEY).not.toBe('default-key');
    });

    it('should encrypt API keys before storage', async () => {
      const rawKey = 'sk_test_123456789';
      const encrypted = await encryptionService.encrypt(rawKey);

      expect(encrypted).not.toBe(rawKey);
      expect(encrypted).not.toContain('sk_');
    });

    it('should not log API keys', async () => {
      const logSpy = jest.spyOn(console, 'error');

      try {
        await exchangeService.connect({
          apiKey: 'sk_secret_key',
          apiSecret: 'secret'
        });
      } catch {}

      const logs = logSpy.mock.calls.flat().join(' ');
      expect(logs).not.toContain('sk_secret_key');
      expect(logs).not.toContain('secret');
    });
  });

  describe('Input Validation', () => {
    it('should validate all API inputs with Zod', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({ invalid: 'data' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('validation');
    });

    it('should prevent SQL injection', async () => {
      const response = await request(app)
        .get('/api/strategies')
        .query({ name: "'; DROP TABLE strategies; --" });

      // Should not error, should just return empty
      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit API requests', async () => {
      const requests = Array(101).fill(null).map(() =>
        request(app).get('/api/prices')
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('CORS', () => {
    it('should only allow configured origins', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'https://evil-site.com');

      expect(response.headers['access-control-allow-origin']).not.toBe('https://evil-site.com');
    });
  });
});
```

### 5.3 Error Handling Tests
```typescript
// src/__tests__/error-handling.test.ts

describe('Error Handling', () => {
  it('should return consistent error format', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send({});

    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('code');
    expect(response.body).toHaveProperty('details');
  });

  it('should not leak internal errors to client', async () => {
    // Cause internal error
    mockDatabaseFailure();

    const response = await request(app).get('/api/strategies');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal server error');
    expect(response.body).not.toHaveProperty('stack');
    expect(response.body.details).not.toContain('postgres');
  });

  it('should log errors with context', async () => {
    const logSpy = jest.spyOn(logger, 'error');
    mockDatabaseFailure();

    await request(app).get('/api/strategies');

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        requestId: expect.any(String),
        userId: expect.any(String)
      })
    );
  });
});
```

## Implementation Files

```
src/middleware/
  ├── validation.ts         # Zod validation middleware
  ├── rateLimiter.ts        # Rate limiting
  ├── errorHandler.ts       # Consistent error responses
  └── sanitizer.ts          # Input sanitization
src/security/
  ├── EncryptionService.ts  # Updated encryption
  └── AuditLogger.ts        # Security audit logging
src/config/
  └── cors.ts               # CORS configuration
```

## Deliverables Checklist

- [ ] **Type Safety:**
  - [ ] Enable `strict: true` in tsconfig
  - [ ] Remove all `any` types from services
  - [ ] Add proper generics to repositories
- [ ] **Security:**
  - [ ] Environment-based encryption key
  - [ ] API key sanitization in logs
  - [ ] Input validation on all endpoints
  - [ ] SQL injection protection
  - [ ] Rate limiting (100 req/min)
  - [ ] CORS whitelist
- [ ] **Error Handling:**
  - [ ] Consistent error response format
  - [ ] No internal errors leaked
  - [ ] Structured logging with context

## Acceptance Criteria

1. TypeScript compiles in strict mode
2. No `any` types in service layer
3. API keys never appear in logs
4. All inputs validated
5. Rate limiting active
6. All security tests pass

---

# PHASE 6: Testing & Documentation
**Score Impact:** +11 points (Testing +6, Docs +5)
**Duration:** ~2-3 days

## Goal
Achieve 80%+ test coverage and create comprehensive documentation.

## TDD Test Cases

### 6.1 Integration Tests
```typescript
// tests/integration/full-trading-flow.test.ts

describe('Full Trading Flow Integration', () => {
  it('should complete entire user journey', async () => {
    // 1. User views explore page (no auth)
    const explore = await request(app).get('/api/public/prices');
    expect(explore.status).toBe(200);

    // 2. User signs up
    const user = await createTestUser();

    // 3. User paper trades
    const paperTrade = await request(app)
      .post('/api/trading')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        action: 'create-order',
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 0.01
      });
    expect(paperTrade.status).toBe(200);
    expect(paperTrade.body.mode).toBe('paper');

    // 4. User creates manual strategy
    const strategy = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Test Strategy',
        symbol: 'BTC/USD',
        type: 'manual'
      });
    expect(strategy.status).toBe(201);

    // 5. User adds AI enhancement (optional)
    const aiProvider = await request(app)
      .post('/api/ai-providers/providers')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        provider: 'openai',
        name: 'My OpenAI',
        apiKey: 'test-key'
      });
    expect(aiProvider.status).toBe(201);

    // 6. User connects exchange for live trading
    const exchange = await request(app)
      .post('/api/exchanges')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        exchange: 'coinbase',
        apiKey: 'test-key',
        apiSecret: 'test-secret'
      });
    expect(exchange.status).toBe(201);

    // 7. User switches to live mode
    const liveMode = await request(app)
      .post('/api/trading/mode')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ mode: 'live' });
    expect(liveMode.status).toBe(200);
  });
});
```

### 6.2 E2E Tests with Playwright
```typescript
// tests/e2e/user-journey.spec.ts

test.describe('User Journey E2E', () => {
  test('anonymous user can explore prices', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.getByText('BTC/USD')).toBeVisible();
    await expect(page.getByTestId('btc-price')).toBeVisible();
  });

  test('user can sign up and paper trade', async ({ page }) => {
    await page.goto('/explore');
    await page.click('text=Sign up to trade');

    // Complete Clerk sign-up (mock in test)
    await signUpWithClerk(page);

    // Should be in dashboard
    await expect(page).toHaveURL('/dashboard');

    // Paper trade
    await page.fill('[name="quantity"]', '0.01');
    await page.click('text=Buy');

    await expect(page.getByText('PAPER')).toBeVisible();
    await expect(page.getByText('BUY 0.01 BTC')).toBeVisible();
  });

  test('user can create strategy without AI', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/dashboard/strategies');
    await page.click('text=Create Strategy');

    await page.fill('[name="name"]', 'My Strategy');
    await page.selectOption('[name="symbol"]', 'BTC/USD');
    await page.selectOption('[name="type"]', 'manual');

    // Skip AI section
    await page.click('text=Skip AI Enhancement');

    await page.click('text=Create');

    await expect(page.getByText('My Strategy')).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();
  });
});
```

## Documentation Deliverables

### OpenAPI Spec
```yaml
# docs/openapi.yaml
openapi: 3.0.0
info:
  title: TradeZZZ API
  version: 1.0.0
  description: AI-powered crypto trading platform

paths:
  /api/public/prices:
    get:
      summary: Get live prices (no auth required)
      responses:
        200:
          description: List of current prices
          content:
            application/json:
              schema:
                type: object
                properties:
                  prices:
                    type: array
                    items:
                      $ref: '#/components/schemas/Price'
  # ... more endpoints
```

### API Documentation Site
- Swagger UI at `/api/docs`
- Auto-generated from OpenAPI spec
- Interactive API testing

### User Documentation
- Getting Started Guide
- Paper Trading Tutorial
- Strategy Creation Guide
- AI Enhancement Guide
- Live Trading Setup

## Deliverables Checklist

- [ ] **Test Coverage:**
  - [ ] 80%+ line coverage
  - [ ] 100% of happy paths tested
  - [ ] Integration tests for all flows
  - [ ] E2E tests for critical journeys
- [ ] **Documentation:**
  - [ ] OpenAPI 3.0 spec
  - [ ] Swagger UI at `/api/docs`
  - [ ] User guides (4 documents)
  - [ ] API changelog

## Acceptance Criteria

1. Test coverage ≥ 80%
2. All E2E tests pass
3. OpenAPI spec complete
4. Swagger UI accessible
5. User guides written

---

# Implementation Schedule

```
Week 1:
├── Phase 1: Anonymous Explore (2-3 days)
└── Phase 2: Paper Trading Start (1-2 days)

Week 2:
├── Phase 2: Paper Trading Complete (2 days)
└── Phase 3: AI Optional (2 days)

Week 3:
├── Phase 4: Multi-Strategy (2-3 days)
└── Phase 5: Security Start (1-2 days)

Week 4:
├── Phase 5: Security Complete (2 days)
└── Phase 6: Testing & Docs (2-3 days)
```

---

# Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Codebase Score | 42/100 | 90/100 | ≥ 90 |
| Test Coverage | ~50% | 80%+ | ≥ 80% |
| E2E Tests | 0 | 10+ | ≥ 10 |
| API Docs | 0 | 100% | 100% |
| User Sign-up → First Trade | ~5 min | < 30 sec | < 1 min |
| Exchange Required for Paper | Yes | No | No |
| AI Required for Strategies | Yes | No | No |

---

# Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Coinbase API rate limits | Implement caching layer |
| Mock exchange accuracy | Use real prices, simulate only execution |
| Migration breaks production | Feature flags, gradual rollout |
| Test flakiness | Use deterministic mocks, retry logic |

---

**Ready to begin Phase 1?**
