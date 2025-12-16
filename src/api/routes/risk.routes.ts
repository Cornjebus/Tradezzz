/**
 * Risk Management API Routes
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { RiskManager } from '../../risk/RiskManager';

const router = Router();

// Per-user risk managers (in production, persist to database)
const userManagers = new Map<string, RiskManager>();

function getManager(userId: string, initialEquity?: number): RiskManager {
  if (!userManagers.has(userId)) {
    userManagers.set(userId, new RiskManager(initialEquity || 10000));
  }
  return userManagers.get(userId)!;
}

/**
 * GET /api/risk/metrics
 * Get risk metrics for user
 */
router.get('/metrics', authMiddleware, (req: Request, res: Response) => {
  try {
    const manager = getManager(req.user!.id);
    const metrics = manager.getMetrics();

    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/risk/limits
 * Get risk limits
 */
router.get('/limits', authMiddleware, (req: Request, res: Response) => {
  try {
    const manager = getManager(req.user!.id);
    res.json({ success: true, data: manager.getLimits() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/risk/limits
 * Update risk limits
 */
router.put('/limits', authMiddleware, (req: Request, res: Response) => {
  try {
    const manager = getManager(req.user!.id);
    manager.updateLimits(req.body);
    res.json({ success: true, data: manager.getLimits() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/risk/check
 * Check if trade is allowed
 */
router.post('/check', authMiddleware, (req: Request, res: Response) => {
  try {
    const { symbol, direction, size, entryPrice, stopLoss, takeProfit } = req.body;

    if (!symbol || !direction || !size || !entryPrice || !stopLoss || !takeProfit) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, direction, size, entryPrice, stopLoss, takeProfit',
      });
    }

    const manager = getManager(req.user!.id);
    const result = manager.checkTradeRisk(
      symbol,
      direction,
      size,
      entryPrice,
      stopLoss,
      takeProfit
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/risk/calculate/position
 * Calculate position size
 */
router.post('/calculate/position', authMiddleware, (req: Request, res: Response) => {
  try {
    const { method = 'fixed_percentage', riskPercentage = 0.02 } = req.body;
    const manager = getManager(req.user!.id);
    const result = manager.calculatePosition(method, riskPercentage);

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/risk/calculate/stoploss
 * Calculate stop loss price
 */
router.post('/calculate/stoploss', authMiddleware, (req: Request, res: Response) => {
  try {
    const { entryPrice, direction, riskPercent = 0.02, atr } = req.body;

    if (!entryPrice || !direction) {
      return res.status(400).json({
        success: false,
        error: 'entryPrice and direction required',
      });
    }

    const manager = getManager(req.user!.id);
    const stopLoss = manager.calculateStopLoss(entryPrice, direction, riskPercent, atr);

    res.json({ success: true, data: { stopLoss } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/risk/calculate/takeprofit
 * Calculate take profit price
 */
router.post('/calculate/takeprofit', authMiddleware, (req: Request, res: Response) => {
  try {
    const { entryPrice, stopLoss, direction, riskRewardRatio = 2 } = req.body;

    if (!entryPrice || !stopLoss || !direction) {
      return res.status(400).json({
        success: false,
        error: 'entryPrice, stopLoss, and direction required',
      });
    }

    const manager = getManager(req.user!.id);
    const takeProfit = manager.calculateTakeProfit(
      entryPrice,
      stopLoss,
      direction,
      riskRewardRatio
    );

    res.json({ success: true, data: { takeProfit } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/risk/positions
 * Get open positions
 */
router.get('/positions', authMiddleware, (req: Request, res: Response) => {
  try {
    const manager = getManager(req.user!.id);
    res.json({ success: true, data: manager.getPositions() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/risk/trades
 * Get trade history
 */
router.get('/trades', authMiddleware, (req: Request, res: Response) => {
  try {
    const manager = getManager(req.user!.id);
    res.json({ success: true, data: manager.getTrades() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/risk/equity
 * Get equity curve
 */
router.get('/equity', authMiddleware, (req: Request, res: Response) => {
  try {
    const manager = getManager(req.user!.id);
    res.json({ success: true, data: manager.getEquityCurve() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
