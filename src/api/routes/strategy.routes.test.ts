/**
 * Strategy Routes Tests - TDD Red Phase
 * Tests for strategy management API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createStrategyRouter } from './strategy.routes';
import { StrategyService } from '../../strategies/StrategyService';
import { AuthService } from '../../users/AuthService';
import { ConfigService } from '../../config/ConfigService';
import { MockDatabase, createMockDatabase } from '../../../tests/helpers/mock-db';
import { errorHandler } from '../middleware/error.middleware';
import type { BacktestService, BacktestResult } from '../../backtesting/BacktestService';

describe('Strategy Routes', () => {
  let app: Express;
  let strategyService: StrategyService;
  let authService: AuthService;
  let configService: ConfigService;
  let db: MockDatabase;
  let accessToken: string;
  let userId: string;
  let backtestService: Pick<BacktestService, 'getBacktestHistory'>;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'test');
    db = createMockDatabase();
    configService = new ConfigService({ db });
    authService = new AuthService({
      db,
      jwtSecret: 'test-jwt-secret-key-minimum-32-chars!!',
      jwtExpiresIn: '24h',
      refreshTokenExpiresIn: '7d',
    });
    strategyService = new StrategyService({ db, configService });

    backtestService = {
      getBacktestHistory: async (strategyId: string): Promise<BacktestResult[]> => {
        return [];
      },
    } as any;

    // Create test user
    const result = await authService.register({
      email: 'strategist@example.com',
      password: 'TestPassword123!',
      tier: 'pro',
    });
    accessToken = result.accessToken;
    userId = result.user.id;

    app = express();
    app.use(express.json());
    app.use('/api/strategies', createStrategyRouter(strategyService, authService, backtestService as any));
    app.use(errorHandler);
  });

  // ============================================================================
  // POST /api/strategies - Create Strategy
  // ============================================================================

  describe('POST /api/strategies', () => {
    it('should_create_strategy', async () => {
      const response = await request(app)
        .post('/api/strategies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'My Momentum Strategy',
          type: 'momentum',
          config: {
            symbols: ['BTC/USDT'],
            timeframe: '1h',
            lookbackPeriod: 14,
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('My Momentum Strategy');
      expect(response.body.data.type).toBe('momentum');
      expect(response.body.data.status).toBe('draft');
    });

    it('should_reject_without_auth', async () => {
      const response = await request(app)
        .post('/api/strategies')
        .send({
          name: 'Test',
          type: 'momentum',
          config: { symbols: ['BTC/USDT'] },
        });

      expect(response.status).toBe(401);
    });

    it('should_reject_invalid_type', async () => {
      const response = await request(app)
        .post('/api/strategies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Invalid Type',
          type: 'invalid_type',
          config: { symbols: ['BTC/USDT'] },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // Zod returns "Invalid option" for enum validation failures
    });

    it('should_reject_missing_name', async () => {
      const response = await request(app)
        .post('/api/strategies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: 'momentum',
          config: { symbols: ['BTC/USDT'] },
        });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // GET /api/strategies - List User Strategies
  // ============================================================================

  describe('GET /api/strategies', () => {
    beforeEach(async () => {
      await strategyService.createStrategy({
        userId,
        name: 'Strategy 1',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });

      await strategyService.createStrategy({
        userId,
        name: 'Strategy 2',
        type: 'mean_reversion',
        config: { symbols: ['ETH/USDT'] },
      });
    });

    it('should_list_user_strategies', async () => {
      const response = await request(app)
        .get('/api/strategies')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it('should_filter_by_type', async () => {
      const response = await request(app)
        .get('/api/strategies?type=momentum')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].type).toBe('momentum');
    });

    it('should_reject_without_auth', async () => {
      const response = await request(app)
        .get('/api/strategies');

      expect(response.status).toBe(401);
    });
  });

  // ============================================================================
  // GET /api/strategies/:id - Get Single Strategy
  // ============================================================================

  describe('GET /api/strategies/:id', () => {
    let strategyId: string;

    beforeEach(async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Test Strategy',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });
      strategyId = strategy.id;
    });

    it('should_get_strategy_by_id', async () => {
      const response = await request(app)
        .get(`/api/strategies/${strategyId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(strategyId);
      expect(response.body.data.name).toBe('Test Strategy');
    });

    it('should_return_404_for_nonexistent', async () => {
      const response = await request(app)
        .get('/api/strategies/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
    });

    it('should_not_allow_access_to_other_user_strategy', async () => {
      // Create another user
      const otherResult = await authService.register({
        email: 'other@example.com',
        password: 'OtherPassword123!',
      });

      const response = await request(app)
        .get(`/api/strategies/${strategyId}`)
        .set('Authorization', `Bearer ${otherResult.accessToken}`);

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // PUT /api/strategies/:id - Update Strategy
  // ============================================================================

  describe('PUT /api/strategies/:id', () => {
    let strategyId: string;

    beforeEach(async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Update Test',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });
      strategyId = strategy.id;
    });

    it('should_update_strategy_name', async () => {
      const response = await request(app)
        .put(`/api/strategies/${strategyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('should_update_strategy_config', async () => {
      const response = await request(app)
        .put(`/api/strategies/${strategyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          config: {
            symbols: ['ETH/USDT'],
            timeframe: '4h',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.config.symbols).toContain('ETH/USDT');
    });
  });

  // ============================================================================
  // POST /api/strategies/:id/status - Update Status
  // ============================================================================

  describe('POST /api/strategies/:id/status', () => {
    let strategyId: string;

    beforeEach(async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Status Test',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });
      strategyId = strategy.id;
    });

    it('should_start_backtesting', async () => {
      const response = await request(app)
        .post(`/api/strategies/${strategyId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'backtesting' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('backtesting');
    });

    it('should_reject_invalid_transition', async () => {
      const response = await request(app)
        .post(`/api/strategies/${strategyId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'active' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid status transition');
    });
  });

  // ============================================================================
  // DELETE /api/strategies/:id - Delete Strategy
  // ============================================================================

  describe('DELETE /api/strategies/:id', () => {
    let strategyId: string;

    beforeEach(async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Delete Test',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });
      strategyId = strategy.id;
    });

    it('should_delete_draft_strategy', async () => {
      const response = await request(app)
        .delete(`/api/strategies/${strategyId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deleted
      const getResponse = await request(app)
        .get(`/api/strategies/${strategyId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getResponse.status).toBe(404);
    });
  });

  // ============================================================================
  // POST /api/strategies/:id/clone - Clone Strategy
  // ============================================================================

  describe('POST /api/strategies/:id/clone', () => {
    let strategyId: string;

    beforeEach(async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Original',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'], lookbackPeriod: 14 },
      });
      strategyId = strategy.id;
    });

    it('should_clone_strategy', async () => {
      const response = await request(app)
        .post(`/api/strategies/${strategyId}/clone`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Cloned Strategy' });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('Cloned Strategy');
      expect(response.body.data.id).not.toBe(strategyId);
      expect(response.body.data.config.lookbackPeriod).toBe(14);
    });
  });

  // ============================================================================
  // GET /api/strategies/:id/stats - Get Strategy Stats
  // ============================================================================

  describe('GET /api/strategies/:id/stats', () => {
    let strategyId: string;

    beforeEach(async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Stats Test',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });
      strategyId = strategy.id;
    });

    it('should_get_strategy_stats', async () => {
      const response = await request(app)
        .get(`/api/strategies/${strategyId}/stats`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalTrades).toBeDefined();
      expect(response.body.data.winRate).toBeDefined();
    });
  });

  // ============================================================================
  // GET /api/strategies/:id/live-eligibility - Live Trading Eligibility
  // ============================================================================

  describe('GET /api/strategies/:id/live-eligibility', () => {
    let strategyId: string;

    beforeEach(async () => {
      const strategy = await strategyService.createStrategy({
        userId,
        name: 'Eligibility Test',
        type: 'momentum',
        config: { symbols: ['BTC/USDT'] },
      });
      strategyId = strategy.id;
    });

    it('should_return_not_eligible_when_no_backtests', async () => {
      const response = await request(app)
        .get(`/api/strategies/${strategyId}/live-eligibility`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligible).toBe(false);
      expect(response.body.data.reason).toContain('No completed backtests');
    });

    it('should_return_eligible_when_latest_backtest_meets_criteria', async () => {
      // Override backtestService behavior for this test
      (backtestService.getBacktestHistory as any) = async (): Promise<BacktestResult[]> => [
        {
          id: 'bt-1',
          strategyId,
          symbol: 'BTC/USDT',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          initialCapital: 10000,
          finalCapital: 11500,
          status: 'completed',
          metrics: {
            totalReturn: 15,
            maxDrawdown: 20,
          } as any,
          trades: [],
          equityCurve: [],
          errorMessage: undefined,
          createdAt: new Date('2024-02-01'),
          completedAt: new Date('2024-02-01'),
        },
      ];

      const response = await request(app)
        .get(`/api/strategies/${strategyId}/live-eligibility`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligible).toBe(true);
      expect(response.body.data.latestBacktest.metrics.totalReturn).toBe(15);
      expect(response.body.data.latestBacktest.metrics.maxDrawdown).toBe(20);
    });
  });
});
