/**
 * TradingModeManager - Phase 10: Paper/Live Trading Isolation
 *
 * Critical safety component that ensures:
 * - Users start in paper mode by default
 * - Explicit confirmation required to switch to live trading
 * - Orders are routed to correct exchange based on mode
 * - Full audit trail of all mode switches
 */

export enum TradingMode {
  PAPER = 'paper',
  LIVE = 'live'
}

export interface ModeSwithConfirmation {
  confirmed: boolean;
  password: string;
  acknowledgement: string;
}

export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
}

export interface OrderResult {
  id: string;
  status: string;
  isLive: boolean;
  warning?: string;
}

export interface ExchangeAdapter {
  createOrder(order: OrderRequest): Promise<{ id: string; status: string }>;
  getBalances(): Promise<Record<string, { available: number; locked: number }>>;
  isTestnet(): boolean;
}

export interface UserExchanges {
  live: ExchangeAdapter;
  paper: ExchangeAdapter;
}

export interface AuditLogEntry {
  userId: string;
  action: string;
  timestamp: Date;
  previousMode: TradingMode;
  newMode: TradingMode;
  metadata?: Record<string, unknown>;
}

export interface ModeStatus {
  mode: TradingMode;
  isLive: boolean;
  canSwitchToLive: boolean;
  modeStartedAt: Date;
}

interface UserModeState {
  mode: TradingMode;
  modeStartedAt: Date;
}

export class TradingModeManager {
  private userModes: Map<string, UserModeState> = new Map();
  private userExchanges: Map<string, UserExchanges> = new Map();
  private auditLogs: Map<string, AuditLogEntry[]> = new Map();

  /**
   * Get current trading mode for a user
   * Defaults to PAPER for new/unknown users
   */
  getCurrentMode(userId: string): TradingMode {
    const state = this.userModes.get(userId);
    return state?.mode ?? TradingMode.PAPER;
  }

  /**
   * Switch trading mode for a user
   * Switching to LIVE requires full confirmation
   * Switching to PAPER is always allowed
   */
  async switchMode(
    userId: string,
    newMode: TradingMode,
    confirmation?: ModeSwithConfirmation
  ): Promise<void> {
    const currentMode = this.getCurrentMode(userId);

    // Switching to LIVE requires confirmation
    if (newMode === TradingMode.LIVE) {
      await this.validateLiveModeSwitch(userId, confirmation);
    }

    // Update mode
    const previousMode = currentMode;
    this.userModes.set(userId, {
      mode: newMode,
      modeStartedAt: new Date()
    });

    // Log the switch
    this.addAuditLog(userId, {
      userId,
      action: `mode_switched_to_${newMode}`,
      timestamp: new Date(),
      previousMode,
      newMode
    });
  }

  /**
   * Validate all requirements for switching to live mode
   */
  private async validateLiveModeSwitch(
    userId: string,
    confirmation?: ModeSwithConfirmation
  ): Promise<void> {
    // Check confirmation object exists
    if (!confirmation) {
      throw new Error('Confirmation required to switch to live trading');
    }

    // Check password
    if (!confirmation.password) {
      throw new Error('Password required for live trading');
    }

    // Check acknowledgement
    if (!confirmation.acknowledgement) {
      throw new Error('Acknowledgement required for live trading');
    }

    // Check exchange is configured
    const exchanges = this.userExchanges.get(userId);
    if (!exchanges?.live) {
      throw new Error('Live exchange must be configured before switching to live mode');
    }

    // Check live exchange is not testnet
    if (exchanges.live.isTestnet()) {
      throw new Error('Live exchange cannot be a testnet');
    }
  }

  /**
   * Configure exchanges for a user
   */
  setExchanges(userId: string, exchanges: UserExchanges): void {
    this.userExchanges.set(userId, exchanges);

    // Initialize user mode state if not exists
    if (!this.userModes.has(userId)) {
      this.userModes.set(userId, {
        mode: TradingMode.PAPER,
        modeStartedAt: new Date()
      });
    }
  }

  /**
   * Create an order - routes to correct exchange based on mode
   */
  async createOrder(userId: string, order: OrderRequest): Promise<OrderResult> {
    const exchanges = this.userExchanges.get(userId);
    if (!exchanges) {
      throw new Error('No exchange configured for user');
    }

    const mode = this.getCurrentMode(userId);
    const exchange = mode === TradingMode.LIVE ? exchanges.live : exchanges.paper;

    const result = await exchange.createOrder(order);

    const isLive = mode === TradingMode.LIVE;
    return {
      id: result.id,
      status: result.status,
      isLive,
      warning: isLive ? '⚠️ This order uses REAL FUNDS' : undefined
    };
  }

  /**
   * Get balances from correct exchange based on mode
   */
  async getBalances(userId: string): Promise<Record<string, { available: number; locked: number }>> {
    const exchanges = this.userExchanges.get(userId);
    if (!exchanges) {
      throw new Error('No exchange configured for user');
    }

    const mode = this.getCurrentMode(userId);
    const exchange = mode === TradingMode.LIVE ? exchanges.live : exchanges.paper;

    return exchange.getBalances();
  }

  /**
   * Get audit logs for a user
   */
  getAuditLogs(userId: string): AuditLogEntry[] {
    return this.auditLogs.get(userId) ?? [];
  }

  /**
   * Add an audit log entry
   */
  private addAuditLog(userId: string, entry: AuditLogEntry): void {
    const logs = this.auditLogs.get(userId) ?? [];
    logs.push(entry);
    this.auditLogs.set(userId, logs);
  }

  /**
   * Get detailed mode status for a user
   */
  getModeStatus(userId: string): ModeStatus {
    const state = this.userModes.get(userId);
    const exchanges = this.userExchanges.get(userId);
    const mode = state?.mode ?? TradingMode.PAPER;

    // Can switch to live if exchange is configured and not testnet
    const canSwitchToLive = !!(
      exchanges?.live &&
      !exchanges.live.isTestnet()
    );

    return {
      mode,
      isLive: mode === TradingMode.LIVE,
      canSwitchToLive,
      modeStartedAt: state?.modeStartedAt ?? new Date()
    };
  }
}
