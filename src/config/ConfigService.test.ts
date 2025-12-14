/**
 * ConfigService Tests - TDD Red Phase
 * Tests for configuration management system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigService, AppConfig, UserSettings, TierFeatures } from './ConfigService';
import { MockDatabase, createMockDatabase } from '../../tests/helpers/mock-db';

describe('ConfigService', () => {
  let configService: ConfigService;
  let db: MockDatabase;

  beforeEach(() => {
    // Reset environment
    vi.resetModules();
    db = createMockDatabase();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ============================================================================
  // Environment Configuration Tests
  // ============================================================================

  describe('Environment Config', () => {
    it('should_load_default_config', () => {
      vi.stubEnv('NODE_ENV', 'development');

      configService = new ConfigService({ db });
      const config = configService.getAppConfig();

      expect(config.environment).toBe('development');
      expect(config.port).toBe(3000);
      expect(config.apiVersion).toBe('v1');
    });

    it('should_load_production_config', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('PORT', '8080');
      vi.stubEnv('JWT_SECRET', 'a-valid-secret-key-that-is-long-enough!!');
      vi.stubEnv('ENCRYPTION_KEY', 'a-valid-encryption-key-32-chars!!');

      configService = new ConfigService({ db });
      const config = configService.getAppConfig();

      expect(config.environment).toBe('production');
      expect(config.port).toBe(8080);
    });

    it('should_require_jwt_secret_in_production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('JWT_SECRET', '');

      expect(() => new ConfigService({ db })).toThrow('JWT_SECRET is required in production');
    });

    it('should_use_default_jwt_secret_in_development', () => {
      vi.stubEnv('NODE_ENV', 'development');

      configService = new ConfigService({ db });
      const config = configService.getAppConfig();

      expect(config.jwtSecret).toBeDefined();
      expect(config.jwtSecret.length).toBeGreaterThanOrEqual(32);
    });

    it('should_load_database_config_from_env', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/testdb');

      configService = new ConfigService({ db });
      const config = configService.getAppConfig();

      expect(config.database.url).toBe('postgresql://user:pass@localhost:5432/testdb');
    });

    it('should_load_redis_config_from_env', () => {
      vi.stubEnv('REDIS_URL', 'redis://localhost:6379');

      configService = new ConfigService({ db });
      const config = configService.getAppConfig();

      expect(config.redis?.url).toBe('redis://localhost:6379');
    });

    it('should_validate_required_env_vars', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('JWT_SECRET', 'a-valid-secret-key-that-is-long-enough');
      vi.stubEnv('ENCRYPTION_KEY', ''); // Missing required key

      expect(() => new ConfigService({ db })).toThrow('ENCRYPTION_KEY is required');
    });
  });

  // ============================================================================
  // Tier Feature Configuration Tests
  // ============================================================================

  describe('Tier Features', () => {
    beforeEach(() => {
      configService = new ConfigService({ db });
    });

    it('should_return_free_tier_features', () => {
      const features = configService.getTierFeatures('free');

      expect(features.maxStrategies).toBe(2);
      expect(features.maxExchangeConnections).toBe(1);
      expect(features.maxAIProviders).toBe(1);
      expect(features.backtestingEnabled).toBe(true);
      expect(features.paperTradingEnabled).toBe(true);
      expect(features.liveTradingEnabled).toBe(false);
      expect(features.advancedAnalytics).toBe(false);
    });

    it('should_return_pro_tier_features', () => {
      const features = configService.getTierFeatures('pro');

      expect(features.maxStrategies).toBe(10);
      expect(features.maxExchangeConnections).toBe(3);
      expect(features.maxAIProviders).toBe(3);
      expect(features.backtestingEnabled).toBe(true);
      expect(features.paperTradingEnabled).toBe(true);
      expect(features.liveTradingEnabled).toBe(true);
      expect(features.advancedAnalytics).toBe(true);
      expect(features.prioritySupport).toBe(false);
    });

    it('should_return_elite_tier_features', () => {
      const features = configService.getTierFeatures('elite');

      expect(features.maxStrategies).toBe(50);
      expect(features.maxExchangeConnections).toBe(10);
      expect(features.maxAIProviders).toBe(5);
      expect(features.liveTradingEnabled).toBe(true);
      expect(features.advancedAnalytics).toBe(true);
      expect(features.prioritySupport).toBe(true);
      expect(features.customAlgorithms).toBe(true);
    });

    it('should_return_institutional_tier_features', () => {
      const features = configService.getTierFeatures('institutional');

      expect(features.maxStrategies).toBe(-1); // Unlimited
      expect(features.maxExchangeConnections).toBe(-1);
      expect(features.maxAIProviders).toBe(-1);
      expect(features.liveTradingEnabled).toBe(true);
      expect(features.advancedAnalytics).toBe(true);
      expect(features.prioritySupport).toBe(true);
      expect(features.customAlgorithms).toBe(true);
      expect(features.dedicatedSupport).toBe(true);
      expect(features.apiAccess).toBe(true);
    });

    it('should_check_if_feature_is_available_for_tier', () => {
      expect(configService.isFeatureAvailable('free', 'liveTradingEnabled')).toBe(false);
      expect(configService.isFeatureAvailable('pro', 'liveTradingEnabled')).toBe(true);
      expect(configService.isFeatureAvailable('elite', 'customAlgorithms')).toBe(true);
      expect(configService.isFeatureAvailable('free', 'customAlgorithms')).toBe(false);
    });

    it('should_check_tier_limits', () => {
      expect(configService.isWithinLimit('free', 'maxStrategies', 2)).toBe(true);
      expect(configService.isWithinLimit('free', 'maxStrategies', 3)).toBe(false);
      expect(configService.isWithinLimit('institutional', 'maxStrategies', 1000)).toBe(true); // Unlimited
    });
  });

  // ============================================================================
  // User Settings Tests
  // ============================================================================

  describe('User Settings', () => {
    let userId: string;

    beforeEach(async () => {
      configService = new ConfigService({ db });
      const user = await db.users.create({
        email: 'settings@example.com',
        passwordHash: 'hash',
        tier: 'pro',
      });
      userId = user.id;
    });

    it('should_get_default_user_settings', async () => {
      const settings = await configService.getUserSettings(userId);

      expect(settings.notifications.email).toBe(true);
      expect(settings.notifications.push).toBe(false);
      expect(settings.notifications.tradeAlerts).toBe(true);
      expect(settings.trading.defaultMode).toBe('paper');
      expect(settings.trading.riskLevel).toBe('medium');
      expect(settings.display.theme).toBe('system');
      expect(settings.display.timezone).toBe('UTC');
    });

    it('should_update_user_settings', async () => {
      await configService.updateUserSettings(userId, {
        notifications: {
          email: false,
          push: true,
          tradeAlerts: true,
        },
      });

      const settings = await configService.getUserSettings(userId);

      expect(settings.notifications.email).toBe(false);
      expect(settings.notifications.push).toBe(true);
    });

    it('should_update_nested_settings', async () => {
      await configService.updateUserSettings(userId, {
        trading: {
          defaultMode: 'live',
          riskLevel: 'high',
          maxPositionSize: 10000,
        },
      });

      const settings = await configService.getUserSettings(userId);

      expect(settings.trading.defaultMode).toBe('live');
      expect(settings.trading.riskLevel).toBe('high');
      expect(settings.trading.maxPositionSize).toBe(10000);
    });

    it('should_validate_settings_against_tier', async () => {
      // Free tier user cannot enable live trading as default
      const freeUser = await db.users.create({
        email: 'free@example.com',
        passwordHash: 'hash',
        tier: 'free',
      });

      await expect(
        configService.updateUserSettings(freeUser.id, {
          trading: {
            defaultMode: 'live', // Not allowed for free tier
          },
        })
      ).rejects.toThrow('Live trading not available for free tier');
    });

    it('should_reset_settings_to_defaults', async () => {
      // First update settings
      await configService.updateUserSettings(userId, {
        notifications: { email: false },
        display: { theme: 'dark' },
      });

      // Then reset
      await configService.resetUserSettings(userId);

      const settings = await configService.getUserSettings(userId);
      expect(settings.notifications.email).toBe(true);
      expect(settings.display.theme).toBe('system');
    });

    it('should_validate_risk_level_values', async () => {
      await expect(
        configService.updateUserSettings(userId, {
          trading: {
            riskLevel: 'extreme' as any, // Invalid value
          },
        })
      ).rejects.toThrow('Invalid risk level');
    });

    it('should_validate_max_position_size', async () => {
      await expect(
        configService.updateUserSettings(userId, {
          trading: {
            maxPositionSize: -100, // Negative not allowed
          },
        })
      ).rejects.toThrow('Max position size must be positive');
    });
  });

  // ============================================================================
  // Exchange Configuration Tests
  // ============================================================================

  describe('Exchange Config', () => {
    beforeEach(() => {
      configService = new ConfigService({ db });
    });

    it('should_get_supported_exchanges', () => {
      const exchanges = configService.getSupportedExchanges();

      expect(exchanges).toContain('binance');
      expect(exchanges).toContain('coinbase');
      expect(exchanges).toContain('kraken');
      expect(exchanges).toContain('bybit');
      expect(exchanges).toContain('okx');
    });

    it('should_get_exchange_config', () => {
      const config = configService.getExchangeConfig('binance');

      expect(config.name).toBe('binance');
      expect(config.displayName).toBe('Binance');
      expect(config.supportsPaperTrading).toBe(true);
      expect(config.supportsLiveTrading).toBe(true);
      expect(config.requiredCredentials).toContain('apiKey');
      expect(config.requiredCredentials).toContain('apiSecret');
    });

    it('should_get_exchange_rate_limits', () => {
      const limits = configService.getExchangeRateLimits('binance');

      expect(limits.requestsPerMinute).toBeGreaterThan(0);
      expect(limits.ordersPerSecond).toBeGreaterThan(0);
    });

    it('should_throw_for_unsupported_exchange', () => {
      expect(() => configService.getExchangeConfig('unsupported' as any))
        .toThrow('Unsupported exchange');
    });
  });

  // ============================================================================
  // AI Provider Configuration Tests
  // ============================================================================

  describe('AI Provider Config', () => {
    beforeEach(() => {
      configService = new ConfigService({ db });
    });

    it('should_get_supported_ai_providers', () => {
      const providers = configService.getSupportedAIProviders();

      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('google');
      expect(providers).toContain('deepseek');
      expect(providers).toContain('groq');
    });

    it('should_get_ai_provider_config', () => {
      const config = configService.getAIProviderConfig('openai');

      expect(config.name).toBe('openai');
      expect(config.displayName).toBe('OpenAI');
      expect(config.models).toContain('gpt-4');
      expect(config.models).toContain('gpt-4-turbo');
      expect(config.defaultModel).toBe('gpt-4-turbo');
    });

    it('should_get_ai_provider_models', () => {
      const models = configService.getAIProviderModels('anthropic');

      expect(models).toContain('claude-3-opus');
      expect(models).toContain('claude-3-sonnet');
      expect(models).toContain('claude-3-haiku');
    });

    it('should_get_model_capabilities', () => {
      const capabilities = configService.getModelCapabilities('openai', 'gpt-4');

      expect(capabilities.maxTokens).toBeGreaterThan(0);
      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.supportsTools).toBe(true);
    });

    it('should_throw_for_unsupported_provider', () => {
      expect(() => configService.getAIProviderConfig('unsupported' as any))
        .toThrow('Unsupported AI provider');
    });
  });

  // ============================================================================
  // Trading Configuration Tests
  // ============================================================================

  describe('Trading Config', () => {
    beforeEach(() => {
      configService = new ConfigService({ db });
    });

    it('should_get_default_trading_config', () => {
      const config = configService.getDefaultTradingConfig();

      expect(config.defaultStopLossPercent).toBe(2);
      expect(config.defaultTakeProfitPercent).toBe(5);
      expect(config.maxLeverageAllowed).toBe(10);
      expect(config.minTradeAmount).toBe(10);
    });

    it('should_get_risk_limits_by_tier', () => {
      const freeLimits = configService.getRiskLimits('free');
      const proLimits = configService.getRiskLimits('pro');

      expect(freeLimits.maxDailyTrades).toBe(10);
      expect(freeLimits.maxPositionValue).toBe(1000);

      expect(proLimits.maxDailyTrades).toBe(100);
      expect(proLimits.maxPositionValue).toBe(50000);
    });

    it('should_get_supported_order_types', () => {
      const orderTypes = configService.getSupportedOrderTypes();

      expect(orderTypes).toContain('market');
      expect(orderTypes).toContain('limit');
      expect(orderTypes).toContain('stop');
      expect(orderTypes).toContain('stop_limit');
    });

    it('should_get_supported_trading_pairs', () => {
      const pairs = configService.getSupportedTradingPairs('binance');

      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs.some(p => p.symbol === 'BTC/USDT')).toBe(true);
    });
  });

  // ============================================================================
  // Feature Flags Tests
  // ============================================================================

  describe('Feature Flags', () => {
    beforeEach(() => {
      configService = new ConfigService({ db });
    });

    it('should_check_if_feature_is_enabled', () => {
      expect(configService.isFeatureEnabled('backtesting')).toBe(true);
      expect(configService.isFeatureEnabled('social_trading')).toBe(false); // Not yet implemented
    });

    it('should_get_all_feature_flags', () => {
      const flags = configService.getFeatureFlags();

      expect(flags.backtesting).toBe(true);
      expect(flags.paperTrading).toBe(true);
      expect(flags.liveTrading).toBe(true);
      expect(typeof flags.socialTrading).toBe('boolean');
    });

    it('should_allow_env_override_for_feature_flags', () => {
      vi.stubEnv('FEATURE_SOCIAL_TRADING', 'true');

      configService = new ConfigService({ db });

      expect(configService.isFeatureEnabled('social_trading')).toBe(true);
    });
  });
});
