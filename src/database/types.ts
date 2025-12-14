/**
 * Database Types - Multi-User Neural Trading Platform
 */

// ============================================================================
// User Types
// ============================================================================

export type UserTier = 'free' | 'pro' | 'elite' | 'institutional';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  tier: UserTier;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  tier?: UserTier;
}

// ============================================================================
// Strategy Types
// ============================================================================

export type StrategyType =
  | 'momentum'
  | 'mean_reversion'
  | 'sentiment'
  | 'arbitrage'
  | 'trend_following'
  | 'custom';

export type StrategyStatus =
  | 'draft'
  | 'backtesting'
  | 'paper'
  | 'active'
  | 'paused'
  | 'archived';

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  description?: string;
  type: StrategyType;
  config: Record<string, unknown>;
  status: StrategyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStrategyInput {
  userId: string;
  name: string;
  description?: string;
  type: StrategyType;
  config: Record<string, unknown>;
  status?: StrategyStatus;
}

// ============================================================================
// Trade Types
// ============================================================================

export type TradeSide = 'buy' | 'sell';
export type TradeStatus = 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'failed';
export type TradingMode = 'paper' | 'live';

export interface Trade {
  id: string;
  userId: string;
  strategyId: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  price: number;
  status: TradeStatus;
  mode: TradingMode;
  exchangeOrderId?: string;
  executedAt?: Date;
  createdAt: Date;
}

export interface CreateTradeInput {
  userId: string;
  strategyId: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  price: number;
  status?: TradeStatus;
  mode: TradingMode;
  exchangeOrderId?: string;
}

// ============================================================================
// Exchange Connection Types
// ============================================================================

export type ExchangeName = 'binance' | 'coinbase' | 'kraken' | 'bybit' | 'okx';

export interface ExchangeConnection {
  id: string;
  userId: string;
  exchange: ExchangeName;
  apiKeyEncrypted: string;
  apiSecretEncrypted: string;
  iv: string;
  isPaper: boolean;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExchangeConnectionInput {
  userId: string;
  exchange: ExchangeName;
  apiKey: string;
  apiSecret: string;
  isPaper?: boolean;
}

// ============================================================================
// AI Provider Types
// ============================================================================

export type AIProviderName =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'groq'
  | 'mistral'
  | 'xai'
  | 'ollama';

export interface AIProviderConnection {
  id: string;
  userId: string;
  provider: AIProviderName;
  apiKeyEncrypted: string;
  iv: string;
  selectedModel: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAIProviderInput {
  userId: string;
  provider: AIProviderName;
  apiKey: string;
  selectedModel: string;
  isPrimary?: boolean;
}

// ============================================================================
// AI Usage Types
// ============================================================================

export interface AIUsageLog {
  id: string;
  userId: string;
  provider: AIProviderName;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  tokensReasoning: number;
  latencyMs: number;
  estimatedCost: number;
  requestType: string;
  createdAt: Date;
}

// ============================================================================
// Audit Log Types
// ============================================================================

export type AuditAction =
  | 'user_created'
  | 'user_login'
  | 'user_logout'
  | 'password_changed'
  | 'api_key_added'
  | 'api_key_deleted'
  | 'api_key_rotated'
  | 'ai_key_added'
  | 'ai_key_deleted'
  | 'strategy_created'
  | 'strategy_activated'
  | 'trade_executed'
  | 'live_trading_enabled'
  | 'live_trading_disabled';

export interface AuditLog {
  id: string;
  userId: string;
  action: AuditAction;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}
