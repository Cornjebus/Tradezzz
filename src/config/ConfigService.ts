/**
 * ConfigService - Configuration Management
 * Handles environment config, tier features, user settings, and feature flags
 */

import { UserTier, ExchangeName, AIProviderName } from '../database/types';

// ============================================================================
// Types
// ============================================================================

export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  port: number;
  apiVersion: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  encryptionKey: string;
  database: {
    url: string;
    poolSize: number;
  };
  redis?: {
    url: string;
  };
}

export interface TierFeatures {
  maxStrategies: number;
  maxExchangeConnections: number;
  maxAIProviders: number;
  backtestingEnabled: boolean;
  paperTradingEnabled: boolean;
  liveTradingEnabled: boolean;
  advancedAnalytics: boolean;
  prioritySupport: boolean;
  customAlgorithms: boolean;
  dedicatedSupport: boolean;
  apiAccess: boolean;
}

export interface UserSettings {
  notifications: {
    email: boolean;
    push: boolean;
    tradeAlerts: boolean;
    weeklyReport: boolean;
  };
  trading: {
    defaultMode: 'paper' | 'live';
    riskLevel: 'low' | 'medium' | 'high';
    maxPositionSize?: number;
    defaultLeverage: number;
  };
  display: {
    theme: 'light' | 'dark' | 'system';
    timezone: string;
    currency: string;
  };
}

export interface ExchangeConfig {
  name: ExchangeName;
  displayName: string;
  supportsPaperTrading: boolean;
  supportsLiveTrading: boolean;
  requiredCredentials: string[];
  optionalCredentials?: string[];
}

export interface ExchangeRateLimits {
  requestsPerMinute: number;
  ordersPerSecond: number;
  ordersPerDay: number;
}

export interface AIProviderConfig {
  name: AIProviderName;
  displayName: string;
  models: string[];
  defaultModel: string;
}

export interface ModelCapabilities {
  maxTokens: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  contextWindow: number;
}

export interface TradingConfig {
  defaultStopLossPercent: number;
  defaultTakeProfitPercent: number;
  maxLeverageAllowed: number;
  minTradeAmount: number;
}

export interface RiskLimits {
  maxDailyTrades: number;
  maxPositionValue: number;
  maxDailyLoss: number;
  maxOpenPositions: number;
}

export interface TradingPair {
  symbol: string;
  base: string;
  quote: string;
  minQuantity: number;
  maxQuantity: number;
  pricePrecision: number;
  quantityPrecision: number;
}

export interface FeatureFlags {
  backtesting: boolean;
  paperTrading: boolean;
  liveTrading: boolean;
  socialTrading: boolean;
  copyTrading: boolean;
  advancedCharting: boolean;
  aiSignals: boolean;
}

export interface ConfigServiceOptions {
  db: any;
}

// ============================================================================
// Tier Features Configuration
// ============================================================================

const TIER_FEATURES: Record<UserTier, TierFeatures> = {
  free: {
    maxStrategies: 2,
    maxExchangeConnections: 1,
    maxAIProviders: 1,
    backtestingEnabled: true,
    paperTradingEnabled: true,
    liveTradingEnabled: false,
    advancedAnalytics: false,
    prioritySupport: false,
    customAlgorithms: false,
    dedicatedSupport: false,
    apiAccess: false,
  },
  pro: {
    maxStrategies: 10,
    maxExchangeConnections: 3,
    maxAIProviders: 3,
    backtestingEnabled: true,
    paperTradingEnabled: true,
    liveTradingEnabled: true,
    advancedAnalytics: true,
    prioritySupport: false,
    customAlgorithms: false,
    dedicatedSupport: false,
    apiAccess: false,
  },
  elite: {
    maxStrategies: 50,
    maxExchangeConnections: 10,
    maxAIProviders: 5,
    backtestingEnabled: true,
    paperTradingEnabled: true,
    liveTradingEnabled: true,
    advancedAnalytics: true,
    prioritySupport: true,
    customAlgorithms: true,
    dedicatedSupport: false,
    apiAccess: true,
  },
  institutional: {
    maxStrategies: -1, // Unlimited
    maxExchangeConnections: -1,
    maxAIProviders: -1,
    backtestingEnabled: true,
    paperTradingEnabled: true,
    liveTradingEnabled: true,
    advancedAnalytics: true,
    prioritySupport: true,
    customAlgorithms: true,
    dedicatedSupport: true,
    apiAccess: true,
  },
};

// ============================================================================
// Exchange Configurations
// ============================================================================

const EXCHANGE_CONFIGS: Record<ExchangeName, ExchangeConfig> = {
  binance: {
    name: 'binance',
    displayName: 'Binance',
    supportsPaperTrading: true,
    supportsLiveTrading: true,
    requiredCredentials: ['apiKey', 'apiSecret'],
  },
  coinbase: {
    name: 'coinbase',
    displayName: 'Coinbase',
    supportsPaperTrading: true,
    supportsLiveTrading: true,
    requiredCredentials: ['apiKey', 'apiSecret'],
    optionalCredentials: ['passphrase'],
  },
  kraken: {
    name: 'kraken',
    displayName: 'Kraken',
    supportsPaperTrading: true,
    supportsLiveTrading: true,
    requiredCredentials: ['apiKey', 'apiSecret'],
  },
  bybit: {
    name: 'bybit',
    displayName: 'Bybit',
    supportsPaperTrading: true,
    supportsLiveTrading: true,
    requiredCredentials: ['apiKey', 'apiSecret'],
  },
  okx: {
    name: 'okx',
    displayName: 'OKX',
    supportsPaperTrading: true,
    supportsLiveTrading: true,
    requiredCredentials: ['apiKey', 'apiSecret'],
    optionalCredentials: ['passphrase'],
  },
};

const EXCHANGE_RATE_LIMITS: Record<ExchangeName, ExchangeRateLimits> = {
  binance: { requestsPerMinute: 1200, ordersPerSecond: 10, ordersPerDay: 200000 },
  coinbase: { requestsPerMinute: 600, ordersPerSecond: 5, ordersPerDay: 100000 },
  kraken: { requestsPerMinute: 300, ordersPerSecond: 3, ordersPerDay: 50000 },
  bybit: { requestsPerMinute: 600, ordersPerSecond: 10, ordersPerDay: 100000 },
  okx: { requestsPerMinute: 600, ordersPerSecond: 10, ordersPerDay: 100000 },
};

// ============================================================================
// AI Provider Configurations
// ============================================================================

const AI_PROVIDER_CONFIGS: Record<AIProviderName, AIProviderConfig> = {
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4-turbo',
  },
  anthropic: {
    name: 'anthropic',
    displayName: 'Anthropic',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3.5-sonnet'],
    defaultModel: 'claude-3.5-sonnet',
  },
  google: {
    name: 'google',
    displayName: 'Google AI',
    models: ['gemini-pro', 'gemini-pro-vision', 'gemini-ultra'],
    defaultModel: 'gemini-pro',
  },
  deepseek: {
    name: 'deepseek',
    displayName: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-coder'],
    defaultModel: 'deepseek-chat',
  },
  groq: {
    name: 'groq',
    displayName: 'Groq',
    models: ['llama-3.1-70b', 'llama-3.1-8b', 'mixtral-8x7b'],
    defaultModel: 'llama-3.1-70b',
  },
  mistral: {
    name: 'mistral',
    displayName: 'Mistral AI',
    models: ['mistral-large', 'mistral-medium', 'mistral-small'],
    defaultModel: 'mistral-large',
  },
  xai: {
    name: 'xai',
    displayName: 'xAI',
    models: ['grok-1', 'grok-2'],
    defaultModel: 'grok-2',
  },
  ollama: {
    name: 'ollama',
    displayName: 'Ollama (Local)',
    models: ['llama3', 'mistral', 'codellama', 'phi'],
    defaultModel: 'llama3',
  },
};

const MODEL_CAPABILITIES: Record<string, Record<string, ModelCapabilities>> = {
  openai: {
    'gpt-4': { maxTokens: 8192, supportsStreaming: true, supportsTools: true, contextWindow: 8192 },
    'gpt-4-turbo': { maxTokens: 4096, supportsStreaming: true, supportsTools: true, contextWindow: 128000 },
    'gpt-4o': { maxTokens: 4096, supportsStreaming: true, supportsTools: true, contextWindow: 128000 },
    'gpt-3.5-turbo': { maxTokens: 4096, supportsStreaming: true, supportsTools: true, contextWindow: 16385 },
  },
  anthropic: {
    'claude-3-opus': { maxTokens: 4096, supportsStreaming: true, supportsTools: true, contextWindow: 200000 },
    'claude-3-sonnet': { maxTokens: 4096, supportsStreaming: true, supportsTools: true, contextWindow: 200000 },
    'claude-3-haiku': { maxTokens: 4096, supportsStreaming: true, supportsTools: true, contextWindow: 200000 },
    'claude-3.5-sonnet': { maxTokens: 8192, supportsStreaming: true, supportsTools: true, contextWindow: 200000 },
  },
};

// ============================================================================
// Risk Limits by Tier
// ============================================================================

const RISK_LIMITS: Record<UserTier, RiskLimits> = {
  free: { maxDailyTrades: 10, maxPositionValue: 1000, maxDailyLoss: 100, maxOpenPositions: 2 },
  pro: { maxDailyTrades: 100, maxPositionValue: 50000, maxDailyLoss: 5000, maxOpenPositions: 10 },
  elite: { maxDailyTrades: 500, maxPositionValue: 500000, maxDailyLoss: 50000, maxOpenPositions: 50 },
  institutional: { maxDailyTrades: -1, maxPositionValue: -1, maxDailyLoss: -1, maxOpenPositions: -1 },
};

// ============================================================================
// Default User Settings
// ============================================================================

const DEFAULT_USER_SETTINGS: UserSettings = {
  notifications: {
    email: true,
    push: false,
    tradeAlerts: true,
    weeklyReport: true,
  },
  trading: {
    defaultMode: 'paper',
    riskLevel: 'medium',
    defaultLeverage: 1,
  },
  display: {
    theme: 'system',
    timezone: 'UTC',
    currency: 'USD',
  },
};

// ============================================================================
// Default Trading Pairs
// ============================================================================

const DEFAULT_TRADING_PAIRS: TradingPair[] = [
  { symbol: 'BTC/USDT', base: 'BTC', quote: 'USDT', minQuantity: 0.0001, maxQuantity: 1000, pricePrecision: 2, quantityPrecision: 8 },
  { symbol: 'ETH/USDT', base: 'ETH', quote: 'USDT', minQuantity: 0.001, maxQuantity: 10000, pricePrecision: 2, quantityPrecision: 8 },
  { symbol: 'SOL/USDT', base: 'SOL', quote: 'USDT', minQuantity: 0.01, maxQuantity: 100000, pricePrecision: 2, quantityPrecision: 8 },
  { symbol: 'BNB/USDT', base: 'BNB', quote: 'USDT', minQuantity: 0.01, maxQuantity: 10000, pricePrecision: 2, quantityPrecision: 8 },
  { symbol: 'XRP/USDT', base: 'XRP', quote: 'USDT', minQuantity: 1, maxQuantity: 1000000, pricePrecision: 4, quantityPrecision: 2 },
];

// ============================================================================
// ConfigService Implementation
// ============================================================================

export class ConfigService {
  private db: any;
  private appConfig: AppConfig;
  private userSettingsCache: Map<string, UserSettings> = new Map();

  constructor(options: ConfigServiceOptions) {
    this.db = options.db;
    this.appConfig = this.loadAppConfig();
  }

  // ============================================================================
  // Environment Configuration
  // ============================================================================

  private loadAppConfig(): AppConfig {
    const env = process.env.NODE_ENV || 'development';
    const isProduction = env === 'production';

    // Validate required production env vars
    if (isProduction) {
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET is required in production');
      }
      if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
        throw new Error('ENCRYPTION_KEY is required');
      }
    }

    return {
      environment: env as AppConfig['environment'],
      port: parseInt(process.env.PORT || '3000', 10),
      apiVersion: process.env.API_VERSION || 'v1',
      jwtSecret: process.env.JWT_SECRET || 'default-dev-secret-key-32-chars!!',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
      refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
      encryptionKey: process.env.ENCRYPTION_KEY || 'default-dev-encryption-key-32!!',
      database: {
        url: process.env.DATABASE_URL || 'postgresql://localhost:5432/neural_trading',
        poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
      },
      redis: process.env.REDIS_URL ? { url: process.env.REDIS_URL } : undefined,
    };
  }

  getAppConfig(): AppConfig {
    return { ...this.appConfig };
  }

  // ============================================================================
  // Tier Features
  // ============================================================================

  getTierFeatures(tier: UserTier): TierFeatures {
    return { ...TIER_FEATURES[tier] };
  }

  isFeatureAvailable(tier: UserTier, feature: keyof TierFeatures): boolean {
    const features = TIER_FEATURES[tier];
    const value = features[feature];
    return typeof value === 'boolean' ? value : value !== 0;
  }

  isWithinLimit(tier: UserTier, limitKey: keyof TierFeatures, currentValue: number): boolean {
    const features = TIER_FEATURES[tier];
    const limit = features[limitKey] as number;
    if (limit === -1) return true; // Unlimited
    return currentValue <= limit;
  }

  // ============================================================================
  // User Settings
  // ============================================================================

  async getUserSettings(userId: string): Promise<UserSettings> {
    // Check cache
    if (this.userSettingsCache.has(userId)) {
      return { ...this.userSettingsCache.get(userId)! };
    }

    // For now, return defaults (would load from DB in production)
    const settings = { ...DEFAULT_USER_SETTINGS };
    this.userSettingsCache.set(userId, settings);
    return settings;
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
    // Get user tier for validation
    const user = await this.db.users.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate trading settings against tier
    if (updates.trading?.defaultMode === 'live') {
      const tierFeatures = this.getTierFeatures(user.tier);
      if (!tierFeatures.liveTradingEnabled) {
        throw new Error('Live trading not available for free tier');
      }
    }

    // Validate risk level
    if (updates.trading?.riskLevel) {
      const validLevels = ['low', 'medium', 'high'];
      if (!validLevels.includes(updates.trading.riskLevel)) {
        throw new Error('Invalid risk level');
      }
    }

    // Validate max position size
    if (updates.trading?.maxPositionSize !== undefined && updates.trading.maxPositionSize < 0) {
      throw new Error('Max position size must be positive');
    }

    // Merge with current settings
    const currentSettings = await this.getUserSettings(userId);
    const newSettings: UserSettings = {
      notifications: { ...currentSettings.notifications, ...updates.notifications },
      trading: { ...currentSettings.trading, ...updates.trading },
      display: { ...currentSettings.display, ...updates.display },
    };

    // Update cache
    this.userSettingsCache.set(userId, newSettings);

    return newSettings;
  }

  async resetUserSettings(userId: string): Promise<void> {
    this.userSettingsCache.set(userId, { ...DEFAULT_USER_SETTINGS });
  }

  // ============================================================================
  // Exchange Configuration
  // ============================================================================

  getSupportedExchanges(): ExchangeName[] {
    return Object.keys(EXCHANGE_CONFIGS) as ExchangeName[];
  }

  getExchangeConfig(exchange: ExchangeName): ExchangeConfig {
    const config = EXCHANGE_CONFIGS[exchange];
    if (!config) {
      throw new Error('Unsupported exchange');
    }
    return { ...config };
  }

  getExchangeRateLimits(exchange: ExchangeName): ExchangeRateLimits {
    const limits = EXCHANGE_RATE_LIMITS[exchange];
    if (!limits) {
      throw new Error('Unsupported exchange');
    }
    return { ...limits };
  }

  // ============================================================================
  // AI Provider Configuration
  // ============================================================================

  getSupportedAIProviders(): AIProviderName[] {
    return Object.keys(AI_PROVIDER_CONFIGS) as AIProviderName[];
  }

  getAIProviderConfig(provider: AIProviderName): AIProviderConfig {
    const config = AI_PROVIDER_CONFIGS[provider];
    if (!config) {
      throw new Error('Unsupported AI provider');
    }
    return { ...config };
  }

  getAIProviderModels(provider: AIProviderName): string[] {
    const config = AI_PROVIDER_CONFIGS[provider];
    if (!config) {
      throw new Error('Unsupported AI provider');
    }
    return [...config.models];
  }

  getModelCapabilities(provider: AIProviderName, model: string): ModelCapabilities {
    const providerCaps = MODEL_CAPABILITIES[provider];
    if (!providerCaps) {
      // Return defaults for unknown providers
      return { maxTokens: 4096, supportsStreaming: true, supportsTools: false, contextWindow: 4096 };
    }
    return providerCaps[model] || { maxTokens: 4096, supportsStreaming: true, supportsTools: false, contextWindow: 4096 };
  }

  // ============================================================================
  // Trading Configuration
  // ============================================================================

  getDefaultTradingConfig(): TradingConfig {
    return {
      defaultStopLossPercent: 2,
      defaultTakeProfitPercent: 5,
      maxLeverageAllowed: 10,
      minTradeAmount: 10,
    };
  }

  getRiskLimits(tier: UserTier): RiskLimits {
    return { ...RISK_LIMITS[tier] };
  }

  getSupportedOrderTypes(): string[] {
    return ['market', 'limit', 'stop', 'stop_limit', 'trailing_stop'];
  }

  getSupportedTradingPairs(exchange: ExchangeName): TradingPair[] {
    // In production, this would fetch from exchange API
    return [...DEFAULT_TRADING_PAIRS];
  }

  // ============================================================================
  // Feature Flags
  // ============================================================================

  isFeatureEnabled(feature: string): boolean {
    const flags = this.getFeatureFlags();
    const camelCase = feature.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    return (flags as any)[camelCase] ?? false;
  }

  getFeatureFlags(): FeatureFlags {
    return {
      backtesting: true,
      paperTrading: true,
      liveTrading: true,
      socialTrading: process.env.FEATURE_SOCIAL_TRADING === 'true',
      copyTrading: process.env.FEATURE_COPY_TRADING === 'true',
      advancedCharting: true,
      aiSignals: true,
    };
  }
}
