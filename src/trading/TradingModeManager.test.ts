import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TradingModeManager, TradingMode, ModeSwithConfirmation } from './TradingModeManager';

describe('TradingModeManager', () => {
  let modeManager: TradingModeManager;
  let mockLiveExchange: any;
  let mockPaperExchange: any;

  beforeEach(() => {
    mockLiveExchange = {
      createOrder: vi.fn().mockResolvedValue({ id: 'live_order_1', status: 'filled' }),
      getBalances: vi.fn().mockResolvedValue({ USDT: { available: 10000, locked: 0 } }),
      isTestnet: () => false
    };

    mockPaperExchange = {
      createOrder: vi.fn().mockResolvedValue({ id: 'paper_order_1', status: 'filled' }),
      getBalances: vi.fn().mockResolvedValue({ USDT: { available: 100000, locked: 0 } }),
      isTestnet: () => true
    };

    modeManager = new TradingModeManager();
  });

  describe('Default Mode', () => {
    it('should_start_in_paper_mode_by_default', () => {
      expect(modeManager.getCurrentMode('user_1')).toBe(TradingMode.PAPER);
    });

    it('should_return_paper_mode_for_new_users', () => {
      expect(modeManager.getCurrentMode('new_user_123')).toBe(TradingMode.PAPER);
      expect(modeManager.getCurrentMode('another_new_user')).toBe(TradingMode.PAPER);
    });
  });

  describe('Mode Switching', () => {
    it('should_require_explicit_confirmation_to_switch_to_live', async () => {
      await expect(
        modeManager.switchMode('user_1', TradingMode.LIVE)
      ).rejects.toThrow('Confirmation required to switch to live trading');
    });

    it('should_require_password_for_live_mode', async () => {
      await expect(
        modeManager.switchMode('user_1', TradingMode.LIVE, {
          confirmed: true,
          acknowledgement: 'I understand I will be trading with real funds'
          // Missing password
        } as ModeSwithConfirmation)
      ).rejects.toThrow('Password required for live trading');
    });

    it('should_require_acknowledgement_for_live_mode', async () => {
      await expect(
        modeManager.switchMode('user_1', TradingMode.LIVE, {
          confirmed: true,
          password: 'user_password'
          // Missing acknowledgement
        } as ModeSwithConfirmation)
      ).rejects.toThrow('Acknowledgement required for live trading');
    });

    it('should_switch_to_live_with_full_confirmation', async () => {
      // Must configure exchanges first
      modeManager.setExchanges('user_1', {
        live: mockLiveExchange,
        paper: mockPaperExchange
      });

      await modeManager.switchMode('user_1', TradingMode.LIVE, {
        confirmed: true,
        password: 'user_password',
        acknowledgement: 'I understand I will be trading with real funds'
      });

      expect(modeManager.getCurrentMode('user_1')).toBe(TradingMode.LIVE);
    });

    it('should_allow_switch_back_to_paper_without_confirmation', async () => {
      // Must configure exchanges first
      modeManager.setExchanges('user_1', {
        live: mockLiveExchange,
        paper: mockPaperExchange
      });

      // First switch to live
      await modeManager.switchMode('user_1', TradingMode.LIVE, {
        confirmed: true,
        password: 'user_password',
        acknowledgement: 'I understand I will be trading with real funds'
      });

      // Switch back to paper - no confirmation needed
      await modeManager.switchMode('user_1', TradingMode.PAPER);

      expect(modeManager.getCurrentMode('user_1')).toBe(TradingMode.PAPER);
    });

    it('should_maintain_separate_modes_per_user', async () => {
      // Configure exchanges for user_1
      modeManager.setExchanges('user_1', {
        live: mockLiveExchange,
        paper: mockPaperExchange
      });

      await modeManager.switchMode('user_1', TradingMode.LIVE, {
        confirmed: true,
        password: 'password1',
        acknowledgement: 'I understand'
      });

      expect(modeManager.getCurrentMode('user_1')).toBe(TradingMode.LIVE);
      expect(modeManager.getCurrentMode('user_2')).toBe(TradingMode.PAPER);
    });
  });

  describe('Audit Logging', () => {
    beforeEach(() => {
      // Configure exchanges for audit logging tests
      modeManager.setExchanges('user_1', {
        live: mockLiveExchange,
        paper: mockPaperExchange
      });
    });

    it('should_log_mode_switch_to_live', async () => {
      await modeManager.switchMode('user_1', TradingMode.LIVE, {
        confirmed: true,
        password: 'password',
        acknowledgement: 'I understand'
      });

      const logs = modeManager.getAuditLogs('user_1');
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('mode_switched_to_live');
      expect(logs[0].userId).toBe('user_1');
      expect(logs[0].timestamp).toBeDefined();
      expect(logs[0].previousMode).toBe(TradingMode.PAPER);
      expect(logs[0].newMode).toBe(TradingMode.LIVE);
    });

    it('should_log_mode_switch_to_paper', async () => {
      // First switch to live
      await modeManager.switchMode('user_1', TradingMode.LIVE, {
        confirmed: true,
        password: 'password',
        acknowledgement: 'I understand'
      });

      // Then switch back to paper
      await modeManager.switchMode('user_1', TradingMode.PAPER);

      const logs = modeManager.getAuditLogs('user_1');
      const paperLog = logs.find(l => l.action === 'mode_switched_to_paper');
      expect(paperLog).toBeDefined();
      expect(paperLog?.previousMode).toBe(TradingMode.LIVE);
      expect(paperLog?.newMode).toBe(TradingMode.PAPER);
    });

    it('should_not_include_password_in_audit_logs', async () => {
      await modeManager.switchMode('user_1', TradingMode.LIVE, {
        confirmed: true,
        password: 'secret_password_123',
        acknowledgement: 'I understand'
      });

      const logs = modeManager.getAuditLogs('user_1');
      const logString = JSON.stringify(logs);
      expect(logString).not.toContain('secret_password_123');
    });
  });

  describe('Order Routing', () => {
    beforeEach(() => {
      modeManager.setExchanges('user_1', {
        live: mockLiveExchange,
        paper: mockPaperExchange
      });
    });

    it('should_route_to_paper_exchange_in_paper_mode', async () => {
      const order = {
        symbol: 'BTC/USDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 0.1
      };

      await modeManager.createOrder('user_1', order);

      expect(mockPaperExchange.createOrder).toHaveBeenCalledWith(order);
      expect(mockLiveExchange.createOrder).not.toHaveBeenCalled();
    });

    it('should_route_to_live_exchange_in_live_mode', async () => {
      await modeManager.switchMode('user_1', TradingMode.LIVE, {
        confirmed: true,
        password: 'password',
        acknowledgement: 'I understand'
      });

      const order = {
        symbol: 'BTC/USDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 0.1
      };

      await modeManager.createOrder('user_1', order);

      expect(mockLiveExchange.createOrder).toHaveBeenCalledWith(order);
      expect(mockPaperExchange.createOrder).not.toHaveBeenCalled();
    });

    it('should_throw_if_no_exchanges_configured', async () => {
      await expect(
        modeManager.createOrder('user_without_exchanges', {
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'market',
          quantity: 0.1
        })
      ).rejects.toThrow('No exchange configured');
    });

    it('should_get_balances_from_correct_exchange', async () => {
      // Paper mode - should get paper balances
      const paperBalances = await modeManager.getBalances('user_1');
      expect(mockPaperExchange.getBalances).toHaveBeenCalled();
      expect(paperBalances.USDT.available).toBe(100000); // Paper has more

      // Switch to live
      await modeManager.switchMode('user_1', TradingMode.LIVE, {
        confirmed: true,
        password: 'password',
        acknowledgement: 'I understand'
      });

      const liveBalances = await modeManager.getBalances('user_1');
      expect(mockLiveExchange.getBalances).toHaveBeenCalled();
    });
  });

  describe('Safety Checks', () => {
    it('should_prevent_live_trading_without_exchange_connection', async () => {
      // Try to switch to live without setting up exchanges
      await expect(
        modeManager.switchMode('user_no_exchange', TradingMode.LIVE, {
          confirmed: true,
          password: 'password',
          acknowledgement: 'I understand'
        })
      ).rejects.toThrow('Live exchange must be configured before switching to live mode');
    });

    it('should_require_live_exchange_to_be_non_testnet', async () => {
      const testnetExchange = {
        ...mockLiveExchange,
        isTestnet: () => true
      };

      modeManager.setExchanges('user_1', {
        live: testnetExchange,
        paper: mockPaperExchange
      });

      await expect(
        modeManager.switchMode('user_1', TradingMode.LIVE, {
          confirmed: true,
          password: 'password',
          acknowledgement: 'I understand'
        })
      ).rejects.toThrow('Live exchange cannot be a testnet');
    });

    it('should_add_live_mode_warning_to_orders', async () => {
      modeManager.setExchanges('user_1', {
        live: mockLiveExchange,
        paper: mockPaperExchange
      });

      await modeManager.switchMode('user_1', TradingMode.LIVE, {
        confirmed: true,
        password: 'password',
        acknowledgement: 'I understand'
      });

      const order = {
        symbol: 'BTC/USDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 0.1
      };

      const result = await modeManager.createOrder('user_1', order);
      expect(result.isLive).toBe(true);
      expect(result.warning).toContain('REAL FUNDS');
    });
  });

  describe('Mode Status', () => {
    it('should_return_mode_status_with_details', () => {
      const status = modeManager.getModeStatus('user_1');

      expect(status.mode).toBe(TradingMode.PAPER);
      expect(status.isLive).toBe(false);
      expect(status.canSwitchToLive).toBe(false); // No exchange configured
    });

    it('should_indicate_can_switch_to_live_when_exchange_configured', () => {
      modeManager.setExchanges('user_1', {
        live: mockLiveExchange,
        paper: mockPaperExchange
      });

      const status = modeManager.getModeStatus('user_1');
      expect(status.canSwitchToLive).toBe(true);
    });

    it('should_track_time_in_current_mode', async () => {
      const status1 = modeManager.getModeStatus('user_1');
      expect(status1.modeStartedAt).toBeDefined();

      modeManager.setExchanges('user_1', {
        live: mockLiveExchange,
        paper: mockPaperExchange
      });

      await modeManager.switchMode('user_1', TradingMode.LIVE, {
        confirmed: true,
        password: 'password',
        acknowledgement: 'I understand'
      });

      const status2 = modeManager.getModeStatus('user_1');
      expect(status2.modeStartedAt).not.toBe(status1.modeStartedAt);
    });
  });
});
