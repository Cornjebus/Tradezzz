import { describe, it, expect, beforeEach } from 'vitest';
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
import { NeonAIAdapterService, NeonAIProvider, NeonAIProviderRepository } from './NeonAIAdapterService';

class StubAdapter implements AIAdapter {
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
      content: 'stubbed chat',
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
      reasoning: 'stubbed sentiment',
    };
  }

  async generateSignal(params: TradingSignalParams): Promise<TradingSignalResult> {
    return {
      action: 'buy',
      confidence: 0.75,
      reasoning: 'stubbed signal',
      suggestedSize: 0.1,
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

describe('NeonAIAdapterService', () => {
  let service: NeonAIAdapterService;
  let providers: Map<string, NeonAIProvider>;
  let repo: NeonAIProviderRepository;

  beforeEach(() => {
    providers = new Map<string, NeonAIProvider>();

    repo = {
      async findById(id: string): Promise<NeonAIProvider | null> {
        return providers.get(id) || null;
      },
      async incrementUsage(id: string, tokens: number, requests: number = 1): Promise<void> {
        const provider = providers.get(id);
        if (!provider) {
          throw new Error('Provider not found');
        }
        // For this test, we don't track totals exhaustively; presence of call is enough.
      },
    };

    const adapter = new StubAdapter();

    service = new NeonAIAdapterService({
      providers: repo,
      decryptApiKey: (encrypted: string) => encrypted,
      adapterFactory: (provider: string) => {
        if (provider === 'openai') {
          return adapter;
        }
        return null;
      },
    });
  });

  function addProvider(overrides: Partial<NeonAIProvider> = {}): NeonAIProvider {
    const base: NeonAIProvider = {
      id: 'prov-1',
      userId: 'user-1',
      provider: 'openai',
      name: 'Stub OpenAI',
      status: 'active',
      defaultModel: 'stub-model',
      encryptedApiKey: 'sk-test',
    };
    const provider = { ...base, ...overrides };
    providers.set(provider.id, provider);
    return provider;
  }

  it('should_test_connection_via_adapter', async () => {
    const provider = addProvider();

    const result = await service.testConnection(provider.id, 'user-1');

    expect(result.valid).toBe(true);
    expect(result.models).toContain('stub-model');
  });

  it('should_delegate_chat_to_adapter', async () => {
    const provider = addProvider();

    const result = await service.chat(provider.id, 'user-1', {
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.content).toBe('stubbed chat');
    expect(result.usage.totalTokens).toBe(15);
  });

  it('should_delegate_sentiment_to_adapter', async () => {
    const provider = addProvider();

    const result = await service.analyzeSentiment(provider.id, 'user-1', {
      text: 'Very bullish outlook',
      symbol: 'BTCUSDT',
    });

    expect(result.sentiment).toBe('bullish');
    expect(result.reasoning).toBe('stubbed sentiment');
  });

  it('should_delegate_signal_to_adapter', async () => {
    const provider = addProvider();

    const result = await service.generateSignal(provider.id, 'user-1', {
      symbol: 'BTCUSDT',
      price: 50000,
      indicators: { rsi: 30 },
    });

    expect(result.action).toBe('buy');
    expect(result.suggestedSize).toBeCloseTo(0.1, 5);
  });

  it('should_enforce_user_ownership', async () => {
    const provider = addProvider({ userId: 'other-user' });

    await expect(
      service.chat(provider.id, 'user-1', {
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toThrow('Access denied');
  });

  it('should_reject_inactive_providers', async () => {
    const provider = addProvider({ status: 'inactive' });

    await expect(
      service.chat(provider.id, 'user-1', {
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toThrow('Provider is not active');
  });
});

