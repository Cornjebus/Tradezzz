/**
 * Exchange Routes - Exchange Connection API Endpoints
 * Handles exchange connections, market data, and account management
 */

import { Router, Request, Response } from 'express';
import { ExchangeService, ExchangeType } from '../../exchanges/ExchangeService';
import { AuthService } from '../../users/AuthService';
import { createAuthMiddleware } from '../middleware/auth.middleware';
import { asyncHandler, NotFoundError } from '../middleware/error.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const createConnectionSchema = z.object({
  exchange: z.enum(['binance', 'coinbase', 'kraken', 'kucoin', 'bybit', 'okx', 'gate'], {
    message: 'Invalid exchange type',
  }),
  name: z.string().min(1, 'Name is required').max(100),
  apiKey: z.string().min(1, 'API key is required'),
  apiSecret: z.string().min(1, 'API secret is required'),
  passphrase: z.string().optional(),
});

const updateConnectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

const rotateCredentialsSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  apiSecret: z.string().min(1, 'API secret is required'),
  passphrase: z.string().optional(),
});

// ============================================================================
// Router Factory
// ============================================================================

export function createExchangeRouter(
  exchangeService: ExchangeService,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // ============================================================================
  // GET /supported - Get Supported Exchanges
  // ============================================================================

  router.get(
    '/supported',
    asyncHandler(async (req: Request, res: Response) => {
      const exchanges = exchangeService.getSupportedExchanges();
      const exchangeInfo = exchanges.map(ex => exchangeService.getExchangeInfo(ex));

      res.json({
        success: true,
        data: exchangeInfo,
      });
    })
  );

  // ============================================================================
  // GET /info/:exchange - Get Exchange Info
  // ============================================================================

  router.get(
    '/info/:exchange',
    asyncHandler(async (req: Request, res: Response) => {
      const { exchange } = req.params;
      const supported = exchangeService.getSupportedExchanges();

      if (!supported.includes(exchange as ExchangeType)) {
        res.status(400).json({
          success: false,
          error: 'Unsupported exchange',
        });
        return;
      }

      const info = exchangeService.getExchangeInfo(exchange as ExchangeType);

      res.json({
        success: true,
        data: info,
      });
    })
  );

  // ============================================================================
  // POST /connections - Create Connection
  // ============================================================================

  router.post(
    '/connections',
    requireAuth,
    validate(createConnectionSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { exchange, name, apiKey, apiSecret, passphrase } = req.body;

      const connection = await exchangeService.createConnection({
        userId,
        exchange,
        name,
        apiKey,
        apiSecret,
        passphrase,
      });

      res.status(201).json({
        success: true,
        data: connection,
      });
    })
  );

  // ============================================================================
  // GET /connections - List User Connections
  // ============================================================================

  router.get(
    '/connections',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;

      const connections = await exchangeService.getUserConnections(userId);

      res.json({
        success: true,
        data: connections,
      });
    })
  );

  // ============================================================================
  // GET /connections/:id - Get Single Connection
  // ============================================================================

  router.get(
    '/connections/:id',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const connection = await exchangeService.getConnection(id);
      if (!connection) {
        throw new NotFoundError('Connection not found');
      }

      if (connection.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: connection,
      });
    })
  );

  // ============================================================================
  // PUT /connections/:id - Update Connection
  // ============================================================================

  router.put(
    '/connections/:id',
    requireAuth,
    validate(updateConnectionSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;
      const { name } = req.body;

      const updated = await exchangeService.updateConnection(id, userId, { name });

      res.json({
        success: true,
        data: updated,
      });
    })
  );

  // ============================================================================
  // DELETE /connections/:id - Delete Connection
  // ============================================================================

  router.delete(
    '/connections/:id',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      await exchangeService.deleteConnection(id, userId);

      res.json({
        success: true,
        message: 'Connection deleted',
      });
    })
  );

  // ============================================================================
  // POST /connections/:id/test - Test Connection
  // ============================================================================

  router.post(
    '/connections/:id/test',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const connection = await exchangeService.getConnection(id);
      if (!connection) {
        throw new NotFoundError('Connection not found');
      }

      if (connection.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const result = await exchangeService.testConnection(id);

      res.json({
        success: true,
        data: result,
      });
    })
  );

  // ============================================================================
  // POST /connections/:id/rotate - Rotate Credentials
  // ============================================================================

  router.post(
    '/connections/:id/rotate',
    requireAuth,
    validate(rotateCredentialsSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;
      const { apiKey, apiSecret, passphrase } = req.body;

      await exchangeService.rotateCredentials(id, userId, {
        apiKey,
        apiSecret,
        passphrase,
      });

      res.json({
        success: true,
        message: 'Credentials rotated successfully',
      });
    })
  );

  // ============================================================================
  // POST /connections/:id/deactivate - Deactivate Connection
  // ============================================================================

  router.post(
    '/connections/:id/deactivate',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const connection = await exchangeService.deactivateConnection(id, userId);

      res.json({
        success: true,
        data: connection,
      });
    })
  );

  // ============================================================================
  // POST /connections/:id/activate - Activate Connection
  // ============================================================================

  router.post(
    '/connections/:id/activate',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const connection = await exchangeService.activateConnection(id, userId);

      res.json({
        success: true,
        data: connection,
      });
    })
  );

  // ============================================================================
  // GET /connections/:id/ticker/:symbol - Get Ticker
  // ============================================================================

  router.get(
    '/connections/:id/ticker/:symbol',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id, symbol } = req.params;

      const connection = await exchangeService.getConnection(id);
      if (!connection) {
        throw new NotFoundError('Connection not found');
      }

      if (connection.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      // Decode symbol (BTC-USDT -> BTC/USDT)
      const decodedSymbol = symbol.replace('-', '/');
      const ticker = await exchangeService.getTicker(id, decodedSymbol);

      res.json({
        success: true,
        data: ticker,
      });
    })
  );

  // ============================================================================
  // GET /connections/:id/orderbook/:symbol - Get Order Book
  // ============================================================================

  router.get(
    '/connections/:id/orderbook/:symbol',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id, symbol } = req.params;

      const connection = await exchangeService.getConnection(id);
      if (!connection) {
        throw new NotFoundError('Connection not found');
      }

      if (connection.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const decodedSymbol = symbol.replace('-', '/');
      const orderBook = await exchangeService.getOrderBook(id, decodedSymbol);

      res.json({
        success: true,
        data: orderBook,
      });
    })
  );

  // ============================================================================
  // GET /connections/:id/ohlcv/:symbol - Get OHLCV Data
  // ============================================================================

  router.get(
    '/connections/:id/ohlcv/:symbol',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id, symbol } = req.params;
      const { timeframe = '1h', limit = '100' } = req.query;

      const connection = await exchangeService.getConnection(id);
      if (!connection) {
        throw new NotFoundError('Connection not found');
      }

      if (connection.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const decodedSymbol = symbol.replace('-', '/');
      const candles = await exchangeService.getOHLCV(
        id,
        decodedSymbol,
        timeframe as string,
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: candles,
      });
    })
  );

  // ============================================================================
  // GET /connections/:id/symbols - Get Available Symbols
  // ============================================================================

  router.get(
    '/connections/:id/symbols',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const connection = await exchangeService.getConnection(id);
      if (!connection) {
        throw new NotFoundError('Connection not found');
      }

      if (connection.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const symbols = await exchangeService.getSymbols(id);

      res.json({
        success: true,
        data: symbols,
      });
    })
  );

  // ============================================================================
  // GET /connections/:id/balance - Get Account Balance
  // ============================================================================

  router.get(
    '/connections/:id/balance',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const connection = await exchangeService.getConnection(id);
      if (!connection) {
        throw new NotFoundError('Connection not found');
      }

      if (connection.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const balance = await exchangeService.getBalance(id);

      res.json({
        success: true,
        data: balance,
      });
    })
  );

  // ============================================================================
  // GET /connections/:id/fees - Get Trading Fees
  // ============================================================================

  router.get(
    '/connections/:id/fees',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const connection = await exchangeService.getConnection(id);
      if (!connection) {
        throw new NotFoundError('Connection not found');
      }

      if (connection.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const fees = await exchangeService.getTradingFees(id);

      res.json({
        success: true,
        data: fees,
      });
    })
  );

  // ============================================================================
  // GET /connections/:id/stats - Get Connection Stats
  // ============================================================================

  router.get(
    '/connections/:id/stats',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const connection = await exchangeService.getConnection(id);
      if (!connection) {
        throw new NotFoundError('Connection not found');
      }

      if (connection.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const stats = await exchangeService.getConnectionStats(id);

      res.json({
        success: true,
        data: stats,
      });
    })
  );

  return router;
}
