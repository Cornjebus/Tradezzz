/**
 * OpenAI Adapter Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIAdapter } from './OpenAIAdapter';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OpenAIAdapter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should_create_adapter_with_valid_config', () => {
      const adapter = new OpenAIAdapter({
        apiKey: 'sk-test-key',
        model: 'gpt-4o-mini',
      });

      expect(adapter.name).toBe('OpenAI');
      expect(adapter.provider).toBe('openai');
    });

    it('should_throw_error_without_api_key', () => {
      expect(() => new OpenAIAdapter({ apiKey: '' })).toThrow('OpenAI API key is required');
    });

    it('should_throw_error_for_unsupported_model', () => {
      expect(() => new OpenAIAdapter({
        apiKey: 'sk-test',
        model: 'gpt-99-ultra'
      })).toThrow('Unsupported model');
    });

    it('should_default_to_gpt-4o-mini', () => {
      const adapter = new OpenAIAdapter({ apiKey: 'sk-test' });
      const capabilities = adapter.getCapabilities();

      expect(capabilities.maxContextTokens).toBe(128000);
    });
  });

  describe('testConnection', () => {
    it('should_return_valid_true_on_success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4o' },
            { id: 'gpt-4o-mini' },
            { id: 'gpt-3.5-turbo' },
          ],
        }),
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test' });
      const result = await adapter.testConnection();

      expect(result.valid).toBe(true);
      expect(result.models).toContain('gpt-4o');
      expect(result.models).toContain('gpt-4o-mini');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should_return_valid_false_on_auth_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid API key' },
        }),
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-invalid' });
      const result = await adapter.testConnection();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should_return_valid_false_on_network_error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test' });
      const result = await adapter.testConnection();

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('chat', () => {
    it('should_return_completion_on_success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4o-mini',
          choices: [{
            message: { content: 'Hello! How can I help you?' },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 8,
            total_tokens: 18,
          },
        }),
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test' });
      const result = await adapter.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.content).toBe('Hello! How can I help you?');
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.usage.totalTokens).toBe(18);
      expect(result.finishReason).toBe('stop');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should_throw_on_api_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: { message: 'Rate limit exceeded' },
        }),
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test' });

      await expect(
        adapter.chat({ messages: [{ role: 'user', content: 'Test' }] })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should_use_custom_model_when_provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'gpt-4',
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test' });
      await adapter.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gpt-4',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"model":"gpt-4"'),
        })
      );
    });
  });

  describe('analyzeSentiment', () => {
    it('should_return_bullish_sentiment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'bullish',
                score: 0.8,
                confidence: 0.9,
                reasoning: 'Strong positive indicators',
              }),
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
        }),
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test' });
      const result = await adapter.analyzeSentiment({
        text: 'Bitcoin is mooning! ATH incoming!',
        symbol: 'BTC',
      });

      expect(result.sentiment).toBe('bullish');
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning).toBeDefined();
    });

    it('should_return_bearish_sentiment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'bearish',
                score: -0.7,
                confidence: 0.85,
                reasoning: 'Market showing weakness',
              }),
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
        }),
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test' });
      const result = await adapter.analyzeSentiment({
        text: 'Crypto crash imminent, sell everything!',
        symbol: 'BTC',
      });

      expect(result.sentiment).toBe('bearish');
      expect(result.score).toBeLessThan(-0.5);
    });

    it('should_handle_non_json_response_gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [{
            message: { content: 'The sentiment appears to be neutral with mixed signals.' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
        }),
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test' });
      const result = await adapter.analyzeSentiment({
        text: 'Market is flat today',
      });

      expect(result.sentiment).toBe('neutral');
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('generateSignal', () => {
    it('should_generate_buy_signal', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [{
            message: {
              content: JSON.stringify({
                action: 'buy',
                confidence: 0.75,
                reasoning: 'RSI oversold, MACD bullish crossover',
                suggestedSize: 0.1,
                stopLoss: 44000,
                takeProfit: 48000,
              }),
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        }),
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test' });
      const result = await adapter.generateSignal({
        symbol: 'BTC/USDT',
        price: 45000,
        indicators: { rsi: 28, macd: 150, volume: 1000000 },
      });

      expect(result.action).toBe('buy');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.suggestedSize).toBe(0.1);
      expect(result.stopLoss).toBe(44000);
      expect(result.takeProfit).toBe(48000);
    });

    it('should_generate_hold_signal_on_parse_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [{
            message: { content: 'Unable to determine signal.' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
        }),
      });

      const adapter = new OpenAIAdapter({ apiKey: 'sk-test' });
      const result = await adapter.generateSignal({
        symbol: 'BTC/USDT',
        price: 45000,
        indicators: {},
      });

      expect(result.action).toBe('hold');
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Failed to parse');
    });
  });

  describe('getCapabilities', () => {
    it('should_return_gpt-4o_capabilities', () => {
      const adapter = new OpenAIAdapter({ apiKey: 'sk-test', model: 'gpt-4o' });
      const caps = adapter.getCapabilities();

      expect(caps.streaming).toBe(true);
      expect(caps.functionCalling).toBe(true);
      expect(caps.vision).toBe(true);
      expect(caps.maxContextTokens).toBe(128000);
    });

    it('should_return_gpt-4_capabilities', () => {
      const adapter = new OpenAIAdapter({ apiKey: 'sk-test', model: 'gpt-4' });
      const caps = adapter.getCapabilities();

      expect(caps.vision).toBe(false);
      expect(caps.maxContextTokens).toBe(8192);
    });
  });

  describe('getSupportedModels', () => {
    it('should_return_all_supported_models', () => {
      const adapter = new OpenAIAdapter({ apiKey: 'sk-test' });
      const models = adapter.getSupportedModels();

      expect(models).toContain('gpt-4o');
      expect(models).toContain('gpt-4o-mini');
      expect(models).toContain('gpt-4-turbo');
      expect(models).toContain('gpt-4');
      expect(models).toContain('gpt-3.5-turbo');
    });
  });
});
