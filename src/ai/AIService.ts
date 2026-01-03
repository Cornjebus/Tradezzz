/**
 * AI Service - Secure provider management with encrypted key storage
 *
 * Integrates:
 * - SecureKeyVault for API key encryption
 * - AI Adapters for real API calls
 * - Provider configuration management
 */

import { SecureKeyVault, StoredKey, KeyVaultStorage, AuditEvent } from '../security/SecureKeyVault';
import { createAdapter, SupportedProvider, PROVIDER_INFO, AIAdapter } from './adapters';
import { ChatCompletionParams, ChatCompletionResult, SentimentParams, SentimentResult, TradingSignalParams, TradingSignalResult, TestConnectionResult } from './adapters/types';

export interface ProviderConfig {
  id: string;
  userId: string;
  provider: SupportedProvider;
  name: string;
  status: 'active' | 'inactive';
  defaultModel?: string;
  totalTokens: number;
  totalRequests: number;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface AIServiceConfig {
  masterPassword: string;
  storage?: KeyVaultStorage;
  auditLog?: (event: AuditEvent) => void;
}

export class AIService {
  private vault: SecureKeyVault;
  private providers: Map<string, ProviderConfig> = new Map();
  private adapterCache: Map<string, AIAdapter> = new Map();

  constructor(config: AIServiceConfig) {
    this.vault = new SecureKeyVault({
      masterPassword: config.masterPassword,
      storage: config.storage,
      auditLog: config.auditLog,
    });
  }

  async initialize(): Promise<void> {
    await this.vault.initialize();
  }

  /**
   * Add a new AI provider with secure key storage
   */
  async addProvider(
    userId: string,
    provider: SupportedProvider,
    name: string,
    apiKey: string,
    defaultModel?: string
  ): Promise<ProviderConfig> {
    const id = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const keyId = `${userId}:${id}`;

    // Store API key securely
    await this.vault.storeKey(keyId, provider, apiKey, {
      userId,
      providerName: name,
    });

    const config: ProviderConfig = {
      id,
      userId,
      provider,
      name,
      status: 'active',
      defaultModel: defaultModel || PROVIDER_INFO[provider].defaultModel,
      totalTokens: 0,
      totalRequests: 0,
      createdAt: new Date(),
    };

    this.providers.set(id, config);

    return config;
  }

  /**
   * Get provider configuration (without decrypting key)
   */
  getProvider(id: string): ProviderConfig | null {
    return this.providers.get(id) || null;
  }

  /**
   * List all providers for a user
   */
  listProviders(userId: string): ProviderConfig[] {
    return Array.from(this.providers.values()).filter(
      (p) => p.userId === userId
    );
  }

  /**
   * Update provider configuration
   */
  async updateProvider(
    id: string,
    userId: string,
    updates: Partial<Pick<ProviderConfig, 'name' | 'defaultModel' | 'status'>>
  ): Promise<ProviderConfig | null> {
    const provider = this.providers.get(id);
    if (!provider || provider.userId !== userId) {
      return null;
    }

    if (updates.name) provider.name = updates.name;
    if (updates.defaultModel) provider.defaultModel = updates.defaultModel;
    if (updates.status) provider.status = updates.status;

    this.providers.set(id, provider);
    this.adapterCache.delete(id); // Clear cached adapter

    return provider;
  }

  /**
   * Delete a provider and its API key
   */
  async deleteProvider(id: string, userId: string): Promise<boolean> {
    const provider = this.providers.get(id);
    if (!provider || provider.userId !== userId) {
      return false;
    }

    const keyId = `${userId}:${id}`;
    await this.vault.deleteKey(keyId);
    this.providers.delete(id);
    this.adapterCache.delete(id);

    return true;
  }

  /**
   * Rotate API key for a provider
   */
  async rotateKey(id: string, userId: string, newApiKey: string): Promise<boolean> {
    const provider = this.providers.get(id);
    if (!provider || provider.userId !== userId) {
      return false;
    }

    const keyId = `${userId}:${id}`;
    await this.vault.rotateKey(keyId, newApiKey);
    this.adapterCache.delete(id); // Clear cached adapter

    return true;
  }

  /**
   * Get masked API key for display
   */
  async getMaskedKey(id: string, userId: string): Promise<string | null> {
    const provider = this.providers.get(id);
    if (!provider || provider.userId !== userId) {
      return null;
    }

    const keyId = `${userId}:${id}`;
    const apiKey = await this.vault.retrieveKey(keyId);

    if (apiKey.length <= 8) return '****';
    return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  }

  /**
   * Test provider connection
   */
  async testConnection(id: string, userId: string): Promise<TestConnectionResult> {
    const adapter = await this.getAdapter(id, userId);
    if (!adapter) {
      return {
        valid: false,
        models: [],
        error: 'Provider not found',
      };
    }

    return adapter.testConnection();
  }

  /**
   * Chat completion
   */
  async chat(
    id: string,
    userId: string,
    params: ChatCompletionParams
  ): Promise<ChatCompletionResult> {
    const adapter = await this.getAdapter(id, userId);
    if (!adapter) {
      throw new Error('Provider not found or not authorized');
    }

    const provider = this.providers.get(id)!;
    if (provider.status !== 'active') {
      throw new Error('Provider is not active');
    }

    const result = await adapter.chat(params);

    // Update usage stats
    provider.totalTokens += result.usage.totalTokens;
    provider.totalRequests++;
    provider.lastUsedAt = new Date();
    this.providers.set(id, provider);

    return result;
  }

  /**
   * Sentiment analysis
   */
  async analyzeSentiment(
    id: string,
    userId: string,
    params: SentimentParams
  ): Promise<SentimentResult> {
    const adapter = await this.getAdapter(id, userId);
    if (!adapter) {
      throw new Error('Provider not found or not authorized');
    }

    const provider = this.providers.get(id)!;
    if (provider.status !== 'active') {
      throw new Error('Provider is not active');
    }

    const result = await adapter.analyzeSentiment(params);

    // Update usage stats (estimate tokens)
    provider.totalTokens += 300;
    provider.totalRequests++;
    provider.lastUsedAt = new Date();
    this.providers.set(id, provider);

    return result;
  }

  /**
   * Generate trading signal
   */
  async generateSignal(
    id: string,
    userId: string,
    params: TradingSignalParams
  ): Promise<TradingSignalResult> {
    const adapter = await this.getAdapter(id, userId);
    if (!adapter) {
      throw new Error('Provider not found or not authorized');
    }

    const provider = this.providers.get(id)!;
    if (provider.status !== 'active') {
      throw new Error('Provider is not active');
    }

    const result = await adapter.generateSignal(params);

    // Update usage stats (estimate tokens)
    provider.totalTokens += 500;
    provider.totalRequests++;
    provider.lastUsedAt = new Date();
    this.providers.set(id, provider);

    return result;
  }

  /**
   * Get usage statistics
   */
  getUsage(id: string, userId: string): {
    totalTokens: number;
    totalRequests: number;
    lastUsedAt?: Date;
    estimatedCost: { amount: number; currency: string };
  } | null {
    const provider = this.providers.get(id);
    if (!provider || provider.userId !== userId) {
      return null;
    }

    // Estimate cost based on provider
    const costPerToken: Record<SupportedProvider, number> = {
      openai: 0.00003, // ~$0.03/1K
      anthropic: 0.000025, // ~$0.025/1K
      deepseek: 0.0000001, // ~$0.0001/1K
      ollama: 0, // Local
      grok: 0.000025, // Rough estimate, xAI Grok
      google: 0.000006, // Rough estimate based on Gemini pricing
    };

    return {
      totalTokens: provider.totalTokens,
      totalRequests: provider.totalRequests,
      lastUsedAt: provider.lastUsedAt,
      estimatedCost: {
        amount: provider.totalTokens * (costPerToken[provider.provider] || 0.00001),
        currency: 'USD',
      },
    };
  }

  /**
   * Get adapter for a provider (creates and caches)
   */
  private async getAdapter(id: string, userId: string): Promise<AIAdapter | null> {
    const provider = this.providers.get(id);
    if (!provider || provider.userId !== userId) {
      return null;
    }

    // Check cache
    if (this.adapterCache.has(id)) {
      return this.adapterCache.get(id)!;
    }

    // Retrieve and decrypt API key
    const keyId = `${userId}:${id}`;
    const apiKey = await this.vault.retrieveKey(keyId);

    // Create adapter
    const adapter = createAdapter({
      provider: provider.provider,
      apiKey,
      model: provider.defaultModel,
    });

    // Cache adapter
    this.adapterCache.set(id, adapter);

    return adapter;
  }

  /**
   * Get supported providers info
   */
  static getSupportedProviders() {
    return PROVIDER_INFO;
  }
}
