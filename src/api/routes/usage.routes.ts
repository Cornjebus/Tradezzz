/**
 * Usage Routes - Phase 19: Usage Tracking API
 *
 * Provides usage tracking endpoints:
 * - Track token usage
 * - Get usage summaries
 * - Cost estimation
 * - Usage limits
 * - Usage history
 */

import { Router, Request, Response } from 'express';
import { UsageTrackingService } from '../../usage/UsageTrackingService';
import { AuthService } from '../../users/AuthService';
import { createAuthMiddleware } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const trackUsageSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  provider: z.string().min(1, 'Provider is required'),
  model: z.string().min(1, 'Model is required'),
  inputTokens: z.number().min(0, 'Input tokens must be non-negative'),
  outputTokens: z.number().min(0, 'Output tokens must be non-negative'),
  operation: z.enum(['chat', 'embedding', 'completion', 'analysis', 'signal']),
  latencyMs: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const estimateCostSchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  model: z.string().min(1, 'Model is required'),
  inputTokens: z.number().min(0),
  outputTokens: z.number().min(0),
});

const setLimitsSchema = z.object({
  dailyTokenLimit: z.number().min(0).optional(),
  dailyCostLimit: z.number().min(0).optional(),
  monthlyTokenLimit: z.number().min(0).optional(),
  monthlyCostLimit: z.number().min(0).optional(),
});

// ============================================================================
// Router Factory
// ============================================================================

export function createUsageRouter(
  usageService: UsageTrackingService,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // ============================================================================
  // POST /track - Track Token Usage
  // ============================================================================

  router.post(
    '/track',
    requireAuth,
    validate(trackUsageSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { providerId, provider, model, inputTokens, outputTokens, operation, latencyMs, metadata } = req.body;

      const record = await usageService.trackUsage({
        userId,
        providerId,
        provider,
        model,
        inputTokens,
        outputTokens,
        operation,
        latencyMs,
        metadata,
      });

      res.status(201).json({
        success: true,
        data: record,
      });
    })
  );

  // ============================================================================
  // GET /summary - Get Usage Summary
  // ============================================================================

  router.get(
    '/summary',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'daily';

      const summary = await usageService.getUsageSummary(userId, period);

      res.json({
        success: true,
        data: summary,
      });
    })
  );

  // ============================================================================
  // GET /providers/:id - Get Provider Usage
  // ============================================================================

  router.get(
    '/providers/:id',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const usage = await usageService.getProviderUsage(userId, id);

      res.json({
        success: true,
        data: usage,
      });
    })
  );

  // ============================================================================
  // POST /estimate - Estimate Cost
  // ============================================================================

  router.post(
    '/estimate',
    requireAuth,
    validate(estimateCostSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { provider, model, inputTokens, outputTokens } = req.body;

      const estimate = usageService.estimateCost(provider, model, inputTokens, outputTokens);

      res.json({
        success: true,
        data: estimate,
      });
    })
  );

  // ============================================================================
  // GET /pricing - Get All Pricing
  // ============================================================================

  router.get(
    '/pricing',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const pricing = usageService.getAllPricing();

      res.json({
        success: true,
        data: pricing,
      });
    })
  );

  // ============================================================================
  // GET /pricing/:provider - Get Provider Pricing
  // ============================================================================

  router.get(
    '/pricing/:provider',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { provider } = req.params;
      const pricing = usageService.getPricing(provider);

      if (!pricing) {
        res.status(404).json({
          success: false,
          error: 'Provider pricing not found',
        });
        return;
      }

      res.json({
        success: true,
        data: pricing,
      });
    })
  );

  // ============================================================================
  // PUT /limits - Set Usage Limits
  // ============================================================================

  router.put(
    '/limits',
    requireAuth,
    validate(setLimitsSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { dailyTokenLimit, dailyCostLimit, monthlyTokenLimit, monthlyCostLimit } = req.body;

      await usageService.setUsageLimit(userId, {
        dailyTokenLimit,
        dailyCostLimit,
        monthlyTokenLimit,
        monthlyCostLimit,
      });

      res.json({
        success: true,
        message: 'Usage limits updated',
      });
    })
  );

  // ============================================================================
  // GET /limits/check - Check Usage Limits
  // ============================================================================

  router.get(
    '/limits/check',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;

      const limitCheck = await usageService.checkUsageLimits(userId);

      res.json({
        success: true,
        data: limitCheck,
      });
    })
  );

  // ============================================================================
  // GET /history - Get Usage History
  // ============================================================================

  router.get(
    '/history',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { provider, model, startDate, endDate, limit, offset } = req.query;

      const history = await usageService.getUsageHistory(userId, {
        provider: provider as string | undefined,
        model: model as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.json({
        success: true,
        data: history,
      });
    })
  );

  return router;
}
