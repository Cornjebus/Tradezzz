/**
 * Risk Calculation Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePositionSize,
  calculateKellyFraction,
  calculateRiskReward,
  calculateVaR,
  calculateCVaR,
  calculateDrawdown,
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateTradeStats,
  calculateCorrelation,
  calculateBeta,
  calculateStopLoss,
  calculateTakeProfit,
} from './calculations';

describe('Risk Calculations', () => {
  describe('calculatePositionSize', () => {
    it('should_calculate_fixed_percentage_position', () => {
      const result = calculatePositionSize({
        method: 'fixed_percentage',
        accountBalance: 10000,
        riskPercentage: 0.02,
      });

      expect(result.positionSize).toBe(200);
      expect(result.riskAmount).toBe(200);
      expect(result.riskPercentage).toBe(0.02);
    });

    it('should_calculate_kelly_position', () => {
      const result = calculatePositionSize({
        method: 'kelly_criterion',
        accountBalance: 10000,
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
      });

      // Kelly = (2*0.6 - 0.4) / 2 = 0.4, half-Kelly = 0.2
      expect(result.positionSize).toBeGreaterThan(0);
      expect(result.riskPercentage).toBeLessThanOrEqual(0.25);
    });

    it('should_cap_kelly_at_25_percent', () => {
      const result = calculatePositionSize({
        method: 'kelly_criterion',
        accountBalance: 10000,
        winRate: 0.9,
        avgWin: 200,
        avgLoss: 10,
      });

      expect(result.riskPercentage).toBeLessThanOrEqual(0.25);
    });

    it('should_calculate_fixed_amount_position', () => {
      const result = calculatePositionSize({
        method: 'fixed_amount',
        accountBalance: 10000,
        fixedAmount: 500,
      });

      expect(result.positionSize).toBe(500);
    });

    it('should_cap_fixed_amount_at_10_percent', () => {
      const result = calculatePositionSize({
        method: 'fixed_amount',
        accountBalance: 10000,
        fixedAmount: 5000,
      });

      expect(result.positionSize).toBe(1000);
    });

    it('should_calculate_volatility_adjusted_position', () => {
      const result = calculatePositionSize({
        method: 'volatility_adjusted',
        accountBalance: 10000,
        riskPercentage: 0.02,
        volatility: 0.02,
        avgVolatility: 0.04,
      });

      // Higher avg vol / current vol = larger position
      expect(result.positionSize).toBe(400); // 0.02 * 10000 * 2
    });
  });

  describe('calculateKellyFraction', () => {
    it('should_calculate_positive_kelly_for_winning_system', () => {
      const kelly = calculateKellyFraction(0.6, 100, 50);
      expect(kelly).toBeGreaterThan(0);
    });

    it('should_return_zero_for_losing_system', () => {
      const kelly = calculateKellyFraction(0.3, 50, 100);
      expect(kelly).toBe(0);
    });

    it('should_return_zero_for_invalid_inputs', () => {
      expect(calculateKellyFraction(0.5, 100, 0)).toBe(0);
      expect(calculateKellyFraction(-0.1, 100, 50)).toBe(0);
      expect(calculateKellyFraction(1.1, 100, 50)).toBe(0);
    });
  });

  describe('calculateRiskReward', () => {
    it('should_calculate_long_trade_risk_reward', () => {
      const result = calculateRiskReward({
        entryPrice: 100,
        stopLoss: 95,
        takeProfit: 115,
      });

      expect(result.riskAmount).toBe(5);
      expect(result.rewardAmount).toBe(15);
      expect(result.riskRewardRatio).toBe(3);
    });

    it('should_calculate_short_trade_risk_reward', () => {
      const result = calculateRiskReward({
        entryPrice: 100,
        stopLoss: 105,
        takeProfit: 85,
      });

      expect(result.riskAmount).toBe(5);
      expect(result.rewardAmount).toBe(15);
      expect(result.riskRewardRatio).toBe(3);
    });

    it('should_calculate_break_even_win_rate', () => {
      const result = calculateRiskReward({
        entryPrice: 100,
        stopLoss: 95,
        takeProfit: 110,
      });

      // RR = 2:1, breakeven = 1/(1+2) = 0.333
      expect(result.breakEvenWinRate).toBeCloseTo(0.333, 2);
    });
  });

  describe('calculateVaR', () => {
    it('should_calculate_95_percent_var', () => {
      const returns = [-0.05, -0.03, -0.01, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08];
      const var95 = calculateVaR(returns, 0.95);

      expect(var95).toBeGreaterThan(0);
      expect(var95).toBeLessThanOrEqual(0.05);
    });

    it('should_return_zero_for_empty_array', () => {
      expect(calculateVaR([], 0.95)).toBe(0);
    });

    it('should_handle_all_positive_returns', () => {
      const returns = [0.01, 0.02, 0.03, 0.04, 0.05];
      const var95 = calculateVaR(returns, 0.95);

      expect(var95).toBeLessThanOrEqual(0);
    });
  });

  describe('calculateCVaR', () => {
    it('should_be_greater_than_or_equal_to_var', () => {
      const returns = [-0.1, -0.05, -0.03, -0.01, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06];
      const var95 = calculateVaR(returns, 0.95);
      const cvar95 = calculateCVaR(returns, 0.95);

      expect(cvar95).toBeGreaterThanOrEqual(var95);
    });
  });

  describe('calculateDrawdown', () => {
    it('should_calculate_max_drawdown', () => {
      const equity = [100, 110, 105, 90, 95, 100, 80, 90, 100];
      const result = calculateDrawdown(equity);

      // Max DD: 110 -> 80 = 30 (27.27%)
      expect(result.maxDrawdown).toBe(30);
      expect(result.maxDrawdownPercent).toBeCloseTo(0.2727, 3);
    });

    it('should_track_peak_and_trough', () => {
      const equity = [100, 120, 100, 80, 90];
      const result = calculateDrawdown(equity);

      expect(result.peakValue).toBe(120);
      expect(result.troughValue).toBe(80);
    });

    it('should_calculate_current_drawdown', () => {
      const equity = [100, 120, 110];
      const result = calculateDrawdown(equity);

      expect(result.currentDrawdown).toBe(10);
      expect(result.currentDrawdownPercent).toBeCloseTo(0.0833, 3);
    });

    it('should_handle_empty_array', () => {
      const result = calculateDrawdown([]);
      expect(result.maxDrawdown).toBe(0);
    });
  });

  describe('calculateSharpeRatio', () => {
    it('should_calculate_positive_sharpe', () => {
      const returns = Array(252).fill(0.001); // 0.1% daily = ~25% annually
      const sharpe = calculateSharpeRatio(returns, 0.02);

      expect(sharpe).toBeGreaterThan(1);
    });

    it('should_calculate_negative_sharpe_for_poor_returns', () => {
      const returns = Array(252).fill(-0.001);
      const sharpe = calculateSharpeRatio(returns, 0.02);

      expect(sharpe).toBeLessThan(0);
    });

    it('should_return_zero_for_insufficient_data', () => {
      expect(calculateSharpeRatio([0.01])).toBe(0);
      expect(calculateSharpeRatio([])).toBe(0);
    });
  });

  describe('calculateSortinoRatio', () => {
    it('should_be_higher_than_sharpe_for_asymmetric_returns', () => {
      const returns = [0.02, 0.03, 0.01, -0.01, 0.02, 0.04, 0.01, -0.005];
      const sharpe = calculateSharpeRatio(returns, 0, 1);
      const sortino = calculateSortinoRatio(returns, 0, 1);

      // Sortino should be higher when positive returns dominate
      expect(sortino).toBeGreaterThan(sharpe);
    });

    it('should_return_infinity_for_no_negative_returns', () => {
      const returns = [0.01, 0.02, 0.03];
      const sortino = calculateSortinoRatio(returns, 0, 1);

      expect(sortino).toBe(Infinity);
    });
  });

  describe('calculateTradeStats', () => {
    it('should_calculate_win_rate', () => {
      const trades = [
        { pnl: 100 },
        { pnl: -50 },
        { pnl: 150 },
        { pnl: -30 },
        { pnl: 80 },
      ];
      const stats = calculateTradeStats(trades);

      expect(stats.winRate).toBe(0.6);
      expect(stats.winningTrades).toBe(3);
      expect(stats.losingTrades).toBe(2);
    });

    it('should_calculate_profit_factor', () => {
      const trades = [
        { pnl: 100 },
        { pnl: -50 },
        { pnl: 200 },
      ];
      const stats = calculateTradeStats(trades);

      expect(stats.profitFactor).toBe(6); // 300/50
    });

    it('should_calculate_expectancy', () => {
      const trades = [
        { pnl: 100 },
        { pnl: -50 },
        { pnl: 100 },
        { pnl: -50 },
      ];
      const stats = calculateTradeStats(trades);

      // WinRate=0.5, AvgWin=100, AvgLoss=50
      // Expectancy = 0.5*100 - 0.5*50 = 25
      expect(stats.expectancy).toBe(25);
    });

    it('should_handle_empty_trades', () => {
      const stats = calculateTradeStats([]);
      expect(stats.totalTrades).toBe(0);
      expect(stats.winRate).toBe(0);
    });
  });

  describe('calculateCorrelation', () => {
    it('should_return_1_for_perfectly_correlated', () => {
      const returns1 = [0.01, 0.02, 0.03, 0.04, 0.05];
      const returns2 = [0.01, 0.02, 0.03, 0.04, 0.05];
      const corr = calculateCorrelation(returns1, returns2);

      expect(corr).toBeCloseTo(1, 5);
    });

    it('should_return_negative_1_for_inverse_correlation', () => {
      const returns1 = [0.01, 0.02, 0.03, 0.04, 0.05];
      const returns2 = [-0.01, -0.02, -0.03, -0.04, -0.05];
      const corr = calculateCorrelation(returns1, returns2);

      expect(corr).toBeCloseTo(-1, 5);
    });

    it('should_handle_mismatched_lengths', () => {
      const returns1 = [0.01, 0.02, 0.03];
      const returns2 = [0.01, 0.02];
      const corr = calculateCorrelation(returns1, returns2);

      expect(corr).toBeDefined();
    });
  });

  describe('calculateBeta', () => {
    it('should_return_1_for_market_matching_returns', () => {
      const asset = [0.01, 0.02, -0.01, 0.03, -0.02];
      const market = [0.01, 0.02, -0.01, 0.03, -0.02];
      const beta = calculateBeta(asset, market);

      expect(beta).toBeCloseTo(1, 5);
    });

    it('should_return_2_for_double_volatility', () => {
      const asset = [0.02, 0.04, -0.02, 0.06, -0.04];
      const market = [0.01, 0.02, -0.01, 0.03, -0.02];
      const beta = calculateBeta(asset, market);

      expect(beta).toBeCloseTo(2, 5);
    });
  });

  describe('calculateStopLoss', () => {
    it('should_calculate_percentage_stop_for_long', () => {
      const stop = calculateStopLoss({
        entryPrice: 100,
        riskPercentage: 0.02,
        direction: 'long',
      });

      expect(stop).toBe(98);
    });

    it('should_calculate_percentage_stop_for_short', () => {
      const stop = calculateStopLoss({
        entryPrice: 100,
        riskPercentage: 0.02,
        direction: 'short',
      });

      expect(stop).toBe(102);
    });

    it('should_calculate_atr_stop_for_long', () => {
      const stop = calculateStopLoss({
        entryPrice: 100,
        riskPercentage: 0.02,
        direction: 'long',
        atr: 2,
        atrMultiplier: 2,
      });

      expect(stop).toBe(96);
    });

    it('should_calculate_atr_stop_for_short', () => {
      const stop = calculateStopLoss({
        entryPrice: 100,
        riskPercentage: 0.02,
        direction: 'short',
        atr: 2,
        atrMultiplier: 2,
      });

      expect(stop).toBe(104);
    });
  });

  describe('calculateTakeProfit', () => {
    it('should_calculate_take_profit_for_long', () => {
      const tp = calculateTakeProfit({
        entryPrice: 100,
        stopLoss: 95,
        riskRewardRatio: 2,
        direction: 'long',
      });

      expect(tp).toBe(110);
    });

    it('should_calculate_take_profit_for_short', () => {
      const tp = calculateTakeProfit({
        entryPrice: 100,
        stopLoss: 105,
        riskRewardRatio: 2,
        direction: 'short',
      });

      expect(tp).toBe(90);
    });

    it('should_handle_3_to_1_risk_reward', () => {
      const tp = calculateTakeProfit({
        entryPrice: 100,
        stopLoss: 98,
        riskRewardRatio: 3,
        direction: 'long',
      });

      expect(tp).toBe(106);
    });
  });
});
