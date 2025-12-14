import { describe, it, expect, beforeEach } from 'vitest';
import { PaperTradingEngine } from './PaperTradingEngine';

describe('PaperTradingEngine', () => {
  let engine: PaperTradingEngine;

  beforeEach(() => {
    engine = new PaperTradingEngine({
      initialBalance: { USDT: 100000 }
    });
  });

  describe('Initialization', () => {
    it('should_initialize_with_default_balance', () => {
      const balances = engine.getBalances();
      expect(balances.USDT.available).toBe(100000);
      expect(balances.USDT.locked).toBe(0);
    });

    it('should_initialize_with_custom_balances', () => {
      const customEngine = new PaperTradingEngine({
        initialBalance: { USDT: 50000, BTC: 1.5, ETH: 10 }
      });

      const balances = customEngine.getBalances();
      expect(balances.USDT.available).toBe(50000);
      expect(balances.BTC.available).toBe(1.5);
      expect(balances.ETH.available).toBe(10);
    });

    it('should_report_as_testnet', () => {
      expect(engine.isTestnet()).toBe(true);
    });
  });

  describe('Market Orders', () => {
    beforeEach(() => {
      // Set mock prices
      engine.setMockPrice('BTC/USDT', 50000);
      engine.setMockPrice('ETH/USDT', 3000);
    });

    it('should_execute_market_buy_order', async () => {
      const order = await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });

      expect(order.id).toBeDefined();
      expect(order.status).toBe('filled');
      expect(order.filledQuantity).toBe(0.1);
      expect(order.averagePrice).toBe(50000);

      // Check balances updated
      const balances = engine.getBalances();
      expect(balances.USDT.available).toBe(95000); // 100000 - (0.1 * 50000)
      expect(balances.BTC.available).toBe(0.1);
    });

    it('should_execute_market_sell_order', async () => {
      // First buy some BTC
      await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.5
      });

      // Then sell
      const order = await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'market',
        quantity: 0.2
      });

      expect(order.status).toBe('filled');

      const balances = engine.getBalances();
      expect(balances.BTC.available).toBe(0.3); // 0.5 - 0.2
      expect(balances.USDT.available).toBe(85000); // 100000 - 25000 + 10000
    });

    it('should_reject_buy_order_with_insufficient_funds', async () => {
      await expect(
        engine.createOrder({
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 10 // 10 * 50000 = 500000 > 100000
        })
      ).rejects.toThrow('Insufficient USDT balance');
    });

    it('should_reject_sell_order_with_insufficient_holdings', async () => {
      await expect(
        engine.createOrder({
          symbol: 'BTC/USDT',
          side: 'sell',
          type: 'market',
          quantity: 1 // Don't have any BTC
        })
      ).rejects.toThrow('Insufficient BTC balance');
    });
  });

  describe('Limit Orders', () => {
    beforeEach(() => {
      engine.setMockPrice('BTC/USDT', 50000);
    });

    it('should_create_pending_limit_buy_order', async () => {
      const order = await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 45000 // Below current price
      });

      expect(order.status).toBe('pending');
      expect(order.price).toBe(45000);

      // USDT should be locked
      const balances = engine.getBalances();
      expect(balances.USDT.available).toBe(95500); // 100000 - 4500 locked
      expect(balances.USDT.locked).toBe(4500);
    });

    it('should_fill_limit_order_when_price_reaches', async () => {
      // Create limit buy order at 45000
      const order = await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 45000
      });

      expect(order.status).toBe('pending');

      // Price drops to 45000
      engine.setMockPrice('BTC/USDT', 45000);
      await engine.processPendingOrders();

      const updatedOrder = engine.getOrder(order.id);
      expect(updatedOrder?.status).toBe('filled');

      const balances = engine.getBalances();
      expect(balances.USDT.locked).toBe(0);
      expect(balances.BTC.available).toBe(0.1);
    });

    it('should_create_pending_limit_sell_order', async () => {
      // First buy some BTC
      await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.5
      });

      // Create limit sell at higher price
      const order = await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'limit',
        quantity: 0.2,
        price: 55000
      });

      expect(order.status).toBe('pending');

      const balances = engine.getBalances();
      expect(balances.BTC.available).toBe(0.3); // 0.5 - 0.2 locked
      expect(balances.BTC.locked).toBe(0.2);
    });
  });

  describe('Order Management', () => {
    it('should_cancel_pending_order', async () => {
      engine.setMockPrice('BTC/USDT', 50000);

      const order = await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 45000
      });

      const cancelled = await engine.cancelOrder(order.id);
      expect(cancelled.status).toBe('cancelled');

      // Funds should be released
      const balances = engine.getBalances();
      expect(balances.USDT.available).toBe(100000);
      expect(balances.USDT.locked).toBe(0);
    });

    it('should_not_cancel_filled_order', async () => {
      engine.setMockPrice('BTC/USDT', 50000);

      const order = await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });

      await expect(
        engine.cancelOrder(order.id)
      ).rejects.toThrow('Cannot cancel filled order');
    });

    it('should_get_order_history', async () => {
      engine.setMockPrice('BTC/USDT', 50000);

      await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });

      await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.05
      });

      const orders = engine.getOrders();
      expect(orders.length).toBe(2);
    });

    it('should_get_open_orders', async () => {
      engine.setMockPrice('BTC/USDT', 50000);

      // Market order (filled immediately)
      await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });

      // Limit order (pending)
      await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 45000
      });

      const openOrders = engine.getOpenOrders();
      expect(openOrders.length).toBe(1);
      expect(openOrders[0].status).toBe('pending');
    });
  });

  describe('Position Tracking', () => {
    it('should_track_positions', async () => {
      engine.setMockPrice('BTC/USDT', 50000);
      engine.setMockPrice('ETH/USDT', 3000);

      await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.5
      });

      await engine.createOrder({
        symbol: 'ETH/USDT',
        side: 'buy',
        type: 'market',
        quantity: 2
      });

      const positions = engine.getPositions();
      expect(positions.BTC.quantity).toBe(0.5);
      expect(positions.BTC.averageEntryPrice).toBe(50000);
      expect(positions.ETH.quantity).toBe(2);
      expect(positions.ETH.averageEntryPrice).toBe(3000);
    });

    it('should_calculate_unrealized_pnl', async () => {
      engine.setMockPrice('BTC/USDT', 50000);

      await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 1
      });

      // Price goes up
      engine.setMockPrice('BTC/USDT', 55000);

      const positions = engine.getPositions();
      expect(positions.BTC.unrealizedPnl).toBe(5000); // (55000 - 50000) * 1
    });

    it('should_calculate_portfolio_value', async () => {
      engine.setMockPrice('BTC/USDT', 50000);

      await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 1
      });

      // USDT: 50000, BTC: 1 * 50000 = 50000
      const totalValue = engine.getPortfolioValue();
      expect(totalValue).toBe(100000);

      // Price goes up
      engine.setMockPrice('BTC/USDT', 60000);
      const newValue = engine.getPortfolioValue();
      expect(newValue).toBe(110000); // 50000 USDT + 60000 BTC
    });
  });

  describe('Trade History', () => {
    it('should_record_trades', async () => {
      engine.setMockPrice('BTC/USDT', 50000);

      await engine.createOrder({
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1
      });

      const trades = engine.getTrades();
      expect(trades.length).toBe(1);
      expect(trades[0].symbol).toBe('BTC/USDT');
      expect(trades[0].side).toBe('buy');
      expect(trades[0].quantity).toBe(0.1);
      expect(trades[0].price).toBe(50000);
      expect(trades[0].timestamp).toBeDefined();
    });
  });
});
