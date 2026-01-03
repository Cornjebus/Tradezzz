import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { CoinbaseAdapter } from './CoinbaseAdapter';
import type { ExchangeAdapterContext } from '../ExchangeService';

describe('CoinbaseAdapter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  // Helper to create adapter with mocked JWT generation
  function createMockedAdapter() {
    const adapter = new CoinbaseAdapter({
      baseUrl: 'https://api.coinbase.com',
    });
    // Mock the private generateJWT method
    (adapter as any).generateJWT = vi.fn().mockReturnValue('mock-jwt-token');
    return adapter;
  }

  describe('Public Endpoints (No Auth Required)', () => {
    it('should_call_product_endpoint_and_map_to_Ticker', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          price: '100.50',
          quote: {
            bid_price: '100.00',
            ask_price: '101.00',
          },
          high_24h: '110.00',
          low_24h: '90.00',
          volume_24h: '1234.56',
        }),
      } as any);

      globalThis.fetch = fetchMock;

      const adapter = new CoinbaseAdapter({
        baseUrl: 'https://api.coinbase.com',
      });

      // No API keys - public endpoint
      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
      };

      const ticker = await adapter.getTicker(ctx, 'BTC/USDT');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/api/v3/brokerage/market/products/BTC-USDT');

      // Should NOT have Authorization header for public endpoint without credentials
      const options = fetchMock.mock.calls[0][1] as RequestInit;
      expect((options.headers as Record<string, string>)['Authorization']).toBeUndefined();

      expect(ticker.symbol).toBe('BTC/USDT');
      expect(ticker.bid).toBe(100);
      expect(ticker.ask).toBe(101);
      expect(ticker.last).toBe(100.5);
      expect(ticker.high).toBe(110);
      expect(ticker.low).toBe(90);
      expect(ticker.volume).toBe(1234.56);
    });

    it('should_get_order_book_from_book_endpoint', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pricebook: {
            bids: [
              { price: '100.00', size: '1.5' },
              { price: '99.50', size: '2.0' },
            ],
            asks: [
              { price: '101.00', size: '1.0' },
              { price: '101.50', size: '1.5' },
            ],
          },
        }),
      } as any);

      globalThis.fetch = fetchMock;

      const adapter = new CoinbaseAdapter({
        baseUrl: 'https://api.coinbase.com',
      });

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
      };

      const orderBook = await adapter.getOrderBook(ctx, 'ETH/USD');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/api/v3/brokerage/market/products/ETH-USD/book');

      expect(orderBook.symbol).toBe('ETH/USD');
      expect(orderBook.bids).toHaveLength(2);
      expect(orderBook.bids[0]).toEqual({ price: 100, quantity: 1.5 });
      expect(orderBook.asks).toHaveLength(2);
      expect(orderBook.asks[0]).toEqual({ price: 101, quantity: 1 });
    });

    it('should_get_ohlcv_candles', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candles: [
            { start: 1704067200, open: '100', high: '105', low: '98', close: '103', volume: '500' },
            { start: 1704070800, open: '103', high: '108', low: '101', close: '106', volume: '600' },
          ],
        }),
      } as any);

      globalThis.fetch = fetchMock;

      const adapter = new CoinbaseAdapter({
        baseUrl: 'https://api.coinbase.com',
      });

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
      };

      const candles = await adapter.getOHLCV(ctx, 'BTC/USD', '1h', 2);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/api/v3/brokerage/market/products/BTC-USD/candles');

      expect(candles).toHaveLength(2);
      expect(candles[0].open).toBe(100);
      expect(candles[0].close).toBe(103);
      expect(candles[0].volume).toBe(500);
    });

    it('should_get_available_symbols', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [
            { base_currency_id: 'BTC', quote_currency_id: 'USD', is_disabled: false, status: 'online' },
            { base_currency_id: 'ETH', quote_currency_id: 'USD', is_disabled: false, status: 'online' },
            { base_currency_id: 'DOGE', quote_currency_id: 'USD', is_disabled: true, status: 'offline' },
          ],
        }),
      } as any);

      globalThis.fetch = fetchMock;

      const adapter = new CoinbaseAdapter({
        baseUrl: 'https://api.coinbase.com',
      });

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
      };

      const symbols = await adapter.getSymbols(ctx);

      expect(symbols).toContain('BTC/USD');
      expect(symbols).toContain('ETH/USD');
      expect(symbols).not.toContain('DOGE/USD'); // Disabled
    });

    it('should_test_connection_successfully_without_auth', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: [] }),
      } as any);

      globalThis.fetch = fetchMock;

      const adapter = new CoinbaseAdapter({
        baseUrl: 'https://api.coinbase.com',
      });

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
      };

      const result = await adapter.testConnection(ctx);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Authenticated Endpoints', () => {
    const testApiKey = 'organizations/test-org/apiKeys/test-key';
    const testApiSecret = 'test-api-secret';

    it('should_get_balance_with_auth', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accounts: [
            {
              currency: 'BTC',
              available_balance: { value: '1.5' },
              hold: { value: '0.5' },
            },
            {
              currency: 'USD',
              available_balance: { value: '10000' },
              hold: { value: '1000' },
            },
          ],
        }),
      } as any);

      globalThis.fetch = fetchMock;

      const adapter = createMockedAdapter();

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
        apiKey: testApiKey,
        apiSecret: testApiSecret,
      };

      const balance = await adapter.getBalance(ctx);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/api/v3/brokerage/accounts');

      // Should have Authorization header with Bearer token
      const options = fetchMock.mock.calls[0][1] as RequestInit;
      expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer mock-jwt-token');

      expect(balance.total['BTC']).toBe(2);
      expect(balance.free['BTC']).toBe(1.5);
      expect(balance.used['BTC']).toBe(0.5);
      expect(balance.assets).toContain('BTC');
      expect(balance.assets).toContain('USD');
    });

    it('should_return_empty_balance_without_auth', async () => {
      const adapter = new CoinbaseAdapter({
        baseUrl: 'https://api.coinbase.com',
      });

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
      };

      const balance = await adapter.getBalance(ctx);

      expect(balance.total).toEqual({});
      expect(balance.free).toEqual({});
      expect(balance.used).toEqual({});
      expect(balance.assets).toEqual([]);
    });

    it('should_create_market_order', async () => {
      const fetchMock = vi.fn()
        // First call: getSymbolLimits
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            base_min_size: '0.0001',
            base_max_size: '10000',
            min_market_funds: '1',
          }),
        })
        // Second call: createOrder
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            success_response: {
              order_id: 'order-123',
            },
          }),
        });

      globalThis.fetch = fetchMock;

      const adapter = createMockedAdapter();

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
        apiKey: testApiKey,
        apiSecret: testApiSecret,
      };

      const result = await adapter.createOrder(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 0.01,
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order-123');
      expect(result.clientOrderId).toBeDefined();
    });

    it('should_create_limit_order', async () => {
      const fetchMock = vi.fn()
        // First call: getSymbolLimits
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            base_min_size: '0.0001',
            base_max_size: '10000',
            min_market_funds: '1',
          }),
        })
        // Second call: createOrder
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            success_response: {
              order_id: 'order-456',
            },
          }),
        });

      globalThis.fetch = fetchMock;

      const adapter = createMockedAdapter();

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
        apiKey: testApiKey,
        apiSecret: testApiSecret,
      };

      const result = await adapter.createOrder(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order-456');

      // Verify the order body structure
      const orderCall = fetchMock.mock.calls[1];
      const body = JSON.parse(orderCall[1].body as string);
      expect(body.side).toBe('BUY');
      expect(body.order_configuration.limit_limit_gtc).toBeDefined();
      expect(body.order_configuration.limit_limit_gtc.limit_price).toBe('50000');
    });

    it('should_fail_order_without_auth', async () => {
      const adapter = new CoinbaseAdapter({
        baseUrl: 'https://api.coinbase.com',
      });

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
      };

      const result = await adapter.createOrder(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 0.01,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API credentials required for trading');
    });

    it('should_cancel_order', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ success: true, order_id: 'order-123' }],
        }),
      } as any);

      globalThis.fetch = fetchMock;

      const adapter = createMockedAdapter();

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
        apiKey: testApiKey,
        apiSecret: testApiSecret,
      };

      const result = await adapter.cancelOrder(ctx, 'order-123');

      expect(result.success).toBe(true);
    });

    it('should_get_open_orders', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: [
            {
              order_id: 'order-1',
              client_order_id: 'client-1',
              product_id: 'BTC-USD',
              side: 'BUY',
              order_type: 'LIMIT',
              status: 'OPEN',
              filled_size: '0',
              filled_value: '0',
              average_filled_price: '0',
              created_time: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      } as any);

      globalThis.fetch = fetchMock;

      const adapter = createMockedAdapter();

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
        apiKey: testApiKey,
        apiSecret: testApiSecret,
      };

      const orders = await adapter.getOpenOrders(ctx);

      expect(orders).toHaveLength(1);
      expect(orders[0].orderId).toBe('order-1');
      expect(orders[0].side).toBe('BUY');
      expect(orders[0].status).toBe('OPEN');
    });

    it('should_get_order_by_id', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          order: {
            order_id: 'order-123',
            client_order_id: 'client-123',
            product_id: 'BTC-USD',
            side: 'SELL',
            order_type: 'MARKET',
            status: 'FILLED',
            filled_size: '0.5',
            filled_value: '25000',
            average_filled_price: '50000',
            created_time: '2024-01-01T00:00:00Z',
          },
        }),
      } as any);

      globalThis.fetch = fetchMock;

      const adapter = createMockedAdapter();

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
        apiKey: testApiKey,
        apiSecret: testApiSecret,
      };

      const order = await adapter.getOrder(ctx, 'order-123');

      expect(order).not.toBeNull();
      expect(order!.orderId).toBe('order-123');
      expect(order!.side).toBe('SELL');
      expect(order!.status).toBe('FILLED');
      expect(order!.filledSize).toBe('0.5');
    });
  });

  describe('Order Validation', () => {
    it('should_validate_order_params', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          base_min_size: '0.001',
          base_max_size: '10000',
          quote_min_size: '1',
          min_market_funds: '10',
        }),
      } as any);

      globalThis.fetch = fetchMock;

      const adapter = new CoinbaseAdapter({
        baseUrl: 'https://api.coinbase.com',
      });

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
      };

      const result = await adapter.validateOrderParams(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
      });

      expect(result.valid).toBe(true);
    });

    it('should_reject_order_below_min_quantity', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          base_min_size: '0.001',
          base_max_size: '10000',
        }),
      } as any);

      globalThis.fetch = fetchMock;

      const adapter = new CoinbaseAdapter({
        baseUrl: 'https://api.coinbase.com',
      });

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
      };

      const result = await adapter.validateOrderParams(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'limit',
        quantity: 0.0001,
        price: 50000,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('minimum');
    });

    it('should_calculate_order_cost', async () => {
      const adapter = new CoinbaseAdapter({
        baseUrl: 'https://api.coinbase.com',
      });

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
      };

      const cost = await adapter.calculateOrderCost(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        quantity: 1,
        price: 50000,
      });

      expect(cost.subtotal).toBe(50000);
      expect(cost.fee).toBe(300); // 0.6% taker fee
      expect(cost.total).toBe(50300);
    });
  });

  describe('Error Handling', () => {
    it('should_report_connection_failure', async () => {
      const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      globalThis.fetch = fetchMock;

      const adapter = new CoinbaseAdapter({
        baseUrl: 'https://api.coinbase.com',
      });

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
      };

      const result = await adapter.testConnection(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should_handle_order_creation_error', async () => {
      const testApiKey = 'organizations/test-org/apiKeys/test-key';
      const testApiSecret = 'test-api-secret';

      const fetchMock = vi.fn()
        // First call: getSymbolLimits
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            base_min_size: '0.0001',
            base_max_size: '10000',
            min_market_funds: '1',
          }),
        })
        // Second call: createOrder fails
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: false,
            error_response: {
              message: 'Insufficient funds',
            },
          }),
        });

      globalThis.fetch = fetchMock;

      const adapter = createMockedAdapter();

      const ctx: ExchangeAdapterContext = {
        connectionId: 'conn-1',
        userId: 'user-1',
        exchange: 'coinbase',
        apiKey: testApiKey,
        apiSecret: testApiSecret,
      };

      const result = await adapter.createOrder(ctx, {
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient funds');
    });
  });
});
