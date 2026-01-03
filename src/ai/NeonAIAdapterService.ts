import type { AIAdapter } from './adapters';
import type {
  ChatCompletionResult,
  SentimentResult,
  TradingSignalResult,
  ChatCompletionParams,
  SentimentParams,
  TradingSignalParams,
} from './adapters/types';

export interface NeonAIProvider {
  id: string;
  userId: string;
  provider: string;
  name: string;
  status: string;
  defaultModel?: string;
  encryptedApiKey: string;
}

export interface NeonAIProviderRepository {
  findById(id: string): Promise<NeonAIProvider | null>;
  incrementUsage(id: string, tokens: number, requests?: number): Promise<void>;
}

export interface NeonAIAdapterServiceOptions {
  providers: NeonAIProviderRepository;
  decryptApiKey: (encrypted: string) => string;
  adapterFactory: (provider: string, config: { apiKey: string; model?: string }) => AIAdapter | null;
  logUsage?: (entry: {
    providerId: string;
    userId: string;
    model: string | undefined;
    requestType: 'chat' | 'sentiment' | 'signal';
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }) => Promise<void> | void;
}

export class NeonAIAdapterService {
  private providers: NeonAIProviderRepository;
  private decryptApiKey: (encrypted: string) => string;
  private adapterFactory: (provider: string, config: { apiKey: string; model?: string }) => AIAdapter | null;
  private logUsage?: NeonAIAdapterServiceOptions['logUsage'];

  constructor(options: NeonAIAdapterServiceOptions) {
    this.providers = options.providers;
    this.decryptApiKey = options.decryptApiKey;
    this.adapterFactory = options.adapterFactory;
    this.logUsage = options.logUsage;
  }

  getRuntimeStatus(): { adapterFactoryConfigured: boolean } {
    return {
      adapterFactoryConfigured: !!this.adapterFactory,
    };
  }

  private async getActiveProviderForUser(providerId: string, userId: string): Promise<NeonAIProvider> {
    const provider = await this.providers.findById(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }
    if (provider.userId !== userId) {
      throw new Error('Access denied');
    }
    if (provider.status !== 'active') {
      throw new Error('Provider is not active');
    }
    return provider;
  }

  private async getAdapter(provider: NeonAIProvider, model?: string): Promise<AIAdapter> {
    const apiKey = this.decryptApiKey(provider.encryptedApiKey);
    const adapter = this.adapterFactory(provider.provider, {
      apiKey,
      model: model || provider.defaultModel,
    });

    if (!adapter) {
      throw new Error('Unsupported AI provider');
    }

    return adapter;
  }

  async testConnection(providerId: string, userId: string): Promise<{ valid: boolean; models: string[] }> {
    const provider = await this.getActiveProviderForUser(providerId, userId);
    const adapter = await this.getAdapter(provider);

    const result = await adapter.testConnection();
    return {
      valid: result.valid,
      models: result.models,
    };
  }

  async chat(
    providerId: string,
    userId: string,
    params: ChatCompletionParams
  ): Promise<ChatCompletionResult> {
    const provider = await this.getActiveProviderForUser(providerId, userId);
    const adapter = await this.getAdapter(provider, params.model);

    const result = await adapter.chat(params);

    const totalTokens = result.usage?.totalTokens ?? 0;
    if (totalTokens > 0) {
      await this.providers.incrementUsage(provider.id, totalTokens, 1);
    }

    if (this.logUsage) {
      const usage = result.usage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens,
      };
      await this.logUsage({
        providerId: provider.id,
        userId,
        model: result.model,
        requestType: 'chat',
        usage: {
          promptTokens: usage.promptTokens ?? 0,
          completionTokens: usage.completionTokens ?? 0,
          totalTokens: usage.totalTokens ?? totalTokens,
        },
      });
    }

    return result;
  }

  async analyzeSentiment(
    providerId: string,
    userId: string,
    params: SentimentParams
  ): Promise<SentimentResult> {
    const provider = await this.getActiveProviderForUser(providerId, userId);
    const adapter = await this.getAdapter(provider);

    const result = await adapter.analyzeSentiment(params);

    await this.providers.incrementUsage(provider.id, 300, 1);

    if (this.logUsage) {
      await this.logUsage({
        providerId: provider.id,
        userId,
        model: undefined,
        requestType: 'sentiment',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 300,
        },
      });
    }

    return result;
  }

  async generateSignal(
    providerId: string,
    userId: string,
    params: TradingSignalParams
  ): Promise<TradingSignalResult> {
    const provider = await this.getActiveProviderForUser(providerId, userId);
    const adapter = await this.getAdapter(provider);

    const result = await adapter.generateSignal(params);

    await this.providers.incrementUsage(provider.id, 500, 1);

    if (this.logUsage) {
      await this.logUsage({
        providerId: provider.id,
        userId,
        model: undefined,
        requestType: 'signal',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 500,
        },
      });
    }

    return result;
  }
}
