/**
 * AIProviderService Tests - TDD Red Phase
 * Tests for AI provider management, sentiment analysis, and signal generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AIProviderService,
  AIProvider,
  AIProviderType,
  SentimentAnalysis,
  AISignal,
  ChatMessage,
} from './AIProviderService';
import { ConfigService } from '../config/ConfigService';
import { MockDatabase, createMockDatabase } from '../../tests/helpers/mock-db';

describe('AIProviderService', () => {
  let aiService: AIProviderService;
  let configService: ConfigService;
  let db: MockDatabase;
  let userId: string;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'development');
    db = createMockDatabase();
    configService = new ConfigService({ db });

    // Create test user
    const user = await db.users.create({
      email: 'trader@example.com',
      passwordHash: 'hashed',
      tier: 'pro',
    });
    userId = user.id;

    aiService = new AIProviderService({
      db,
      configService,
      encryptionKey: 'test-encryption-key-32-characters!',
    });
  });

  // ============================================================================
  // Provider Connection Management
  // ============================================================================

  describe('Provider Management', () => {
    it('should_create_ai_provider_connection', async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'My OpenAI',
        apiKey: 'sk-test-key-12345',
      });

      expect(provider.id).toBeDefined();
      expect(provider.userId).toBe(userId);
      expect(provider.provider).toBe('openai');
      expect(provider.name).toBe('My OpenAI');
      expect(provider.status).toBe('active');
    });

    it('should_encrypt_api_key', async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'anthropic',
        name: 'My Anthropic',
        apiKey: 'sk-ant-test-key',
      });

      const stored = await aiService.getProvider(provider.id);
      expect(stored!.encryptedApiKey).toBeDefined();
      expect(stored!.encryptedApiKey).not.toBe('sk-ant-test-key');
    });

    it('should_decrypt_api_key', async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Decrypt Test',
        apiKey: 'sk-original-key-abc123',
      });

      const decrypted = await aiService.getDecryptedApiKey(provider.id);
      expect(decrypted).toBe('sk-original-key-abc123');
    });

    it('should_list_user_providers', async () => {
      await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'OpenAI',
        apiKey: 'key1',
      });

      await aiService.createProvider({
        userId,
        provider: 'anthropic',
        name: 'Anthropic',
        apiKey: 'key2',
      });

      const providers = await aiService.getUserProviders(userId);
      expect(providers.length).toBe(2);
    });

    it('should_mask_api_key_in_list', async () => {
      await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'OpenAI',
        apiKey: 'sk-abcdefghijklmnop',
      });

      const providers = await aiService.getUserProviders(userId);
      expect(providers[0].maskedApiKey).toBe('sk-a...mnop');
      expect(providers[0].encryptedApiKey).toBeUndefined();
    });

    it('should_enforce_tier_provider_limits', async () => {
      // Free tier allows 1 provider
      const freeUser = await db.users.create({
        email: 'free@example.com',
        passwordHash: 'hashed',
        tier: 'free',
      });

      await aiService.createProvider({
        userId: freeUser.id,
        provider: 'openai',
        name: 'First',
        apiKey: 'key1',
      });

      await expect(
        aiService.createProvider({
          userId: freeUser.id,
          provider: 'anthropic',
          name: 'Second',
          apiKey: 'key2',
        })
      ).rejects.toThrow('AI provider limit reached for free tier');
    });

    it('should_validate_provider_type', async () => {
      await expect(
        aiService.createProvider({
          userId,
          provider: 'invalid_provider' as AIProviderType,
          name: 'Invalid',
          apiKey: 'key',
        })
      ).rejects.toThrow('Unsupported AI provider');
    });

    it('should_delete_provider', async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'To Delete',
        apiKey: 'key',
      });

      await aiService.deleteProvider(provider.id, userId);

      const deleted = await aiService.getProvider(provider.id);
      expect(deleted).toBeNull();
    });

    it('should_update_provider_name', async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Original',
        apiKey: 'key',
      });

      const updated = await aiService.updateProvider(provider.id, userId, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
    });

    it('should_rotate_api_key', async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Rotate Test',
        apiKey: 'old-key',
      });

      await aiService.rotateApiKey(provider.id, userId, 'new-key');

      const decrypted = await aiService.getDecryptedApiKey(provider.id);
      expect(decrypted).toBe('new-key');
    });

    it('should_set_default_model', async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Model Test',
        apiKey: 'key',
        defaultModel: 'gpt-4',
      });

      expect(provider.defaultModel).toBe('gpt-4');
    });
  });

  // ============================================================================
  // Provider Status & Testing
  // ============================================================================

  describe('Provider Status', () => {
    it('should_test_provider_connection', async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Test Provider',
        apiKey: 'valid-key',
      });

      const result = await aiService.testProvider(provider.id);

      expect(result.valid).toBe(true);
      expect(result.models).toBeDefined();
    });

    it('should_deactivate_provider', async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Active',
        apiKey: 'key',
      });

      const deactivated = await aiService.deactivateProvider(provider.id, userId);
      expect(deactivated.status).toBe('inactive');
    });

    it('should_reactivate_provider', async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Reactivate',
        apiKey: 'key',
      });

      await aiService.deactivateProvider(provider.id, userId);
      const reactivated = await aiService.activateProvider(provider.id, userId);

      expect(reactivated.status).toBe('active');
    });

    it('should_track_last_used', async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Usage Track',
        apiKey: 'key',
      });

      await aiService.markProviderUsed(provider.id);

      const updated = await aiService.getProvider(provider.id);
      expect(updated!.lastUsedAt).toBeDefined();
    });
  });

  // ============================================================================
  // Sentiment Analysis
  // ============================================================================

  describe('Sentiment Analysis', () => {
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

    it('should_analyze_text_sentiment', async () => {
      const result = await aiService.analyzeSentiment(providerId, {
        text: 'Bitcoin is showing strong bullish momentum with increasing volume',
        symbol: 'BTC/USDT',
      });

      expect(result.sentiment).toBeDefined();
      expect(['bullish', 'bearish', 'neutral']).toContain(result.sentiment);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.score).toBeDefined();
    });

    it('should_analyze_news_sentiment', async () => {
      const headlines = [
        'Ethereum breaks new all-time high',
        'Institutional adoption continues to grow',
        'Major partnership announced',
      ];

      const result = await aiService.analyzeNewsSentiment(providerId, {
        headlines,
        symbol: 'ETH/USDT',
      });

      expect(result.overallSentiment).toBeDefined();
      expect(result.headlineScores).toHaveLength(3);
    });

    it('should_analyze_social_sentiment', async () => {
      const posts = [
        { text: 'To the moon! 🚀', source: 'twitter', likes: 1000 },
        { text: 'Major breakout incoming', source: 'reddit', likes: 500 },
      ];

      const result = await aiService.analyzeSocialSentiment(providerId, {
        posts,
        symbol: 'BTC/USDT',
      });

      expect(result.sentiment).toBeDefined();
      expect(result.volume).toBeDefined();
      expect(result.trending).toBeDefined();
    });

    it('should_require_active_provider', async () => {
      await aiService.deactivateProvider(providerId, userId);

      await expect(
        aiService.analyzeSentiment(providerId, {
          text: 'Test',
          symbol: 'BTC/USDT',
        })
      ).rejects.toThrow('Provider is not active');
    });
  });

  // ============================================================================
  // AI Signal Generation
  // ============================================================================

  describe('Signal Generation', () => {
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
      const signal = await aiService.generateSignal(providerId, {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        priceData: [
          { open: 50000, high: 51000, low: 49500, close: 50500, volume: 1000 },
          { open: 50500, high: 51500, low: 50000, close: 51200, volume: 1200 },
        ],
        indicators: {
          rsi: 65,
          macd: { value: 100, signal: 80, histogram: 20 },
          sma20: 49000,
          sma50: 48000,
        },
      });

      expect(signal.action).toBeDefined();
      expect(['buy', 'sell', 'hold']).toContain(signal.action);
      expect(signal.confidence).toBeGreaterThanOrEqual(0);
      expect(signal.reasoning).toBeDefined();
    });

    it('should_include_entry_exit_levels', async () => {
      const signal = await aiService.generateSignal(providerId, {
        symbol: 'ETH/USDT',
        timeframe: '4h',
        priceData: [{ open: 3000, high: 3100, low: 2950, close: 3050, volume: 500 }],
      });

      if (signal.action !== 'hold') {
        expect(signal.entryPrice).toBeDefined();
        expect(signal.stopLoss).toBeDefined();
        expect(signal.takeProfit).toBeDefined();
      }
    });

    it('should_generate_multi_timeframe_analysis', async () => {
      const analysis = await aiService.analyzeMultiTimeframe(providerId, {
        symbol: 'BTC/USDT',
        timeframes: ['15m', '1h', '4h', '1d'],
        priceData: {
          '15m': [{ open: 50000, high: 50100, low: 49900, close: 50050, volume: 100 }],
          '1h': [{ open: 50000, high: 50500, low: 49500, close: 50200, volume: 500 }],
          '4h': [{ open: 49000, high: 51000, low: 48500, close: 50200, volume: 2000 }],
          '1d': [{ open: 48000, high: 51000, low: 47000, close: 50200, volume: 10000 }],
        },
      });

      expect(analysis.overallBias).toBeDefined();
      expect(analysis.timeframeSignals).toBeDefined();
      expect(Object.keys(analysis.timeframeSignals)).toHaveLength(4);
    });
  });

  // ============================================================================
  // Chat/Completion
  // ============================================================================

  describe('Chat Completion', () => {
    let providerId: string;

    beforeEach(async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Chat Provider',
        apiKey: 'key',
        defaultModel: 'gpt-4',
      });
      providerId = provider.id;
    });

    it('should_send_chat_message', async () => {
      const response = await aiService.chat(providerId, {
        messages: [
          { role: 'user', content: 'What is the current trend for Bitcoin?' },
        ],
      });

      expect(response.content).toBeDefined();
      expect(response.role).toBe('assistant');
    });

    it('should_support_system_messages', async () => {
      const response = await aiService.chat(providerId, {
        messages: [
          { role: 'system', content: 'You are a crypto trading expert.' },
          { role: 'user', content: 'Analyze BTC/USDT' },
        ],
      });

      expect(response.content).toBeDefined();
    });

    it('should_track_token_usage', async () => {
      const response = await aiService.chat(providerId, {
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response.usage).toBeDefined();
      expect(response.usage.promptTokens).toBeGreaterThan(0);
      expect(response.usage.completionTokens).toBeGreaterThan(0);
      expect(response.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should_use_specified_model', async () => {
      const response = await aiService.chat(providerId, {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gpt-3.5-turbo',
      });

      expect(response.model).toBe('gpt-3.5-turbo');
    });
  });

  // ============================================================================
  // Token Usage Tracking
  // ============================================================================

  describe('Token Usage', () => {
    let providerId: string;

    beforeEach(async () => {
      const provider = await aiService.createProvider({
        userId,
        provider: 'openai',
        name: 'Usage Provider',
        apiKey: 'key',
      });
      providerId = provider.id;
    });

    it('should_track_cumulative_usage', async () => {
      await aiService.chat(providerId, {
        messages: [{ role: 'user', content: 'First message' }],
      });

      await aiService.chat(providerId, {
        messages: [{ role: 'user', content: 'Second message' }],
      });

      const usage = await aiService.getProviderUsage(providerId);
      expect(usage.totalTokens).toBeGreaterThan(0);
      expect(usage.requestCount).toBe(2);
    });

    it('should_get_daily_usage', async () => {
      await aiService.chat(providerId, {
        messages: [{ role: 'user', content: 'Test' }],
      });

      const dailyUsage = await aiService.getDailyUsage(providerId);
      expect(dailyUsage.date).toBeDefined();
      expect(dailyUsage.tokens).toBeGreaterThan(0);
    });

    it('should_get_monthly_usage', async () => {
      const monthlyUsage = await aiService.getMonthlyUsage(userId);
      expect(monthlyUsage.month).toBeDefined();
      expect(monthlyUsage.totalTokens).toBeDefined();
      expect(monthlyUsage.byProvider).toBeDefined();
    });

    it('should_estimate_cost', async () => {
      await aiService.chat(providerId, {
        messages: [{ role: 'user', content: 'Test' }],
      });

      const cost = await aiService.estimateCost(providerId);
      expect(cost.estimatedCost).toBeDefined();
      expect(cost.currency).toBe('USD');
    });
  });

  // ============================================================================
  // Provider Info
  // ============================================================================

  describe('Provider Info', () => {
    it('should_get_supported_providers', () => {
      const providers = aiService.getSupportedProviders();

      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('deepseek');
      expect(providers).toContain('google');
    });

    it('should_get_provider_info', () => {
      const info = aiService.getProviderInfo('openai');

      expect(info.id).toBe('openai');
      expect(info.name).toBe('OpenAI');
      expect(info.models).toBeDefined();
      expect(info.models.length).toBeGreaterThan(0);
    });

    it('should_get_available_models', () => {
      const models = aiService.getAvailableModels('openai');

      expect(models).toContain('gpt-4');
      expect(models).toContain('gpt-3.5-turbo');
    });

    it('should_get_model_pricing', () => {
      const pricing = aiService.getModelPricing('openai', 'gpt-4');

      expect(pricing.inputPrice).toBeDefined();
      expect(pricing.outputPrice).toBeDefined();
      expect(pricing.unit).toBe('per_1k_tokens');
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should_handle_rate_limit_error', () => {
      const error = aiService.categorizeError(new Error('Rate limit exceeded'));
      expect(error.type).toBe('rate_limit');
      expect(error.retryable).toBe(true);
    });

    it('should_handle_auth_error', () => {
      const error = aiService.categorizeError(new Error('Invalid API key'));
      expect(error.type).toBe('authentication');
      expect(error.retryable).toBe(false);
    });

    it('should_handle_quota_error', () => {
      const error = aiService.categorizeError(new Error('Quota exceeded'));
      expect(error.type).toBe('quota');
      expect(error.retryable).toBe(false);
    });

    it('should_handle_provider_not_found', async () => {
      await expect(
        aiService.chat('non-existent-id', {
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow('Provider not found');
    });
  });
});
