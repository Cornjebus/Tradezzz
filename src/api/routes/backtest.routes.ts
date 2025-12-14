/**
 * Backtest Routes - Backtesting API Endpoints
 * Handles backtest execution, history, and analysis
 */

import { Router, Request, Response } from 'express';
import { BacktestService, BacktestConfig } from '../../backtesting/BacktestService';
import { StrategyService } from '../../strategies/StrategyService';
import { AuthService } from '../../users/AuthService';
import { createAuthMiddleware } from '../middleware/auth.middleware';
import { asyncHandler, NotFoundError } from '../middleware/error.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const runBacktestSchema = z.object({
  strategyId: z.string().uuid('Invalid strategy ID'),
  symbol: z.string().min(1, 'Symbol is required'),
  startDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid start date'),
  endDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid end date'),
  initialCapital: z.number().positive('Initial capital must be positive'),
  slippage: z.number().min(0).max(10).optional(),
  commission: z.number().min(0).max(10).optional(),
});

// ============================================================================
// Router Factory
// ============================================================================

export function createBacktestRouter(
  backtestService: BacktestService,
  strategyService: StrategyService,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // ============================================================================
  // POST / - Run Backtest
  // ============================================================================

  router.post(
    '/',
    requireAuth,
    validate(runBacktestSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { strategyId, symbol, startDate, endDate, initialCapital, slippage, commission } = req.body;

      // Verify strategy ownership
      const strategy = await strategyService.getStrategy(strategyId);
      if (!strategy) {
        throw new NotFoundError('Strategy not found');
      }
      if (strategy.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      // For now, generate sample data (in production, would fetch from exchange)
      const sampleData = generateSampleData(new Date(startDate), new Date(endDate));

      const config: BacktestConfig = {
        strategyId,
        symbol,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        initialCapital,
        slippage,
        commission,
        data: sampleData,
      };

      const result = await backtestService.runBacktest(config);

      res.status(201).json({
        success: true,
        data: result,
      });
    })
  );

  // ============================================================================
  // GET /history/:strategyId - Get Backtest History
  // ============================================================================

  router.get(
    '/history/:strategyId',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { strategyId } = req.params;

      // Verify strategy ownership
      const strategy = await strategyService.getStrategy(strategyId);
      if (!strategy) {
        throw new NotFoundError('Strategy not found');
      }
      if (strategy.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const history = await backtestService.getBacktestHistory(strategyId);

      res.json({
        success: true,
        data: history,
      });
    })
  );

  // ============================================================================
  // POST /compare - Compare Multiple Backtests
  // ============================================================================

  router.post(
    '/compare',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { backtestIds } = req.body;

      if (!Array.isArray(backtestIds) || backtestIds.length < 2) {
        res.status(400).json({
          success: false,
          error: 'At least 2 backtest IDs required for comparison',
        });
        return;
      }

      // Get all backtest results (simplified - would need proper storage in production)
      // For now, return empty comparison
      res.json({
        success: true,
        data: [],
        message: 'Comparison requires stored backtest results',
      });
    })
  );

  return router;
}

// ============================================================================
// Helper: Generate Sample Data
// ============================================================================

function generateSampleData(startDate: Date, endDate: Date): any[] {
  const data = [];
  let currentTime = startDate.getTime();
  const endTime = endDate.getTime();
  const hourMs = 60 * 60 * 1000;

  let price = 50000; // Starting price

  while (currentTime < endTime) {
    const change = (Math.random() - 0.48) * 0.02; // Slight upward bias
    price = price * (1 + change);

    const high = price * (1 + Math.random() * 0.01);
    const low = price * (1 - Math.random() * 0.01);
    const open = price * (1 + (Math.random() - 0.5) * 0.005);

    data.push({
      timestamp: currentTime,
      open,
      high,
      low,
      close: price,
      volume: Math.floor(Math.random() * 1000) + 100,
    });

    currentTime += hourMs;
  }

  return data;
}
