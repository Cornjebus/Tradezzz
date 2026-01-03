/**
 * Public Market Routes - Anonymous Market Data API
 *
 * Phase 1: Anonymous Explore Mode
 *
 * These endpoints provide market data WITHOUT requiring authentication,
 * enabling anonymous users to explore prices, charts, and order books
 * before signing up.
 *
 * Endpoints:
 * - GET /api/public/prices - All live prices with 5s cache
 * - GET /api/public/ticker/:symbol - Single symbol ticker
 * - GET /api/public/orderbook/:symbol - Order book depth
 * - GET /api/public/candles/:symbol - OHLCV candlestick data
 * - GET /api/public/symbols - Available trading symbols
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { CoinbaseAdapter } from '../../exchanges/adapters/CoinbaseAdapter';

// Types for public market data
export interface PublicPrice {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export interface PublicSymbol {
  symbol: string;
  base: string;
  quote: string;
}

// Valid timeframes for OHLCV data
const VALID_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '2h', '6h', '1d'];

// Symbol format validation regex
const SYMBOL_REGEX = /^[A-Z0-9]+-[A-Z0-9]+$/;

// Cache configuration
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const PRICE_CACHE_TTL_MS = 5000; // 5 seconds
const SYMBOL_CACHE_TTL_MS = 60000; // 60 seconds

// Simple in-memory cache
const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string, ttlMs: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttlMs) {
    return entry.data as T;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Create Public Market Router
 *
 * @param adapter - Exchange adapter for fetching market data (defaults to Coinbase)
 */
export function createPublicMarketRouter(
  adapter?: CoinbaseAdapter
): Router {
  const router = Router();
  const exchangeAdapter = adapter || new CoinbaseAdapter();

  // Default symbols to fetch for main prices endpoint
  const PRIMARY_SYMBOLS = [
    'BTC/USD', 'ETH/USD', 'SOL/USD', 'DOGE/USD',
    'XRP/USD', 'ADA/USD', 'AVAX/USD', 'MATIC/USD',
  ];

  // ==========================================================================
  // GET /prices - All Live Prices
  // ==========================================================================

  router.get(
    '/prices',
    asyncHandler(async (req: Request, res: Response) => {
      const cacheKey = 'prices:all';
      const cachedPrices = getCached<{ prices: PublicPrice[]; timestamp: number }>(
        cacheKey,
        PRICE_CACHE_TTL_MS
      );

      if (cachedPrices) {
        res.json({
          success: true,
          ...cachedPrices,
        });
        return;
      }

      try {
        // Create context without auth (public endpoint)
        const ctx = {
          connectionId: 'public',
          userId: 'anonymous',
          exchange: 'coinbase',
        };

        // Fetch tickers for primary symbols
        const tickerPromises = PRIMARY_SYMBOLS.map(async (symbol) => {
          try {
            const ticker = await exchangeAdapter.getTicker(ctx, symbol);

            // Calculate 24h change (using high/low as approximation)
            const midPoint = (ticker.high + ticker.low) / 2;
            const change24h = ticker.last - midPoint;
            const changePercent24h = midPoint > 0 ? (change24h / midPoint) * 100 : 0;

            return {
              symbol,
              price: ticker.last,
              bid: ticker.bid,
              ask: ticker.ask,
              change24h: parseFloat(change24h.toFixed(2)),
              changePercent24h: parseFloat(changePercent24h.toFixed(2)),
              high24h: ticker.high,
              low24h: ticker.low,
              volume24h: ticker.volume,
            } as PublicPrice;
          } catch {
            return null;
          }
        });

        const results = await Promise.all(tickerPromises);
        const prices = results.filter((p): p is PublicPrice => p !== null);

        if (prices.length === 0) {
          throw new Error('Unable to fetch prices');
        }

        const timestamp = Date.now();
        const responseData = { prices, timestamp };

        setCache(cacheKey, responseData);

        res.json({
          success: true,
          ...responseData,
        });
      } catch (error: any) {
        res.status(503).json({
          success: false,
          error: 'Market data temporarily unavailable',
          details: error.message,
        });
      }
    })
  );

  // ==========================================================================
  // GET /ticker/:symbol - Single Symbol Ticker
  // ==========================================================================

  router.get(
    '/ticker/:symbol',
    asyncHandler(async (req: Request, res: Response) => {
      const { symbol: rawSymbol } = req.params;

      // Validate symbol format
      if (!SYMBOL_REGEX.test(rawSymbol)) {
        res.status(400).json({
          success: false,
          error: 'Invalid symbol format. Use format: BTC-USD',
        });
        return;
      }

      // Convert BTC-USD to BTC/USD
      const symbol = rawSymbol.replace('-', '/');

      try {
        const ctx = {
          connectionId: 'public',
          userId: 'anonymous',
          exchange: 'coinbase',
        };

        const ticker = await exchangeAdapter.getTicker(ctx, symbol);

        // Calculate 24h change
        const midPoint = (ticker.high + ticker.low) / 2;
        const change24h = ticker.last - midPoint;
        const changePercent24h = midPoint > 0 ? (change24h / midPoint) * 100 : 0;

        res.json({
          success: true,
          symbol,
          price: ticker.last,
          bid: ticker.bid,
          ask: ticker.ask,
          high24h: ticker.high,
          low24h: ticker.low,
          volume24h: ticker.volume,
          change24h: parseFloat(change24h.toFixed(2)),
          changePercent24h: parseFloat(changePercent24h.toFixed(2)),
          timestamp: ticker.timestamp,
        });
      } catch (error: any) {
        if (error.message.includes('not found') || error.message.includes('404')) {
          res.status(404).json({
            success: false,
            error: `Symbol ${symbol} not found`,
          });
        } else {
          res.status(503).json({
            success: false,
            error: 'Market data temporarily unavailable',
          });
        }
      }
    })
  );

  // ==========================================================================
  // GET /orderbook/:symbol - Order Book
  // ==========================================================================

  router.get(
    '/orderbook/:symbol',
    asyncHandler(async (req: Request, res: Response) => {
      const { symbol: rawSymbol } = req.params;

      // Validate symbol format
      if (!SYMBOL_REGEX.test(rawSymbol)) {
        res.status(400).json({
          success: false,
          error: 'Invalid symbol format. Use format: BTC-USD',
        });
        return;
      }

      const symbol = rawSymbol.replace('-', '/');

      try {
        const ctx = {
          connectionId: 'public',
          userId: 'anonymous',
          exchange: 'coinbase',
        };

        const orderBook = await exchangeAdapter.getOrderBook(ctx, symbol);

        res.json({
          success: true,
          symbol,
          bids: orderBook.bids,
          asks: orderBook.asks,
          timestamp: orderBook.timestamp,
        });
      } catch (error: any) {
        if (error.message.includes('not found') || error.message.includes('404')) {
          res.status(404).json({
            success: false,
            error: `Symbol ${symbol} not found`,
          });
        } else {
          res.status(503).json({
            success: false,
            error: 'Order book data temporarily unavailable',
          });
        }
      }
    })
  );

  // ==========================================================================
  // GET /candles/:symbol - OHLCV Candlestick Data
  // ==========================================================================

  router.get(
    '/candles/:symbol',
    asyncHandler(async (req: Request, res: Response) => {
      const { symbol: rawSymbol } = req.params;
      const { timeframe = '1h', limit: limitStr = '100' } = req.query;

      // Validate symbol format
      if (!SYMBOL_REGEX.test(rawSymbol)) {
        res.status(400).json({
          success: false,
          error: 'Invalid symbol format. Use format: BTC-USD',
        });
        return;
      }

      // Validate timeframe
      if (!VALID_TIMEFRAMES.includes(timeframe as string)) {
        res.status(400).json({
          success: false,
          error: `Invalid timeframe. Valid values: ${VALID_TIMEFRAMES.join(', ')}`,
        });
        return;
      }

      // Parse and cap limit
      let limit = parseInt(limitStr as string, 10);
      if (isNaN(limit) || limit < 1) {
        limit = 100;
      }
      limit = Math.min(limit, 1000); // Cap at 1000

      const symbol = rawSymbol.replace('-', '/');

      try {
        const ctx = {
          connectionId: 'public',
          userId: 'anonymous',
          exchange: 'coinbase',
        };

        const candles = await exchangeAdapter.getOHLCV(
          ctx,
          symbol,
          timeframe as string,
          limit
        );

        res.json({
          success: true,
          symbol,
          timeframe,
          candles: candles.map((c) => ({
            timestamp: c.timestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          })),
        });
      } catch (error: any) {
        if (error.message.includes('not found') || error.message.includes('404')) {
          res.status(404).json({
            success: false,
            error: `Symbol ${symbol} not found`,
          });
        } else {
          res.status(503).json({
            success: false,
            error: 'Candle data temporarily unavailable',
          });
        }
      }
    })
  );

  // ==========================================================================
  // GET /symbols - Available Trading Symbols
  // ==========================================================================

  router.get(
    '/symbols',
    asyncHandler(async (req: Request, res: Response) => {
      const cacheKey = 'symbols:all';
      const cachedSymbols = getCached<PublicSymbol[]>(cacheKey, SYMBOL_CACHE_TTL_MS);

      if (cachedSymbols) {
        res.json({
          success: true,
          symbols: cachedSymbols,
          count: cachedSymbols.length,
        });
        return;
      }

      try {
        const ctx = {
          connectionId: 'public',
          userId: 'anonymous',
          exchange: 'coinbase',
        };

        const symbolList = await exchangeAdapter.getSymbols(ctx);

        const symbols: PublicSymbol[] = symbolList.map((s) => {
          const [base, quote] = s.split('/');
          return { symbol: s, base, quote };
        });

        setCache(cacheKey, symbols);

        res.json({
          success: true,
          symbols,
          count: symbols.length,
        });
      } catch (error: any) {
        res.status(503).json({
          success: false,
          error: 'Symbol data temporarily unavailable',
        });
      }
    })
  );

  return router;
}
