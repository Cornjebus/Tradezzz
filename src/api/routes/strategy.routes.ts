/**
 * Strategy Routes - Strategy Management API Endpoints
 * Handles CRUD operations for trading strategies
 */

import { Router, Request, Response } from 'express';
import { StrategyService } from '../../strategies/StrategyService';
import { AuthService } from '../../users/AuthService';
import { createAuthMiddleware } from '../middleware/auth.middleware';
import { asyncHandler, NotFoundError } from '../middleware/error.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const createStrategySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum(['momentum', 'mean_reversion', 'sentiment', 'arbitrage', 'trend_following', 'custom']),
  config: z.object({}).passthrough(), // Accept any object
});

const updateStrategySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  config: z.object({}).passthrough().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['draft', 'backtesting', 'paper', 'active', 'paused', 'archived']),
});

const cloneStrategySchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

// ============================================================================
// Router Factory
// ============================================================================

export function createStrategyRouter(
  strategyService: StrategyService,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // ============================================================================
  // POST / - Create Strategy
  // ============================================================================

  router.post(
    '/',
    requireAuth,
    validate(createStrategySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { name, description, type, config } = req.body;
      const userId = req.userId!;

      const strategy = await strategyService.createStrategy({
        userId,
        name,
        description,
        type,
        config,
      });

      res.status(201).json({
        success: true,
        data: strategy,
      });
    })
  );

  // ============================================================================
  // GET / - List User Strategies
  // ============================================================================

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { status, type } = req.query;

      const filters: { status?: any; type?: any } = {};
      if (status) filters.status = status as string;
      if (type) filters.type = type as string;

      const strategies = await strategyService.getUserStrategies(userId, filters);

      res.json({
        success: true,
        data: strategies,
      });
    })
  );

  // ============================================================================
  // GET /:id - Get Single Strategy
  // ============================================================================

  router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.userId!;

      const strategy = await strategyService.getStrategy(id);

      if (!strategy) {
        throw new NotFoundError('Strategy not found');
      }

      // Check ownership
      if (strategy.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: strategy,
      });
    })
  );

  // ============================================================================
  // PUT /:id - Update Strategy
  // ============================================================================

  router.put(
    '/:id',
    requireAuth,
    validate(updateStrategySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.userId!;
      const { name, description, config } = req.body;

      // Verify ownership
      const existing = await strategyService.getStrategy(id);
      if (!existing) {
        throw new NotFoundError('Strategy not found');
      }
      if (existing.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const updated = await strategyService.updateStrategy(id, {
        name,
        description,
        config,
      });

      res.json({
        success: true,
        data: updated,
      });
    })
  );

  // ============================================================================
  // POST /:id/status - Update Strategy Status
  // ============================================================================

  router.post(
    '/:id/status',
    requireAuth,
    validate(updateStatusSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.userId!;
      const { status } = req.body;

      // Verify ownership
      const existing = await strategyService.getStrategy(id);
      if (!existing) {
        throw new NotFoundError('Strategy not found');
      }
      if (existing.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const updated = await strategyService.updateStatus(id, status);

      res.json({
        success: true,
        data: updated,
      });
    })
  );

  // ============================================================================
  // DELETE /:id - Delete Strategy
  // ============================================================================

  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.userId!;

      // Verify ownership
      const existing = await strategyService.getStrategy(id);
      if (!existing) {
        throw new NotFoundError('Strategy not found');
      }
      if (existing.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      await strategyService.deleteStrategy(id);

      res.json({
        success: true,
        message: 'Strategy deleted',
      });
    })
  );

  // ============================================================================
  // POST /:id/clone - Clone Strategy
  // ============================================================================

  router.post(
    '/:id/clone',
    requireAuth,
    validate(cloneStrategySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.userId!;
      const { name } = req.body;

      const cloned = await strategyService.cloneStrategy(id, name, userId);

      res.status(201).json({
        success: true,
        data: cloned,
      });
    })
  );

  // ============================================================================
  // GET /:id/stats - Get Strategy Statistics
  // ============================================================================

  router.get(
    '/:id/stats',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.userId!;

      // Verify ownership
      const existing = await strategyService.getStrategy(id);
      if (!existing) {
        throw new NotFoundError('Strategy not found');
      }
      if (existing.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const stats = await strategyService.getStrategyStats(id);

      res.json({
        success: true,
        data: stats,
      });
    })
  );

  return router;
}
