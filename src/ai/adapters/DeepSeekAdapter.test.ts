/**
 * DeepSeek Adapter Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeepSeekAdapter } from './DeepSeekAdapter';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DeepSeekAdapter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should_create_adapter_with_valid_config', () => {
      const adapter = new DeepSeekAdapter({
        apiKey: 'sk-deepseek-test',
        model: 'deepseek-chat',
      });

      expect(adapter.name).toBe('DeepSeek');
      expect(adapter.provider).toBe('deepseek');
    });

    it('should_throw_error_without_api_key', () => {
      expect(() => new DeepSeekAdapter({ apiKey: '' })).toThrow('DeepSeek API key is required');
    });

    it('should_throw_error_for_unsupported_model', () => {
      expect(() => new DeepSeekAdapter({
        apiKey: 'sk-test',
        model: 'deepseek-ultra'
      })).toThrow('Unsupported model');
    });

    it('should_default_to_deepseek-chat', () => {
      const adapter = new DeepSeekAdapter({ apiKey: 'sk-test' });
      const capabilities = adapter.getCapabilities();

      expect(capabilities.maxContextTokens).toBe(64000);
    });
  });

  describe('testConnection', () => {
    it('should_return_valid_true_on_success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'deepseek-chat' }] }),
      });

      const adapter = new DeepSeekAdapter({ apiKey: 'sk-test' });
      const result = await adapter.testConnection();

      expect(result.valid).toBe(true);
      expect(result.models).toContain('deepseek-chat');
      expect(result.models).toContain('deepseek-coder');
    });

    it('should_return_valid_false_on_auth_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid API key' } }),
      });

      const adapter = new DeepSeekAdapter({ apiKey: 'sk-invalid' });
      const result = await adapter.testConnection();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });
  });

  describe('chat', () => {
    it('should_return_completion_on_success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'deepseek-chat',
          choices: [{
            message: { content: 'Hello! How can I help?' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        }),
      });

      const adapter = new DeepSeekAdapter({ apiKey: 'sk-test' });
      const result = await adapter.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.content).toBe('Hello! How can I help?');
      expect(result.usage.totalTokens).toBe(18);
    });

    it('should_throw_on_api_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      });

      const adapter = new DeepSeekAdapter({ apiKey: 'sk-test' });

      await expect(
        adapter.chat({ messages: [{ role: 'user', content: 'Test' }] })
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('analyzeSentiment', () => {
    it('should_return_bullish_sentiment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'deepseek-chat',
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'bullish',
                score: 0.8,
                confidence: 0.9,
                reasoning: 'Strong indicators',
              }),
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
        }),
      });

      const adapter = new DeepSeekAdapter({ apiKey: 'sk-test' });
      const result = await adapter.analyzeSentiment({
        text: 'Bitcoin mooning!',
        symbol: 'BTC',
      });

      expect(result.sentiment).toBe('bullish');
      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should_handle_non_json_response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'deepseek-chat',
          choices: [{
            message: { content: 'The sentiment is neutral.' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
        }),
      });

      const adapter = new DeepSeekAdapter({ apiKey: 'sk-test' });
      const result = await adapter.analyzeSentiment({ text: 'Market flat' });

      expect(result.sentiment).toBe('neutral');
    });
  });

  describe('generateSignal', () => {
    it('should_generate_buy_signal', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'deepseek-chat',
          choices: [{
            message: {
              content: JSON.stringify({
                action: 'buy',
                confidence: 0.75,
                reasoning: 'Bullish crossover',
                suggestedSize: 0.1,
              }),
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        }),
      });

      const adapter = new DeepSeekAdapter({ apiKey: 'sk-test' });
      const result = await adapter.generateSignal({
        symbol: 'BTC/USDT',
        price: 45000,
        indicators: { rsi: 28 },
      });

      expect(result.action).toBe('buy');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('getCapabilities', () => {
    it('should_return_deepseek-chat_capabilities', () => {
      const adapter = new DeepSeekAdapter({ apiKey: 'sk-test', model: 'deepseek-chat' });
      const caps = adapter.getCapabilities();

      expect(caps.streaming).toBe(true);
      expect(caps.functionCalling).toBe(true);
      expect(caps.vision).toBe(false);
      expect(caps.maxContextTokens).toBe(64000);
    });

    it('should_return_deepseek-coder_capabilities', () => {
      const adapter = new DeepSeekAdapter({ apiKey: 'sk-test', model: 'deepseek-coder' });
      const caps = adapter.getCapabilities();

      expect(caps.maxContextTokens).toBe(64000);
    });
  });

  describe('getSupportedModels', () => {
    it('should_return_all_supported_models', () => {
      const adapter = new DeepSeekAdapter({ apiKey: 'sk-test' });
      const models = adapter.getSupportedModels();

      expect(models).toContain('deepseek-chat');
      expect(models).toContain('deepseek-coder');
      expect(models.length).toBe(2);
    });
  });
});
