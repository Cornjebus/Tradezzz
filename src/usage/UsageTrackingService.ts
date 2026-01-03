/**
 * Usage Tracking Service - Phase 19: Usage Tracking
 *
 * Tracks AI provider usage including:
 * - Token counts (input/output)
 * - Cost estimation per provider/model
 * - Usage limits and alerts
 * - Historical usage data
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export type OperationType = 'chat' | 'embedding' | 'completion' | 'analysis' | 'signal';

export interface TrackUsageInput {
  userId: string;
  providerId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  operation: OperationType;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

export interface UsageRecord {
  id: string;
  userId: string;
  providerId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  operation: OperationType;
  estimatedCost: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface UsageSummary {
  period: 'daily' | 'weekly' | 'monthly';
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  totalCost: number;
  averageLatency: number;
  byProvider: Record<string, ProviderUsageSummary>;
  startDate: Date;
  endDate: Date;
}

export interface ProviderUsageSummary {
  totalTokens: number;
  totalRequests: number;
  totalCost: number;
  averageLatency: number;
  byModel: Record<string, ModelUsageSummary>;
}

export interface ModelUsageSummary {
  totalTokens: number;
  totalRequests: number;
  totalCost: number;
  averageLatency: number;
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  isLocal: boolean;
}

export interface ModelPricing {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

export interface ProviderPricing {
  provider: string;
  models: Record<string, ModelPricing>;
  isLocal?: boolean;
}

export interface UsageLimit {
  userId: string;
  dailyTokenLimit: number;
  dailyCostLimit: number;
  monthlyTokenLimit?: number;
  monthlyCostLimit?: number;
}

export interface LimitCheck {
  exceededTokenLimit: boolean;
  exceededCostLimit: boolean;
  tokenLimitUsedPercent: number;
  costLimitUsedPercent: number;
  currentTokens: number;
  currentCost: number;
  tokenLimit: number;
  costLimit: number;
}

export interface UsageHistoryOptions {
  startDate?: Date;
  endDate?: Date;
  provider?: string;
  model?: string;
  limit?: number;
  offset?: number;
}

export interface UsageTrackingConfig {
  db: any;
}

// ============================================================================
// Pricing Data (per 1M tokens)
// ============================================================================

const PROVIDER_PRICING: Record<string, ProviderPricing> = {
  openai: {
    provider: 'openai',
    models: {
      'gpt-4': { inputPricePerMillion: 30.00, outputPricePerMillion: 60.00 },
      'gpt-4-turbo': { inputPricePerMillion: 10.00, outputPricePerMillion: 30.00 },
      'gpt-4o': { inputPricePerMillion: 5.00, outputPricePerMillion: 15.00 },
      'gpt-4o-mini': { inputPricePerMillion: 0.15, outputPricePerMillion: 0.60 },
      'gpt-3.5-turbo': { inputPricePerMillion: 0.50, outputPricePerMillion: 1.50 },
      'text-embedding-ada-002': { inputPricePerMillion: 0.10, outputPricePerMillion: 0 },
      'text-embedding-3-small': { inputPricePerMillion: 0.02, outputPricePerMillion: 0 },
      'text-embedding-3-large': { inputPricePerMillion: 0.13, outputPricePerMillion: 0 },
    },
  },
  anthropic: {
    provider: 'anthropic',
    models: {
      'claude-3-opus': { inputPricePerMillion: 15.00, outputPricePerMillion: 75.00 },
      'claude-3-sonnet': { inputPricePerMillion: 3.00, outputPricePerMillion: 15.00 },
      'claude-3-haiku': { inputPricePerMillion: 0.25, outputPricePerMillion: 1.25 },
      'claude-3.5-sonnet': { inputPricePerMillion: 3.00, outputPricePerMillion: 15.00 },
    },
  },
  deepseek: {
    provider: 'deepseek',
    models: {
      'deepseek-chat': { inputPricePerMillion: 0.14, outputPricePerMillion: 0.28 },
      'deepseek-coder': { inputPricePerMillion: 0.14, outputPricePerMillion: 0.28 },
      'deepseek-reasoner': { inputPricePerMillion: 0.55, outputPricePerMillion: 2.19 },
    },
  },
  google: {
    provider: 'google',
    models: {
      'gemini-pro': { inputPricePerMillion: 0.50, outputPricePerMillion: 1.50 },
      'gemini-pro-vision': { inputPricePerMillion: 0.50, outputPricePerMillion: 1.50 },
      'gemini-1.5-pro': { inputPricePerMillion: 3.50, outputPricePerMillion: 10.50 },
      'gemini-1.5-flash': { inputPricePerMillion: 0.075, outputPricePerMillion: 0.30 },
    },
  },
  mistral: {
    provider: 'mistral',
    models: {
      'mistral-tiny': { inputPricePerMillion: 0.25, outputPricePerMillion: 0.25 },
      'mistral-small': { inputPricePerMillion: 1.00, outputPricePerMillion: 3.00 },
      'mistral-medium': { inputPricePerMillion: 2.70, outputPricePerMillion: 8.10 },
      'mistral-large': { inputPricePerMillion: 4.00, outputPricePerMillion: 12.00 },
    },
  },
  cohere: {
    provider: 'cohere',
    models: {
      'command': { inputPricePerMillion: 1.00, outputPricePerMillion: 2.00 },
      'command-light': { inputPricePerMillion: 0.30, outputPricePerMillion: 0.60 },
      'command-r': { inputPricePerMillion: 0.50, outputPricePerMillion: 1.50 },
      'command-r-plus': { inputPricePerMillion: 3.00, outputPricePerMillion: 15.00 },
    },
  },
  grok: {
    provider: 'grok',
    models: {
      'grok-1': { inputPricePerMillion: 5.00, outputPricePerMillion: 15.00 },
      'grok-2': { inputPricePerMillion: 2.00, outputPricePerMillion: 10.00 },
    },
  },
  ollama: {
    provider: 'ollama',
    models: {},
    isLocal: true,
  },
};

// ============================================================================
// Usage Tracking Service Implementation
// ============================================================================

export class UsageTrackingService {
  private db: any;
  private records: Map<string, UsageRecord> = new Map();
  private limits: Map<string, UsageLimit> = new Map();

  constructor(config: UsageTrackingConfig) {
    this.db = config.db;
  }

  // ============================================================================
  // Track Usage
  // ============================================================================

  async trackUsage(input: TrackUsageInput): Promise<UsageRecord> {
    const { userId, providerId, provider, model, inputTokens, outputTokens, operation, latencyMs, metadata } = input;

    const totalTokens = inputTokens + outputTokens;
    const cost = this.estimateCost(provider, model, inputTokens, outputTokens);

    const record: UsageRecord = {
      id: uuidv4(),
      userId,
      providerId,
      provider,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      operation,
      estimatedCost: cost.totalCost,
      latencyMs,
      metadata,
      createdAt: new Date(),
    };

    this.records.set(record.id, record);

    return record;
  }

  // ============================================================================
  // Usage Summary
  // ============================================================================

  async getUsageSummary(userId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<UsageSummary> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const userRecords = Array.from(this.records.values())
      .filter(r => r.userId === userId && r.createdAt >= startDate);

    const byProvider: Record<string, ProviderUsageSummary> = {};

    let totalTokens = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    for (const record of userRecords) {
      totalTokens += record.totalTokens;
      totalInputTokens += record.inputTokens;
      totalOutputTokens += record.outputTokens;
      totalCost += record.estimatedCost;

      if (record.latencyMs) {
        totalLatency += record.latencyMs;
        latencyCount++;
      }

      // By provider
      if (!byProvider[record.provider]) {
        byProvider[record.provider] = {
          totalTokens: 0,
          totalRequests: 0,
          totalCost: 0,
          averageLatency: 0,
          byModel: {},
        };
      }

      byProvider[record.provider].totalTokens += record.totalTokens;
      byProvider[record.provider].totalRequests++;
      byProvider[record.provider].totalCost += record.estimatedCost;

      // By model
      if (!byProvider[record.provider].byModel[record.model]) {
        byProvider[record.provider].byModel[record.model] = {
          totalTokens: 0,
          totalRequests: 0,
          totalCost: 0,
          averageLatency: 0,
        };
      }

      byProvider[record.provider].byModel[record.model].totalTokens += record.totalTokens;
      byProvider[record.provider].byModel[record.model].totalRequests++;
      byProvider[record.provider].byModel[record.model].totalCost += record.estimatedCost;
    }

    return {
      period,
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      totalRequests: userRecords.length,
      totalCost,
      averageLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
      byProvider,
      startDate,
      endDate: now,
    };
  }

  // ============================================================================
  // Provider Usage
  // ============================================================================

  async getProviderUsage(userId: string, providerId: string): Promise<ProviderUsageSummary> {
    const userRecords = Array.from(this.records.values())
      .filter(r => r.userId === userId && r.providerId === providerId);

    const byModel: Record<string, ModelUsageSummary> = {};

    let totalTokens = 0;
    let totalCost = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    for (const record of userRecords) {
      totalTokens += record.totalTokens;
      totalCost += record.estimatedCost;

      if (record.latencyMs) {
        totalLatency += record.latencyMs;
        latencyCount++;
      }

      if (!byModel[record.model]) {
        byModel[record.model] = {
          totalTokens: 0,
          totalRequests: 0,
          totalCost: 0,
          averageLatency: 0,
        };
      }

      byModel[record.model].totalTokens += record.totalTokens;
      byModel[record.model].totalRequests++;
      byModel[record.model].totalCost += record.estimatedCost;
    }

    return {
      totalTokens,
      totalRequests: userRecords.length,
      totalCost,
      averageLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
      byModel,
    };
  }

  // ============================================================================
  // Cost Estimation
  // ============================================================================

  estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): CostEstimate {
    const providerPricing = PROVIDER_PRICING[provider];

    if (!providerPricing || providerPricing.isLocal) {
      return {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        currency: 'USD',
        isLocal: true,
      };
    }

    // Try to find exact model match, or use a default
    let modelPricing = providerPricing.models[model];
    if (!modelPricing) {
      // Try partial match
      for (const [key, pricing] of Object.entries(providerPricing.models)) {
        if (model.includes(key) || key.includes(model)) {
          modelPricing = pricing;
          break;
        }
      }
    }

    if (!modelPricing) {
      // Use first available model pricing as fallback
      const models = Object.values(providerPricing.models);
      modelPricing = models[0] || { inputPricePerMillion: 0, outputPricePerMillion: 0 };
    }

    const inputCost = (inputTokens / 1_000_000) * modelPricing.inputPricePerMillion;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.outputPricePerMillion;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD',
      isLocal: false,
    };
  }

  // ============================================================================
  // Pricing
  // ============================================================================

  getPricing(provider: string): ProviderPricing | undefined {
    return PROVIDER_PRICING[provider];
  }

  getAllPricing(): Record<string, ProviderPricing> {
    return { ...PROVIDER_PRICING };
  }

  // ============================================================================
  // Usage Limits
  // ============================================================================

  async setUsageLimit(userId: string, limit: Partial<UsageLimit>): Promise<void> {
    const existingLimit = this.limits.get(userId) || {
      userId,
      dailyTokenLimit: 100000,
      dailyCostLimit: 10.00,
    };

    this.limits.set(userId, {
      ...existingLimit,
      ...limit,
      userId,
    });
  }

  async checkUsageLimits(userId: string): Promise<LimitCheck> {
    const limit = this.limits.get(userId) || {
      userId,
      dailyTokenLimit: 100000,
      dailyCostLimit: 10.00,
    };

    const summary = await this.getUsageSummary(userId, 'daily');

    const exceededTokenLimit = summary.totalTokens > limit.dailyTokenLimit;
    const exceededCostLimit = summary.totalCost > limit.dailyCostLimit;
    const tokenLimitUsedPercent = (summary.totalTokens / limit.dailyTokenLimit) * 100;
    const costLimitUsedPercent = (summary.totalCost / limit.dailyCostLimit) * 100;

    return {
      exceededTokenLimit,
      exceededCostLimit,
      tokenLimitUsedPercent,
      costLimitUsedPercent,
      currentTokens: summary.totalTokens,
      currentCost: summary.totalCost,
      tokenLimit: limit.dailyTokenLimit,
      costLimit: limit.dailyCostLimit,
    };
  }

  // ============================================================================
  // Usage History
  // ============================================================================

  async getUsageHistory(userId: string, options: UsageHistoryOptions = {}): Promise<UsageRecord[]> {
    const { startDate, endDate, provider, model, limit = 100, offset = 0 } = options;

    let records = Array.from(this.records.values())
      .filter(r => r.userId === userId);

    if (startDate) {
      records = records.filter(r => r.createdAt >= startDate);
    }

    if (endDate) {
      records = records.filter(r => r.createdAt <= endDate);
    }

    if (provider) {
      records = records.filter(r => r.provider === provider);
    }

    if (model) {
      records = records.filter(r => r.model === model);
    }

    // Sort by date descending
    records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Paginate
    return records.slice(offset, offset + limit);
  }
}
