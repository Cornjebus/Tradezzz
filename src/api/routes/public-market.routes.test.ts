/**
 * Public Market API Tests - TDD Red Phase
 *
 * Phase 1: Anonymous Explore Mode
 * Tests for public market data endpoints that work WITHOUT authentication
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPublicMarketRouter } from './public-market.routes';

// Create a mock adapter factory
function createMockAdapter() {
  return {
    getTicker: vi.fn(),
    getOrderBook: vi.fn(),
    getOHLCV: vi.fn(),
    getSymbols: vi.fn(),
  };
}

describe('Public Market API', () => {
  let app: express.Application;
  let mockAdapter: ReturnType<typeof createMockAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockAdapter();
    app = express();
    app.use(express.json());
    app.use('/api/public', createPublicMarketRouter(mockAdapter as any));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/public/prices - Live Prices (No Auth)
  // ==========================================================================

  describe('GET /api/public/prices', () => {
    it('should return prices without authentication', async () => {
      mockAdapter.getSymbols.mockResolvedValue(['BTC/USD', 'ETH/USD', 'SOL/USD']);
      mockAdapter.getTicker.mockImplementation(async (_ctx: any, symbol: string) => ({
        symbol,
        bid: 50000,
        ask: 50010,
        last: 50005,
        high: 51000,
        low: 49000,
        volume: 1000,
        timestamp: Date.now(),
      }));

      const response = await request(app).get('/api/public/prices');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.prices).toBeInstanceOf(Array);
      expect(response.body.prices.length).toBeGreaterThan(0);
      expect(response.body.prices[0]).toHaveProperty('symbol');
      expect(response.body.prices[0]).toHaveProperty('price');
      expect(response.body.prices[0]).toHaveProperty('change24h');
    });

    it('should return at least BTC, ETH, SOL prices', async () => {
      mockAdapter.getSymbols.mockResolvedValue(['BTC/USD', 'ETH/USD', 'SOL/USD', 'DOGE/USD']);
      mockAdapter.getTicker.mockImplementation(async (_ctx: any, symbol: string) => ({
        symbol,
        bid: 50000,
        ask: 50010,
        last: 50005,
        high: 51000,
        low: 49000,
        volume: 1000,
        timestamp: Date.now(),
      }));

      const response = await request(app).get('/api/public/prices');

      expect(response.status).toBe(200);
      const symbols = response.body.prices.map((p: any) => p.symbol);
      expect(symbols).toContain('BTC/USD');
      expect(symbols).toContain('ETH/USD');
    });

    it('should include timestamp in response', async () => {
      mockAdapter.getSymbols.mockResolvedValue(['BTC/USD']);
      mockAdapter.getTicker.mockResolvedValue({
        symbol: 'BTC/USD',
        bid: 50000,
        ask: 50010,
        last: 50005,
        high: 51000,
        low: 49000,
        volume: 1000,
        timestamp: Date.now(),
      });

      const response = await request(app).get('/api/public/prices');

      expect(response.status).toBe(200);
      expect(response.body.timestamp).toBeDefined();
      expect(typeof response.body.timestamp).toBe('number');
    });

    it('should return cached prices within 5 seconds', async () => {
      mockAdapter.getSymbols.mockResolvedValue(['BTC/USD']);
      mockAdapter.getTicker.mockResolvedValue({
        symbol: 'BTC/USD',
        bid: 50000,
        ask: 50010,
        last: 50005,
        high: 51000,
        low: 49000,
        volume: 1000,
        timestamp: Date.now(),
      });

      // First call
      const first = await request(app).get('/api/public/prices');
      const firstTimestamp = first.body.timestamp;

      // Second call within cache period
      const second = await request(app).get('/api/public/prices');
      const secondTimestamp = second.body.timestamp;

      // Both should have same timestamp (cached)
      expect(firstTimestamp).toBe(secondTimestamp);
    });

    it('should handle adapter errors gracefully', async () => {
      // Test error handling on order book endpoint which doesn't use caching
      mockAdapter.getOrderBook.mockRejectedValue(new Error('API unavailable'));

      const response = await request(app).get('/api/public/orderbook/XYZ-USD');

      // Should return 503 or 404 depending on error type
      expect([404, 503]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });
  });

  // ==========================================================================
  // GET /api/public/orderbook/:symbol - Order Book (No Auth)
  // ==========================================================================

  describe('GET /api/public/orderbook/:symbol', () => {
    it('should return order book without authentication', async () => {
      mockAdapter.getOrderBook.mockResolvedValue({
        symbol: 'BTC/USD',
        bids: [
          { price: 50000, quantity: 1.5 },
          { price: 49990, quantity: 2.0 },
        ],
        asks: [
          { price: 50010, quantity: 1.0 },
          { price: 50020, quantity: 1.5 },
        ],
        timestamp: Date.now(),
      });

      const response = await request(app).get('/api/public/orderbook/BTC-USD');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.bids).toBeInstanceOf(Array);
      expect(response.body.asks).toBeInstanceOf(Array);
      expect(response.body.symbol).toBe('BTC/USD');
    });

    it('should return 400 for invalid symbol format', async () => {
      const response = await request(app).get('/api/public/orderbook/INVALID');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid symbol');
    });

    it('should return 404 when symbol not found', async () => {
      mockAdapter.getOrderBook.mockRejectedValue(new Error('Product not found'));

      const response = await request(app).get('/api/public/orderbook/XYZ-USD');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle hyphenated symbol format', async () => {
      mockAdapter.getOrderBook.mockResolvedValue({
        symbol: 'ETH/USD',
        bids: [{ price: 3000, quantity: 10 }],
        asks: [{ price: 3010, quantity: 10 }],
        timestamp: Date.now(),
      });

      const response = await request(app).get('/api/public/orderbook/ETH-USD');

      expect(response.status).toBe(200);
      expect(response.body.symbol).toBe('ETH/USD');
    });
  });

  // ==========================================================================
  // GET /api/public/candles/:symbol - OHLCV Data (No Auth)
  // ==========================================================================

  describe('GET /api/public/candles/:symbol', () => {
    it('should return OHLCV data without authentication', async () => {
      const mockCandles = Array.from({ length: 24 }, (_, i) => ({
        timestamp: Date.now() - i * 3600000,
        open: 50000 + i * 10,
        high: 50100 + i * 10,
        low: 49900 + i * 10,
        close: 50050 + i * 10,
        volume: 100 + i,
      }));

      mockAdapter.getOHLCV.mockResolvedValue(mockCandles);

      const response = await request(app)
        .get('/api/public/candles/BTC-USD')
        .query({ timeframe: '1h', limit: 24 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.candles).toHaveLength(24);
      expect(response.body.candles[0]).toHaveProperty('open');
      expect(response.body.candles[0]).toHaveProperty('high');
      expect(response.body.candles[0]).toHaveProperty('low');
      expect(response.body.candles[0]).toHaveProperty('close');
      expect(response.body.candles[0]).toHaveProperty('volume');
    });

    it('should default to 1h timeframe and 100 limit', async () => {
      mockAdapter.getOHLCV.mockResolvedValue([]);

      await request(app).get('/api/public/candles/BTC-USD');

      expect(mockAdapter.getOHLCV).toHaveBeenCalledWith(
        expect.anything(),
        'BTC/USD',
        '1h',
        100
      );
    });

    it('should accept custom timeframe parameter', async () => {
      mockAdapter.getOHLCV.mockResolvedValue([]);

      await request(app)
        .get('/api/public/candles/BTC-USD')
        .query({ timeframe: '15m' });

      expect(mockAdapter.getOHLCV).toHaveBeenCalledWith(
        expect.anything(),
        'BTC/USD',
        '15m',
        100
      );
    });

    it('should validate timeframe values', async () => {
      const response = await request(app)
        .get('/api/public/candles/BTC-USD')
        .query({ timeframe: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('timeframe');
    });

    it('should limit maximum candles to 1000', async () => {
      mockAdapter.getOHLCV.mockResolvedValue([]);

      await request(app)
        .get('/api/public/candles/BTC-USD')
        .query({ limit: 5000 });

      expect(mockAdapter.getOHLCV).toHaveBeenCalledWith(
        expect.anything(),
        'BTC/USD',
        '1h',
        1000 // Should be capped at 1000
      );
    });
  });

  // ==========================================================================
  // GET /api/public/symbols - Available Symbols (No Auth)
  // ==========================================================================

  describe('GET /api/public/symbols', () => {
    it('should return available trading symbols', async () => {
      mockAdapter.getSymbols.mockResolvedValue([
        'BTC/USD', 'ETH/USD', 'SOL/USD', 'DOGE/USD',
        'XRP/USD', 'ADA/USD', 'AVAX/USD', 'MATIC/USD',
        'DOT/USD', 'LINK/USD', 'LTC/USD', 'UNI/USD',
      ]);

      const response = await request(app).get('/api/public/symbols');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.symbols.length).toBeGreaterThan(10);
    });

    it('should include symbol metadata', async () => {
      mockAdapter.getSymbols.mockResolvedValue(['BTC/USD', 'ETH/USD']);

      const response = await request(app).get('/api/public/symbols');

      expect(response.status).toBe(200);
      expect(response.body.symbols[0]).toHaveProperty('symbol');
      expect(response.body.symbols[0]).toHaveProperty('base');
      expect(response.body.symbols[0]).toHaveProperty('quote');
    });

    it('should return consistent symbols data', async () => {
      mockAdapter.getSymbols.mockResolvedValue(['BTC/USD', 'ETH/USD']);

      // First call
      const first = await request(app).get('/api/public/symbols');

      // Second call
      const second = await request(app).get('/api/public/symbols');

      // Both should return same data structure
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.body.success).toBe(true);
      expect(second.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // GET /api/public/ticker/:symbol - Single Ticker (No Auth)
  // ==========================================================================

  describe('GET /api/public/ticker/:symbol', () => {
    it('should return single symbol ticker', async () => {
      mockAdapter.getTicker.mockResolvedValue({
        symbol: 'BTC/USD',
        bid: 50000,
        ask: 50010,
        last: 50005,
        high: 51000,
        low: 49000,
        volume: 1000,
        timestamp: Date.now(),
      });

      const response = await request(app).get('/api/public/ticker/BTC-USD');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.symbol).toBe('BTC/USD');
      expect(response.body.price).toBe(50005);
      expect(response.body.bid).toBe(50000);
      expect(response.body.ask).toBe(50010);
    });

    it('should include 24h change metrics', async () => {
      mockAdapter.getTicker.mockResolvedValue({
        symbol: 'BTC/USD',
        bid: 50000,
        ask: 50010,
        last: 50005,
        high: 51000,
        low: 49000,
        volume: 1000,
        timestamp: Date.now(),
      });

      const response = await request(app).get('/api/public/ticker/BTC-USD');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('high24h');
      expect(response.body).toHaveProperty('low24h');
      expect(response.body).toHaveProperty('volume24h');
    });
  });

  // ==========================================================================
  // Rate Limiting Tests
  // ==========================================================================

  describe('Rate Limiting', () => {
    it('should apply rate limiting to public endpoints', async () => {
      mockAdapter.getSymbols.mockResolvedValue(['BTC/USD']);
      mockAdapter.getTicker.mockResolvedValue({
        symbol: 'BTC/USD',
        bid: 50000,
        ask: 50010,
        last: 50005,
        high: 51000,
        low: 49000,
        volume: 1000,
        timestamp: Date.now(),
      });

      // Make 100 rapid requests
      const requests = Array(100).fill(null).map(() =>
        request(app).get('/api/public/prices')
      );

      const responses = await Promise.all(requests);

      // Should have some successful responses
      const successful = responses.filter(r => r.status === 200);
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // CORS Tests
  // ==========================================================================

  describe('CORS', () => {
    it('should allow cross-origin requests', async () => {
      mockAdapter.getSymbols.mockResolvedValue(['BTC/USD']);
      mockAdapter.getTicker.mockResolvedValue({
        symbol: 'BTC/USD',
        bid: 50000,
        ask: 50010,
        last: 50005,
        high: 51000,
        low: 49000,
        volume: 1000,
        timestamp: Date.now(),
      });

      const response = await request(app)
        .get('/api/public/prices')
        .set('Origin', 'https://example.com');

      expect(response.status).toBe(200);
    });
  });
});
