import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AIProviderService,
  AIProviderType,
  ChatMessage,
} from './AIProviderService';
import { ConfigService } from '../config/ConfigService';
import { MockDatabase, createMockDatabase } from '../../tests/helpers/mock-db';
import type { AIAdapter } from './adapters';
import type {
  ChatCompletionParams,
  ChatCompletionResult,
  SentimentParams,
  SentimentResult,
  TradingSignalParams,
  TradingSignalResult,
  TestConnectionResult,
} from './adapters/types';

class StubAIAdapter implements AIAdapter {
  readonly name = 'Stub';
  readonly provider = 'openai';

  async testConnection(): Promise<TestConnectionResult> {
    return {
      valid: true,
      models: ['stub-model'],
      latencyMs: 1,
    };
  }

  async chat(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    return {
      content: 'stubbed response',
      model: params.model || 'stub-model',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
      finishReason: 'stop',
      latencyMs: 5,
    };
  }

  async analyzeSentiment(params: SentimentParams): Promise<SentimentResult> {
    return {
      sentiment: 'bullish',
      score: 0.8,
      confidence: 0.9,
      reasoning: 'stubbed',
    };
  }

  async generateSignal(params: TradingSignalParams): Promise<TradingSignalResult> {
    return {
      action: 'buy',
      confidence: 0.8,
      reasoning: 'stubbed',
      suggestedSize: 1,
      stopLoss: params.price * 0.95,
      takeProfit: params.price * 1.1,
    };
  }

  getCapabilities() {
    return {
      streaming: false,
      functionCalling: false,
      vision: false,
      maxContextTokens: 8192,
      maxOutputTokens: 1024,
    };
  }

  getSupportedModels(): string[] {
    return ['stub-model'];
  }
}

describe('AIProviderService with adapterFactory', () => {
  let aiService: AIProviderService;
  let configService: ConfigService;
  let db: MockDatabase;
  let userId: string;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'test');
    db = createMockDatabase();
    configService = new ConfigService({ db });

    const adapter = new StubAIAdapter();
    const adapterFactory = (provider: AIProviderType, config: { apiKey: string; model?: string }): AIAdapter | null => {
      if (provider === 'openai') {
        return adapter;
      }
      return null;
    };

    aiService = new AIProviderService({
      db,
      configService,
      encryptionKey: 'test-encryption-key-32-characters!',
      adapterFactory,
    });

    const user = await db.users.create({
      email: 'adapter@example.com',
      passwordHash: 'hashed',
      tier: 'pro',
    });
    userId = user.id;
  });

  it('should_delegate_chat_to_adapter_when_factory_is_provided', async () => {
    const provider = await aiService.createProvider({
      userId,
      provider: 'openai',
      name: 'Stub OpenAI',
      apiKey: 'stub-key',
    });

    const response = await aiService.chat(provider.id, {
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(response.content).toBe('stubbed response');
    expect(response.model).toBeDefined();
    expect(response.usage.totalTokens).toBe(15);

    const usage = await aiService.getProviderUsage(provider.id);
    expect(usage.totalTokens).toBe(15);
    expect(usage.requestCount).toBe(1);
  });

  it('should_report_adapterFactoryConfigured_true_when_factory_is_injected', () => {
    const status = aiService.getRuntimeStatus();
    expect(status.adapterFactoryConfigured).toBe(true);
  });

  it('should_delegate_sentiment_to_adapter_when_available', async () => {
    const provider = await aiService.createProvider({
      userId,
      provider: 'openai',
      name: 'Stub OpenAI',
      apiKey: 'stub-key',
    });

    const result = await aiService.analyzeSentiment(provider.id, {
      text: 'Market looks very strong and bullish here',
      symbol: 'BTCUSDT',
    });

    expect(result.sentiment).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.reasoning).toBe('stubbed');

    const usage = await aiService.getProviderUsage(provider.id);
    expect(usage.totalTokens).toBeGreaterThan(0);
    expect(usage.requestCount).toBe(1);
  });

  it('should_delegate_signal_generation_to_adapter_when_available', async () => {
    const provider = await aiService.createProvider({
      userId,
      provider: 'openai',
      name: 'Stub OpenAI',
      apiKey: 'stub-key',
    });

    const priceData = [
      { open: 100, high: 105, low: 95, close: 98, volume: 1000 },
      { open: 98, high: 110, low: 97, close: 100, volume: 1500 },
    ];

    const signal = await aiService.generateSignal(provider.id, {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      priceData,
      indicators: { rsi: 55 },
    });

    expect(signal.action).toBe('buy');
    expect(signal.confidence).toBeCloseTo(0.8, 5);
    expect(signal.reasoning).toBe('stubbed');
    expect(signal.entryPrice).toBe(100);
    expect(signal.stopLoss).toBeCloseTo(95, 5);
    expect(signal.takeProfit).toBeCloseTo(110, 5);
    expect(signal.riskRewardRatio).toBeCloseTo(2, 5);

    const usage = await aiService.getProviderUsage(provider.id);
    expect(usage.totalTokens).toBeGreaterThan(0);
    expect(usage.requestCount).toBe(1);
  });
});
