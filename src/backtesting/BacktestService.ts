/**
 * BacktestService - Backtesting Engine
 * Handles strategy backtesting, performance metrics, and risk analysis
 */

import { v4 as uuidv4 } from 'uuid';
import { StrategyService } from '../strategies/StrategyService';
import { ConfigService } from '../config/ConfigService';
import { StrategyType } from '../database/types';

// ============================================================================
// Types
// ============================================================================

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestConfig {
  strategyId: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  data: OHLCV[];
  slippage?: number; // Percentage
  commission?: number; // Percentage per trade
}

export interface TradeRecord {
  id: string;
  entryTime: number;
  entryPrice: number;
  exitTime?: number;
  exitPrice?: number;
  side: 'long' | 'short';
  quantity: number;
  pnl?: number;
  pnlPercent?: number;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
  drawdown: number;
}

export interface BacktestMetrics {
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  avgTradeDuration: number;
}

export interface BacktestResult {
  id: string;
  strategyId: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  status: 'completed' | 'failed';
  metrics: BacktestMetrics;
  trades: TradeRecord[];
  equityCurve: EquityPoint[];
  createdAt: Date;
}

export interface Signal {
  timestamp: number;
  type: 'entry' | 'exit';
  side: 'long' | 'short';
  price: number;
  strength?: number;
}

export interface RiskAnalysis {
  valueAtRisk95: number;
  valueAtRisk99: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxConsecutiveLosses: number;
  avgDrawdownDuration: number;
}

export interface BacktestComparison {
  backtestId: string;
  strategyName: string;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}

export interface BacktestServiceOptions {
  db: any;
  configService: ConfigService;
  strategyService: StrategyService;
}

// ============================================================================
// Tier Limits
// ============================================================================

const TIER_BACKTEST_LIMITS: Record<string, number> = {
  free: 30, // 30 days max
  pro: 365, // 1 year
  elite: 1095, // 3 years
  institutional: -1, // Unlimited
};

// ============================================================================
// BacktestService Implementation
// ============================================================================

export class BacktestService {
  private db: any;
  private configService: ConfigService;
  private strategyService: StrategyService;
  private backtestResults: Map<string, BacktestResult[]> = new Map();

  constructor(options: BacktestServiceOptions) {
    this.db = options.db;
    this.configService = options.configService;
    this.strategyService = options.strategyService;
  }

  // ============================================================================
  // Main Backtest Execution
  // ============================================================================

  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    // Validate inputs
    await this.validateBacktestConfig(config);

    // Get strategy
    const strategy = await this.strategyService.getStrategy(config.strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    // Check tier limits
    await this.checkTierLimits(strategy.userId, config);

    // Run backtest simulation
    const result = await this.executeBacktest(config, strategy);

    // Persist and cache result
    await this.saveResult(strategy.userId, result);

    return result;
  }

  private async validateBacktestConfig(config: BacktestConfig): Promise<void> {
    if (config.endDate <= config.startDate) {
      throw new Error('End date must be after start date');
    }

    if (config.initialCapital <= 0) {
      throw new Error('Initial capital must be positive');
    }

    if (!config.data || config.data.length === 0) {
      throw new Error('No data provided for backtest');
    }
  }

  private async checkTierLimits(userId: string, config: BacktestConfig): Promise<void> {
    const user = await this.db.users.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const maxDays = TIER_BACKTEST_LIMITS[user.tier];
    if (maxDays === -1) return; // Unlimited

    const daysDiff = Math.ceil(
      (config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff > maxDays) {
      throw new Error(`Backtest period exceeds ${user.tier} tier limit of ${maxDays} days`);
    }
  }

  private async executeBacktest(config: BacktestConfig, strategy: any): Promise<BacktestResult> {
    const slippage = config.slippage ?? 0.1; // 0.1% default
    const commission = config.commission ?? 0.1; // 0.1% default

    // Generate signals based on strategy type
    const signals = this.generateSignals(strategy.type, config.data, strategy.config);

    // Simulate trades
    const { trades, equityCurve } = this.simulateTrades(
      config.data,
      signals,
      config.initialCapital,
      slippage,
      commission
    );

    // Calculate metrics
    const metrics = this.calculateMetrics(trades, equityCurve, config.initialCapital);

    return {
      id: uuidv4(),
      strategyId: config.strategyId,
      symbol: config.symbol,
      startDate: config.startDate,
      endDate: config.endDate,
      status: 'completed',
      metrics,
      trades,
      equityCurve,
      createdAt: new Date(),
    };
  }

  // ============================================================================
  // Signal Generation
  // ============================================================================

  generateSignals(type: StrategyType, data: OHLCV[], config: Record<string, any>): Signal[] {
    switch (type) {
      case 'momentum':
        return this.generateMomentumSignals(data, config);
      case 'mean_reversion':
        return this.generateMeanReversionSignals(data, config);
      case 'trend_following':
        return this.generateTrendFollowingSignals(data, config);
      default:
        return this.generateMomentumSignals(data, config);
    }
  }

  private generateMomentumSignals(data: OHLCV[], config: Record<string, any>): Signal[] {
    const signals: Signal[] = [];
    const lookback = config.lookbackPeriod || 14;
    const entryThreshold = config.entryThreshold || 0.02;
    const exitThreshold = config.exitThreshold || -0.01;

    let inPosition = false;
    let positionSide: 'long' | 'short' = 'long';

    for (let i = lookback; i < data.length; i++) {
      const returns = (data[i].close - data[i - lookback].close) / data[i - lookback].close;

      if (!inPosition) {
        if (returns > entryThreshold) {
          signals.push({
            timestamp: data[i].timestamp,
            type: 'entry',
            side: 'long',
            price: data[i].close,
            strength: returns,
          });
          inPosition = true;
          positionSide = 'long';
        } else if (returns < -entryThreshold) {
          signals.push({
            timestamp: data[i].timestamp,
            type: 'entry',
            side: 'short',
            price: data[i].close,
            strength: Math.abs(returns),
          });
          inPosition = true;
          positionSide = 'short';
        }
      } else {
        const shouldExit = positionSide === 'long'
          ? returns < exitThreshold
          : returns > -exitThreshold;

        if (shouldExit) {
          signals.push({
            timestamp: data[i].timestamp,
            type: 'exit',
            side: positionSide,
            price: data[i].close,
          });
          inPosition = false;
        }
      }
    }

    return signals;
  }

  private generateMeanReversionSignals(data: OHLCV[], config: Record<string, any>): Signal[] {
    const signals: Signal[] = [];
    const period = config.bollingerPeriod || 20;
    const stdDev = config.bollingerStdDev || 2;

    let inPosition = false;
    let positionSide: 'long' | 'short' = 'long';

    for (let i = period; i < data.length; i++) {
      const slice = data.slice(i - period, i);
      const closes = slice.map(d => d.close);
      const sma = closes.reduce((a, b) => a + b, 0) / period;
      const variance = closes.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
      const std = Math.sqrt(variance);

      const upperBand = sma + stdDev * std;
      const lowerBand = sma - stdDev * std;
      const currentPrice = data[i].close;

      if (!inPosition) {
        if (currentPrice < lowerBand) {
          signals.push({
            timestamp: data[i].timestamp,
            type: 'entry',
            side: 'long',
            price: currentPrice,
          });
          inPosition = true;
          positionSide = 'long';
        } else if (currentPrice > upperBand) {
          signals.push({
            timestamp: data[i].timestamp,
            type: 'entry',
            side: 'short',
            price: currentPrice,
          });
          inPosition = true;
          positionSide = 'short';
        }
      } else {
        if ((positionSide === 'long' && currentPrice > sma) ||
            (positionSide === 'short' && currentPrice < sma)) {
          signals.push({
            timestamp: data[i].timestamp,
            type: 'exit',
            side: positionSide,
            price: currentPrice,
          });
          inPosition = false;
        }
      }
    }

    return signals;
  }

  private generateTrendFollowingSignals(data: OHLCV[], config: Record<string, any>): Signal[] {
    const signals: Signal[] = [];
    const fastPeriod = config.fastMaPeriod || 10;
    const slowPeriod = config.slowMaPeriod || 50;

    let inPosition = false;
    let positionSide: 'long' | 'short' = 'long';
    let prevFastMa = 0;
    let prevSlowMa = 0;

    for (let i = slowPeriod; i < data.length; i++) {
      const fastSlice = data.slice(i - fastPeriod, i);
      const slowSlice = data.slice(i - slowPeriod, i);

      const fastMa = fastSlice.reduce((a, b) => a + b.close, 0) / fastPeriod;
      const slowMa = slowSlice.reduce((a, b) => a + b.close, 0) / slowPeriod;

      if (prevFastMa > 0 && prevSlowMa > 0) {
        const crossedUp = prevFastMa <= prevSlowMa && fastMa > slowMa;
        const crossedDown = prevFastMa >= prevSlowMa && fastMa < slowMa;

        if (!inPosition) {
          if (crossedUp) {
            signals.push({
              timestamp: data[i].timestamp,
              type: 'entry',
              side: 'long',
              price: data[i].close,
            });
            inPosition = true;
            positionSide = 'long';
          } else if (crossedDown) {
            signals.push({
              timestamp: data[i].timestamp,
              type: 'entry',
              side: 'short',
              price: data[i].close,
            });
            inPosition = true;
            positionSide = 'short';
          }
        } else {
          if ((positionSide === 'long' && crossedDown) ||
              (positionSide === 'short' && crossedUp)) {
            signals.push({
              timestamp: data[i].timestamp,
              type: 'exit',
              side: positionSide,
              price: data[i].close,
            });
            inPosition = false;
          }
        }
      }

      prevFastMa = fastMa;
      prevSlowMa = slowMa;
    }

    return signals;
  }

  // ============================================================================
  // Trade Simulation
  // ============================================================================

  private simulateTrades(
    data: OHLCV[],
    signals: Signal[],
    initialCapital: number,
    slippage: number,
    commission: number
  ): { trades: TradeRecord[]; equityCurve: EquityPoint[] } {
    const trades: TradeRecord[] = [];
    const equityCurve: EquityPoint[] = [];

    let capital = initialCapital;
    let position: TradeRecord | null = null;
    let peakEquity = initialCapital;

    // Initialize equity curve with starting point
    equityCurve.push({
      timestamp: data[0]?.timestamp || 0,
      equity: capital,
      drawdown: 0,
    });

    for (const signal of signals) {
      if (signal.type === 'entry' && !position) {
        // Apply slippage to entry
        const entryPrice = signal.side === 'long'
          ? signal.price * (1 + slippage / 100)
          : signal.price * (1 - slippage / 100);

        // Calculate position size (use 95% of capital to account for commission)
        const positionValue = capital * 0.95;
        const quantity = positionValue / entryPrice;

        // Apply commission
        capital -= positionValue * (commission / 100);

        position = {
          id: uuidv4(),
          entryTime: signal.timestamp,
          entryPrice,
          side: signal.side,
          quantity,
        };
      } else if (signal.type === 'exit' && position) {
        // Apply slippage to exit
        const exitPrice = position.side === 'long'
          ? signal.price * (1 - slippage / 100)
          : signal.price * (1 + slippage / 100);

        // Calculate P&L
        const pnl = position.side === 'long'
          ? (exitPrice - position.entryPrice) * position.quantity
          : (position.entryPrice - exitPrice) * position.quantity;

        // Apply commission
        const commissionCost = position.quantity * exitPrice * (commission / 100);
        capital += position.quantity * exitPrice - commissionCost;

        // Complete trade record
        const completedTrade: TradeRecord = {
          ...position,
          exitTime: signal.timestamp,
          exitPrice,
          pnl: pnl - commissionCost,
          pnlPercent: ((pnl - commissionCost) / (position.entryPrice * position.quantity)) * 100,
        };

        trades.push(completedTrade);
        position = null;

        // Update equity curve
        peakEquity = Math.max(peakEquity, capital);
        const drawdown = ((peakEquity - capital) / peakEquity) * 100;

        equityCurve.push({
          timestamp: signal.timestamp,
          equity: capital,
          drawdown,
        });
      }
    }

    return { trades, equityCurve };
  }

  // ============================================================================
  // Metrics Calculation
  // ============================================================================

  private calculateMetrics(
    trades: TradeRecord[],
    equityCurve: EquityPoint[],
    initialCapital: number
  ): BacktestMetrics {
    const finalCapital = equityCurve.length > 0
      ? equityCurve[equityCurve.length - 1].equity
      : initialCapital;

    const completedTrades = trades.filter(t => t.exitTime !== undefined);
    const winningTrades = completedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = completedTrades.filter(t => (t.pnl || 0) <= 0);

    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));

    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

    const maxDrawdown = equityCurve.reduce((max, point) => Math.max(max, point.drawdown), 0);

    // Calculate Sharpe Ratio (simplified)
    const returns = equityCurve.map((point, i) => {
      if (i === 0) return 0;
      return (point.equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity;
    }).slice(1);

    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdReturn = returns.length > 0
      ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length)
      : 0;

    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

    // Calculate average trade duration
    const avgTradeDuration = completedTrades.length > 0
      ? completedTrades.reduce((sum, t) => sum + ((t.exitTime || 0) - t.entryTime), 0) / completedTrades.length
      : 0;

    return {
      initialCapital,
      finalCapital,
      totalReturn: ((finalCapital - initialCapital) / initialCapital) * 100,
      totalTrades: completedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0,
      avgWin,
      avgLoss,
      maxDrawdown,
      sharpeRatio,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
      avgTradeDuration,
    };
  }

  // ============================================================================
  // History & Comparison
  // ============================================================================

  private async saveResult(userId: string, result: BacktestResult): Promise<void> {
    // Persist to DB if a backtest repository is available
    const repo = this.db?.backtests;
    if (repo && typeof repo.create === 'function' && typeof repo.update === 'function') {
      try {
        const created = await repo.create({
          userId,
          strategyId: result.strategyId,
          symbol: result.symbol,
          startDate: result.startDate,
          endDate: result.endDate,
          initialCapital: result.metrics.initialCapital,
        });

        await repo.update(created.id, {
          status: 'completed',
          finalCapital: result.metrics.finalCapital,
          metrics: result.metrics,
          trades: result.trades,
          equityCurve: result.equityCurve.map(point => point.equity),
          completedAt: result.endDate,
        });
      } catch {
        // If persistence fails, continue with in-memory storage only
      }
    }

    this.storeResult(result.strategyId, result);
  }

  private storeResult(strategyId: string, result: BacktestResult): void {
    const existing = this.backtestResults.get(strategyId) || [];
    existing.push(result);
    this.backtestResults.set(strategyId, existing);
  }

  async getBacktestHistory(strategyId: string): Promise<BacktestResult[]> {
    return this.backtestResults.get(strategyId) || [];
  }

  compareBacktests(results: BacktestResult[]): BacktestComparison[] {
    return results.map(result => ({
      backtestId: result.id,
      strategyName: result.strategyId, // Would resolve to actual name in production
      totalReturn: result.metrics.totalReturn,
      sharpeRatio: result.metrics.sharpeRatio,
      maxDrawdown: result.metrics.maxDrawdown,
      winRate: result.metrics.winRate,
    }));
  }

  // ============================================================================
  // Risk Analysis
  // ============================================================================

  analyzeRisk(result: BacktestResult): RiskAnalysis {
    const returns = result.equityCurve.map((point, i) => {
      if (i === 0) return 0;
      return (point.equity - result.equityCurve[i - 1].equity) / result.equityCurve[i - 1].equity;
    }).slice(1);

    // Sort returns for VaR calculation
    const sortedReturns = [...returns].sort((a, b) => a - b);

    // VaR (Value at Risk)
    const var95Index = Math.floor(sortedReturns.length * 0.05);
    const var99Index = Math.floor(sortedReturns.length * 0.01);

    const valueAtRisk95 = sortedReturns[var95Index] || 0;
    const valueAtRisk99 = sortedReturns[var99Index] || 0;

    // Sortino Ratio (downside deviation only)
    const negativeReturns = returns.filter(r => r < 0);
    const downsideDeviation = negativeReturns.length > 0
      ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + r * r, 0) / negativeReturns.length)
      : 0;

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length || 0;
    const sortinoRatio = downsideDeviation > 0 ? (avgReturn / downsideDeviation) * Math.sqrt(252) : 0;

    // Calmar Ratio
    const annualizedReturn = result.metrics.totalReturn; // Simplified
    const calmarRatio = result.metrics.maxDrawdown > 0
      ? annualizedReturn / result.metrics.maxDrawdown
      : 0;

    // Max consecutive losses
    let maxConsecutiveLosses = 0;
    let currentStreak = 0;
    for (const trade of result.trades) {
      if ((trade.pnl || 0) < 0) {
        currentStreak++;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return {
      valueAtRisk95: valueAtRisk95 * 100,
      valueAtRisk99: valueAtRisk99 * 100,
      sortinoRatio,
      calmarRatio,
      maxConsecutiveLosses,
      avgDrawdownDuration: 0, // Would need more complex calculation
    };
  }
}
