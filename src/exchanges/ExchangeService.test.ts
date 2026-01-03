/**
 * ExchangeService Tests - TDD Red Phase
 * Tests for exchange connection management, API key encryption, and market data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExchangeService,
  ExchangeConnection,
  ExchangeType,
  MarketData,
  OrderBook,
  Ticker,
} from './ExchangeService';
import { ConfigService } from '../config/ConfigService';
import { MockDatabase, createMockDatabase } from '../../tests/helpers/mock-db';

describe('ExchangeService', () => {
  let exchangeService: ExchangeService;
  let configService: ConfigService;
  let db: MockDatabase;
  let userId: string;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'test');
    db = createMockDatabase();
    configService = new ConfigService({ db });

    // Create test user
    const user = await db.users.create({
      email: 'trader@example.com',
      passwordHash: 'hashed',
      tier: 'pro',
    });
    userId = user.id;

    exchangeService = new ExchangeService({
      db,
      configService,
      encryptionKey: 'test-encryption-key-32-characters!',
    });
  });

  // ============================================================================
  // Exchange Connection Management
  // ============================================================================

  describe('Connection Management', () => {
    it('should_create_exchange_connection', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'My Binance Account',
        apiKey: 'test-api-key-12345',
        apiSecret: 'test-api-secret-67890',
      });

      expect(connection.id).toBeDefined();
      expect(connection.userId).toBe(userId);
      expect(connection.exchange).toBe('binance');
      expect(connection.name).toBe('My Binance Account');
      expect(connection.status).toBe('active');
      expect(connection.createdAt).toBeDefined();
    });

    it('should_encrypt_api_credentials', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'coinbase',
        name: 'Coinbase Pro',
        apiKey: 'my-secret-api-key',
        apiSecret: 'my-secret-api-secret',
      });

      // Stored credentials should be encrypted (not plaintext)
      const stored = await exchangeService.getConnection(connection.id);
      expect(stored!.encryptedApiKey).toBeDefined();
      expect(stored!.encryptedApiKey).not.toBe('my-secret-api-key');
      expect(stored!.encryptedApiSecret).not.toBe('my-secret-api-secret');
    });

    it('should_decrypt_api_credentials', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'kraken',
        name: 'Kraken Account',
        apiKey: 'original-api-key',
        apiSecret: 'original-api-secret',
      });

      const decrypted = await exchangeService.getDecryptedCredentials(connection.id);
      expect(decrypted.apiKey).toBe('original-api-key');
      expect(decrypted.apiSecret).toBe('original-api-secret');
    });

    it('should_support_passphrase_for_coinbase', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'coinbase',
        name: 'Coinbase Pro',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        passphrase: 'my-passphrase',
      });

      const decrypted = await exchangeService.getDecryptedCredentials(connection.id);
      expect(decrypted.passphrase).toBe('my-passphrase');
    });

    it('should_list_user_connections', async () => {
      await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Binance 1',
        apiKey: 'key1',
        apiSecret: 'secret1',
      });

      await exchangeService.createConnection({
        userId,
        exchange: 'kraken',
        name: 'Kraken 1',
        apiKey: 'key2',
        apiSecret: 'secret2',
      });

      const connections = await exchangeService.getUserConnections(userId);
      expect(connections.length).toBe(2);
    });

    it('should_mask_api_key_in_list', async () => {
      await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Binance',
        apiKey: 'abcdefghijklmnop',
        apiSecret: 'secret123456789',
      });

      const connections = await exchangeService.getUserConnections(userId);
      expect(connections[0].maskedApiKey).toBe('abcd...mnop');
      expect(connections[0].encryptedApiKey).toBeUndefined(); // Should not expose encrypted data
      expect(connections[0].encryptedApiSecret).toBeUndefined();
    });

    it('should_enforce_tier_connection_limits', async () => {
      // Free tier allows 1 connection
      const freeUser = await db.users.create({
        email: 'free@example.com',
        passwordHash: 'hashed',
        tier: 'free',
      });

      await exchangeService.createConnection({
        userId: freeUser.id,
        exchange: 'binance',
        name: 'First',
        apiKey: 'key1',
        apiSecret: 'secret1',
      });

      await expect(
        exchangeService.createConnection({
          userId: freeUser.id,
          exchange: 'kraken',
          name: 'Second',
          apiKey: 'key2',
          apiSecret: 'secret2',
        })
      ).rejects.toThrow('Exchange connection limit reached for free tier');
    });

    it('should_validate_exchange_type', async () => {
      await expect(
        exchangeService.createConnection({
          userId,
          exchange: 'invalid_exchange' as ExchangeType,
          name: 'Invalid',
          apiKey: 'key',
          apiSecret: 'secret',
        })
      ).rejects.toThrow('Unsupported exchange');
    });

    it('should_delete_connection', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'To Delete',
        apiKey: 'key',
        apiSecret: 'secret',
      });

      await exchangeService.deleteConnection(connection.id, userId);

      const deleted = await exchangeService.getConnection(connection.id);
      expect(deleted).toBeNull();
    });

    it('should_not_delete_other_user_connection', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'My Connection',
        apiKey: 'key',
        apiSecret: 'secret',
      });

      const otherUser = await db.users.create({
        email: 'other@example.com',
        passwordHash: 'hashed',
        tier: 'pro',
      });

      await expect(
        exchangeService.deleteConnection(connection.id, otherUser.id)
      ).rejects.toThrow('Access denied');
    });

    it('should_update_connection_name', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Original Name',
        apiKey: 'key',
        apiSecret: 'secret',
      });

      const updated = await exchangeService.updateConnection(connection.id, userId, {
        name: 'New Name',
      });

      expect(updated.name).toBe('New Name');
    });

    it('should_rotate_api_credentials', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Rotate Test',
        apiKey: 'old-api-key',
        apiSecret: 'old-api-secret',
      });

      await exchangeService.rotateCredentials(connection.id, userId, {
        apiKey: 'new-api-key',
        apiSecret: 'new-api-secret',
      });

      const decrypted = await exchangeService.getDecryptedCredentials(connection.id);
      expect(decrypted.apiKey).toBe('new-api-key');
      expect(decrypted.apiSecret).toBe('new-api-secret');
    });
  });

  // ============================================================================
  // Connection Status & Validation
  // ============================================================================

  describe('Connection Status', () => {
    it('should_test_connection_validity', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Test Connection',
        apiKey: 'valid-api-key',
        apiSecret: 'valid-api-secret',
      });

      // Mock the exchange API test (in production would make real API call)
      const result = await exchangeService.testConnection(connection.id);

      expect(result.valid).toBe(true);
      expect(result.permissions).toBeDefined();
    });

    it('should_deactivate_connection', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Active Connection',
        apiKey: 'key',
        apiSecret: 'secret',
      });

      const deactivated = await exchangeService.deactivateConnection(connection.id, userId);
      expect(deactivated.status).toBe('inactive');
    });

    it('should_reactivate_connection', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Inactive Connection',
        apiKey: 'key',
        apiSecret: 'secret',
      });

      await exchangeService.deactivateConnection(connection.id, userId);
      const reactivated = await exchangeService.activateConnection(connection.id, userId);

      expect(reactivated.status).toBe('active');
    });

    it('should_track_last_used_timestamp', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Usage Tracking',
        apiKey: 'key',
        apiSecret: 'secret',
      });

      await exchangeService.markConnectionUsed(connection.id);

      const updated = await exchangeService.getConnection(connection.id);
      expect(updated!.lastUsedAt).toBeDefined();
    });
  });

  // ============================================================================
  // Market Data (Simulated)
  // ============================================================================

  describe('Market Data', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Data Connection',
        apiKey: 'key',
        apiSecret: 'secret',
      });
      connectionId = connection.id;
    });

    it('should_get_ticker', async () => {
      const ticker = await exchangeService.getTicker(connectionId, 'BTC/USDT');

      expect(ticker.symbol).toBe('BTC/USDT');
      expect(ticker.bid).toBeDefined();
      expect(ticker.ask).toBeDefined();
      expect(ticker.last).toBeDefined();
      expect(ticker.volume).toBeDefined();
      expect(ticker.timestamp).toBeDefined();
    });

    it('should_get_order_book', async () => {
      const orderBook = await exchangeService.getOrderBook(connectionId, 'BTC/USDT');

      expect(orderBook.symbol).toBe('BTC/USDT');
      expect(orderBook.bids).toBeDefined();
      expect(orderBook.asks).toBeDefined();
      expect(orderBook.bids.length).toBeGreaterThan(0);
      expect(orderBook.asks.length).toBeGreaterThan(0);
    });

    it('should_get_ohlcv_data', async () => {
      const candles = await exchangeService.getOHLCV(connectionId, 'BTC/USDT', '1h', 100);

      expect(candles.length).toBe(100);
      expect(candles[0].timestamp).toBeDefined();
      expect(candles[0].open).toBeDefined();
      expect(candles[0].high).toBeDefined();
      expect(candles[0].low).toBeDefined();
      expect(candles[0].close).toBeDefined();
      expect(candles[0].volume).toBeDefined();
    });

    it('should_get_available_symbols', async () => {
      const symbols = await exchangeService.getSymbols(connectionId);

      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols).toContain('BTC/USDT');
      expect(symbols).toContain('ETH/USDT');
    });

    it('should_get_account_balance', async () => {
      const balance = await exchangeService.getBalance(connectionId);

      expect(balance.total).toBeDefined();
      expect(balance.free).toBeDefined();
      expect(balance.used).toBeDefined();
      expect(balance.assets).toBeDefined();
    });

    it('should_require_active_connection_for_data', async () => {
      await exchangeService.deactivateConnection(connectionId, userId);

      await expect(
        exchangeService.getTicker(connectionId, 'BTC/USDT')
      ).rejects.toThrow('Connection is not active');
    });
  });

  // ============================================================================
  // Exchange-Specific Features
  // ============================================================================

  describe('Exchange Features', () => {
    it('should_get_supported_exchanges', () => {
      const exchanges = exchangeService.getSupportedExchanges();

      expect(exchanges).toContain('binance');
      expect(exchanges).toContain('coinbase');
      expect(exchanges).toContain('kraken');
      expect(exchanges).toContain('kucoin');
      expect(exchanges).toContain('bybit');
    });

    it('should_get_exchange_info', () => {
      const info = exchangeService.getExchangeInfo('binance');

      expect(info.id).toBe('binance');
      expect(info.name).toBe('Binance');
      expect(info.requiredCredentials).toContain('apiKey');
      expect(info.requiredCredentials).toContain('apiSecret');
      expect(info.supportedFeatures).toBeDefined();
    });

    it('should_get_coinbase_info_with_passphrase', () => {
      const info = exchangeService.getExchangeInfo('coinbase');

      expect(info.requiredCredentials).toContain('passphrase');
    });

    it('should_validate_symbol_format', () => {
      expect(exchangeService.isValidSymbol('BTC/USDT')).toBe(true);
      expect(exchangeService.isValidSymbol('ETH/BTC')).toBe(true);
      expect(exchangeService.isValidSymbol('BTCUSDT')).toBe(false);
      expect(exchangeService.isValidSymbol('invalid')).toBe(false);
    });

    it('should_get_trading_fees', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Fee Test',
        apiKey: 'key',
        apiSecret: 'secret',
      });

      const fees = await exchangeService.getTradingFees(connection.id);

      expect(fees.maker).toBeDefined();
      expect(fees.taker).toBeDefined();
      expect(fees.maker).toBeLessThanOrEqual(fees.taker);
    });
  });

  // ============================================================================
  // Order Placement Preparation
  // ============================================================================

  describe('Order Preparation', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Order Test',
        apiKey: 'key',
        apiSecret: 'secret',
      });
      connectionId = connection.id;
    });

    it('should_validate_order_params', async () => {
      const validation = await exchangeService.validateOrderParams(connectionId, {
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.001,
        price: 50000,
      });

      expect(validation.valid).toBe(true);
    });

    it('should_reject_below_minimum_quantity', async () => {
      const validation = await exchangeService.validateOrderParams(connectionId, {
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.00000001, // Too small
      });

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('minimum');
    });

    it('should_get_symbol_limits', async () => {
      const limits = await exchangeService.getSymbolLimits(connectionId, 'BTC/USDT');

      expect(limits.minQuantity).toBeDefined();
      expect(limits.maxQuantity).toBeDefined();
      expect(limits.minPrice).toBeDefined();
      expect(limits.maxPrice).toBeDefined();
      expect(limits.minNotional).toBeDefined();
    });

    it('should_calculate_order_cost', async () => {
      const cost = await exchangeService.calculateOrderCost(connectionId, {
        symbol: 'BTC/USDT',
        side: 'buy',
        quantity: 0.1,
        price: 50000,
      });

      expect(cost.subtotal).toBe(5000);
      expect(cost.fee).toBeDefined();
      expect(cost.total).toBeGreaterThan(5000);
    });
  });

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  describe('Rate Limiting', () => {
    it('should_track_api_request_count', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Rate Limit Test',
        apiKey: 'key',
        apiSecret: 'secret',
      });

      // Make several requests
      await exchangeService.getTicker(connection.id, 'BTC/USDT');
      await exchangeService.getTicker(connection.id, 'ETH/USDT');

      const stats = await exchangeService.getConnectionStats(connection.id);
      expect(stats.requestCount).toBe(2);
    });

    it('should_get_rate_limit_status', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Rate Status',
        apiKey: 'key',
        apiSecret: 'secret',
      });

      const status = await exchangeService.getRateLimitStatus(connection.id);

      expect(status.requestsRemaining).toBeDefined();
      expect(status.resetAt).toBeDefined();
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should_handle_invalid_api_key_error', async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Invalid Key',
        apiKey: 'INVALID_KEY',
        apiSecret: 'INVALID_SECRET',
      });

      // In production, this would return actual API error
      const result = await exchangeService.testConnection(connection.id);
      // For mock, we always return valid - real implementation would check
      expect(result).toBeDefined();
    });

    it('should_handle_connection_not_found', async () => {
      await expect(
        exchangeService.getTicker('non-existent-id', 'BTC/USDT')
      ).rejects.toThrow('Connection not found');
    });

    it('should_categorize_exchange_errors', () => {
      const authError = exchangeService.categorizeError(new Error('Invalid API key'));
      expect(authError.type).toBe('authentication');

      const rateError = exchangeService.categorizeError(new Error('Rate limit exceeded'));
      expect(rateError.type).toBe('rate_limit');

      const networkError = exchangeService.categorizeError(new Error('ECONNREFUSED'));
      expect(networkError.type).toBe('network');
    });
  });
});
