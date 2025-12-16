/**
 * AIService Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIService, ProviderConfig } from './AIService';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AIService', () => {
  const MASTER_PASSWORD = 'SecurePassword123!';
  let service: AIService;

  beforeEach(async () => {
    mockFetch.mockReset();
    service = new AIService({
      masterPassword: MASTER_PASSWORD,
    });
    await service.initialize();
  });

  describe('Provider Management', () => {
    it('should_add_provider_with_secure_key', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'My OpenAI',
        'sk-test-key-12345'
      );

      expect(provider.id).toBeDefined();
      expect(provider.userId).toBe('user1');
      expect(provider.provider).toBe('openai');
      expect(provider.name).toBe('My OpenAI');
      expect(provider.status).toBe('active');
    });

    it('should_set_default_model', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      expect(provider.defaultModel).toBe('gpt-4o-mini');
    });

    it('should_use_custom_model', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key',
        'gpt-4o'
      );

      expect(provider.defaultModel).toBe('gpt-4o');
    });

    it('should_list_user_providers', async () => {
      await service.addProvider('user1', 'openai', 'OpenAI', 'sk-1');
      await service.addProvider('user1', 'anthropic', 'Claude', 'sk-2');
      await service.addProvider('user2', 'deepseek', 'DeepSeek', 'sk-3');

      const user1Providers = service.listProviders('user1');
      const user2Providers = service.listProviders('user2');

      expect(user1Providers.length).toBe(2);
      expect(user2Providers.length).toBe(1);
    });

    it('should_get_provider_by_id', async () => {
      const created = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      const fetched = service.getProvider(created.id);

      expect(fetched?.id).toBe(created.id);
      expect(fetched?.name).toBe('OpenAI');
    });

    it('should_return_null_for_nonexistent_provider', () => {
      const result = service.getProvider('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Provider Updates', () => {
    it('should_update_provider_name', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'Old Name',
        'sk-key'
      );

      const updated = await service.updateProvider(provider.id, 'user1', {
        name: 'New Name',
      });

      expect(updated?.name).toBe('New Name');
    });

    it('should_update_provider_model', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      const updated = await service.updateProvider(provider.id, 'user1', {
        defaultModel: 'gpt-4-turbo',
      });

      expect(updated?.defaultModel).toBe('gpt-4-turbo');
    });

    it('should_deactivate_provider', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      const updated = await service.updateProvider(provider.id, 'user1', {
        status: 'inactive',
      });

      expect(updated?.status).toBe('inactive');
    });

    it('should_reject_update_for_wrong_user', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      const updated = await service.updateProvider(provider.id, 'user2', {
        name: 'Hacked',
      });

      expect(updated).toBeNull();
    });
  });

  describe('Provider Deletion', () => {
    it('should_delete_provider_and_key', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      const deleted = await service.deleteProvider(provider.id, 'user1');
      expect(deleted).toBe(true);

      const fetched = service.getProvider(provider.id);
      expect(fetched).toBeNull();
    });

    it('should_reject_delete_for_wrong_user', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      const deleted = await service.deleteProvider(provider.id, 'user2');
      expect(deleted).toBe(false);
    });
  });

  describe('Key Rotation', () => {
    it('should_rotate_api_key', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-old-key'
      );

      const rotated = await service.rotateKey(
        provider.id,
        'user1',
        'sk-new-key'
      );

      expect(rotated).toBe(true);
    });

    it('should_reject_rotation_for_wrong_user', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      const rotated = await service.rotateKey(provider.id, 'user2', 'sk-new');
      expect(rotated).toBe(false);
    });
  });

  describe('Masked Key', () => {
    it('should_return_masked_key', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-test-api-key-12345'
      );

      const masked = await service.getMaskedKey(provider.id, 'user1');

      expect(masked).toBe('sk-t...2345');
    });

    it('should_return_null_for_wrong_user', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      const masked = await service.getMaskedKey(provider.id, 'user2');
      expect(masked).toBeNull();
    });
  });

  describe('Test Connection', () => {
    it('should_test_openai_connection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'gpt-4o' }],
        }),
      });

      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-test-key'
      );

      const result = await service.testConnection(provider.id, 'user1');

      expect(result.valid).toBe(true);
    });

    it('should_return_error_for_nonexistent_provider', async () => {
      const result = await service.testConnection('nonexistent', 'user1');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Provider not found');
    });
  });

  describe('Chat', () => {
    it('should_call_adapter_and_track_usage', async () => {
      // Mock for chat call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [
            {
              message: { content: 'Hello!' },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-test-key'
      );

      const result = await service.chat(provider.id, 'user1', {
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result.content).toBe('Hello!');

      const usage = service.getUsage(provider.id, 'user1');
      expect(usage?.totalTokens).toBe(15);
      expect(usage?.totalRequests).toBe(1);
    });

    it('should_reject_chat_for_inactive_provider', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      await service.updateProvider(provider.id, 'user1', {
        status: 'inactive',
      });

      await expect(
        service.chat(provider.id, 'user1', {
          messages: [{ role: 'user', content: 'Hi' }],
        })
      ).rejects.toThrow('Provider is not active');
    });
  });

  describe('Sentiment Analysis', () => {
    it('should_analyze_sentiment', async () => {
      // Mock for sentiment analysis call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sentiment: 'bullish',
                  score: 0.8,
                  confidence: 0.9,
                  reasoning: 'Strong indicators',
                }),
              },
            },
          ],
          usage: { total_tokens: 100 },
        }),
      });

      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      const result = await service.analyzeSentiment(provider.id, 'user1', {
        text: 'BTC to the moon!',
        symbol: 'BTC',
      });

      expect(result.sentiment).toBe('bullish');
    });
  });

  describe('Trading Signal', () => {
    it('should_generate_signal', async () => {
      // Mock for signal generation call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  action: 'buy',
                  confidence: 0.75,
                  reasoning: 'RSI oversold',
                  suggestedSize: 0.1,
                }),
              },
            },
          ],
          usage: { total_tokens: 200 },
        }),
      });

      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      const result = await service.generateSignal(provider.id, 'user1', {
        symbol: 'BTC/USDT',
        price: 45000,
        indicators: { rsi: 28 },
      });

      expect(result.action).toBe('buy');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Usage Statistics', () => {
    it('should_track_usage_across_requests', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/models')) {
          return { ok: true, json: async () => ({ data: [{ id: 'gpt-4o' }] }) };
        }
        return {
          ok: true,
          json: async () => ({
            model: 'gpt-4o-mini',
            choices: [{ message: { content: 'Response' } }],
            usage: { total_tokens: 50 },
          }),
        };
      });

      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      await service.chat(provider.id, 'user1', {
        messages: [{ role: 'user', content: 'Test 1' }],
      });

      await service.chat(provider.id, 'user1', {
        messages: [{ role: 'user', content: 'Test 2' }],
      });

      const usage = service.getUsage(provider.id, 'user1');

      expect(usage?.totalRequests).toBe(2);
      expect(usage?.totalTokens).toBe(100);
    });

    it('should_estimate_cost', async () => {
      const provider = await service.addProvider(
        'user1',
        'openai',
        'OpenAI',
        'sk-key'
      );

      // Manually set tokens for testing
      const config = service.getProvider(provider.id)!;
      (config as any).totalTokens = 1000;

      const usage = service.getUsage(provider.id, 'user1');

      expect(usage?.estimatedCost.amount).toBeGreaterThan(0);
      expect(usage?.estimatedCost.currency).toBe('USD');
    });
  });

  describe('Static Methods', () => {
    it('should_return_supported_providers', () => {
      const providers = AIService.getSupportedProviders();

      expect(providers.openai).toBeDefined();
      expect(providers.anthropic).toBeDefined();
      expect(providers.deepseek).toBeDefined();
      expect(providers.ollama).toBeDefined();
    });
  });
});
