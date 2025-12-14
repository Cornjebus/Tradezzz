/**
 * AI Routes Tests
 * Tests for AI provider API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createAIRouter } from './ai.routes';
import { AIProviderService } from '../../ai/AIProviderService';
import { AuthService } from '../../users/AuthService';
import { ConfigService } from '../../config/ConfigService';
import { MockDatabase, createMockDatabase } from '../../../tests/helpers/mock-db';
import { errorHandler } from '../middleware/error.middleware';

describe('AI Routes', () => {
  let app: Express;
  let aiService: AIProviderService;
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
    aiService = new AIProviderService({
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
    app.use('/api/ai', createAIRouter(aiService, authService));
    app.use(errorHandler);
  });

  // ============================================================================
  // GET /api/ai/supported - Get Supported Providers
  // ============================================================================

  describe('GET /api/ai/supported', () => {
    it('should_list_supported_providers', async () => {
      const response = await request(app)
        .get('/api/ai/supported');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.map((p: any) => p.id)).toContain('openai');
      expect(response.body.data.map((p: any) => p.id)).toContain('anthropic');
    });

    it('should_include_provider_info', async () => {
      const response = await request(app)
        .get('/api/ai/supported');

      const openai = response.body.data.find((p: any) => p.id === 'openai');
      expect(openai.name).toBe('OpenAI');
      expect(openai.models.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // GET /api/ai/info/:provider - Get Provider Info
  // ============================================================================

  describe('GET /api/ai/info/:provider', () => {
    it('should_get_provider_info', async () => {
      const response = await request(app)
        .get('/api/ai/info/openai');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('openai');
      expect(response.body.data.features).toBeDefined();
    });

    it('should_reject_unsupported_provider', async () => {
      const response = await request(app)
        .get('/api/ai/info/invalid');

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // GET /api/ai/models/:provider - Get Available Models
  // ============================================================================

  describe('GET /api/ai/models/:provider', () => {
    it('should_get_available_models', async () => {
      const response = await request(app)
        .get('/api/ai/models/openai');

      expect(response.status).toBe(200);
      expect(response.body.data).toContain('gpt-4');
      expect(response.body.data).toContain('gpt-3.5-turbo');
    });
  });

  // ============================================================================
  // POST /api/ai/providers - Create Provider
  // ============================================================================

  describe('POST /api/ai/providers', () => {
    it('should_create_provider', async () => {
      const response = await request(app)
        .post('/api/ai/providers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          provider: 'openai',
          name: 'My OpenAI',
          apiKey: 'sk-test-key',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.provider).toBe('openai');
      expect(response.body.data.name).toBe('My OpenAI');
      expect(response.body.data.status).toBe('active');
    });

    it('should_reject_without_auth', async () => {
      const response = await request(app)
        .post('/api/ai/providers')
        .send({
          provider: 'openai',
          name: 'Test',
          apiKey: 'key',
        });

      expect(response.status).toBe(401);
    });

    it('should_reject_invalid_provider', async () => {
      const response = await request(app)
        .post('/api/ai/providers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          provider: 'invalid',
          name: 'Test',
          apiKey: 'key',
        });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // GET /api/ai/providers - List Providers
  // ============================================================================

  describe('GET /api/ai/providers', () => {
    beforeEach(async () => {
      await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'OpenAI 1',
        apiKey: 'key1',
      });

      await aiService.createProvider({
        userId,
        provider: 'anthropic',
        name: 'Anthropic 1',
        apiKey: 'key2',
      });
    });

    it('should_list_user_providers', async () => {
      const response = await request(app)
        .get('/api/ai/providers')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);
    });

    it('should_not_expose_api_keys', async () => {
      const response = await request(app)
        .get('/api/ai/providers')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.body.data[0].encryptedApiKey).toBeUndefined();
      expect(response.body.data[0].maskedApiKey).toBeDefined();
    });
  });

  // ============================================================================
  // GET /api/ai/providers/:id - Get Single Provider
  // ============================================================================

  describe('GET /api/ai/providers/:id', () => {
    let providerId: string;

    beforeEach(async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Test Provider',
        apiKey: 'key',
      });
      providerId = provider.id;
    });

    it('should_get_provider_by_id', async () => {
      const response = await request(app)
        .get(`/api/ai/providers/${providerId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(providerId);
    });

    it('should_return_404_for_nonexistent', async () => {
      const response = await request(app)
        .get('/api/ai/providers/nonexistent')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // PUT /api/ai/providers/:id - Update Provider
  // ============================================================================

  describe('PUT /api/ai/providers/:id', () => {
    let providerId: string;

    beforeEach(async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Original',
        apiKey: 'key',
      });
      providerId = provider.id;
    });

    it('should_update_provider_name', async () => {
      const response = await request(app)
        .put(`/api/ai/providers/${providerId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('should_update_default_model', async () => {
      const response = await request(app)
        .put(`/api/ai/providers/${providerId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ defaultModel: 'gpt-4-turbo' });

      expect(response.status).toBe(200);
      expect(response.body.data.defaultModel).toBe('gpt-4-turbo');
    });
  });

  // ============================================================================
  // DELETE /api/ai/providers/:id - Delete Provider
  // ============================================================================

  describe('DELETE /api/ai/providers/:id', () => {
    let providerId: string;

    beforeEach(async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'To Delete',
        apiKey: 'key',
      });
      providerId = provider.id;
    });

    it('should_delete_provider', async () => {
      const response = await request(app)
        .delete(`/api/ai/providers/${providerId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deleted
      const getResponse = await request(app)
        .get(`/api/ai/providers/${providerId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getResponse.status).toBe(404);
    });
  });

  // ============================================================================
  // POST /api/ai/providers/:id/test - Test Provider
  // ============================================================================

  describe('POST /api/ai/providers/:id/test', () => {
    let providerId: string;

    beforeEach(async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Test Provider',
        apiKey: 'key',
      });
      providerId = provider.id;
    });

    it('should_test_provider', async () => {
      const response = await request(app)
        .post(`/api/ai/providers/${providerId}/test`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.models).toBeDefined();
    });
  });

  // ============================================================================
  // POST /api/ai/providers/:id/chat - Chat Completion
  // ============================================================================

  describe('POST /api/ai/providers/:id/chat', () => {
    let providerId: string;

    beforeEach(async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Chat Provider',
        apiKey: 'key',
      });
      providerId = provider.id;
    });

    it('should_send_chat_message', async () => {
      const response = await request(app)
        .post(`/api/ai/providers/${providerId}/chat`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          messages: [
            { role: 'user', content: 'Hello' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toBeDefined();
      expect(response.body.data.role).toBe('assistant');
    });

    it('should_track_token_usage', async () => {
      const response = await request(app)
        .post(`/api/ai/providers/${providerId}/chat`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          messages: [{ role: 'user', content: 'Test' }],
        });

      expect(response.body.data.usage).toBeDefined();
      expect(response.body.data.usage.totalTokens).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // POST /api/ai/providers/:id/sentiment - Sentiment Analysis
  // ============================================================================

  describe('POST /api/ai/providers/:id/sentiment', () => {
    let providerId: string;

    beforeEach(async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Sentiment Provider',
        apiKey: 'key',
      });
      providerId = provider.id;
    });

    it('should_analyze_sentiment', async () => {
      const response = await request(app)
        .post(`/api/ai/providers/${providerId}/sentiment`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          text: 'Bitcoin is showing strong bullish momentum',
          symbol: 'BTC/USDT',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.sentiment).toBeDefined();
      expect(response.body.data.confidence).toBeDefined();
      expect(response.body.data.score).toBeDefined();
    });

    it('should_return_bullish_for_positive_text', async () => {
      const response = await request(app)
        .post(`/api/ai/providers/${providerId}/sentiment`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          text: 'Bullish breakout expected, strong momentum',
          symbol: 'ETH/USDT',
        });

      expect(response.body.data.sentiment).toBe('bullish');
    });
  });

  // ============================================================================
  // POST /api/ai/providers/:id/signal - Generate Signal
  // ============================================================================

  describe('POST /api/ai/providers/:id/signal', () => {
    let providerId: string;

    beforeEach(async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Signal Provider',
        apiKey: 'key',
      });
      providerId = provider.id;
    });

    it('should_generate_trading_signal', async () => {
      const response = await request(app)
        .post(`/api/ai/providers/${providerId}/signal`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          symbol: 'BTC/USDT',
          timeframe: '1h',
          priceData: [
            { open: 50000, high: 51000, low: 49500, close: 50500, volume: 1000 },
            { open: 50500, high: 52000, low: 50000, close: 51500, volume: 1200 },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.action).toBeDefined();
      expect(['buy', 'sell', 'hold']).toContain(response.body.data.action);
      expect(response.body.data.confidence).toBeDefined();
      expect(response.body.data.reasoning).toBeDefined();
    });
  });

  // ============================================================================
  // GET /api/ai/providers/:id/usage - Get Provider Usage
  // ============================================================================

  describe('GET /api/ai/providers/:id/usage', () => {
    let providerId: string;

    beforeEach(async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Usage Provider',
        apiKey: 'key',
      });
      providerId = provider.id;

      // Generate some usage
      await aiService.chat(providerId, {
        messages: [{ role: 'user', content: 'Test' }],
      });
    });

    it('should_get_provider_usage', async () => {
      const response = await request(app)
        .get(`/api/ai/providers/${providerId}/usage`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.usage).toBeDefined();
      expect(response.body.data.daily).toBeDefined();
      expect(response.body.data.estimatedCost).toBeDefined();
    });
  });

  // ============================================================================
  // GET /api/ai/usage/monthly - Get Monthly Usage
  // ============================================================================

  describe('GET /api/ai/usage/monthly', () => {
    beforeEach(async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Monthly Usage',
        apiKey: 'key',
      });

      await aiService.chat(provider.id, {
        messages: [{ role: 'user', content: 'Test' }],
      });
    });

    it('should_get_monthly_usage', async () => {
      const response = await request(app)
        .get('/api/ai/usage/monthly')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.month).toBeDefined();
      expect(response.body.data.totalTokens).toBeDefined();
      expect(response.body.data.byProvider).toBeDefined();
    });
  });

  // ============================================================================
  // POST /api/ai/providers/:id/deactivate - Deactivate Provider
  // ============================================================================

  describe('POST /api/ai/providers/:id/deactivate', () => {
    let providerId: string;

    beforeEach(async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Active Provider',
        apiKey: 'key',
      });
      providerId = provider.id;
    });

    it('should_deactivate_provider', async () => {
      const response = await request(app)
        .post(`/api/ai/providers/${providerId}/deactivate`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('inactive');
    });
  });
});
