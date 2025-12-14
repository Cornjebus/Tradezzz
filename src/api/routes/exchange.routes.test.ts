/**
 * Exchange Routes Tests
 * Tests for exchange connection API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createExchangeRouter } from './exchange.routes';
import { ExchangeService } from '../../exchanges/ExchangeService';
import { AuthService } from '../../users/AuthService';
import { ConfigService } from '../../config/ConfigService';
import { MockDatabase, createMockDatabase } from '../../../tests/helpers/mock-db';
import { errorHandler } from '../middleware/error.middleware';

describe('Exchange Routes', () => {
  let app: Express;
  let exchangeService: ExchangeService;
  let authService: AuthService;
  let configService: ConfigService;
  let db: MockDatabase;
  let accessToken: string;
  let userId: string;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'development');
    db = createMockDatabase();
    configService = new ConfigService({ db });
    authService = new AuthService({
      db,
      jwtSecret: 'test-jwt-secret-key-minimum-32-chars!!',
      jwtExpiresIn: '24h',
      refreshTokenExpiresIn: '7d',
    });
    exchangeService = new ExchangeService({
      db,
      configService,
      encryptionKey: 'test-encryption-key-32-characters!',
    });

    // Create test user
    const result = await authService.register({
      email: 'trader@example.com',
      password: 'TestPassword123!',
      tier: 'pro',
    });
    accessToken = result.accessToken;
    userId = result.user.id;

    app = express();
    app.use(express.json());
    app.use('/api/exchanges', createExchangeRouter(exchangeService, authService));
    app.use(errorHandler);
  });

  // ============================================================================
  // GET /api/exchanges/supported - Get Supported Exchanges
  // ============================================================================

  describe('GET /api/exchanges/supported', () => {
    it('should_list_supported_exchanges', async () => {
      const response = await request(app)
        .get('/api/exchanges/supported');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.map((e: any) => e.id)).toContain('binance');
      expect(response.body.data.map((e: any) => e.id)).toContain('coinbase');
    });

    it('should_include_exchange_info', async () => {
      const response = await request(app)
        .get('/api/exchanges/supported');

      const binance = response.body.data.find((e: any) => e.id === 'binance');
      expect(binance.name).toBe('Binance');
      expect(binance.requiredCredentials).toContain('apiKey');
    });
  });

  // ============================================================================
  // GET /api/exchanges/info/:exchange - Get Exchange Info
  // ============================================================================

  describe('GET /api/exchanges/info/:exchange', () => {
    it('should_get_exchange_info', async () => {
      const response = await request(app)
        .get('/api/exchanges/info/binance');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('binance');
      expect(response.body.data.supportedFeatures).toBeDefined();
    });

    it('should_reject_unsupported_exchange', async () => {
      const response = await request(app)
        .get('/api/exchanges/info/invalid');

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // POST /api/exchanges/connections - Create Connection
  // ============================================================================

  describe('POST /api/exchanges/connections', () => {
    it('should_create_connection', async () => {
      const response = await request(app)
        .post('/api/exchanges/connections')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          exchange: 'binance',
          name: 'My Binance',
          apiKey: 'test-api-key',
          apiSecret: 'test-api-secret',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exchange).toBe('binance');
      expect(response.body.data.name).toBe('My Binance');
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.maskedApiKey).toBeDefined();
    });

    it('should_reject_without_auth', async () => {
      const response = await request(app)
        .post('/api/exchanges/connections')
        .send({
          exchange: 'binance',
          name: 'Test',
          apiKey: 'key',
          apiSecret: 'secret',
        });

      expect(response.status).toBe(401);
    });

    it('should_reject_invalid_exchange', async () => {
      const response = await request(app)
        .post('/api/exchanges/connections')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          exchange: 'invalid',
          name: 'Test',
          apiKey: 'key',
          apiSecret: 'secret',
        });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // GET /api/exchanges/connections - List Connections
  // ============================================================================

  describe('GET /api/exchanges/connections', () => {
    beforeEach(async () => {
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
    });

    it('should_list_user_connections', async () => {
      const response = await request(app)
        .get('/api/exchanges/connections')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);
    });

    it('should_not_expose_encrypted_credentials', async () => {
      const response = await request(app)
        .get('/api/exchanges/connections')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.body.data[0].encryptedApiKey).toBeUndefined();
      expect(response.body.data[0].encryptedApiSecret).toBeUndefined();
    });
  });

  // ============================================================================
  // GET /api/exchanges/connections/:id - Get Single Connection
  // ============================================================================

  describe('GET /api/exchanges/connections/:id', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Test Connection',
        apiKey: 'key',
        apiSecret: 'secret',
      });
      connectionId = connection.id;
    });

    it('should_get_connection_by_id', async () => {
      const response = await request(app)
        .get(`/api/exchanges/connections/${connectionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(connectionId);
    });

    it('should_return_404_for_nonexistent', async () => {
      const response = await request(app)
        .get('/api/exchanges/connections/nonexistent')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // PUT /api/exchanges/connections/:id - Update Connection
  // ============================================================================

  describe('PUT /api/exchanges/connections/:id', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Original Name',
        apiKey: 'key',
        apiSecret: 'secret',
      });
      connectionId = connection.id;
    });

    it('should_update_connection_name', async () => {
      const response = await request(app)
        .put(`/api/exchanges/connections/${connectionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('New Name');
    });
  });

  // ============================================================================
  // DELETE /api/exchanges/connections/:id - Delete Connection
  // ============================================================================

  describe('DELETE /api/exchanges/connections/:id', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'To Delete',
        apiKey: 'key',
        apiSecret: 'secret',
      });
      connectionId = connection.id;
    });

    it('should_delete_connection', async () => {
      const response = await request(app)
        .delete(`/api/exchanges/connections/${connectionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deleted
      const getResponse = await request(app)
        .get(`/api/exchanges/connections/${connectionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getResponse.status).toBe(404);
    });
  });

  // ============================================================================
  // POST /api/exchanges/connections/:id/test - Test Connection
  // ============================================================================

  describe('POST /api/exchanges/connections/:id/test', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Test Connection',
        apiKey: 'key',
        apiSecret: 'secret',
      });
      connectionId = connection.id;
    });

    it('should_test_connection', async () => {
      const response = await request(app)
        .post(`/api/exchanges/connections/${connectionId}/test`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.permissions).toBeDefined();
    });
  });

  // ============================================================================
  // POST /api/exchanges/connections/:id/rotate - Rotate Credentials
  // ============================================================================

  describe('POST /api/exchanges/connections/:id/rotate', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Rotate Test',
        apiKey: 'old-key',
        apiSecret: 'old-secret',
      });
      connectionId = connection.id;
    });

    it('should_rotate_credentials', async () => {
      const response = await request(app)
        .post(`/api/exchanges/connections/${connectionId}/rotate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          apiKey: 'new-key',
          apiSecret: 'new-secret',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ============================================================================
  // POST /api/exchanges/connections/:id/deactivate - Deactivate Connection
  // ============================================================================

  describe('POST /api/exchanges/connections/:id/deactivate', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Active Connection',
        apiKey: 'key',
        apiSecret: 'secret',
      });
      connectionId = connection.id;
    });

    it('should_deactivate_connection', async () => {
      const response = await request(app)
        .post(`/api/exchanges/connections/${connectionId}/deactivate`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('inactive');
    });
  });

  // ============================================================================
  // GET /api/exchanges/connections/:id/ticker/:symbol - Get Ticker
  // ============================================================================

  describe('GET /api/exchanges/connections/:id/ticker/:symbol', () => {
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
      const response = await request(app)
        .get(`/api/exchanges/connections/${connectionId}/ticker/BTC-USDT`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.symbol).toBe('BTC/USDT');
      expect(response.body.data.bid).toBeDefined();
      expect(response.body.data.ask).toBeDefined();
      expect(response.body.data.last).toBeDefined();
    });
  });

  // ============================================================================
  // GET /api/exchanges/connections/:id/orderbook/:symbol - Get Order Book
  // ============================================================================

  describe('GET /api/exchanges/connections/:id/orderbook/:symbol', () => {
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

    it('should_get_order_book', async () => {
      const response = await request(app)
        .get(`/api/exchanges/connections/${connectionId}/orderbook/BTC-USDT`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.symbol).toBe('BTC/USDT');
      expect(response.body.data.bids.length).toBeGreaterThan(0);
      expect(response.body.data.asks.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // GET /api/exchanges/connections/:id/ohlcv/:symbol - Get OHLCV
  // ============================================================================

  describe('GET /api/exchanges/connections/:id/ohlcv/:symbol', () => {
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

    it('should_get_ohlcv_data', async () => {
      const response = await request(app)
        .get(`/api/exchanges/connections/${connectionId}/ohlcv/BTC-USDT?timeframe=1h&limit=50`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(50);
      expect(response.body.data[0].open).toBeDefined();
      expect(response.body.data[0].high).toBeDefined();
      expect(response.body.data[0].low).toBeDefined();
      expect(response.body.data[0].close).toBeDefined();
    });
  });

  // ============================================================================
  // GET /api/exchanges/connections/:id/balance - Get Balance
  // ============================================================================

  describe('GET /api/exchanges/connections/:id/balance', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Balance Connection',
        apiKey: 'key',
        apiSecret: 'secret',
      });
      connectionId = connection.id;
    });

    it('should_get_account_balance', async () => {
      const response = await request(app)
        .get(`/api/exchanges/connections/${connectionId}/balance`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBeDefined();
      expect(response.body.data.free).toBeDefined();
      expect(response.body.data.assets).toBeDefined();
    });
  });

  // ============================================================================
  // GET /api/exchanges/connections/:id/symbols - Get Symbols
  // ============================================================================

  describe('GET /api/exchanges/connections/:id/symbols', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Symbols Connection',
        apiKey: 'key',
        apiSecret: 'secret',
      });
      connectionId = connection.id;
    });

    it('should_get_available_symbols', async () => {
      const response = await request(app)
        .get(`/api/exchanges/connections/${connectionId}/symbols`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toContain('BTC/USDT');
      expect(response.body.data).toContain('ETH/USDT');
    });
  });

  // ============================================================================
  // GET /api/exchanges/connections/:id/fees - Get Fees
  // ============================================================================

  describe('GET /api/exchanges/connections/:id/fees', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await exchangeService.createConnection({
        userId,
        exchange: 'binance',
        name: 'Fees Connection',
        apiKey: 'key',
        apiSecret: 'secret',
      });
      connectionId = connection.id;
    });

    it('should_get_trading_fees', async () => {
      const response = await request(app)
        .get(`/api/exchanges/connections/${connectionId}/fees`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.maker).toBeDefined();
      expect(response.body.data.taker).toBeDefined();
    });
  });
});
