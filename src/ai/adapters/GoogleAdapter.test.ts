/**
 * Google Gemini Adapter Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleAdapter } from './GoogleAdapter';

const mockFetch = vi.fn();
// @ts-expect-error - assign to global for tests
global.fetch = mockFetch;

describe('GoogleAdapter (Gemini)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should_create_adapter_with_valid_config', () => {
      const adapter = new GoogleAdapter({
        apiKey: 'google-api-key',
        model: 'gemini-pro',
      });

      expect(adapter.name).toBe('Google Gemini');
      expect(adapter.provider).toBe('google');
    });

    it('should_throw_error_without_api_key', () => {
      expect(() => new GoogleAdapter({ apiKey: '' })).toThrow('Google Gemini API key is required');
    });

    it('should_throw_error_for_unsupported_model', () => {
      expect(() => new GoogleAdapter({
        apiKey: 'google-api-key',
        model: 'unsupported-model',
      })).toThrow('Unsupported model');
    });
  });

  describe('testConnection', () => {
    it('should_return_valid_true_on_success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'models/gemini-pro' },
            { name: 'models/gemini-1.5-pro' },
          ],
        }),
      });

      const adapter = new GoogleAdapter({ apiKey: 'google-key' });
      const result = await adapter.testConnection();

      expect(result.valid).toBe(true);
      expect(result.models).toContain('gemini-pro');
      expect(result.models).toContain('gemini-1.5-pro');
    });

    it('should_return_valid_false_on_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid API key' } }),
      });

      const adapter = new GoogleAdapter({ apiKey: 'bad-key' });
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
          candidates: [
            {
              content: {
                parts: [{ text: 'Hello from Gemini!' }],
              },
              finishReason: 'stop',
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        }),
      });

      const adapter = new GoogleAdapter({ apiKey: 'google-key' });
      const result = await adapter.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.content).toBe('Hello from Gemini!');
      expect(result.usage.totalTokens).toBe(15);
    });

    it('should_throw_on_api_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      });

      const adapter = new GoogleAdapter({ apiKey: 'google-key' });

      await expect(
        adapter.chat({ messages: [{ role: 'user', content: 'Test' }] })
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('analyzeSentiment', () => {
    it('should_return_parsed_sentiment', async () => {
      const jsonPayload = JSON.stringify({
        sentiment: 'bullish',
        score: 0.9,
        confidence: 0.95,
        reasoning: 'Strong uptrend',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: jsonPayload }],
              },
            },
          ],
        }),
      });

      const adapter = new GoogleAdapter({ apiKey: 'google-key' });
      const result = await adapter.analyzeSentiment({
        text: 'Bitcoin is mooning!',
        symbol: 'BTC',
      });

      expect(result.sentiment).toBe('bullish');
      expect(result.score).toBeCloseTo(0.9, 5);
      expect(result.confidence).toBeCloseTo(0.95, 5);
    });
  });

  describe('generateSignal', () => {
    it('should_return_parsed_signal', async () => {
      const jsonPayload = JSON.stringify({
        action: 'buy',
        confidence: 0.8,
        reasoning: 'RSI oversold',
        suggestedSize: 0.2,
        stopLoss: 95,
        takeProfit: 110,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: jsonPayload }],
              },
            },
          ],
        }),
      });

      const adapter = new GoogleAdapter({ apiKey: 'google-key' });
      const result = await adapter.generateSignal({
        symbol: 'BTCUSDT',
        price: 100,
        indicators: { rsi: 30 },
      });

      expect(result.action).toBe('buy');
      expect(result.confidence).toBeCloseTo(0.8, 5);
      expect(result.suggestedSize).toBeCloseTo(0.2, 5);
      expect(result.stopLoss).toBe(95);
      expect(result.takeProfit).toBe(110);
    });
  });
});

