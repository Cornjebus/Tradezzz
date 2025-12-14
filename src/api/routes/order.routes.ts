/**
 * Order Routes - Order Execution API Endpoints
 * Handles order creation, execution, cancellation, and position management
 */

import { Router, Request, Response } from 'express';
import { OrderService, OrderFilters } from '../../execution/OrderService';
import { StrategyService } from '../../strategies/StrategyService';
import { AuthService } from '../../users/AuthService';
import { createAuthMiddleware } from '../middleware/auth.middleware';
import { asyncHandler, NotFoundError } from '../middleware/error.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const createOrderSchema = z.object({
  strategyId: z.string().uuid('Invalid strategy ID'),
  symbol: z.string().min(1, 'Symbol is required'),
  side: z.enum(['buy', 'sell'], { message: 'Side must be buy or sell' }),
  type: z.enum(['market', 'limit', 'stop_loss', 'take_profit'], { message: 'Invalid order type' }),
  quantity: z.number().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive').optional(),
  stopPrice: z.number().positive('Stop price must be positive').optional(),
  mode: z.enum(['paper', 'live'], { message: 'Mode must be paper or live' }),
  exchangeId: z.string().optional(),
});

const modifyOrderSchema = z.object({
  price: z.number().positive('Price must be positive').optional(),
  quantity: z.number().positive('Quantity must be positive').optional(),
  stopPrice: z.number().positive('Stop price must be positive').optional(),
});

const executePaperOrderSchema = z.object({
  currentPrice: z.number().positive('Current price must be positive'),
  slippage: z.number().min(0).max(10).optional(),
});

// ============================================================================
// Router Factory
// ============================================================================

export function createOrderRouter(
  orderService: OrderService,
  strategyService: StrategyService,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // ============================================================================
  // POST / - Create Order
  // ============================================================================

  router.post(
    '/',
    requireAuth,
    validate(createOrderSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { strategyId, symbol, side, type, quantity, price, stopPrice, mode, exchangeId } = req.body;

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

      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol,
        side,
        type,
        quantity,
        price,
        stopPrice,
        mode,
        exchangeId,
      });

      res.status(201).json({
        success: true,
        data: order,
      });
    })
  );

  // ============================================================================
  // GET / - List User Orders
  // ============================================================================

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { status, symbol, mode } = req.query;

      const filters: OrderFilters = {};
      if (status) filters.status = status as any;
      if (symbol) filters.symbol = symbol as string;
      if (mode) filters.mode = mode as any;

      const orders = await orderService.getUserOrders(userId, filters);

      res.json({
        success: true,
        data: orders,
      });
    })
  );

  // ============================================================================
  // GET /:id - Get Single Order
  // ============================================================================

  router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const order = await orderService.getOrder(id);
      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (order.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: order,
      });
    })
  );

  // ============================================================================
  // POST /:id/execute - Execute Paper Order
  // ============================================================================

  router.post(
    '/:id/execute',
    requireAuth,
    validate(executePaperOrderSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;
      const { currentPrice, slippage } = req.body;

      const order = await orderService.getOrder(id);
      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (order.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      if (order.mode !== 'paper') {
        res.status(400).json({
          success: false,
          error: 'Only paper orders can be manually executed',
        });
        return;
      }

      const executed = await orderService.executePaperOrder(id, currentPrice, { slippage });

      res.json({
        success: true,
        data: executed,
      });
    })
  );

  // ============================================================================
  // DELETE /:id - Cancel Order
  // ============================================================================

  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const order = await orderService.getOrder(id);
      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (order.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const cancelled = await orderService.cancelOrder(id);

      res.json({
        success: true,
        data: cancelled,
      });
    })
  );

  // ============================================================================
  // PUT /:id - Modify Order
  // ============================================================================

  router.put(
    '/:id',
    requireAuth,
    validate(modifyOrderSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;
      const { price, quantity, stopPrice } = req.body;

      const order = await orderService.getOrder(id);
      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (order.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const modified = await orderService.modifyOrder(id, { price, quantity, stopPrice });

      res.json({
        success: true,
        data: modified,
      });
    })
  );

  // ============================================================================
  // DELETE /cancel-all/:symbol - Cancel All Orders for Symbol
  // ============================================================================

  router.delete(
    '/cancel-all/:symbol',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { symbol } = req.params;

      await orderService.cancelAllOrders(userId, symbol);

      res.json({
        success: true,
        message: `All pending orders for ${symbol} cancelled`,
      });
    })
  );

  // ============================================================================
  // GET /positions/open - Get Open Positions
  // ============================================================================

  router.get(
    '/positions/open',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;

      const positions = await orderService.getOpenPositions(userId);

      res.json({
        success: true,
        data: positions,
      });
    })
  );

  // ============================================================================
  // GET /positions/closed - Get Closed Positions
  // ============================================================================

  router.get(
    '/positions/closed',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;

      const positions = await orderService.getClosedPositions(userId);

      res.json({
        success: true,
        data: positions,
      });
    })
  );

  // ============================================================================
  // GET /portfolio/summary - Get Portfolio Summary
  // ============================================================================

  router.get(
    '/portfolio/summary',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;

      // In production, would fetch current prices from exchanges
      // For now, return positions with entry prices as current
      const positions = await orderService.getOpenPositions(userId);
      const currentPrices: Record<string, number> = {};

      for (const position of positions) {
        currentPrices[position.symbol] = position.entryPrice;
      }

      const summary = await orderService.getPortfolioSummary(userId, currentPrices);

      res.json({
        success: true,
        data: summary,
      });
    })
  );

  // ============================================================================
  // GET /strategy/:strategyId - Get Strategy Orders
  // ============================================================================

  router.get(
    '/strategy/:strategyId',
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

      const orders = await orderService.getStrategyOrders(strategyId);

      res.json({
        success: true,
        data: orders,
      });
    })
  );

  return router;
}
