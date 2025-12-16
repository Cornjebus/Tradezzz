/**
 * User Settings Routes - User Preferences & Configuration
 *
 * Manages user preferences for trading, notifications, and display
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// In-memory storage (in production, use database)
interface UserSettings {
  userId: string;
  subscription: {
    tier: 'dreamer' | 'sleeper' | 'slumber' | 'coma';
    features: string[];
    maxStrategies: number;
  };
  trading: {
    defaultMode: 'paper' | 'live';
    riskLevel: 'conservative' | 'medium' | 'aggressive';
    maxPositions: number;
    defaultOrderSize: number;
  };
  notifications: {
    bigTrades: boolean;
    morningSummary: boolean;
    priceAlerts: boolean;
    systemUpdates: boolean;
    email: boolean;
    push: boolean;
  };
  display: {
    theme: 'dark' | 'light' | 'auto';
    currency: string;
    timezone: string;
    language: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSettings = new Map<string, UserSettings>();

// Default settings for new users
function getDefaultSettings(userId: string): UserSettings {
  return {
    userId,
    subscription: {
      tier: 'dreamer',
      features: ['paper_trading', 'basic_strategies'],
      maxStrategies: 1
    },
    trading: {
      defaultMode: 'paper',
      riskLevel: 'conservative',
      maxPositions: 5,
      defaultOrderSize: 100
    },
    notifications: {
      bigTrades: false,
      morningSummary: true,
      priceAlerts: false,
      systemUpdates: true,
      email: true,
      push: false
    },
    display: {
      theme: 'dark',
      currency: 'USD',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: 'en'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * GET /api/settings
 * Get all user settings
 */
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let settings = userSettings.get(userId);

    if (!settings) {
      settings = getDefaultSettings(userId);
      userSettings.set(userId, settings);
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/settings/subscription
 * Get subscription details
 */
router.get('/subscription', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let settings = userSettings.get(userId) || getDefaultSettings(userId);

    const tierInfo = {
      dreamer: {
        name: 'Dreamer',
        price: 0,
        emoji: '😴',
        features: ['Paper trading', '1 Strategy', 'Basic analytics'],
        upgradeUrl: null
      },
      sleeper: {
        name: 'Sleeper',
        price: 29,
        emoji: '💤',
        features: ['Live trading', '5 Strategies', 'Advanced analytics', 'Priority support'],
        upgradeUrl: '/upgrade/sleeper'
      },
      slumber: {
        name: 'Slumber',
        price: 79,
        emoji: '🌙',
        features: ['Everything in Sleeper', 'Unlimited strategies', 'API access', 'Custom indicators'],
        upgradeUrl: '/upgrade/slumber'
      },
      coma: {
        name: 'Coma',
        price: 199,
        emoji: '🛏️',
        features: ['Everything in Slumber', 'Dedicated support', 'White-label', 'Custom integrations'],
        upgradeUrl: '/upgrade/coma'
      }
    };

    res.json({
      success: true,
      data: {
        current: settings.subscription,
        tierInfo: tierInfo[settings.subscription.tier],
        allTiers: tierInfo
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
 * GET /api/settings/trading
 * Get trading preferences
 */
router.get('/trading', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let settings = userSettings.get(userId) || getDefaultSettings(userId);

    res.json({
      success: true,
      data: settings.trading
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/settings/trading
 * Update trading preferences
 */
router.put('/trading', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let settings = userSettings.get(userId) || getDefaultSettings(userId);

    const { riskLevel, maxPositions, defaultOrderSize } = req.body;

    // Validate risk level
    if (riskLevel && !['conservative', 'medium', 'aggressive'].includes(riskLevel)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid risk level'
      });
    }

    // Update trading settings (defaultMode is controlled by trading mode API)
    if (riskLevel) settings.trading.riskLevel = riskLevel;
    if (maxPositions !== undefined) settings.trading.maxPositions = Math.max(1, Math.min(100, maxPositions));
    if (defaultOrderSize !== undefined) settings.trading.defaultOrderSize = Math.max(1, defaultOrderSize);

    settings.updatedAt = new Date();
    userSettings.set(userId, settings);

    res.json({
      success: true,
      message: 'Trading preferences updated',
      data: settings.trading
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/settings/notifications
 * Get notification preferences
 */
router.get('/notifications', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let settings = userSettings.get(userId) || getDefaultSettings(userId);

    res.json({
      success: true,
      data: settings.notifications
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/settings/notifications
 * Update notification preferences
 */
router.put('/notifications', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let settings = userSettings.get(userId) || getDefaultSettings(userId);

    const { bigTrades, morningSummary, priceAlerts, systemUpdates, email, push } = req.body;

    // Update notification settings
    if (bigTrades !== undefined) settings.notifications.bigTrades = !!bigTrades;
    if (morningSummary !== undefined) settings.notifications.morningSummary = !!morningSummary;
    if (priceAlerts !== undefined) settings.notifications.priceAlerts = !!priceAlerts;
    if (systemUpdates !== undefined) settings.notifications.systemUpdates = !!systemUpdates;
    if (email !== undefined) settings.notifications.email = !!email;
    if (push !== undefined) settings.notifications.push = !!push;

    settings.updatedAt = new Date();
    userSettings.set(userId, settings);

    res.json({
      success: true,
      message: 'Notification preferences updated',
      data: settings.notifications
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/settings/display
 * Get display preferences
 */
router.get('/display', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let settings = userSettings.get(userId) || getDefaultSettings(userId);

    res.json({
      success: true,
      data: settings.display
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/settings/display
 * Update display preferences
 */
router.put('/display', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let settings = userSettings.get(userId) || getDefaultSettings(userId);

    const { theme, currency, timezone, language } = req.body;

    // Validate theme
    if (theme && !['dark', 'light', 'auto'].includes(theme)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid theme'
      });
    }

    // Update display settings
    if (theme) settings.display.theme = theme;
    if (currency) settings.display.currency = currency;
    if (timezone) settings.display.timezone = timezone;
    if (language) settings.display.language = language;

    settings.updatedAt = new Date();
    userSettings.set(userId, settings);

    res.json({
      success: true,
      message: 'Display preferences updated',
      data: settings.display
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
