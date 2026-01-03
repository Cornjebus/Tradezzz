/**
 * OrderService Tests - TDD Red Phase
 * Tests for order execution, position management, and risk checks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderService, Order, OrderType, OrderSide, OrderStatus, Position } from './OrderService';
import { StrategyService } from '../strategies/StrategyService';
import { ConfigService } from '../config/ConfigService';
import { MockDatabase, createMockDatabase } from '../../tests/helpers/mock-db';

describe('OrderService', () => {
  let orderService: OrderService;
  let strategyService: StrategyService;
  let configService: ConfigService;
  let db: MockDatabase;
  let userId: string;
  let strategyId: string;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'test');
    db = createMockDatabase();
    configService = new ConfigService({ db });
    strategyService = new StrategyService({ db, configService });

    // Create test user
    const user = await db.users.create({
      email: 'trader@example.com',
      passwordHash: 'hashed',
      tier: 'pro',
    });
    userId = user.id;

    // Create test strategy
    const strategy = await strategyService.createStrategy({
      userId,
      name: 'Test Strategy',
      type: 'momentum',
      config: { symbols: ['BTC/USDT'] },
    });
    strategyId = strategy.id;

    orderService = new OrderService({ db, configService, strategyService });
  });

  // ============================================================================
  // Order Creation
  // ============================================================================

  describe('Order Creation', () => {
    it('should_create_market_buy_order', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });

      expect(order.id).toBeDefined();
      expect(order.symbol).toBe('BTC/USDT');
      expect(order.side).toBe('buy');
      expect(order.type).toBe('market');
      expect(order.quantity).toBe(0.1);
      expect(order.status).toBe('pending');
      expect(order.mode).toBe('paper');
    });

    it('should_create_limit_order_with_price', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.5,
        price: 45000,
        mode: 'paper',
      });

      expect(order.type).toBe('limit');
      expect(order.price).toBe(45000);
    });

    it('should_create_stop_loss_order', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'ETH/USDT',
        side: 'sell',
        type: 'stop_loss',
        quantity: 1.0,
        stopPrice: 2800,
        mode: 'paper',
      });

      expect(order.type).toBe('stop_loss');
      expect(order.stopPrice).toBe(2800);
    });

    it('should_create_take_profit_order', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'ETH/USDT',
        side: 'sell',
        type: 'take_profit',
        quantity: 1.0,
        stopPrice: 3500,
        mode: 'paper',
      });

      expect(order.type).toBe('take_profit');
      expect(order.stopPrice).toBe(3500);
    });

    it('should_reject_limit_order_without_price', async () => {
      await expect(
        orderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'limit',
          quantity: 0.1,
          mode: 'paper',
        })
      ).rejects.toThrow('Limit orders require a price');
    });

    it('should_reject_stop_order_without_stop_price', async () => {
      await expect(
        orderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'sell',
          type: 'stop_loss',
          quantity: 0.1,
          mode: 'paper',
        })
      ).rejects.toThrow('Stop orders require a stop price');
    });

    it('should_reject_negative_quantity', async () => {
      await expect(
        orderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: -0.1,
          mode: 'paper',
        })
      ).rejects.toThrow('Quantity must be positive');
    });

    it('should_reject_zero_quantity', async () => {
      await expect(
        orderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0,
          mode: 'paper',
        })
      ).rejects.toThrow('Quantity must be positive');
    });
  });

  // ============================================================================
  // Paper Trading Execution
  // ============================================================================

  describe('Paper Trading Execution', () => {
    it('should_execute_paper_market_order_immediately', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });

      // No slippage for exact price match
      const executed = await orderService.executePaperOrder(order.id, 50000, { slippage: 0 });

      expect(executed.status).toBe('filled');
      expect(executed.filledPrice).toBe(50000);
      expect(executed.filledAt).toBeDefined();
    });

    it('should_apply_slippage_to_paper_orders', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });

      const executed = await orderService.executePaperOrder(order.id, 50000, { slippage: 0.1 });

      // Buy order should fill at slightly higher price due to slippage
      expect(executed.filledPrice).toBeGreaterThan(50000);
      expect(executed.filledPrice).toBeLessThanOrEqual(50050);
    });

    it('should_fill_limit_order_when_price_reached', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 48000,
        mode: 'paper',
      });

      // Price above limit - should not fill
      const notFilled = await orderService.checkLimitOrder(order.id, 49000);
      expect(notFilled.status).toBe('pending');

      // Price at or below limit - should fill
      const filled = await orderService.checkLimitOrder(order.id, 48000);
      expect(filled.status).toBe('filled');
      expect(filled.filledPrice).toBe(48000);
    });

    it('should_trigger_stop_loss_order', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'stop_loss',
        quantity: 0.1,
        stopPrice: 45000,
        mode: 'paper',
      });

      // Price above stop - should not trigger
      const notTriggered = await orderService.checkStopOrder(order.id, 46000);
      expect(notTriggered.status).toBe('pending');

      // Price at or below stop - should trigger and fill
      const triggered = await orderService.checkStopOrder(order.id, 44500);
      expect(triggered.status).toBe('filled');
    });

    it('should_calculate_paper_trading_fees', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 1.0,
        mode: 'paper',
      });

      const executed = await orderService.executePaperOrder(order.id, 50000);

      expect(executed.fee).toBeDefined();
      expect(executed.fee).toBeGreaterThan(0);
      // Default 0.1% fee = 50000 * 0.001 = 50
      expect(executed.fee).toBeCloseTo(50, 0);
    });
  });

  // ============================================================================
  // Position Management
  // ============================================================================

  describe('Position Management', () => {
    it('should_create_position_on_buy_order_fill', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.5,
        mode: 'paper',
      });

      // No slippage for predictable entry price
      await orderService.executePaperOrder(order.id, 50000, { slippage: 0 });

      const positions = await orderService.getOpenPositions(userId);
      expect(positions.length).toBe(1);
      expect(positions[0].symbol).toBe('BTC/USDT');
      expect(positions[0].quantity).toBe(0.5);
      expect(positions[0].side).toBe('long');
      expect(positions[0].entryPrice).toBe(50000);
    });

    it('should_add_to_existing_position', async () => {
      // First buy (no slippage for predictable values)
      const order1 = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.5,
        mode: 'paper',
      });
      await orderService.executePaperOrder(order1.id, 50000, { slippage: 0 });

      // Second buy
      const order2 = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.5,
        mode: 'paper',
      });
      await orderService.executePaperOrder(order2.id, 52000, { slippage: 0 });

      const positions = await orderService.getOpenPositions(userId);
      expect(positions.length).toBe(1);
      expect(positions[0].quantity).toBe(1.0);
      // Average entry price = (0.5 * 50000 + 0.5 * 52000) / 1.0 = 51000
      expect(positions[0].entryPrice).toBe(51000);
    });

    it('should_close_position_on_sell_order_fill', async () => {
      // Open position (no slippage for predictable values)
      const buyOrder = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 1.0,
        mode: 'paper',
      });
      await orderService.executePaperOrder(buyOrder.id, 50000, { slippage: 0 });

      // Close position
      const sellOrder = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'market',
        quantity: 1.0,
        mode: 'paper',
      });
      await orderService.executePaperOrder(sellOrder.id, 55000, { slippage: 0 });

      const openPositions = await orderService.getOpenPositions(userId);
      expect(openPositions.length).toBe(0);

      const closedPositions = await orderService.getClosedPositions(userId);
      expect(closedPositions.length).toBe(1);
      expect(closedPositions[0].realizedPnl).toBe(5000); // (55000 - 50000) * 1.0
    });

    it('should_partially_close_position', async () => {
      // Open position (no slippage for predictable values)
      const buyOrder = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 2.0,
        mode: 'paper',
      });
      await orderService.executePaperOrder(buyOrder.id, 50000, { slippage: 0 });

      // Partial close
      const sellOrder = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'market',
        quantity: 0.5,
        mode: 'paper',
      });
      await orderService.executePaperOrder(sellOrder.id, 52000, { slippage: 0 });

      const positions = await orderService.getOpenPositions(userId);
      expect(positions.length).toBe(1);
      expect(positions[0].quantity).toBe(1.5);
    });

    it('should_track_unrealized_pnl', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 1.0,
        mode: 'paper',
      });
      // Execute without slippage for predictable calculation
      await orderService.executePaperOrder(order.id, 50000, { slippage: 0 });

      const pnl = await orderService.calculateUnrealizedPnl(userId, 'BTC/USDT', 55000);
      expect(pnl).toBe(5000); // (55000 - 50000) * 1.0
    });

    it('should_create_short_position', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'market',
        quantity: 0.5,
        mode: 'paper',
      });
      await orderService.executePaperOrder(order.id, 50000);

      const positions = await orderService.getOpenPositions(userId);
      expect(positions.length).toBe(1);
      expect(positions[0].side).toBe('short');
    });
  });

  // ============================================================================
  // Risk Checks
  // ============================================================================

  describe('Risk Checks', () => {
    it('should_enforce_max_position_size', async () => {
      // Set position limit in strategy config
      const strategy = await strategyService.getStrategy(strategyId);
      await strategyService.updateStrategy(strategyId, {
        config: {
          ...strategy!.config,
          maxPositionSize: 1.0,
        },
      });

      // First order - should succeed
      const order1 = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.8,
        mode: 'paper',
      });
      await orderService.executePaperOrder(order1.id, 50000);

      // Second order - exceeds limit
      await expect(
        orderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0.5,
          mode: 'paper',
        })
      ).rejects.toThrow('Order would exceed maximum position size');
    });

    it('should_enforce_max_daily_loss', async () => {
      // Simulate losses
      await orderService.recordLoss(userId, 'BTC/USDT', 500);
      await orderService.recordLoss(userId, 'BTC/USDT', 500);

      // User's tier allows max $1000 daily loss
      await expect(
        orderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          mode: 'paper',
        })
      ).rejects.toThrow('Daily loss limit reached');
    });

    it('should_enforce_max_open_orders', async () => {
      // Create multiple pending orders
      for (let i = 0; i < 10; i++) {
        await orderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'limit',
          quantity: 0.1,
          price: 45000 + i * 100,
          mode: 'paper',
        });
      }

      // 11th order should fail (pro tier has 10 max open orders)
      await expect(
        orderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'limit',
          quantity: 0.1,
          price: 44000,
          mode: 'paper',
        })
      ).rejects.toThrow('Maximum open orders reached');
    });

    it('should_require_live_trading_tier_for_live_mode', async () => {
      // Create free tier user
      const freeUser = await db.users.create({
        email: 'free@example.com',
        passwordHash: 'hashed',
        tier: 'free',
      });

      // Allow this test to exercise tier validation rather than execution mode
      await strategyService.updateStrategy(strategyId, {
        executionMode: 'auto' as any,
      });

      await expect(
        orderService.createOrder({
          userId: freeUser.id,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          mode: 'live',
        })
      ).rejects.toThrow('Live trading not available for free tier');
    });

    it('should_validate_symbol_format', async () => {
      await expect(
        orderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTCUSDT', // Missing /
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          mode: 'paper',
        })
      ).rejects.toThrow('Invalid symbol format');
    });

    it('should_block_live_orders_when_global_kill_switch_enabled', async () => {
      const original = process.env.LIVE_TRADING_DISABLED;
      process.env.LIVE_TRADING_DISABLED = 'true';

      await expect(
        orderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          mode: 'live',
        })
      ).rejects.toThrow('Live trading is temporarily disabled');

      if (original === undefined) {
        delete process.env.LIVE_TRADING_DISABLED;
      } else {
        process.env.LIVE_TRADING_DISABLED = original;
      }
    });

    it('should_create_approval_request_for_manual_live_order', async () => {
      await strategyService.updateStatus(strategyId, 'backtesting' as any);
      await strategyService.updateStatus(strategyId, 'paper' as any);
      await strategyService.updateStatus(strategyId, 'active' as any);

      await db.exchangeConnections.create({
        userId,
        exchange: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        name: 'Binance',
      } as any);

      const approval = await orderService.createApprovalRequest({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'live',
      });

      expect(approval.id).toBeDefined();
      expect(approval.status).toBe('pending');
      expect(approval.mode).toBe('live');
      expect(approval.strategyId).toBe(strategyId);
    });

    it('should_approve_manual_live_order_via_approval_flow', async () => {
      await strategyService.updateStatus(strategyId, 'backtesting' as any);
      await strategyService.updateStatus(strategyId, 'paper' as any);
      await strategyService.updateStatus(strategyId, 'active' as any);

      await db.exchangeConnections.create({
        userId,
        exchange: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        name: 'Binance',
      } as any);

      // Provide a passing backtest so the gate allows live trading
      const backtestService = {
        getBacktestHistory: vi.fn().mockResolvedValue([
          {
            id: 'bt-1',
            strategyId,
            symbol: 'BTC/USDT',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
            status: 'completed',
            metrics: {
              totalReturn: 10,
              maxDrawdown: 15,
            },
            trades: [],
            equityCurve: [],
            createdAt: new Date('2024-02-01'),
          },
        ]),
      } as any;

      const gatedOrderService = new OrderService({
        db,
        configService,
        strategyService,
        backtestService,
      });

      const approval = await gatedOrderService.createApprovalRequest({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'live',
      });

      const result = await gatedOrderService.approveLiveOrder(userId, approval.id);

      expect(result.approval.status).toBe('approved');
      expect(result.approval.orderId).toBeDefined();
      expect(result.order.mode).toBe('live');
      expect(result.order.symbol).toBe('BTC/USDT');
    });

    it('should_block_live_orders_for_manual_execution_mode', async () => {
      // Ensure strategy is active and has exchange so other gates pass
      await strategyService.updateStatus(strategyId, 'backtesting' as any);
      await strategyService.updateStatus(strategyId, 'paper' as any);
      await strategyService.updateStatus(strategyId, 'active' as any);

      await db.exchangeConnections.create({
        userId,
        exchange: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        name: 'Binance',
      } as any);

      // Execution mode defaults to manual; live order should be rejected
      await expect(
        orderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          mode: 'live',
        })
      ).rejects.toThrow('This strategy is configured for manual execution only. Enable autonomous mode before placing live orders.');
    });

    it('should_allow_live_orders_for_auto_execution_mode', async () => {
      await strategyService.updateStatus(strategyId, 'backtesting' as any);
      await strategyService.updateStatus(strategyId, 'paper' as any);
      await strategyService.updateStatus(strategyId, 'active' as any);

      await db.exchangeConnections.create({
        userId,
        exchange: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        name: 'Binance',
      } as any);

      // Update strategy to autonomous execution
      await strategyService.updateStrategy(strategyId, {
        executionMode: 'auto' as any,
      });

      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'live',
      });

      expect(order.mode).toBe('live');
      expect(order.id).toBeDefined();
    });

    it('should_enforce_backtest_gate_for_live_trading', async () => {
      // Strategy must be active for live trading
      await strategyService.updateStatus(strategyId, 'backtesting' as any);
      await strategyService.updateStatus(strategyId, 'paper' as any);
      await strategyService.updateStatus(strategyId, 'active' as any);
      await strategyService.updateStrategy(strategyId, {
        executionMode: 'auto' as any,
      });

      // Create an exchange connection so live trading checks pass
      await db.exchangeConnections.create({
        userId,
        exchange: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        name: 'Binance',
      } as any);

      const backtestService = {
        getBacktestHistory: vi.fn().mockResolvedValue([]),
      } as any;

      const gatedOrderService = new OrderService({
        db,
        configService,
        strategyService,
        backtestService,
      });

      await expect(
        gatedOrderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          mode: 'live',
        })
      ).rejects.toThrow('Strategy must pass a successful backtest before live trading');
    });

    it('should_allow_live_order_when_latest_backtest_meets_criteria', async () => {
      await strategyService.updateStatus(strategyId, 'backtesting' as any);
      await strategyService.updateStatus(strategyId, 'paper' as any);
      await strategyService.updateStatus(strategyId, 'active' as any);
       await strategyService.updateStrategy(strategyId, {
        executionMode: 'auto' as any,
      });

      await db.exchangeConnections.create({
        userId,
        exchange: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        name: 'Binance',
      } as any);

      const backtestService = {
        getBacktestHistory: vi.fn().mockResolvedValue([
          {
            id: 'bt-1',
            strategyId,
            symbol: 'BTC/USDT',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
            status: 'completed',
            metrics: {
              totalReturn: 15,
              maxDrawdown: 20,
            },
            trades: [],
            equityCurve: [],
            createdAt: new Date('2024-02-01'),
          },
        ]),
      } as any;

      const gatedOrderService = new OrderService({
        db,
        configService,
        strategyService,
        backtestService,
      });

      const order = await gatedOrderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'live',
      });

      expect(order.id).toBeDefined();
      expect(order.mode).toBe('live');
    });
  });

  // ============================================================================
  // Order History
  // ============================================================================

  describe('Order History', () => {
    it('should_get_order_by_id', async () => {
      const created = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });

      const order = await orderService.getOrder(created.id);
      expect(order).toBeDefined();
      expect(order!.id).toBe(created.id);
    });

    it('should_get_user_orders', async () => {
      await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });

      await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'ETH/USDT',
        side: 'sell',
        type: 'limit',
        quantity: 1.0,
        price: 3000,
        mode: 'paper',
      });

      const orders = await orderService.getUserOrders(userId);
      expect(orders.length).toBe(2);
    });

    it('should_filter_orders_by_status', async () => {
      const order1 = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });
      await orderService.executePaperOrder(order1.id, 50000);

      await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'ETH/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 1.0,
        price: 2800,
        mode: 'paper',
      });

      const filledOrders = await orderService.getUserOrders(userId, { status: 'filled' });
      expect(filledOrders.length).toBe(1);
      expect(filledOrders[0].symbol).toBe('BTC/USDT');

      const pendingOrders = await orderService.getUserOrders(userId, { status: 'pending' });
      expect(pendingOrders.length).toBe(1);
      expect(pendingOrders[0].symbol).toBe('ETH/USDT');
    });

    it('should_filter_orders_by_symbol', async () => {
      await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });

      await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'ETH/USDT',
        side: 'buy',
        type: 'market',
        quantity: 1.0,
        mode: 'paper',
      });

      const btcOrders = await orderService.getUserOrders(userId, { symbol: 'BTC/USDT' });
      expect(btcOrders.length).toBe(1);
    });

    it('should_get_strategy_orders', async () => {
      await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });

      const orders = await orderService.getStrategyOrders(strategyId);
      expect(orders.length).toBe(1);
      expect(orders[0].strategyId).toBe(strategyId);
    });
  });

  // ============================================================================
  // Order Cancellation
  // ============================================================================

  describe('Order Cancellation', () => {
    it('should_cancel_pending_order', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 45000,
        mode: 'paper',
      });

      const cancelled = await orderService.cancelOrder(order.id);
      expect(cancelled.status).toBe('cancelled');
    });

    it('should_not_cancel_filled_order', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });
      await orderService.executePaperOrder(order.id, 50000);

      await expect(orderService.cancelOrder(order.id)).rejects.toThrow(
        'Cannot cancel filled order'
      );
    });

    it('should_cancel_all_pending_orders_for_symbol', async () => {
      await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 45000,
        mode: 'paper',
      });

      await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'limit',
        quantity: 0.1,
        price: 55000,
        mode: 'paper',
      });

      await orderService.cancelAllOrders(userId, 'BTC/USDT');

      const pendingOrders = await orderService.getUserOrders(userId, { status: 'pending' });
      expect(pendingOrders.length).toBe(0);
    });
  });

  // ============================================================================
  // Order Modification
  // ============================================================================

  describe('Order Modification', () => {
    it('should_modify_limit_order_price', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 45000,
        mode: 'paper',
      });

      const modified = await orderService.modifyOrder(order.id, { price: 46000 });
      expect(modified.price).toBe(46000);
    });

    it('should_modify_order_quantity', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 45000,
        mode: 'paper',
      });

      const modified = await orderService.modifyOrder(order.id, { quantity: 0.2 });
      expect(modified.quantity).toBe(0.2);
    });

    it('should_not_modify_filled_order', async () => {
      const order = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        mode: 'paper',
      });
      await orderService.executePaperOrder(order.id, 50000);

      await expect(orderService.modifyOrder(order.id, { quantity: 0.2 })).rejects.toThrow(
        'Cannot modify filled order'
      );
    });
  });

  // ============================================================================
  // Portfolio Summary
  // ============================================================================

  describe('Portfolio Summary', () => {
    beforeEach(async () => {
      // Create some positions (no slippage for predictable values)
      const order1 = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        quantity: 1.0,
        mode: 'paper',
      });
      await orderService.executePaperOrder(order1.id, 50000, { slippage: 0 });

      const order2 = await orderService.createOrder({
        userId,
        strategyId,
        symbol: 'ETH/USDT',
        side: 'buy',
        type: 'market',
        quantity: 10.0,
        mode: 'paper',
      });
      await orderService.executePaperOrder(order2.id, 3000, { slippage: 0 });
    });

    it('should_calculate_total_portfolio_value', async () => {
      const currentPrices = {
        'BTC/USDT': 52000,
        'ETH/USDT': 3200,
      };

      const summary = await orderService.getPortfolioSummary(userId, currentPrices);

      expect(summary.totalValue).toBe(52000 * 1.0 + 3200 * 10.0); // 84000
      expect(summary.totalCost).toBe(50000 * 1.0 + 3000 * 10.0); // 80000
      expect(summary.totalPnl).toBe(4000);
      expect(summary.totalPnlPercent).toBe(5); // 4000/80000 * 100
    });

    it('should_list_position_breakdown', async () => {
      const currentPrices = {
        'BTC/USDT': 52000,
        'ETH/USDT': 3200,
      };

      const summary = await orderService.getPortfolioSummary(userId, currentPrices);

      expect(summary.positions.length).toBe(2);

      const btcPosition = summary.positions.find(p => p.symbol === 'BTC/USDT');
      expect(btcPosition).toBeDefined();
      expect(btcPosition!.currentValue).toBe(52000);
      expect(btcPosition!.unrealizedPnl).toBe(2000);
    });
  });

  // ============================================================================
  // Live Trading Validation
  // ============================================================================

  describe('Live Trading Validation', () => {
    it('should_validate_strategy_is_active_for_live_trading', async () => {
      // Strategy is in draft status, not active
      await strategyService.updateStrategy(strategyId, {
        executionMode: 'auto' as any,
      });
      await expect(
        orderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          mode: 'live',
        })
      ).rejects.toThrow('Strategy must be active for live trading');
    });

    it('should_require_exchange_connection_for_live_trading', async () => {
      // First activate the strategy properly
      await strategyService.updateStatus(strategyId, 'backtesting');
      await strategyService.updateStatus(strategyId, 'paper');
      await strategyService.updateStatus(strategyId, 'active');
      await strategyService.updateStrategy(strategyId, {
        executionMode: 'auto' as any,
      });

      await expect(
        orderService.createOrder({
          userId,
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1,
          mode: 'live',
          exchangeId: 'binance',
        })
      ).rejects.toThrow('Exchange connection required for live trading');
    });
  });
});
