/**
 * Anthropic Adapter Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicAdapter } from './AnthropicAdapter';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AnthropicAdapter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should_create_adapter_with_valid_config', () => {
      const adapter = new AnthropicAdapter({
        apiKey: 'sk-ant-test-key',
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(adapter.name).toBe('Anthropic');
      expect(adapter.provider).toBe('anthropic');
    });

    it('should_throw_error_without_api_key', () => {
      expect(() => new AnthropicAdapter({ apiKey: '' })).toThrow('Anthropic API key is required');
    });

    it('should_throw_error_for_unsupported_model', () => {
      expect(() => new AnthropicAdapter({
        apiKey: 'sk-ant-test',
        model: 'claude-99-ultra'
      })).toThrow('Unsupported model');
    });

    it('should_default_to_claude-3-5-sonnet', () => {
      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test' });
      const capabilities = adapter.getCapabilities();

      expect(capabilities.maxContextTokens).toBe(200000);
      expect(capabilities.maxOutputTokens).toBe(8192);
    });
  });

  describe('testConnection', () => {
    it('should_return_valid_true_on_success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg_123',
          type: 'message',
          content: [{ type: 'text', text: 'Hi!' }],
          model: 'claude-3-5-sonnet-20241022',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test' });
      const result = await adapter.testConnection();

      expect(result.valid).toBe(true);
      expect(result.models).toContain('claude-3-5-sonnet-20241022');
      expect(result.models).toContain('claude-3-opus-20240229');
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

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-invalid' });
      const result = await adapter.testConnection();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should_return_valid_false_on_network_error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test' });
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
          id: 'msg_123',
          type: 'message',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Hello! How can I help you today?' }],
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 10,
            output_tokens: 8,
          },
        }),
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test' });
      const result = await adapter.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.content).toBe('Hello! How can I help you today?');
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.usage.totalTokens).toBe(18);
      expect(result.finishReason).toBe('stop');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should_handle_system_message_correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Response' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 20, output_tokens: 5 },
        }),
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test' });
      await adapter.chat({
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"system":"You are a helpful assistant"'),
        })
      );
    });

    it('should_throw_on_api_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: { message: 'Rate limit exceeded' },
        }),
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test' });

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
          model: 'claude-3-5-sonnet-20241022',
          content: [{
            type: 'text',
            text: JSON.stringify({
              sentiment: 'bullish',
              score: 0.8,
              confidence: 0.9,
              reasoning: 'Strong positive indicators',
            }),
          }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 50, output_tokens: 30 },
        }),
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test' });
      const result = await adapter.analyzeSentiment({
        text: 'Bitcoin is mooning! ATH incoming!',
        symbol: 'BTC',
      });

      expect(result.sentiment).toBe('bullish');
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should_return_bearish_sentiment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'claude-3-5-sonnet-20241022',
          content: [{
            type: 'text',
            text: JSON.stringify({
              sentiment: 'bearish',
              score: -0.7,
              confidence: 0.85,
              reasoning: 'Market showing weakness',
            }),
          }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 50, output_tokens: 30 },
        }),
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test' });
      const result = await adapter.analyzeSentiment({
        text: 'Crypto crash imminent!',
      });

      expect(result.sentiment).toBe('bearish');
      expect(result.score).toBeLessThan(-0.5);
    });

    it('should_handle_non_json_response_gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'claude-3-5-sonnet-20241022',
          content: [{
            type: 'text',
            text: 'The sentiment appears to be neutral.',
          }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 50, output_tokens: 30 },
        }),
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test' });
      const result = await adapter.analyzeSentiment({ text: 'Market is flat' });

      expect(result.sentiment).toBe('neutral');
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('generateSignal', () => {
    it('should_generate_buy_signal', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'claude-3-5-sonnet-20241022',
          content: [{
            type: 'text',
            text: JSON.stringify({
              action: 'buy',
              confidence: 0.75,
              reasoning: 'RSI oversold, MACD bullish crossover',
              suggestedSize: 0.1,
              stopLoss: 44000,
              takeProfit: 48000,
            }),
          }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test' });
      const result = await adapter.generateSignal({
        symbol: 'BTC/USDT',
        price: 45000,
        indicators: { rsi: 28, macd: 150 },
      });

      expect(result.action).toBe('buy');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.stopLoss).toBe(44000);
      expect(result.takeProfit).toBe(48000);
    });

    it('should_generate_hold_signal_on_parse_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'claude-3-5-sonnet-20241022',
          content: [{
            type: 'text',
            text: 'Unable to determine signal.',
          }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 20 },
        }),
      });

      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test' });
      const result = await adapter.generateSignal({
        symbol: 'BTC/USDT',
        price: 45000,
        indicators: {},
      });

      expect(result.action).toBe('hold');
      expect(result.confidence).toBe(0);
    });
  });

  describe('getCapabilities', () => {
    it('should_return_claude-3-5-sonnet_capabilities', () => {
      const adapter = new AnthropicAdapter({
        apiKey: 'sk-ant-test',
        model: 'claude-3-5-sonnet-20241022',
      });
      const caps = adapter.getCapabilities();

      expect(caps.streaming).toBe(true);
      expect(caps.functionCalling).toBe(true);
      expect(caps.vision).toBe(true);
      expect(caps.maxContextTokens).toBe(200000);
      expect(caps.maxOutputTokens).toBe(8192);
    });

    it('should_return_claude-3-opus_capabilities', () => {
      const adapter = new AnthropicAdapter({
        apiKey: 'sk-ant-test',
        model: 'claude-3-opus-20240229',
      });
      const caps = adapter.getCapabilities();

      expect(caps.maxOutputTokens).toBe(4096);
    });
  });

  describe('getSupportedModels', () => {
    it('should_return_all_supported_models', () => {
      const adapter = new AnthropicAdapter({ apiKey: 'sk-ant-test' });
      const models = adapter.getSupportedModels();

      expect(models).toContain('claude-3-5-sonnet-20241022');
      expect(models).toContain('claude-3-opus-20240229');
      expect(models).toContain('claude-3-sonnet-20240229');
      expect(models).toContain('claude-3-haiku-20240307');
    });
  });
});
