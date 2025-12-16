/**
 * RiskManager - Portfolio risk management service
 */

import {
  calculatePositionSize,
  calculateRiskReward,
  calculateVaR,
  calculateCVaR,
  calculateDrawdown,
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateTradeStats,
  calculateStopLoss,
  calculateTakeProfit,
  PositionSizingMethod,
  PositionSizeResult,
  RiskRewardResult,
  DrawdownResult,
  TradeStats,
} from './calculations';

export interface RiskLimits {
  maxPositionSize: number; // Max % of portfolio per position
  maxDailyLoss: number; // Max daily loss %
  maxDrawdown: number; // Max drawdown % before stopping
  maxOpenPositions: number;
  maxCorrelatedPositions: number;
  minRiskRewardRatio: number;
}

export interface Position {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  size: number;
  stopLoss: number;
  takeProfit: number;
  openedAt: Date;
  unrealizedPnl: number;
}

export interface Trade {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  pnlPercent: number;
  openedAt: Date;
  closedAt: Date;
}

export interface RiskMetrics {
  totalEquity: number;
  availableCapital: number;
  usedMargin: number;
  marginUsagePercent: number;
  unrealizedPnl: number;
  realizedPnl: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  openPositions: number;
  drawdown: DrawdownResult;
  var95: number;
  cvar95: number;
  sharpeRatio: number;
  sortinoRatio: number;
  tradeStats: TradeStats;
}

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  warnings: string[];
  adjustedSize?: number;
}

export class RiskManager {
  private limits: RiskLimits;
  private positions: Map<string, Position> = new Map();
  private trades: Trade[] = [];
  private equityCurve: number[] = [];
  private dailyReturns: number[] = [];
  private initialEquity: number;
  private currentEquity: number;

  constructor(initialEquity: number, limits?: Partial<RiskLimits>) {
    this.initialEquity = initialEquity;
    this.currentEquity = initialEquity;
    this.equityCurve = [initialEquity];

    this.limits = {
      maxPositionSize: 0.1, // 10% max per position
      maxDailyLoss: 0.05, // 5% max daily loss
      maxDrawdown: 0.2, // 20% max drawdown
      maxOpenPositions: 10,
      maxCorrelatedPositions: 3,
      minRiskRewardRatio: 1.5,
      ...limits,
    };
  }

  /**
   * Calculate position size for a new trade
   */
  calculatePosition(
    method: PositionSizingMethod,
    riskPercentage: number = 0.02
  ): PositionSizeResult {
    const stats = calculateTradeStats(this.trades);

    return calculatePositionSize({
      method,
      accountBalance: this.currentEquity,
      riskPercentage,
      winRate: stats.winRate || 0.5,
      avgWin: stats.avgWin || 1,
      avgLoss: stats.avgLoss || 1,
    });
  }

  /**
   * Check if a trade is allowed based on risk limits
   */
  checkTradeRisk(
    symbol: string,
    direction: 'long' | 'short',
    size: number,
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
  ): RiskCheckResult {
    const warnings: string[] = [];
    let adjustedSize = size;

    // Check position count
    if (this.positions.size >= this.limits.maxOpenPositions) {
      return {
        allowed: false,
        reason: `Max open positions (${this.limits.maxOpenPositions}) reached`,
        warnings,
      };
    }

    // Check position size limit
    const positionValue = size * entryPrice;
    const positionPercent = positionValue / this.currentEquity;

    if (positionPercent > this.limits.maxPositionSize) {
      adjustedSize = (this.limits.maxPositionSize * this.currentEquity) / entryPrice;
      warnings.push(
        `Position size reduced from ${size.toFixed(4)} to ${adjustedSize.toFixed(4)} (max ${this.limits.maxPositionSize * 100}%)`
      );
    }

    // Check risk/reward ratio
    const rr = calculateRiskReward({ entryPrice, stopLoss, takeProfit });
    if (rr.riskRewardRatio < this.limits.minRiskRewardRatio) {
      return {
        allowed: false,
        reason: `Risk/reward ratio ${rr.riskRewardRatio.toFixed(2)} below minimum ${this.limits.minRiskRewardRatio}`,
        warnings,
      };
    }

    // Check drawdown limit
    const drawdown = calculateDrawdown(this.equityCurve);
    if (drawdown.currentDrawdownPercent >= this.limits.maxDrawdown) {
      return {
        allowed: false,
        reason: `Current drawdown ${(drawdown.currentDrawdownPercent * 100).toFixed(1)}% exceeds limit ${this.limits.maxDrawdown * 100}%`,
        warnings,
      };
    }

    // Check daily loss limit
    const dailyPnlPercent = this.getDailyPnlPercent();
    if (dailyPnlPercent <= -this.limits.maxDailyLoss) {
      return {
        allowed: false,
        reason: `Daily loss limit (${this.limits.maxDailyLoss * 100}%) reached`,
        warnings,
      };
    }

    // Check duplicate position
    const existingPosition = Array.from(this.positions.values()).find(
      (p) => p.symbol === symbol
    );
    if (existingPosition) {
      warnings.push(`Already have open position in ${symbol}`);
    }

    return {
      allowed: true,
      warnings,
      adjustedSize: adjustedSize !== size ? adjustedSize : undefined,
    };
  }

  /**
   * Open a new position
   */
  openPosition(
    symbol: string,
    direction: 'long' | 'short',
    size: number,
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
  ): Position {
    const id = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const position: Position = {
      id,
      symbol,
      direction,
      entryPrice,
      currentPrice: entryPrice,
      size,
      stopLoss,
      takeProfit,
      openedAt: new Date(),
      unrealizedPnl: 0,
    };

    this.positions.set(id, position);
    return position;
  }

  /**
   * Update position with current price
   */
  updatePosition(id: string, currentPrice: number): Position | null {
    const position = this.positions.get(id);
    if (!position) return null;

    position.currentPrice = currentPrice;

    const priceDiff =
      position.direction === 'long'
        ? currentPrice - position.entryPrice
        : position.entryPrice - currentPrice;

    position.unrealizedPnl = priceDiff * position.size;
    this.positions.set(id, position);

    return position;
  }

  /**
   * Close a position
   */
  closePosition(id: string, exitPrice: number): Trade | null {
    const position = this.positions.get(id);
    if (!position) return null;

    const priceDiff =
      position.direction === 'long'
        ? exitPrice - position.entryPrice
        : position.entryPrice - exitPrice;

    const pnl = priceDiff * position.size;
    const pnlPercent = priceDiff / position.entryPrice;

    const trade: Trade = {
      id: `trade_${Date.now()}`,
      symbol: position.symbol,
      direction: position.direction,
      entryPrice: position.entryPrice,
      exitPrice,
      size: position.size,
      pnl,
      pnlPercent,
      openedAt: position.openedAt,
      closedAt: new Date(),
    };

    this.trades.push(trade);
    this.positions.delete(id);

    // Update equity
    this.currentEquity += pnl;
    this.equityCurve.push(this.currentEquity);

    return trade;
  }

  /**
   * Get all open positions
   */
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get position by ID
   */
  getPosition(id: string): Position | null {
    return this.positions.get(id) || null;
  }

  /**
   * Get trade history
   */
  getTrades(): Trade[] {
    return [...this.trades];
  }

  /**
   * Calculate stop loss for entry
   */
  calculateStopLoss(
    entryPrice: number,
    direction: 'long' | 'short',
    riskPercent: number = 0.02,
    atr?: number
  ): number {
    return calculateStopLoss({
      entryPrice,
      riskPercentage: riskPercent,
      direction,
      atr,
      atrMultiplier: 2,
    });
  }

  /**
   * Calculate take profit for entry
   */
  calculateTakeProfit(
    entryPrice: number,
    stopLoss: number,
    direction: 'long' | 'short',
    riskRewardRatio: number = 2
  ): number {
    return calculateTakeProfit({
      entryPrice,
      stopLoss,
      riskRewardRatio,
      direction,
    });
  }

  /**
   * Get comprehensive risk metrics
   */
  getMetrics(): RiskMetrics {
    const positions = this.getPositions();
    const unrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const usedMargin = positions.reduce(
      (sum, p) => sum + p.size * p.entryPrice,
      0
    );
    const realizedPnl = this.currentEquity - this.initialEquity;
    const dailyPnl = this.getDailyPnl();
    const dailyPnlPercent = this.getDailyPnlPercent();

    const returns = this.calculateReturns();
    const drawdown = calculateDrawdown(this.equityCurve);
    const tradeStats = calculateTradeStats(this.trades);

    return {
      totalEquity: this.currentEquity + unrealizedPnl,
      availableCapital: this.currentEquity - usedMargin,
      usedMargin,
      marginUsagePercent: usedMargin / this.currentEquity,
      unrealizedPnl,
      realizedPnl,
      dailyPnl,
      dailyPnlPercent,
      openPositions: positions.length,
      drawdown,
      var95: calculateVaR(returns, 0.95),
      cvar95: calculateCVaR(returns, 0.95),
      sharpeRatio: calculateSharpeRatio(returns),
      sortinoRatio: calculateSortinoRatio(returns),
      tradeStats,
    };
  }

  /**
   * Get current risk limits
   */
  getLimits(): RiskLimits {
    return { ...this.limits };
  }

  /**
   * Update risk limits
   */
  updateLimits(updates: Partial<RiskLimits>): void {
    this.limits = { ...this.limits, ...updates };
  }

  /**
   * Record daily return (call at end of day)
   */
  recordDailyReturn(): void {
    if (this.equityCurve.length < 2) {
      this.dailyReturns.push(0);
      return;
    }

    const prev = this.equityCurve[this.equityCurve.length - 2];
    const curr = this.equityCurve[this.equityCurve.length - 1];
    const dailyReturn = prev > 0 ? (curr - prev) / prev : 0;

    this.dailyReturns.push(dailyReturn);
  }

  /**
   * Get equity curve
   */
  getEquityCurve(): number[] {
    return [...this.equityCurve];
  }

  private calculateReturns(): number[] {
    if (this.equityCurve.length < 2) return [];

    const returns: number[] = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      const prev = this.equityCurve[i - 1];
      const curr = this.equityCurve[i];
      returns.push(prev > 0 ? (curr - prev) / prev : 0);
    }
    return returns;
  }

  private getDailyPnl(): number {
    // Simplified: sum of today's closed trades
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.trades
      .filter((t) => t.closedAt >= today)
      .reduce((sum, t) => sum + t.pnl, 0);
  }

  private getDailyPnlPercent(): number {
    const dailyPnl = this.getDailyPnl();
    return this.initialEquity > 0 ? dailyPnl / this.initialEquity : 0;
  }
}

export default RiskManager;
