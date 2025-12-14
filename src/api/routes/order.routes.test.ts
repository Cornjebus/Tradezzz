/**
 * Order Routes Tests
 * Tests for order execution API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createOrderRouter } from './order.routes';
import { OrderService } from '../../execution/OrderService';
import { StrategyService } from '../../strategies/StrategyService';
import { AuthService } from '../../users/AuthService';
import { ConfigService } from '../../config/ConfigService';
import { MockDatabase, createMockDatabase } from '../../../tests/helpers/mock-db';
import { errorHandler } from '../middleware/error.middleware';

describe('Order Routes', () => {
  let app: Express;
  let orderService: OrderService;
  let strategyService: StrategyService;
  let authService: AuthService;
  let configService: ConfigService;
  let db: MockDatabase;
  let accessToken: string;
  let userId: string;
  let strategyId: string;

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
    strategyService = new StrategyService({ db, configService });
    orderService = new OrderService({ db, configService, strategyService });

    // Create test user
    const result = await authService.register({
      email: 'trader@example.com',
      password: 'TestPassword123!',
      tier: 'pro',
    });
    accessToken = result.accessToken;
    userId = result.user.id;

    // Create test strategy
    const strategy = await strategyService.createStrategy({
      userId,
      name: 'Test Trading Strategy',
      type: 'momentum',
      config: { symbols: ['BTC/USDT'] },
    });
    strategyId = strategy.id;

    app = express();
    app.use(express.json());
    app.use('/api/orders', createOrderRouter(orderService, strategyService, authService));
    app.use(errorHandler);
  });

  // ============================================================================
  // POST /api/orders - Create Order
  // ============================================================================

  describe('POST /api/orders', () => {
    it('should_create_market_order', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          mode: 'paper',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.symbol).toBe('BTC/USDT');
      expect(response.body.data.side).toBe('buy');
      expect(response.body.data.type).toBe('market');
      expect(response.body.data.status).toBe('pending');
    });

    it('should_create_limit_order_with_price', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'limit',
          quantity: 0.5,
          price: 45000,
          mode: 'paper',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.type).toBe('limit');
      expect(response.body.data.price).toBe(45000);
    });

    it('should_reject_without_auth', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          mode: 'paper',
        });

      expect(response.status).toBe(401);
    });

    it('should_reject_invalid_strategy', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          strategyId: '00000000-0000-0000-0000-000000000000',
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          mode: 'paper',
        });

      expect(response.status).toBe(404);
    });

    it('should_reject_negative_quantity', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: -0.1,
          mode: 'paper',
        });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // GET /api/orders - List Orders
  // ============================================================================

  describe('GET /api/orders', () => {
    beforeEach(async () => {
      await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });

      await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'ETH/USDT',
        side: 'sell',
        type: 'limit',
        quantity: 1.0,
        price: 3000,
        mode: 'paper',
      });
    });

    it('should_list_user_orders', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it('should_filter_by_symbol', async () => {
      const response = await request(app)
        .get('/api/orders?symbol=BTC/USDT')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].symbol).toBe('BTC/USDT');
    });

    it('should_reject_without_auth', async () => {
      const response = await request(app)
        .get('/api/orders');

      expect(response.status).toBe(401);
    });
  });

  // ============================================================================
  // GET /api/orders/:id - Get Single Order
  // ============================================================================

  describe('GET /api/orders/:id', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });
      orderId = order.id;
    });

    it('should_get_order_by_id', async () => {
      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(orderId);
    });

    it('should_return_404_for_nonexistent', async () => {
      const response = await request(app)
        .get('/api/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
    });

    it('should_not_allow_access_to_other_user_order', async () => {
      const otherResult = await authService.register({
        email: 'other@example.com',
        password: 'OtherPassword123!',
      });

      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${otherResult.accessToken}`);

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // POST /api/orders/:id/execute - Execute Paper Order
  // ============================================================================

  describe('POST /api/orders/:id/execute', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });
      orderId = order.id;
    });

    it('should_execute_paper_order', async () => {
      const response = await request(app)
        .post(`/api/orders/${orderId}/execute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPrice: 50000,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('filled');
      expect(response.body.data.filledPrice).toBeDefined();
    });

    it('should_apply_slippage', async () => {
      const response = await request(app)
        .post(`/api/orders/${orderId}/execute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPrice: 50000,
          slippage: 0.1,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.filledPrice).toBeGreaterThan(50000);
    });

    it('should_reject_negative_price', async () => {
      const response = await request(app)
        .post(`/api/orders/${orderId}/execute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPrice: -1000,
        });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // DELETE /api/orders/:id - Cancel Order
  // ============================================================================

  describe('DELETE /api/orders/:id', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 45000,
        mode: 'paper',
      });
      orderId = order.id;
    });

    it('should_cancel_pending_order', async () => {
      const response = await request(app)
        .delete(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });

    it('should_return_404_for_nonexistent', async () => {
      const response = await request(app)
        .delete('/api/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // PUT /api/orders/:id - Modify Order
  // ============================================================================

  describe('PUT /api/orders/:id', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 45000,
        mode: 'paper',
      });
      orderId = order.id;
    });

    it('should_modify_order_price', async () => {
      const response = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          price: 46000,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.price).toBe(46000);
    });

    it('should_modify_order_quantity', async () => {
      const response = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quantity: 0.2,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.quantity).toBe(0.2);
    });
  });

  // ============================================================================
  // GET /api/orders/positions/open - Get Open Positions
  // ============================================================================

  describe('GET /api/orders/positions/open', () => {
    beforeEach(async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.5,
        mode: 'paper',
      });
      await orderService.executePaperOrder(order.id, 50000, { slippage: 0 });
    });

    it('should_list_open_positions', async () => {
      const response = await request(app)
        .get('/api/orders/positions/open')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].symbol).toBe('BTC/USDT');
      expect(response.body.data[0].side).toBe('long');
    });
  });

  // ============================================================================
  // GET /api/orders/positions/closed - Get Closed Positions
  // ============================================================================

  describe('GET /api/orders/positions/closed', () => {
    beforeEach(async () => {
      // Open and close a position
      const buyOrder = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.5,
        mode: 'paper',
      });
      await orderService.executePaperOrder(buyOrder.id, 50000, { slippage: 0 });

      const sellOrder = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'market',
        quantity: 0.5,
        mode: 'paper',
      });
      await orderService.executePaperOrder(sellOrder.id, 55000, { slippage: 0 });
    });

    it('should_list_closed_positions', async () => {
      const response = await request(app)
        .get('/api/orders/positions/closed')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].realizedPnl).toBe(2500); // (55000 - 50000) * 0.5
    });
  });

  // ============================================================================
  // GET /api/orders/portfolio/summary - Get Portfolio Summary
  // ============================================================================

  describe('GET /api/orders/portfolio/summary', () => {
    beforeEach(async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 1.0,
        mode: 'paper',
      });
      await orderService.executePaperOrder(order.id, 50000, { slippage: 0 });
    });

    it('should_get_portfolio_summary', async () => {
      const response = await request(app)
        .get('/api/orders/portfolio/summary')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalValue).toBeDefined();
      expect(response.body.data.totalCost).toBeDefined();
      expect(response.body.data.positions).toBeDefined();
    });
  });

  // ============================================================================
  // GET /api/orders/strategy/:strategyId - Get Strategy Orders
  // ============================================================================

  describe('GET /api/orders/strategy/:strategyId', () => {
    beforeEach(async () => {
      await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });
    });

    it('should_get_strategy_orders', async () => {
      const response = await request(app)
        .get(`/api/orders/strategy/${strategyId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
    });

    it('should_reject_invalid_strategy', async () => {
      const response = await request(app)
        .get('/api/orders/strategy/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
    });
  });
});
