/**
 * Ollama Adapter Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaAdapter } from './OllamaAdapter';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OllamaAdapter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should_create_adapter_without_api_key', () => {
      const adapter = new OllamaAdapter({
        apiKey: '', // Not required for Ollama
        model: 'llama3.2',
      });

      expect(adapter.name).toBe('Ollama');
      expect(adapter.provider).toBe('ollama');
    });

    it('should_default_to_llama3.2', () => {
      const adapter = new OllamaAdapter({ apiKey: '' });
      const models = adapter.getSupportedModels();

      expect(models).toContain('llama3.2');
    });

    it('should_use_custom_base_url', () => {
      const adapter = new OllamaAdapter({
        apiKey: '',
        baseUrl: 'http://192.168.1.100:11434',
      });

      expect(adapter.name).toBe('Ollama');
    });
  });

  describe('testConnection', () => {
    it('should_return_valid_true_when_ollama_running', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama3.2:latest' },
            { name: 'mistral:latest' },
          ],
        }),
      });

      const adapter = new OllamaAdapter({ apiKey: '' });
      const result = await adapter.testConnection();

      expect(result.valid).toBe(true);
      expect(result.models).toContain('llama3.2:latest');
      expect(result.models).toContain('mistral:latest');
    });

    it('should_return_helpful_error_when_ollama_not_running', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED'));

      const adapter = new OllamaAdapter({ apiKey: '' });
      const result = await adapter.testConnection();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Ollama not running');
    });

    it('should_warn_if_model_not_available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'mistral:latest' },
          ],
        }),
      });

      const adapter = new OllamaAdapter({ apiKey: '', model: 'llama3.2' });
      const result = await adapter.testConnection();

      expect(result.valid).toBe(true);
      expect(result.error).toContain("Model 'llama3.2' not found");
    });
  });

  describe('chat', () => {
    it('should_return_completion_on_success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3.2',
          message: { content: 'Hello! I can help you with trading.' },
          done: true,
          prompt_eval_count: 10,
          eval_count: 15,
        }),
      });

      const adapter = new OllamaAdapter({ apiKey: '' });
      const result = await adapter.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.content).toBe('Hello! I can help you with trading.');
      expect(result.model).toBe('llama3.2');
      expect(result.usage.totalTokens).toBe(25);
      expect(result.finishReason).toBe('stop');
    });

    it('should_throw_on_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Model not found',
      });

      const adapter = new OllamaAdapter({ apiKey: '' });

      await expect(
        adapter.chat({ messages: [{ role: 'user', content: 'Test' }] })
      ).rejects.toThrow('Model not found');
    });
  });

  describe('analyzeSentiment', () => {
    it('should_return_bullish_sentiment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3.2',
          message: {
            content: JSON.stringify({
              sentiment: 'bullish',
              score: 0.7,
              confidence: 0.8,
              reasoning: 'Positive momentum',
            }),
          },
          done: true,
        }),
      });

      const adapter = new OllamaAdapter({ apiKey: '' });
      const result = await adapter.analyzeSentiment({
        text: 'Bitcoin breaking out!',
        symbol: 'BTC',
      });

      expect(result.sentiment).toBe('bullish');
      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should_handle_non_json_response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3.2',
          message: { content: 'The market appears bearish due to negative news.' },
          done: true,
        }),
      });

      const adapter = new OllamaAdapter({ apiKey: '' });
      const result = await adapter.analyzeSentiment({ text: 'Bad news' });

      expect(result.sentiment).toBe('bearish');
    });
  });

  describe('generateSignal', () => {
    it('should_generate_buy_signal', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3.2',
          message: {
            content: JSON.stringify({
              action: 'buy',
              confidence: 0.65,
              reasoning: 'RSI oversold',
              suggestedSize: 0.05,
            }),
          },
          done: true,
        }),
      });

      const adapter = new OllamaAdapter({ apiKey: '' });
      const result = await adapter.generateSignal({
        symbol: 'ETH/USDT',
        price: 2500,
        indicators: { rsi: 25 },
      });

      expect(result.action).toBe('buy');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should_handle_parse_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3.2',
          message: { content: 'I cannot determine a signal.' },
          done: true,
        }),
      });

      const adapter = new OllamaAdapter({ apiKey: '' });
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
    it('should_return_conservative_capabilities', () => {
      const adapter = new OllamaAdapter({ apiKey: '' });
      const caps = adapter.getCapabilities();

      expect(caps.streaming).toBe(true);
      expect(caps.functionCalling).toBe(false);
      expect(caps.vision).toBe(false);
      expect(caps.maxContextTokens).toBe(8192);
    });
  });

  describe('getSupportedModels', () => {
    it('should_return_default_models', () => {
      const adapter = new OllamaAdapter({ apiKey: '' });
      const models = adapter.getSupportedModels();

      expect(models).toContain('llama3.2');
      expect(models).toContain('llama3.1');
      expect(models).toContain('mistral');
      expect(models).toContain('codellama');
    });
  });
});
