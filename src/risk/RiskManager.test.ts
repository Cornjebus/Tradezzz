/**
 * RiskManager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RiskManager } from './RiskManager';

describe('RiskManager', () => {
  let manager: RiskManager;

  beforeEach(() => {
    manager = new RiskManager(10000);
  });

  describe('Constructor', () => {
    it('should_initialize_with_equity', () => {
      const metrics = manager.getMetrics();
      expect(metrics.totalEquity).toBe(10000);
    });

    it('should_set_default_limits', () => {
      const limits = manager.getLimits();
      expect(limits.maxPositionSize).toBe(0.1);
      expect(limits.maxDailyLoss).toBe(0.05);
      expect(limits.maxDrawdown).toBe(0.2);
    });

    it('should_accept_custom_limits', () => {
      const custom = new RiskManager(10000, {
        maxPositionSize: 0.05,
        maxDrawdown: 0.15,
      });
      const limits = custom.getLimits();

      expect(limits.maxPositionSize).toBe(0.05);
      expect(limits.maxDrawdown).toBe(0.15);
    });
  });

  describe('calculatePosition', () => {
    it('should_calculate_fixed_percentage', () => {
      const result = manager.calculatePosition('fixed_percentage', 0.02);
      expect(result.positionSize).toBe(200);
    });

    it('should_calculate_kelly_criterion', () => {
      const result = manager.calculatePosition('kelly_criterion');
      expect(result.positionSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkTradeRisk', () => {
    it('should_allow_valid_trade', () => {
      const result = manager.checkTradeRisk(
        'BTC/USDT',
        'long',
        0.01, // Small position (0.01 * 45000 = 450 = 4.5% of 10k)
        45000,
        44000,
        48000
      );

      expect(result.allowed).toBe(true);
      expect(result.warnings.length).toBe(0);
    });

    it('should_reject_low_risk_reward', () => {
      const result = manager.checkTradeRisk(
        'BTC/USDT',
        'long',
        0.1,
        45000,
        44000,
        45500 // Only 1:0.5 RR
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Risk/reward ratio');
    });

    it('should_reduce_oversized_position', () => {
      const result = manager.checkTradeRisk(
        'BTC/USDT',
        'long',
        1, // 1 BTC at 45000 = 45% of 10000 equity
        45000,
        44000,
        48000
      );

      expect(result.allowed).toBe(true);
      expect(result.adjustedSize).toBeDefined();
      expect(result.adjustedSize!).toBeLessThan(1);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should_reject_when_max_positions_reached', () => {
      // Open max positions
      for (let i = 0; i < 10; i++) {
        manager.openPosition(`SYM${i}`, 'long', 0.01, 100, 95, 110);
      }

      const result = manager.checkTradeRisk(
        'NEW/USDT',
        'long',
        0.1,
        100,
        95,
        110
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Max open positions');
    });

    it('should_warn_about_duplicate_symbol', () => {
      manager.openPosition('BTC/USDT', 'long', 0.1, 45000, 44000, 48000);

      const result = manager.checkTradeRisk(
        'BTC/USDT',
        'long',
        0.1,
        45000,
        44000,
        48000
      );

      expect(result.allowed).toBe(true);
      expect(result.warnings.some(w => w.includes('BTC/USDT'))).toBe(true);
    });
  });

  describe('Position Management', () => {
    it('should_open_position', () => {
      const position = manager.openPosition(
        'BTC/USDT',
        'long',
        0.1,
        45000,
        44000,
        48000
      );

      expect(position.id).toBeDefined();
      expect(position.symbol).toBe('BTC/USDT');
      expect(position.direction).toBe('long');
      expect(position.size).toBe(0.1);
    });

    it('should_update_position_price', () => {
      const position = manager.openPosition(
        'BTC/USDT',
        'long',
        0.1,
        45000,
        44000,
        48000
      );

      const updated = manager.updatePosition(position.id, 46000);

      expect(updated?.currentPrice).toBe(46000);
      expect(updated?.unrealizedPnl).toBe(100); // 0.1 * 1000
    });

    it('should_calculate_short_unrealized_pnl', () => {
      const position = manager.openPosition(
        'BTC/USDT',
        'short',
        0.1,
        45000,
        46000,
        42000
      );

      const updated = manager.updatePosition(position.id, 44000);

      expect(updated?.unrealizedPnl).toBe(100); // Profit on short
    });

    it('should_close_position_with_profit', () => {
      const position = manager.openPosition(
        'BTC/USDT',
        'long',
        0.1,
        45000,
        44000,
        48000
      );

      const trade = manager.closePosition(position.id, 48000);

      expect(trade?.pnl).toBe(300); // 0.1 * 3000
      expect(trade?.exitPrice).toBe(48000);
      expect(manager.getPosition(position.id)).toBeNull();
    });

    it('should_close_position_with_loss', () => {
      const position = manager.openPosition(
        'BTC/USDT',
        'long',
        0.1,
        45000,
        44000,
        48000
      );

      const trade = manager.closePosition(position.id, 44000);

      expect(trade?.pnl).toBe(-100); // 0.1 * -1000
    });

    it('should_list_all_positions', () => {
      manager.openPosition('BTC/USDT', 'long', 0.1, 45000, 44000, 48000);
      manager.openPosition('ETH/USDT', 'short', 1, 3000, 3100, 2800);

      const positions = manager.getPositions();
      expect(positions.length).toBe(2);
    });
  });

  describe('Stop Loss & Take Profit', () => {
    it('should_calculate_stop_loss_for_long', () => {
      const stop = manager.calculateStopLoss(100, 'long', 0.02);
      expect(stop).toBe(98);
    });

    it('should_calculate_stop_loss_for_short', () => {
      const stop = manager.calculateStopLoss(100, 'short', 0.02);
      expect(stop).toBe(102);
    });

    it('should_calculate_atr_based_stop', () => {
      const stop = manager.calculateStopLoss(100, 'long', 0.02, 2);
      expect(stop).toBe(96); // 100 - (2 * 2)
    });

    it('should_calculate_take_profit', () => {
      const tp = manager.calculateTakeProfit(100, 95, 'long', 2);
      expect(tp).toBe(110); // Risk 5, reward 10
    });
  });

  describe('Risk Metrics', () => {
    it('should_track_equity_curve', () => {
      manager.openPosition('BTC/USDT', 'long', 0.1, 45000, 44000, 48000);
      manager.closePosition(manager.getPositions()[0].id, 46000);

      const curve = manager.getEquityCurve();
      expect(curve.length).toBe(2);
      expect(curve[1]).toBe(10100); // +100 profit
    });

    it('should_calculate_drawdown', () => {
      // Simulate some trades
      const pos1 = manager.openPosition('A', 'long', 1, 100, 90, 120);
      manager.closePosition(pos1.id, 110); // +10

      const pos2 = manager.openPosition('B', 'long', 1, 100, 90, 120);
      manager.closePosition(pos2.id, 85); // -15

      const metrics = manager.getMetrics();
      expect(metrics.drawdown.maxDrawdown).toBeGreaterThan(0);
    });

    it('should_track_trade_stats', () => {
      // Win
      const pos1 = manager.openPosition('A', 'long', 1, 100, 90, 120);
      manager.closePosition(pos1.id, 110);

      // Loss
      const pos2 = manager.openPosition('B', 'long', 1, 100, 90, 120);
      manager.closePosition(pos2.id, 95);

      const metrics = manager.getMetrics();
      expect(metrics.tradeStats.totalTrades).toBe(2);
      expect(metrics.tradeStats.winningTrades).toBe(1);
      expect(metrics.tradeStats.losingTrades).toBe(1);
    });

    it('should_calculate_unrealized_pnl', () => {
      const pos = manager.openPosition('BTC', 'long', 1, 100, 90, 120);
      manager.updatePosition(pos.id, 105);

      const metrics = manager.getMetrics();
      expect(metrics.unrealizedPnl).toBe(5);
    });

    it('should_calculate_margin_usage', () => {
      manager.openPosition('BTC', 'long', 0.1, 45000, 44000, 48000);

      const metrics = manager.getMetrics();
      expect(metrics.usedMargin).toBe(4500);
      expect(metrics.marginUsagePercent).toBe(0.45);
    });
  });

  describe('Limits Management', () => {
    it('should_update_limits', () => {
      manager.updateLimits({
        maxPositionSize: 0.05,
        minRiskRewardRatio: 2,
      });

      const limits = manager.getLimits();
      expect(limits.maxPositionSize).toBe(0.05);
      expect(limits.minRiskRewardRatio).toBe(2);
    });
  });

  describe('Trade History', () => {
    it('should_return_trade_history', () => {
      const pos1 = manager.openPosition('A', 'long', 1, 100, 90, 120);
      manager.closePosition(pos1.id, 110);

      const pos2 = manager.openPosition('B', 'short', 1, 100, 110, 90);
      manager.closePosition(pos2.id, 95);

      const trades = manager.getTrades();
      expect(trades.length).toBe(2);
      expect(trades[0].pnl).toBe(10);
      expect(trades[1].pnl).toBe(5);
    });
  });
});
