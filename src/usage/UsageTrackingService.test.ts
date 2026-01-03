/**
 * Usage Tracking Service Tests - Phase 19: Usage Tracking
 * TDD Red Phase - Write tests first
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsageTrackingService, UsageRecord, CostEstimate, ProviderPricing } from './UsageTrackingService';
import { createMockDatabase, MockDatabase } from '../../tests/helpers/mock-db';

describe('UsageTrackingService', () => {
  let usageService: UsageTrackingService;
  let db: MockDatabase;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    db = createMockDatabase();
    usageService = new UsageTrackingService({ db });
  });

  // ============================================================================
  // Token Tracking Tests
  // ============================================================================

  describe('trackUsage', () => {
    it('should_record_token_usage_for_provider', async () => {
      const result = await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        operation: 'chat',
      });

      expect(result.id).toBeDefined();
      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
      expect(result.totalTokens).toBe(150);
    });

    it('should_calculate_cost_based_on_pricing', async () => {
      const result = await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
        operation: 'chat',
      });

      // GPT-4: $0.03/1K input, $0.06/1K output
      // Expected: (1000 * 0.03 / 1000) + (500 * 0.06 / 1000) = 0.03 + 0.03 = 0.06
      expect(result.estimatedCost).toBeCloseTo(0.06, 2);
    });

    it('should_track_request_latency', async () => {
      const result = await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'anthropic',
        model: 'claude-3-opus',
        inputTokens: 200,
        outputTokens: 100,
        operation: 'chat',
        latencyMs: 1500,
      });

      expect(result.latencyMs).toBe(1500);
    });

    it('should_handle_different_operations', async () => {
      const chatResult = await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        operation: 'chat',
      });

      const embeddingResult = await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'text-embedding-ada-002',
        inputTokens: 500,
        outputTokens: 0,
        operation: 'embedding',
      });

      expect(chatResult.operation).toBe('chat');
      expect(embeddingResult.operation).toBe('embedding');
    });
  });

  // ============================================================================
  // Usage Summary Tests
  // ============================================================================

  describe('getUsageSummary', () => {
    it('should_return_daily_usage_summary', async () => {
      // Track some usage
      await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        operation: 'chat',
      });

      await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 200,
        outputTokens: 100,
        operation: 'chat',
      });

      const summary = await usageService.getUsageSummary('user-1', 'daily');

      expect(summary.totalTokens).toBe(450);
      expect(summary.totalRequests).toBe(2);
      expect(summary.totalCost).toBeGreaterThan(0);
    });

    it('should_return_monthly_usage_summary', async () => {
      await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
        operation: 'chat',
      });

      const summary = await usageService.getUsageSummary('user-1', 'monthly');

      expect(summary.period).toBe('monthly');
      expect(summary.totalTokens).toBeGreaterThan(0);
    });

    it('should_break_down_by_provider', async () => {
      await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        operation: 'chat',
      });

      await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-2',
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        inputTokens: 200,
        outputTokens: 100,
        operation: 'chat',
      });

      const summary = await usageService.getUsageSummary('user-1', 'daily');

      expect(summary.byProvider).toBeDefined();
      expect(summary.byProvider['openai']).toBeDefined();
      expect(summary.byProvider['anthropic']).toBeDefined();
    });
  });

  // ============================================================================
  // Provider Usage Tests
  // ============================================================================

  describe('getProviderUsage', () => {
    it('should_return_usage_for_specific_provider', async () => {
      await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 500,
        outputTokens: 250,
        operation: 'chat',
      });

      const usage = await usageService.getProviderUsage('user-1', 'provider-1');

      expect(usage.totalTokens).toBe(750);
      expect(usage.totalRequests).toBe(1);
      expect(usage.averageLatency).toBeDefined();
    });

    it('should_return_model_breakdown', async () => {
      await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        operation: 'chat',
      });

      await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        inputTokens: 200,
        outputTokens: 100,
        operation: 'chat',
      });

      const usage = await usageService.getProviderUsage('user-1', 'provider-1');

      expect(usage.byModel).toBeDefined();
      expect(usage.byModel['gpt-4']).toBeDefined();
      expect(usage.byModel['gpt-3.5-turbo']).toBeDefined();
    });
  });

  // ============================================================================
  // Cost Estimation Tests
  // ============================================================================

  describe('estimateCost', () => {
    it('should_estimate_openai_costs', () => {
      const cost = usageService.estimateCost('openai', 'gpt-4', 1000, 500);

      // GPT-4: $0.03/1K input, $0.06/1K output
      expect(cost.inputCost).toBeCloseTo(0.03, 2);
      expect(cost.outputCost).toBeCloseTo(0.03, 2);
      expect(cost.totalCost).toBeCloseTo(0.06, 2);
    });

    it('should_estimate_anthropic_costs', () => {
      const cost = usageService.estimateCost('anthropic', 'claude-3-opus', 1000, 500);

      // Claude 3 Opus: $0.015/1K input, $0.075/1K output
      expect(cost.inputCost).toBeCloseTo(0.015, 3);
      expect(cost.outputCost).toBeCloseTo(0.0375, 3);
      expect(cost.totalCost).toBeCloseTo(0.0525, 3);
    });

    it('should_estimate_deepseek_costs', () => {
      const cost = usageService.estimateCost('deepseek', 'deepseek-chat', 1000, 500);

      // DeepSeek: $0.0014/1K input, $0.0028/1K output (much cheaper)
      expect(cost.totalCost).toBeLessThan(0.01);
    });

    it('should_return_zero_for_local_providers', () => {
      const cost = usageService.estimateCost('ollama', 'llama2', 10000, 5000);

      expect(cost.totalCost).toBe(0);
      expect(cost.isLocal).toBe(true);
    });
  });

  // ============================================================================
  // Pricing Configuration Tests
  // ============================================================================

  describe('getPricing', () => {
    it('should_return_pricing_for_provider', () => {
      const pricing = usageService.getPricing('openai');

      expect(pricing).toBeDefined();
      expect(pricing.models['gpt-4']).toBeDefined();
      expect(pricing.models['gpt-3.5-turbo']).toBeDefined();
    });

    it('should_return_all_supported_providers_pricing', () => {
      const allPricing = usageService.getAllPricing();

      expect(allPricing['openai']).toBeDefined();
      expect(allPricing['anthropic']).toBeDefined();
      expect(allPricing['deepseek']).toBeDefined();
      expect(allPricing['google']).toBeDefined();
    });
  });

  // ============================================================================
  // Usage Limits & Alerts Tests
  // ============================================================================

  describe('checkUsageLimits', () => {
    it('should_check_if_user_exceeds_daily_limit', async () => {
      // Set a low limit for testing
      await usageService.setUsageLimit('user-1', {
        dailyTokenLimit: 1000,
        dailyCostLimit: 0.10,
      });

      // Track usage that exceeds limit
      await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 800,
        outputTokens: 400,
        operation: 'chat',
      });

      const limitCheck = await usageService.checkUsageLimits('user-1');

      expect(limitCheck.exceededTokenLimit).toBe(true);
    });

    it('should_check_if_user_exceeds_cost_limit', async () => {
      await usageService.setUsageLimit('user-1', {
        dailyTokenLimit: 100000,
        dailyCostLimit: 0.01, // Very low cost limit
      });

      await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
        operation: 'chat',
      });

      const limitCheck = await usageService.checkUsageLimits('user-1');

      expect(limitCheck.exceededCostLimit).toBe(true);
    });

    it('should_return_percentage_of_limit_used', async () => {
      await usageService.setUsageLimit('user-1', {
        dailyTokenLimit: 10000,
        dailyCostLimit: 1.00,
      });

      await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 2500,
        outputTokens: 2500,
        operation: 'chat',
      });

      const limitCheck = await usageService.checkUsageLimits('user-1');

      expect(limitCheck.tokenLimitUsedPercent).toBeCloseTo(50, 0);
    });
  });

  // ============================================================================
  // Usage History Tests
  // ============================================================================

  describe('getUsageHistory', () => {
    it('should_return_usage_records_for_date_range', async () => {
      await usageService.trackUsage({
        userId: 'user-1',
        providerId: 'provider-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        operation: 'chat',
      });

      const history = await usageService.getUsageHistory('user-1', {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(),
      });

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].userId).toBe('user-1');
    });

    it('should_paginate_results', async () => {
      // Track multiple usage records
      for (let i = 0; i < 15; i++) {
        await usageService.trackUsage({
          userId: 'user-1',
          providerId: 'provider-1',
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          operation: 'chat',
        });
      }

      const page1 = await usageService.getUsageHistory('user-1', { limit: 10 });
      const page2 = await usageService.getUsageHistory('user-1', { limit: 10, offset: 10 });

      expect(page1.length).toBe(10);
      expect(page2.length).toBe(5);
    });
  });
});
