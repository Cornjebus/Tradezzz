/**
 * AIProviderService - AI Provider Management and Integration
 * Handles AI provider connections, sentiment analysis, and signal generation
 */

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { ConfigService } from '../config/ConfigService';

// ============================================================================
// Types
// ============================================================================

export type AIProviderType = 'openai' | 'anthropic' | 'deepseek' | 'google' | 'cohere' | 'mistral';
export type ProviderStatus = 'active' | 'inactive' | 'error';
export type SentimentType = 'bullish' | 'bearish' | 'neutral';
export type SignalAction = 'buy' | 'sell' | 'hold';

export interface AIProvider {
  id: string;
  userId: string;
  provider: AIProviderType;
  name: string;
  status: ProviderStatus;
  defaultModel?: string;
  encryptedApiKey?: string;
  maskedApiKey?: string;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProviderParams {
  userId: string;
  provider: AIProviderType;
  name: string;
  apiKey: string;
  defaultModel?: string;
}

export interface SentimentAnalysis {
  sentiment: SentimentType;
  confidence: number;
  score: number; // -1 to 1
  reasoning?: string;
}

export interface NewsSentimentResult {
  overallSentiment: SentimentType;
  confidence: number;
  headlineScores: { headline: string; sentiment: SentimentType; score: number }[];
}

export interface SocialSentimentResult {
  sentiment: SentimentType;
  confidence: number;
  volume: number;
  trending: boolean;
  topKeywords: string[];
}

export interface AISignal {
  action: SignalAction;
  confidence: number;
  reasoning: string;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskRewardRatio?: number;
}

export interface MultiTimeframeAnalysis {
  overallBias: SentimentType;
  confidence: number;
  timeframeSignals: Record<string, AISignal>;
  recommendation: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  role: 'assistant';
  model: string;
  usage: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProviderUsage {
  totalTokens: number;
  requestCount: number;
  lastRequestAt?: Date;
}

export interface DailyUsage {
  date: string;
  tokens: number;
  requests: number;
  cost: number;
}

export interface MonthlyUsage {
  month: string;
  totalTokens: number;
  totalCost: number;
  byProvider: Record<string, { tokens: number; cost: number }>;
}

export interface CostEstimate {
  estimatedCost: number;
  currency: string;
  tokenCount: number;
}

export interface ProviderInfo {
  id: AIProviderType;
  name: string;
  models: string[];
  features: string[];
}

export interface ModelPricing {
  inputPrice: number;
  outputPrice: number;
  unit: string;
}

export interface ProviderTestResult {
  valid: boolean;
  models: string[];
  error?: string;
}

export interface AIError {
  type: 'authentication' | 'rate_limit' | 'quota' | 'network' | 'validation' | 'unknown';
  message: string;
  retryable: boolean;
}

export interface AIProviderServiceOptions {
  db: any;
  configService: ConfigService;
  encryptionKey: string;
}

// ============================================================================
// Provider Info
// ============================================================================

const PROVIDER_INFO: Record<AIProviderType, ProviderInfo> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'],
    features: ['chat', 'embeddings', 'function_calling', 'vision'],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3.5-sonnet'],
    features: ['chat', 'long_context', 'function_calling'],
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-coder'],
    features: ['chat', 'code_generation'],
  },
  google: {
    id: 'google',
    name: 'Google AI',
    models: ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro'],
    features: ['chat', 'vision', 'embeddings'],
  },
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    models: ['command', 'command-light', 'command-r', 'command-r-plus'],
    features: ['chat', 'embeddings', 'rerank'],
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    models: ['mistral-tiny', 'mistral-small', 'mistral-medium', 'mistral-large'],
    features: ['chat', 'function_calling'],
  },
};

const MODEL_PRICING: Record<string, Record<string, ModelPricing>> = {
  openai: {
    'gpt-4': { inputPrice: 0.03, outputPrice: 0.06, unit: 'per_1k_tokens' },
    'gpt-4-turbo': { inputPrice: 0.01, outputPrice: 0.03, unit: 'per_1k_tokens' },
    'gpt-3.5-turbo': { inputPrice: 0.0005, outputPrice: 0.0015, unit: 'per_1k_tokens' },
    'gpt-4o': { inputPrice: 0.005, outputPrice: 0.015, unit: 'per_1k_tokens' },
    'gpt-4o-mini': { inputPrice: 0.00015, outputPrice: 0.0006, unit: 'per_1k_tokens' },
  },
  anthropic: {
    'claude-3-opus': { inputPrice: 0.015, outputPrice: 0.075, unit: 'per_1k_tokens' },
    'claude-3-sonnet': { inputPrice: 0.003, outputPrice: 0.015, unit: 'per_1k_tokens' },
    'claude-3-haiku': { inputPrice: 0.00025, outputPrice: 0.00125, unit: 'per_1k_tokens' },
    'claude-3.5-sonnet': { inputPrice: 0.003, outputPrice: 0.015, unit: 'per_1k_tokens' },
  },
  deepseek: {
    'deepseek-chat': { inputPrice: 0.0001, outputPrice: 0.0002, unit: 'per_1k_tokens' },
    'deepseek-coder': { inputPrice: 0.0001, outputPrice: 0.0002, unit: 'per_1k_tokens' },
  },
};

const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_INFO) as AIProviderType[];

// ============================================================================
// AIProviderService Implementation
// ============================================================================

export class AIProviderService {
  private db: any;
  private configService: ConfigService;
  private encryptionKey: Buffer;
  private providers: Map<string, AIProvider> = new Map();
  private providerUsage: Map<string, ProviderUsage> = new Map();

  constructor(options: AIProviderServiceOptions) {
    this.db = options.db;
    this.configService = options.configService;
    this.encryptionKey = crypto.scryptSync(options.encryptionKey, 'salt', 32);
  }

  // ============================================================================
  // Encryption Helpers
  // ============================================================================

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '****';
    }
    return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  }

  // ============================================================================
  // Provider Management
  // ============================================================================

  async createProvider(params: CreateProviderParams): Promise<AIProvider> {
    if (!SUPPORTED_PROVIDERS.includes(params.provider)) {
      throw new Error(`Unsupported AI provider: ${params.provider}`);
    }

    const user = await this.db.users.findById(params.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const tierFeatures = this.configService.getTierFeatures(user.tier);
    const existingProviders = await this.getUserProviders(params.userId);

    if (tierFeatures.maxAIProviders !== -1 &&
        existingProviders.length >= tierFeatures.maxAIProviders) {
      throw new Error(`AI provider limit reached for ${user.tier} tier`);
    }

    const encryptedApiKey = this.encrypt(params.apiKey);

    const provider: AIProvider = {
      id: uuidv4(),
      userId: params.userId,
      provider: params.provider,
      name: params.name,
      status: 'active',
      defaultModel: params.defaultModel || PROVIDER_INFO[params.provider].models[0],
      encryptedApiKey,
      maskedApiKey: this.maskApiKey(params.apiKey),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.providers.set(provider.id, provider);
    this.providerUsage.set(provider.id, { totalTokens: 0, requestCount: 0 });

    return this.sanitizeProvider(provider);
  }

  private sanitizeProvider(provider: AIProvider): AIProvider {
    const { encryptedApiKey, ...safe } = provider;
    return safe as AIProvider;
  }

  async getProvider(providerId: string): Promise<AIProvider | null> {
    return this.providers.get(providerId) || null;
  }

  async getDecryptedApiKey(providerId: string): Promise<string> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }
    return this.decrypt(provider.encryptedApiKey!);
  }

  async getUserProviders(userId: string): Promise<AIProvider[]> {
    return Array.from(this.providers.values())
      .filter(p => p.userId === userId)
      .map(p => this.sanitizeProvider(p));
  }

  async deleteProvider(providerId: string, userId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }
    if (provider.userId !== userId) {
      throw new Error('Access denied');
    }
    this.providers.delete(providerId);
    this.providerUsage.delete(providerId);
  }

  async updateProvider(
    providerId: string,
    userId: string,
    updates: { name?: string; defaultModel?: string }
  ): Promise<AIProvider> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }
    if (provider.userId !== userId) {
      throw new Error('Access denied');
    }

    if (updates.name) provider.name = updates.name;
    if (updates.defaultModel) provider.defaultModel = updates.defaultModel;
    provider.updatedAt = new Date();

    this.providers.set(providerId, provider);
    return this.sanitizeProvider(provider);
  }

  async rotateApiKey(providerId: string, userId: string, newApiKey: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }
    if (provider.userId !== userId) {
      throw new Error('Access denied');
    }

    provider.encryptedApiKey = this.encrypt(newApiKey);
    provider.maskedApiKey = this.maskApiKey(newApiKey);
    provider.updatedAt = new Date();
    this.providers.set(providerId, provider);
  }

  // ============================================================================
  // Provider Status
  // ============================================================================

  async testProvider(providerId: string): Promise<ProviderTestResult> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    // In production, would make actual API call
    return {
      valid: true,
      models: PROVIDER_INFO[provider.provider].models,
    };
  }

  async deactivateProvider(providerId: string, userId: string): Promise<AIProvider> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }
    if (provider.userId !== userId) {
      throw new Error('Access denied');
    }

    provider.status = 'inactive';
    provider.updatedAt = new Date();
    this.providers.set(providerId, provider);
    return this.sanitizeProvider(provider);
  }

  async activateProvider(providerId: string, userId: string): Promise<AIProvider> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }
    if (provider.userId !== userId) {
      throw new Error('Access denied');
    }

    provider.status = 'active';
    provider.updatedAt = new Date();
    this.providers.set(providerId, provider);
    return this.sanitizeProvider(provider);
  }

  async markProviderUsed(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.lastUsedAt = new Date();
      this.providers.set(providerId, provider);
    }
  }

  private async ensureActiveProvider(providerId: string): Promise<AIProvider> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }
    if (provider.status !== 'active') {
      throw new Error('Provider is not active');
    }
    await this.markProviderUsed(providerId);
    return provider;
  }

  // ============================================================================
  // Sentiment Analysis
  // ============================================================================

  async analyzeSentiment(
    providerId: string,
    params: { text: string; symbol: string }
  ): Promise<SentimentAnalysis> {
    await this.ensureActiveProvider(providerId);

    // Simulated sentiment analysis
    const keywords = params.text.toLowerCase();
    let score = 0;

    // Bullish keywords
    if (keywords.includes('bullish') || keywords.includes('moon') || keywords.includes('strong')) score += 0.3;
    if (keywords.includes('breakout') || keywords.includes('pump') || keywords.includes('rally')) score += 0.2;
    if (keywords.includes('buy') || keywords.includes('accumulate')) score += 0.15;

    // Bearish keywords
    if (keywords.includes('bearish') || keywords.includes('crash') || keywords.includes('dump')) score -= 0.3;
    if (keywords.includes('sell') || keywords.includes('short') || keywords.includes('weak')) score -= 0.2;
    if (keywords.includes('fear') || keywords.includes('panic')) score -= 0.15;

    score = Math.max(-1, Math.min(1, score));

    const sentiment: SentimentType = score > 0.1 ? 'bullish' : score < -0.1 ? 'bearish' : 'neutral';
    const confidence = Math.abs(score) * 0.8 + 0.2;

    this.trackUsage(providerId, 100, 50);

    return {
      sentiment,
      confidence,
      score,
      reasoning: `Analysis based on keyword detection in text regarding ${params.symbol}`,
    };
  }

  async analyzeNewsSentiment(
    providerId: string,
    params: { headlines: string[]; symbol: string }
  ): Promise<NewsSentimentResult> {
    await this.ensureActiveProvider(providerId);

    const headlineScores = params.headlines.map(headline => {
      const lower = headline.toLowerCase();
      let score = 0;
      if (lower.includes('high') || lower.includes('up') || lower.includes('grow')) score = 0.5;
      else if (lower.includes('low') || lower.includes('down') || lower.includes('fall')) score = -0.5;

      return {
        headline,
        sentiment: (score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral') as SentimentType,
        score,
      };
    });

    const avgScore = headlineScores.reduce((sum, h) => sum + h.score, 0) / headlineScores.length;
    const overallSentiment: SentimentType = avgScore > 0.1 ? 'bullish' : avgScore < -0.1 ? 'bearish' : 'neutral';

    this.trackUsage(providerId, 200, 100);

    return {
      overallSentiment,
      confidence: 0.7,
      headlineScores,
    };
  }

  async analyzeSocialSentiment(
    providerId: string,
    params: { posts: { text: string; source: string; likes: number }[]; symbol: string }
  ): Promise<SocialSentimentResult> {
    await this.ensureActiveProvider(providerId);

    const totalLikes = params.posts.reduce((sum, p) => sum + p.likes, 0);
    let weightedScore = 0;

    for (const post of params.posts) {
      const lower = post.text.toLowerCase();
      let score = 0;
      if (lower.includes('moon') || lower.includes('🚀') || lower.includes('bull')) score = 0.5;
      else if (lower.includes('bear') || lower.includes('dump') || lower.includes('📉')) score = -0.5;
      weightedScore += score * (post.likes / totalLikes);
    }

    this.trackUsage(providerId, 150, 75);

    return {
      sentiment: weightedScore > 0.1 ? 'bullish' : weightedScore < -0.1 ? 'bearish' : 'neutral',
      confidence: 0.65,
      volume: params.posts.length,
      trending: totalLikes > 1000,
      topKeywords: ['crypto', 'bitcoin', 'trading'],
    };
  }

  // ============================================================================
  // Signal Generation
  // ============================================================================

  async generateSignal(
    providerId: string,
    params: {
      symbol: string;
      timeframe: string;
      priceData: { open: number; high: number; low: number; close: number; volume: number }[];
      indicators?: Record<string, any>;
    }
  ): Promise<AISignal> {
    await this.ensureActiveProvider(providerId);

    const lastCandle = params.priceData[params.priceData.length - 1];
    const prevCandle = params.priceData.length > 1 ? params.priceData[params.priceData.length - 2] : lastCandle;

    const priceChange = (lastCandle.close - prevCandle.close) / prevCandle.close;
    const rsi = params.indicators?.rsi || 50;

    let action: SignalAction = 'hold';
    let confidence = 0.5;
    let reasoning = '';

    if (priceChange > 0.01 && rsi < 70) {
      action = 'buy';
      confidence = 0.65;
      reasoning = 'Bullish momentum with room to grow';
    } else if (priceChange < -0.01 && rsi > 30) {
      action = 'sell';
      confidence = 0.6;
      reasoning = 'Bearish pressure detected';
    } else {
      reasoning = 'No clear signal, market consolidating';
    }

    this.trackUsage(providerId, 300, 200);

    const signal: AISignal = {
      action,
      confidence,
      reasoning,
    };

    if (action !== 'hold') {
      signal.entryPrice = lastCandle.close;
      signal.stopLoss = action === 'buy' ? lastCandle.close * 0.98 : lastCandle.close * 1.02;
      signal.takeProfit = action === 'buy' ? lastCandle.close * 1.04 : lastCandle.close * 0.96;
      signal.riskRewardRatio = 2;
    }

    return signal;
  }

  async analyzeMultiTimeframe(
    providerId: string,
    params: {
      symbol: string;
      timeframes: string[];
      priceData: Record<string, { open: number; high: number; low: number; close: number; volume: number }[]>;
    }
  ): Promise<MultiTimeframeAnalysis> {
    await this.ensureActiveProvider(providerId);

    const timeframeSignals: Record<string, AISignal> = {};
    let bullishCount = 0;
    let bearishCount = 0;

    for (const tf of params.timeframes) {
      const signal = await this.generateSignal(providerId, {
        symbol: params.symbol,
        timeframe: tf,
        priceData: params.priceData[tf],
      });
      timeframeSignals[tf] = signal;
      if (signal.action === 'buy') bullishCount++;
      else if (signal.action === 'sell') bearishCount++;
    }

    const overallBias: SentimentType = bullishCount > bearishCount ? 'bullish' : bearishCount > bullishCount ? 'bearish' : 'neutral';

    return {
      overallBias,
      confidence: Math.abs(bullishCount - bearishCount) / params.timeframes.length,
      timeframeSignals,
      recommendation: `${overallBias.charAt(0).toUpperCase() + overallBias.slice(1)} bias across ${params.timeframes.length} timeframes`,
    };
  }

  // ============================================================================
  // Chat Completion
  // ============================================================================

  async chat(
    providerId: string,
    params: { messages: ChatMessage[]; model?: string }
  ): Promise<ChatResponse> {
    const provider = await this.ensureActiveProvider(providerId);
    const model = params.model || provider.defaultModel || PROVIDER_INFO[provider.provider].models[0];

    // Simulated response
    const promptTokens = params.messages.reduce((sum, m) => sum + m.content.length / 4, 0);
    const completionTokens = 50;

    this.trackUsage(providerId, Math.floor(promptTokens), completionTokens);

    return {
      content: `This is a simulated AI response for ${provider.provider} using model ${model}. In production, this would call the actual API.`,
      role: 'assistant',
      model,
      usage: {
        promptTokens: Math.floor(promptTokens),
        completionTokens,
        totalTokens: Math.floor(promptTokens) + completionTokens,
      },
    };
  }

  // ============================================================================
  // Token Usage
  // ============================================================================

  private trackUsage(providerId: string, promptTokens: number, completionTokens: number): void {
    const usage = this.providerUsage.get(providerId) || { totalTokens: 0, requestCount: 0 };
    usage.totalTokens += promptTokens + completionTokens;
    usage.requestCount++;
    usage.lastRequestAt = new Date();
    this.providerUsage.set(providerId, usage);
  }

  async getProviderUsage(providerId: string): Promise<ProviderUsage> {
    return this.providerUsage.get(providerId) || { totalTokens: 0, requestCount: 0 };
  }

  async getDailyUsage(providerId: string): Promise<DailyUsage> {
    const usage = await this.getProviderUsage(providerId);
    return {
      date: new Date().toISOString().split('T')[0],
      tokens: usage.totalTokens,
      requests: usage.requestCount,
      cost: usage.totalTokens * 0.00001, // Simplified
    };
  }

  async getMonthlyUsage(userId: string): Promise<MonthlyUsage> {
    const providers = await this.getUserProviders(userId);
    const byProvider: Record<string, { tokens: number; cost: number }> = {};
    let totalTokens = 0;
    let totalCost = 0;

    for (const provider of providers) {
      const usage = await this.getProviderUsage(provider.id);
      const cost = usage.totalTokens * 0.00001;
      byProvider[provider.provider] = { tokens: usage.totalTokens, cost };
      totalTokens += usage.totalTokens;
      totalCost += cost;
    }

    return {
      month: new Date().toISOString().slice(0, 7),
      totalTokens,
      totalCost,
      byProvider,
    };
  }

  async estimateCost(providerId: string): Promise<CostEstimate> {
    const usage = await this.getProviderUsage(providerId);
    return {
      estimatedCost: usage.totalTokens * 0.00001,
      currency: 'USD',
      tokenCount: usage.totalTokens,
    };
  }

  // ============================================================================
  // Provider Info
  // ============================================================================

  getSupportedProviders(): AIProviderType[] {
    return SUPPORTED_PROVIDERS;
  }

  getProviderInfo(provider: AIProviderType): ProviderInfo {
    return PROVIDER_INFO[provider];
  }

  getAvailableModels(provider: AIProviderType): string[] {
    return PROVIDER_INFO[provider]?.models || [];
  }

  getModelPricing(provider: AIProviderType, model: string): ModelPricing {
    return MODEL_PRICING[provider]?.[model] || { inputPrice: 0.001, outputPrice: 0.002, unit: 'per_1k_tokens' };
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  categorizeError(error: Error): AIError {
    const message = error.message.toLowerCase();

    if (message.includes('invalid api') || message.includes('authentication') || message.includes('unauthorized')) {
      return { type: 'authentication', message: error.message, retryable: false };
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return { type: 'rate_limit', message: error.message, retryable: true };
    }

    if (message.includes('quota') || message.includes('exceeded')) {
      return { type: 'quota', message: error.message, retryable: false };
    }

    if (message.includes('network') || message.includes('timeout') || message.includes('econnrefused')) {
      return { type: 'network', message: error.message, retryable: true };
    }

    return { type: 'unknown', message: error.message, retryable: false };
  }
}
