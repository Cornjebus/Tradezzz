/**
 * Trading Mode API Routes - Phase 10: Paper/Live Isolation
 *
 * Endpoints for managing trading mode and paper trading
 */

import { Router, Request, Response } from 'express';
import { TradingModeManager, TradingMode } from '../../trading/TradingModeManager';
import { PaperTradingEngine } from '../../trading/PaperTradingEngine';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Singleton instances (in production, inject via DI)
const modeManager = new TradingModeManager();
const paperEngines = new Map<string, PaperTradingEngine>();

/**
 * Get user's paper trading engine, creating if needed
 */
function getPaperEngine(userId: string): PaperTradingEngine {
  let engine = paperEngines.get(userId);
  if (!engine) {
    engine = new PaperTradingEngine({
      initialBalance: { USDT: 100000 } // Default 100k USDT for paper trading
    });
    paperEngines.set(userId, engine);
  }
  return engine;
}

/**
 * GET /api/trading/mode
 * Get current trading mode for user
 */
router.get('/mode', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const status = modeManager.getModeStatus(userId);

    res.json({
      success: true,
      data: {
        mode: status.mode,
        isLive: status.isLive,
        canSwitchToLive: status.canSwitchToLive,
        modeStartedAt: status.modeStartedAt
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/trading/mode
 * Switch trading mode
 */
router.post('/mode', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { mode, confirmation } = req.body;

    if (!mode || !['paper', 'live'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be "paper" or "live"'
      });
    }

    const targetMode = mode === 'live' ? TradingMode.LIVE : TradingMode.PAPER;

    await modeManager.switchMode(userId, targetMode, confirmation);

    const status = modeManager.getModeStatus(userId);
    res.json({
      success: true,
      message: `Switched to ${mode} trading mode`,
      data: {
        mode: status.mode,
        isLive: status.isLive
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/trading/mode/audit
 * Get mode switch audit logs
 */
router.get('/mode/audit', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const logs = modeManager.getAuditLogs(userId);

    res.json({
      success: true,
      data: logs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Paper Trading Endpoints
// ============================================

/**
 * GET /api/trading/paper/balances
 * Get paper trading balances
 */
router.get('/paper/balances', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const engine = getPaperEngine(userId);
    const balances = engine.getBalances();

    res.json({
      success: true,
      data: balances
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/trading/paper/orders
 * Create a paper trading order
 */
router.post('/paper/orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Ensure user is in paper mode
    const currentMode = modeManager.getCurrentMode(userId);
    if (currentMode !== TradingMode.PAPER) {
      return res.status(400).json({
        success: false,
        error: 'Must be in paper trading mode to create paper orders'
      });
    }

    const { symbol, side, type, quantity, price } = req.body;

    if (!symbol || !side || !type || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, side, type, quantity'
      });
    }

    const engine = getPaperEngine(userId);

    // Set mock price if not set (in production, get from exchange)
    // This is a simplified version - real implementation would fetch prices
    const mockPrice = price || 50000; // Default for demo
    engine.setMockPrice(symbol, mockPrice);

    const order = await engine.createOrder({
      symbol,
      side,
      type,
      quantity,
      price
    });

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/trading/paper/orders
 * Get paper trading orders
 */
router.get('/paper/orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const engine = getPaperEngine(userId);

    const { status } = req.query;

    let orders;
    if (status === 'open') {
      orders = engine.getOpenOrders();
    } else {
      orders = engine.getOrders();
    }

    res.json({
      success: true,
      data: orders
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/trading/paper/orders/:orderId
 * Cancel a paper trading order
 */
router.delete('/paper/orders/:orderId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { orderId } = req.params;

    const engine = getPaperEngine(userId);
    const order = await engine.cancelOrder(orderId);

    res.json({
      success: true,
      data: order
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/trading/paper/positions
 * Get paper trading positions
 */
router.get('/paper/positions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const engine = getPaperEngine(userId);
    const positions = engine.getPositions();

    res.json({
      success: true,
      data: positions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/trading/paper/trades
 * Get paper trading trade history
 */
router.get('/paper/trades', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const engine = getPaperEngine(userId);
    const trades = engine.getTrades();

    res.json({
      success: true,
      data: trades
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/trading/paper/portfolio
 * Get paper trading portfolio value
 */
router.get('/paper/portfolio', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const engine = getPaperEngine(userId);

    const balances = engine.getBalances();
    const positions = engine.getPositions();
    const totalValue = engine.getPortfolioValue();

    res.json({
      success: true,
      data: {
        totalValue,
        balances,
        positions
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/trading/paper/reset
 * Reset paper trading account
 */
router.post('/paper/reset', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { initialBalance } = req.body;

    // Create new paper engine
    const engine = new PaperTradingEngine({
      initialBalance: initialBalance || { USDT: 100000 }
    });
    paperEngines.set(userId, engine);

    res.json({
      success: true,
      message: 'Paper trading account reset',
      data: {
        balances: engine.getBalances()
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
