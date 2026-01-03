/**
 * Usage Routes Tests - Phase 19: Usage Tracking
 * TDD Red Phase - Write tests first
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createUsageRouter } from './usage.routes';
import { UsageTrackingService } from '../../usage/UsageTrackingService';
import { AuthService } from '../../users/AuthService';
import { createMockDatabase, MockDatabase } from '../../../tests/helpers/mock-db';
import { errorHandler } from '../middleware/error.middleware';

describe('Usage Routes', () => {
  let app: Express;
  let usageService: UsageTrackingService;
  let authService: AuthService;
  let db: MockDatabase;
  let accessToken: string;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'test');

    db = createMockDatabase();
    usageService = new UsageTrackingService({ db });
    authService = new AuthService({
      db,
      jwtSecret: 'test-jwt-secret-key-minimum-32-chars!!',
      jwtExpiresIn: '24h',
      refreshTokenExpiresIn: '7d',
    });

    // Create test user and get token
    const result = await authService.register({
      email: 'usage-test@example.com',
      password: 'TestPassword123!',
      tier: 'pro',
    });
    accessToken = result.accessToken;

    app = express();
    app.use(express.json());
    app.use('/api/usage', createUsageRouter(usageService, authService));
    app.use(errorHandler);
  });

  // ============================================================================
  // Track Usage Tests
  // ============================================================================

  describe('POST /api/usage/track', () => {
    it('should_track_token_usage', async () => {
      const res = await request(app)
        .post('/api/usage/track')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          providerId: 'provider-1',
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          operation: 'chat',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalTokens).toBe(150);
      expect(res.body.data.estimatedCost).toBeGreaterThan(0);
    });

    it('should_reject_without_auth', async () => {
      const res = await request(app)
        .post('/api/usage/track')
        .send({
          providerId: 'provider-1',
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          operation: 'chat',
        });

      expect(res.status).toBe(401);
    });
  });

  // ============================================================================
  // Summary Tests
  // ============================================================================

  describe('GET /api/usage/summary', () => {
    it('should_return_daily_summary', async () => {
      // Track some usage first
      await request(app)
        .post('/api/usage/track')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          providerId: 'provider-1',
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          operation: 'chat',
        });

      const res = await request(app)
        .get('/api/usage/summary?period=daily')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.period).toBe('daily');
      expect(res.body.data.totalTokens).toBeGreaterThan(0);
    });

    it('should_return_monthly_summary', async () => {
      const res = await request(app)
        .get('/api/usage/summary?period=monthly')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.period).toBe('monthly');
    });
  });

  // ============================================================================
  // Provider Usage Tests
  // ============================================================================

  describe('GET /api/usage/providers/:id', () => {
    it('should_return_provider_usage', async () => {
      await request(app)
        .post('/api/usage/track')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          providerId: 'provider-1',
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          operation: 'chat',
        });

      const res = await request(app)
        .get('/api/usage/providers/provider-1')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalTokens).toBe(150);
      expect(res.body.data.byModel).toBeDefined();
    });
  });

  // ============================================================================
  // Cost Estimation Tests
  // ============================================================================

  describe('POST /api/usage/estimate', () => {
    it('should_estimate_cost_for_tokens', async () => {
      const res = await request(app)
        .post('/api/usage/estimate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 1000,
          outputTokens: 500,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.totalCost).toBeGreaterThan(0);
      expect(res.body.data.currency).toBe('USD');
    });
  });

  // ============================================================================
  // Pricing Tests
  // ============================================================================

  describe('GET /api/usage/pricing', () => {
    it('should_return_all_pricing', async () => {
      const res = await request(app)
        .get('/api/usage/pricing')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.openai).toBeDefined();
      expect(res.body.data.anthropic).toBeDefined();
    });

    it('should_return_pricing_for_provider', async () => {
      const res = await request(app)
        .get('/api/usage/pricing/openai')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.provider).toBe('openai');
      expect(res.body.data.models).toBeDefined();
    });
  });

  // ============================================================================
  // Limits Tests
  // ============================================================================

  describe('Usage Limits', () => {
    it('should_set_usage_limits', async () => {
      const res = await request(app)
        .put('/api/usage/limits')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dailyTokenLimit: 50000,
          dailyCostLimit: 5.00,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should_check_usage_limits', async () => {
      const res = await request(app)
        .get('/api/usage/limits/check')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tokenLimitUsedPercent).toBeDefined();
      expect(res.body.data.costLimitUsedPercent).toBeDefined();
    });
  });

  // ============================================================================
  // History Tests
  // ============================================================================

  describe('GET /api/usage/history', () => {
    it('should_return_usage_history', async () => {
      await request(app)
        .post('/api/usage/track')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          providerId: 'provider-1',
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          operation: 'chat',
        });

      const res = await request(app)
        .get('/api/usage/history')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should_paginate_history', async () => {
      const res = await request(app)
        .get('/api/usage/history?limit=10&offset=0')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
