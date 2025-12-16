/**
 * Exchanges Routes - Phase 9: Exchange Connections (Clerk-compatible)
 *
 * Simplified routes for exchange management with Clerk auth
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// In-memory storage (in production, use database)
interface ExchangeConnection {
  id: string;
  userId: string;
  exchange: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  maskedApiKey: string;
  encryptedApiKey: string;
  encryptedSecret: string;
  permissions: string[];
  createdAt: Date;
  lastSyncAt?: Date;
}

const connections = new Map<string, ExchangeConnection>();

const SUPPORTED_EXCHANGES = {
  binance: {
    id: 'binance',
    name: 'Binance',
    logo: '🟡',
    features: ['spot', 'futures', 'margin'],
    requiredFields: ['apiKey', 'apiSecret']
  },
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase',
    logo: '🔵',
    features: ['spot', 'advanced_trade'],
    requiredFields: ['apiKey', 'apiSecret']
  },
  kraken: {
    id: 'kraken',
    name: 'Kraken',
    logo: '🟣',
    features: ['spot', 'futures'],
    requiredFields: ['apiKey', 'apiSecret']
  },
  kucoin: {
    id: 'kucoin',
    name: 'KuCoin',
    logo: '🟢',
    features: ['spot', 'futures', 'margin'],
    requiredFields: ['apiKey', 'apiSecret', 'passphrase']
  },
  bybit: {
    id: 'bybit',
    name: 'Bybit',
    logo: '🟠',
    features: ['spot', 'derivatives'],
    requiredFields: ['apiKey', 'apiSecret']
  },
  okx: {
    id: 'okx',
    name: 'OKX',
    logo: '⚪',
    features: ['spot', 'futures', 'options'],
    requiredFields: ['apiKey', 'apiSecret', 'passphrase']
  }
};

function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function simpleEncrypt(text: string): string {
  return Buffer.from(text).toString('base64');
}

/**
 * GET /api/exchanges/supported
 * Get all supported exchanges
 */
router.get('/supported', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(SUPPORTED_EXCHANGES)
  });
});

/**
 * GET /api/exchanges
 * List user's exchange connections
 */
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userConnections = Array.from(connections.values())
      .filter(c => c.userId === userId)
      .map(c => ({
        id: c.id,
        exchange: c.exchange,
        name: c.name,
        status: c.status,
        maskedApiKey: c.maskedApiKey,
        permissions: c.permissions,
        createdAt: c.createdAt,
        lastSyncAt: c.lastSyncAt
      }));

    res.json({
      success: true,
      data: userConnections
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/exchanges
 * Add new exchange connection
 */
router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { exchange, name, apiKey, apiSecret, passphrase } = req.body;

    if (!exchange || !apiKey || !apiSecret) {
      return res.status(400).json({
        success: false,
        error: 'exchange, apiKey, and apiSecret are required'
      });
    }

    if (!SUPPORTED_EXCHANGES[exchange as keyof typeof SUPPORTED_EXCHANGES]) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported exchange'
      });
    }

    const exchangeInfo = SUPPORTED_EXCHANGES[exchange as keyof typeof SUPPORTED_EXCHANGES];
    if (exchangeInfo.requiredFields.includes('passphrase') && !passphrase) {
      return res.status(400).json({
        success: false,
        error: `${exchange} requires a passphrase`
      });
    }

    const newConnection: ExchangeConnection = {
      id: `exc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      exchange,
      name: name || exchangeInfo.name,
      status: 'active',
      maskedApiKey: maskApiKey(apiKey),
      encryptedApiKey: simpleEncrypt(apiKey),
      encryptedSecret: simpleEncrypt(apiSecret),
      permissions: ['read', 'trade'],
      createdAt: new Date()
    };

    connections.set(newConnection.id, newConnection);

    res.status(201).json({
      success: true,
      data: {
        id: newConnection.id,
        exchange: newConnection.exchange,
        name: newConnection.name,
        status: newConnection.status,
        maskedApiKey: newConnection.maskedApiKey,
        permissions: newConnection.permissions
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
 * GET /api/exchanges/:id
 * Get single exchange connection
 */
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const connection = connections.get(id);
    if (!connection || connection.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: connection.id,
        exchange: connection.exchange,
        name: connection.name,
        status: connection.status,
        maskedApiKey: connection.maskedApiKey,
        permissions: connection.permissions,
        createdAt: connection.createdAt,
        lastSyncAt: connection.lastSyncAt
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
 * DELETE /api/exchanges/:id
 * Remove exchange connection
 */
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const connection = connections.get(id);
    if (!connection || connection.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    connections.delete(id);

    res.json({
      success: true,
      message: 'Connection deleted'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/exchanges/:id/test
 * Test exchange connection
 */
router.post('/:id/test', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const connection = connections.get(id);
    if (!connection || connection.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    // Simulated test (in production, would make actual API call)
    connection.lastSyncAt = new Date();
    connections.set(id, connection);

    res.json({
      success: true,
      data: {
        valid: true,
        permissions: connection.permissions,
        balance: {
          total: 1000.00,
          available: 950.00
        }
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
 * POST /api/exchanges/:id/activate
 * Activate exchange connection
 */
router.post('/:id/activate', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const connection = connections.get(id);
    if (!connection || connection.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    connection.status = 'active';
    connections.set(id, connection);

    res.json({
      success: true,
      data: { id: connection.id, status: connection.status }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/exchanges/:id/deactivate
 * Deactivate exchange connection
 */
router.post('/:id/deactivate', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const connection = connections.get(id);
    if (!connection || connection.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    connection.status = 'inactive';
    connections.set(id, connection);

    res.json({
      success: true,
      data: { id: connection.id, status: connection.status }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/exchanges/:id/balance
 * Get exchange balance
 */
router.get('/:id/balance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const connection = connections.get(id);
    if (!connection || connection.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    // Simulated balance (in production, would call exchange API)
    res.json({
      success: true,
      data: {
        total: 1000.00,
        available: 950.00,
        inOrders: 50.00,
        assets: [
          { symbol: 'USDT', free: 500, locked: 50 },
          { symbol: 'BTC', free: 0.01, locked: 0 },
          { symbol: 'ETH', free: 0.5, locked: 0 }
        ]
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
