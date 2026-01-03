/**
 * OrderService - Order Execution and Position Management
 * Handles paper trading, live trading preparation, and risk management
 */

import { v4 as uuidv4 } from 'uuid';
import { StrategyService } from '../strategies/StrategyService';
import { ConfigService } from '../config/ConfigService';
import type { StrategyExecutionMode } from '../database/types';
import type { BacktestService, BacktestResult } from '../backtesting/BacktestService';

// ============================================================================
// Types
// ============================================================================

export type OrderType = 'market' | 'limit' | 'stop_loss' | 'take_profit';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'rejected' | 'expired';
export type OrderMode = 'paper' | 'live';
export type PositionSide = 'long' | 'short';

export type OrderApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface OrderApprovalRequest {
  id: string;
  userId: string;
  strategyId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  mode: OrderMode;
  exchangeId?: string;
  status: OrderApprovalStatus;
  createdAt: Date;
  decidedAt?: Date;
  orderId?: string;
}

export interface Order {
  id: string;
  userId: string;
  strategyId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: OrderStatus;
  mode: OrderMode;
  exchangeId?: string;
  filledPrice?: number;
  filledAt?: Date;
  fee?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Position {
  id: string;
  userId: string;
  strategyId: string;
  symbol: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  currentPrice?: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
  openedAt: Date;
  closedAt?: Date;
}

export interface CreateOrderParams {
  userId: string;
  strategyId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  mode: OrderMode;
  exchangeId?: string;
}

export interface ExecutionOptions {
  slippage?: number; // Percentage
  fee?: number; // Percentage
}

export interface OrderFilters {
  status?: OrderStatus;
  symbol?: string;
  mode?: OrderMode;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  positions: PositionSummary[];
}

export interface PositionSummary {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface OrderServiceOptions {
  db: any;
  configService: ConfigService;
  strategyService: StrategyService;
  backtestService?: BacktestService;
}

// ============================================================================
// Tier Limits
// ============================================================================

const TIER_ORDER_LIMITS: Record<string, { maxOpenOrders: number; maxDailyLoss: number }> = {
  free: { maxOpenOrders: 5, maxDailyLoss: 100 },
  pro: { maxOpenOrders: 10, maxDailyLoss: 1000 },
  elite: { maxOpenOrders: 50, maxDailyLoss: 10000 },
  institutional: { maxOpenOrders: -1, maxDailyLoss: -1 }, // Unlimited
};

// ============================================================================
// OrderService Implementation
// ============================================================================

export class OrderService {
  private db: any;
  private configService: ConfigService;
  private strategyService: StrategyService;
  private backtestService?: BacktestService;
  private orders: Map<string, Order> = new Map();
  private positions: Map<string, Position[]> = new Map();
  private dailyLosses: Map<string, number> = new Map();
  private approvals: Map<string, OrderApprovalRequest> = new Map();

  constructor(options: OrderServiceOptions) {
    this.db = options.db;
    this.configService = options.configService;
    this.strategyService = options.strategyService;
    this.backtestService = options.backtestService;
  }

  // ============================================================================
  // Order Creation
  // ============================================================================

  async createOrder(params: CreateOrderParams): Promise<Order> {
    return this.createOrderInternal(params);
  }

  private async createOrderInternal(
    params: CreateOrderParams,
    options?: { allowManualLive?: boolean }
  ): Promise<Order> {
    // Validate quantity
    if (params.quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    // Validate symbol format
    if (!params.symbol.includes('/')) {
      throw new Error('Invalid symbol format. Use BASE/QUOTE format (e.g., BTC/USDT)');
    }

    // Validate limit order price
    if (params.type === 'limit' && params.price === undefined) {
      throw new Error('Limit orders require a price');
    }

    // Validate stop orders
    if ((params.type === 'stop_loss' || params.type === 'take_profit') && params.stopPrice === undefined) {
      throw new Error('Stop orders require a stop price');
    }

    // Get user for tier checks
    const user = await this.db.users.findById(params.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Fetch strategy to inspect execution mode for live safety
    const strategy = await this.strategyService.getStrategy(params.strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    const executionMode: StrategyExecutionMode = (strategy.executionMode as StrategyExecutionMode) || 'manual';

    // Global kill switch for live trading (safety guardrail)
    if (params.mode === 'live' && process.env.LIVE_TRADING_DISABLED === 'true') {
      throw new Error('Live trading is temporarily disabled');
    }

    // For safety, reject fully automatic live orders for manual strategies
    if (params.mode === 'live' && executionMode === 'manual' && !options?.allowManualLive) {
      throw new Error('This strategy is configured for manual execution only. Enable autonomous mode before placing live orders.');
    }

    // Check tier for live trading
    if (params.mode === 'live') {
      const tierFeatures = this.configService.getTierFeatures(user.tier);
      if (!tierFeatures.liveTradingEnabled) {
        throw new Error(`Live trading not available for ${user.tier} tier`);
      }

      // Validate strategy is active
      if (!strategy || strategy.status !== 'active') {
        throw new Error('Strategy must be active for live trading');
      }

      // Validate exchange connection
      const exchangeConnections = await this.db.exchangeConnections?.findByUserId?.(params.userId) || [];
      if (exchangeConnections.length === 0) {
        throw new Error('Exchange connection required for live trading');
      }

      // Enforce backtest gate: strategy must have at least one successful
      // backtest meeting minimum performance criteria before live trading.
      await this.enforceBacktestGate(params.strategyId);
    }

    // Check daily loss limit
    await this.checkDailyLossLimit(params.userId, user.tier);

    // Check max open orders
    await this.checkMaxOpenOrders(params.userId, user.tier);

    // Check position size limit
    await this.checkPositionSizeLimit(params);

    // Create order
    const order: Order = {
      id: uuidv4(),
      userId: params.userId,
      strategyId: params.strategyId,
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: params.quantity,
      price: params.price,
      stopPrice: params.stopPrice,
      status: 'pending',
      mode: params.mode,
      exchangeId: params.exchangeId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.set(order.id, order);
    return order;
  }

  // ============================================================================
  // Manual Execution Approvals
  // ============================================================================

  async createApprovalRequest(params: CreateOrderParams): Promise<OrderApprovalRequest> {
    if (params.mode !== 'live') {
      throw new Error('Approval requests are only supported for live orders');
    }

    const approval: OrderApprovalRequest = {
      id: uuidv4(),
      userId: params.userId,
      strategyId: params.strategyId,
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: params.quantity,
      price: params.price,
      stopPrice: params.stopPrice,
      mode: params.mode,
      exchangeId: params.exchangeId,
      status: 'pending',
      createdAt: new Date(),
    };

    this.approvals.set(approval.id, approval);
    return approval;
  }

  async getUserApprovals(userId: string, status?: OrderApprovalStatus): Promise<OrderApprovalRequest[]> {
    let approvals = Array.from(this.approvals.values()).filter(a => a.userId === userId);
    if (status) {
      approvals = approvals.filter(a => a.status === status);
    }
    return approvals;
  }

  async approveLiveOrder(
    userId: string,
    approvalId: string
  ): Promise<{ approval: OrderApprovalRequest; order: Order }> {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error('Approval request not found');
    }
    if (approval.userId !== userId) {
      throw new Error('Cannot modify another user\'s approval request');
    }
    if (approval.status !== 'pending') {
      throw new Error('Approval request is not pending');
    }

    const order = await this.createOrderInternal(
      {
        userId: approval.userId,
        strategyId: approval.strategyId,
        symbol: approval.symbol,
        side: approval.side,
        type: approval.type,
        quantity: approval.quantity,
        price: approval.price,
        stopPrice: approval.stopPrice,
        mode: approval.mode,
        exchangeId: approval.exchangeId,
      },
      { allowManualLive: true }
    );

    approval.status = 'approved';
    approval.decidedAt = new Date();
    approval.orderId = order.id;
    this.approvals.set(approval.id, approval);

    return { approval, order };
  }

  async rejectApproval(userId: string, approvalId: string): Promise<OrderApprovalRequest> {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error('Approval request not found');
    }
    if (approval.userId !== userId) {
      throw new Error('Cannot modify another user\'s approval request');
    }
    if (approval.status !== 'pending') {
      throw new Error('Approval request is not pending');
    }

    approval.status = 'rejected';
    approval.decidedAt = new Date();
    this.approvals.set(approval.id, approval);
    return approval;
  }

  private async checkDailyLossLimit(userId: string, tier: string): Promise<void> {
    const limits = TIER_ORDER_LIMITS[tier];
    if (limits.maxDailyLoss === -1) return; // Unlimited

    const dailyLoss = this.dailyLosses.get(userId) || 0;
    if (dailyLoss >= limits.maxDailyLoss) {
      throw new Error('Daily loss limit reached');
    }
  }

  private async checkMaxOpenOrders(userId: string, tier: string): Promise<void> {
    const limits = TIER_ORDER_LIMITS[tier];
    if (limits.maxOpenOrders === -1) return; // Unlimited

    const userOrders = Array.from(this.orders.values()).filter(
      o => o.userId === userId && o.status === 'pending'
    );

    if (userOrders.length >= limits.maxOpenOrders) {
      throw new Error('Maximum open orders reached');
    }
  }

  private async checkPositionSizeLimit(params: CreateOrderParams): Promise<void> {
    const strategy = await this.strategyService.getStrategy(params.strategyId);
    if (!strategy || !strategy.config.maxPositionSize) return;

    // Get current position for this symbol
    const userPositions = this.positions.get(params.userId) || [];
    const existingPosition = userPositions.find(
      p => p.symbol === params.symbol && !p.closedAt
    );

    const currentQuantity = existingPosition?.quantity || 0;
    const newTotal = params.side === 'buy'
      ? currentQuantity + params.quantity
      : currentQuantity - params.quantity;

    if (Math.abs(newTotal) > strategy.config.maxPositionSize) {
      throw new Error('Order would exceed maximum position size');
    }
  }

  // ============================================================================
  // Backtest Gate for Live Trading
  // ============================================================================

  private async enforceBacktestGate(strategyId: string): Promise<void> {
    if (!this.backtestService) {
      // In environments without BacktestService (e.g., some tests), skip gate.
      return;
    }

    const history: BacktestResult[] = await this.backtestService.getBacktestHistory(strategyId);
    const completed = history.filter(result => result.status === 'completed');

    if (completed.length === 0) {
      throw new Error('Strategy must pass a successful backtest before live trading');
    }

    const latest = completed[completed.length - 1];
    const metrics = latest.metrics;

    if (!metrics) {
      throw new Error('Latest backtest metrics are missing; re-run backtest before live trading');
    }

    const { totalReturn, maxDrawdown } = metrics as any;

    if (typeof totalReturn !== 'number' || typeof maxDrawdown !== 'number') {
      throw new Error('Latest backtest metrics are invalid; re-run backtest before live trading');
    }

    if (totalReturn < 0) {
      throw new Error('Latest backtest has negative return; adjust strategy before enabling live trading');
    }

    if (maxDrawdown > 30) {
      throw new Error('Latest backtest max drawdown exceeds 30%; reduce risk before enabling live trading');
    }
  }

  // ============================================================================
  // Paper Trading Execution
  // ============================================================================

  async executePaperOrder(orderId: string, currentPrice: number, options: ExecutionOptions = {}): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'pending') {
      throw new Error('Order is not pending');
    }

    const slippage = options.slippage ?? 0.1; // 0.1% default
    const feePercent = options.fee ?? 0.1; // 0.1% default

    // Apply slippage
    let filledPrice: number;
    if (order.side === 'buy') {
      filledPrice = currentPrice * (1 + slippage / 100);
    } else {
      filledPrice = currentPrice * (1 - slippage / 100);
    }

    // Calculate fee
    const fee = order.quantity * filledPrice * (feePercent / 100);

    // Update order
    order.status = 'filled';
    order.filledPrice = filledPrice;
    order.filledAt = new Date();
    order.fee = fee;
    order.updatedAt = new Date();

    this.orders.set(orderId, order);

    // Update positions
    await this.updatePosition(order);

    return order;
  }

  async checkLimitOrder(orderId: string, currentPrice: number): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.type !== 'limit') {
      throw new Error('Not a limit order');
    }

    if (order.status !== 'pending') {
      return order;
    }

    // Check if limit price reached
    const shouldFill = order.side === 'buy'
      ? currentPrice <= order.price!
      : currentPrice >= order.price!;

    if (shouldFill) {
      order.status = 'filled';
      order.filledPrice = order.price;
      order.filledAt = new Date();
      order.fee = order.quantity * order.price! * 0.001;
      order.updatedAt = new Date();

      this.orders.set(orderId, order);
      await this.updatePosition(order);
    }

    return order;
  }

  async checkStopOrder(orderId: string, currentPrice: number): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.type !== 'stop_loss' && order.type !== 'take_profit') {
      throw new Error('Not a stop order');
    }

    if (order.status !== 'pending') {
      return order;
    }

    // Check if stop price triggered
    let shouldTrigger = false;
    if (order.type === 'stop_loss') {
      shouldTrigger = order.side === 'sell'
        ? currentPrice <= order.stopPrice!
        : currentPrice >= order.stopPrice!;
    } else {
      shouldTrigger = order.side === 'sell'
        ? currentPrice >= order.stopPrice!
        : currentPrice <= order.stopPrice!;
    }

    if (shouldTrigger) {
      order.status = 'filled';
      order.filledPrice = currentPrice;
      order.filledAt = new Date();
      order.fee = order.quantity * currentPrice * 0.001;
      order.updatedAt = new Date();

      this.orders.set(orderId, order);
      await this.updatePosition(order);
    }

    return order;
  }

  // ============================================================================
  // Position Management
  // ============================================================================

  private async updatePosition(order: Order): Promise<void> {
    const userPositions = this.positions.get(order.userId) || [];
    const existingIndex = userPositions.findIndex(
      p => p.symbol === order.symbol && !p.closedAt
    );

    if (order.side === 'buy') {
      if (existingIndex >= 0) {
        const existing = userPositions[existingIndex];
        if (existing.side === 'long') {
          // Add to long position
          const totalCost = existing.entryPrice * existing.quantity + order.filledPrice! * order.quantity;
          const totalQuantity = existing.quantity + order.quantity;
          existing.entryPrice = totalCost / totalQuantity;
          existing.quantity = totalQuantity;
        } else {
          // Reducing short position
          if (order.quantity >= existing.quantity) {
            // Close short position
            const pnl = (existing.entryPrice - order.filledPrice!) * existing.quantity;
            existing.realizedPnl = pnl;
            existing.closedAt = new Date();

            // If quantity > existing, open new long
            if (order.quantity > existing.quantity) {
              const newPosition: Position = {
                id: uuidv4(),
                userId: order.userId,
                strategyId: order.strategyId,
                symbol: order.symbol,
                side: 'long',
                quantity: order.quantity - existing.quantity,
                entryPrice: order.filledPrice!,
                openedAt: new Date(),
              };
              userPositions.push(newPosition);
            }
          } else {
            existing.quantity -= order.quantity;
          }
        }
      } else {
        // Create new long position
        const position: Position = {
          id: uuidv4(),
          userId: order.userId,
          strategyId: order.strategyId,
          symbol: order.symbol,
          side: 'long',
          quantity: order.quantity,
          entryPrice: order.filledPrice!,
          openedAt: new Date(),
        };
        userPositions.push(position);
      }
    } else {
      // Sell order
      if (existingIndex >= 0) {
        const existing = userPositions[existingIndex];
        if (existing.side === 'short') {
          // Add to short position
          const totalCost = existing.entryPrice * existing.quantity + order.filledPrice! * order.quantity;
          const totalQuantity = existing.quantity + order.quantity;
          existing.entryPrice = totalCost / totalQuantity;
          existing.quantity = totalQuantity;
        } else {
          // Reducing long position
          if (order.quantity >= existing.quantity) {
            // Close long position
            const pnl = (order.filledPrice! - existing.entryPrice) * existing.quantity;
            existing.realizedPnl = pnl;
            existing.closedAt = new Date();

            // If quantity > existing, open new short
            if (order.quantity > existing.quantity) {
              const newPosition: Position = {
                id: uuidv4(),
                userId: order.userId,
                strategyId: order.strategyId,
                symbol: order.symbol,
                side: 'short',
                quantity: order.quantity - existing.quantity,
                entryPrice: order.filledPrice!,
                openedAt: new Date(),
              };
              userPositions.push(newPosition);
            }
          } else {
            existing.quantity -= order.quantity;
          }
        }
      } else {
        // Create new short position
        const position: Position = {
          id: uuidv4(),
          userId: order.userId,
          strategyId: order.strategyId,
          symbol: order.symbol,
          side: 'short',
          quantity: order.quantity,
          entryPrice: order.filledPrice!,
          openedAt: new Date(),
        };
        userPositions.push(position);
      }
    }

    this.positions.set(order.userId, userPositions);
  }

  async getOpenPositions(userId: string): Promise<Position[]> {
    const userPositions = this.positions.get(userId) || [];
    return userPositions.filter(p => !p.closedAt);
  }

  async getClosedPositions(userId: string): Promise<Position[]> {
    const userPositions = this.positions.get(userId) || [];
    return userPositions.filter(p => p.closedAt);
  }

  async calculateUnrealizedPnl(userId: string, symbol: string, currentPrice: number): Promise<number> {
    const positions = await this.getOpenPositions(userId);
    const position = positions.find(p => p.symbol === symbol);

    if (!position) {
      return 0;
    }

    if (position.side === 'long') {
      return (currentPrice - position.entryPrice) * position.quantity;
    } else {
      return (position.entryPrice - currentPrice) * position.quantity;
    }
  }

  // ============================================================================
  // Order Retrieval
  // ============================================================================

  async getOrder(orderId: string): Promise<Order | undefined> {
    return this.orders.get(orderId);
  }

  async getUserOrders(userId: string, filters?: OrderFilters): Promise<Order[]> {
    let orders = Array.from(this.orders.values()).filter(o => o.userId === userId);

    if (filters?.status) {
      orders = orders.filter(o => o.status === filters.status);
    }

    if (filters?.symbol) {
      orders = orders.filter(o => o.symbol === filters.symbol);
    }

    if (filters?.mode) {
      orders = orders.filter(o => o.mode === filters.mode);
    }

    return orders;
  }

  async getStrategyOrders(strategyId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(o => o.strategyId === strategyId);
  }

  // ============================================================================
  // Order Cancellation
  // ============================================================================

  async cancelOrder(orderId: string): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'filled') {
      throw new Error('Cannot cancel filled order');
    }

    order.status = 'cancelled';
    order.updatedAt = new Date();

    this.orders.set(orderId, order);
    return order;
  }

  async cancelAllOrders(userId: string, symbol?: string): Promise<void> {
    const orders = Array.from(this.orders.values()).filter(o =>
      o.userId === userId &&
      o.status === 'pending' &&
      (symbol ? o.symbol === symbol : true)
    );

    for (const order of orders) {
      order.status = 'cancelled';
      order.updatedAt = new Date();
      this.orders.set(order.id, order);
    }
  }

  // ============================================================================
  // Order Modification
  // ============================================================================

  async modifyOrder(orderId: string, updates: { price?: number; quantity?: number; stopPrice?: number }): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'pending') {
      throw new Error('Cannot modify filled order');
    }

    if (updates.price !== undefined) {
      order.price = updates.price;
    }

    if (updates.quantity !== undefined) {
      if (updates.quantity <= 0) {
        throw new Error('Quantity must be positive');
      }
      order.quantity = updates.quantity;
    }

    if (updates.stopPrice !== undefined) {
      order.stopPrice = updates.stopPrice;
    }

    order.updatedAt = new Date();
    this.orders.set(orderId, order);

    return order;
  }

  // ============================================================================
  // Portfolio Summary
  // ============================================================================

  async getPortfolioSummary(userId: string, currentPrices: Record<string, number>): Promise<PortfolioSummary> {
    const openPositions = await this.getOpenPositions(userId);

    let totalValue = 0;
    let totalCost = 0;
    const positionSummaries: PositionSummary[] = [];

    for (const position of openPositions) {
      const currentPrice = currentPrices[position.symbol] || position.entryPrice;
      const currentValue = currentPrice * position.quantity;
      const cost = position.entryPrice * position.quantity;

      let unrealizedPnl: number;
      if (position.side === 'long') {
        unrealizedPnl = (currentPrice - position.entryPrice) * position.quantity;
      } else {
        unrealizedPnl = (position.entryPrice - currentPrice) * position.quantity;
      }

      totalValue += currentValue;
      totalCost += cost;

      positionSummaries.push({
        symbol: position.symbol,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        currentPrice,
        currentValue,
        unrealizedPnl,
        unrealizedPnlPercent: (unrealizedPnl / cost) * 100,
      });
    }

    const totalPnl = totalValue - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalPnl,
      totalPnlPercent,
      positions: positionSummaries,
    };
  }

  // ============================================================================
  // Loss Tracking
  // ============================================================================

  async recordLoss(userId: string, symbol: string, amount: number): Promise<void> {
    const currentLoss = this.dailyLosses.get(userId) || 0;
    this.dailyLosses.set(userId, currentLoss + amount);
  }

  resetDailyLosses(): void {
    this.dailyLosses.clear();
  }
}
