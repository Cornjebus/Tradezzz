/**
 * Risk Management Service for TradeZZZ
 * Handles position sizing, risk limits, and portfolio risk assessment
 */

// ============================================
// TYPES
// ============================================

export interface RiskLimits {
  maxPositionSize: number; // % of portfolio per position (0-100)
  maxDailyLoss: number; // % of portfolio (0-100)
  maxOpenPositions: number; // Max number of concurrent positions
  maxLeverage: number; // Maximum leverage allowed
  stopLossRequired: boolean; // Require stop loss on all positions
  takeProfitRecommended: boolean; // Recommend take profit
  maxDrawdown: number; // % max drawdown before alert (0-100)
}

export interface RiskMetrics {
  currentDrawdown: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  openPositionsCount: number;
  portfolioAtRisk: number; // Value at risk
  riskScore: number; // 0-100, higher = riskier
  warnings: RiskWarning[];
}

export interface RiskWarning {
  type: "position_size" | "daily_loss" | "drawdown" | "leverage" | "concentration";
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: Date;
}

export interface PositionRiskCheck {
  allowed: boolean;
  warnings: RiskWarning[];
  suggestedSize?: number;
  reason?: string;
}

export interface UserRiskProfile {
  userId: string;
  limits: RiskLimits;
  dailyStats: {
    startingBalance: number;
    currentBalance: number;
    tradesCount: number;
    winCount: number;
    lossCount: number;
    largestWin: number;
    largestLoss: number;
    resetAt: Date;
  };
  historicalMetrics: {
    maxDrawdown: number;
    averageDailyReturn: number;
    sharpeRatio: number;
    winRate: number;
    profitFactor: number;
  };
}

// ============================================
// DEFAULT LIMITS
// ============================================

const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionSize: 5, // 5% per position
  maxDailyLoss: 3, // 3% daily loss limit
  maxOpenPositions: 10,
  maxLeverage: 3,
  stopLossRequired: true,
  takeProfitRecommended: true,
  maxDrawdown: 15, // 15% max drawdown
};

const CONSERVATIVE_LIMITS: RiskLimits = {
  maxPositionSize: 2,
  maxDailyLoss: 1,
  maxOpenPositions: 5,
  maxLeverage: 1,
  stopLossRequired: true,
  takeProfitRecommended: true,
  maxDrawdown: 5,
};

const AGGRESSIVE_LIMITS: RiskLimits = {
  maxPositionSize: 10,
  maxDailyLoss: 5,
  maxOpenPositions: 20,
  maxLeverage: 5,
  stopLossRequired: false,
  takeProfitRecommended: false,
  maxDrawdown: 25,
};

export const RISK_PROFILES = {
  conservative: CONSERVATIVE_LIMITS,
  moderate: DEFAULT_RISK_LIMITS,
  aggressive: AGGRESSIVE_LIMITS,
} as const;

export type RiskProfileType = keyof typeof RISK_PROFILES;

// ============================================
// RISK MANAGER CLASS
// ============================================

class RiskManager {
  private userProfiles: Map<string, UserRiskProfile> = new Map();
  private warningHistory: Map<string, RiskWarning[]> = new Map();

  /**
   * Initialize or get user's risk profile
   */
  getUserProfile(userId: string): UserRiskProfile {
    if (!this.userProfiles.has(userId)) {
      const profile: UserRiskProfile = {
        userId,
        limits: { ...DEFAULT_RISK_LIMITS },
        dailyStats: {
          startingBalance: 100000,
          currentBalance: 100000,
          tradesCount: 0,
          winCount: 0,
          lossCount: 0,
          largestWin: 0,
          largestLoss: 0,
          resetAt: this.getStartOfDay(),
        },
        historicalMetrics: {
          maxDrawdown: 0,
          averageDailyReturn: 0,
          sharpeRatio: 0,
          winRate: 0,
          profitFactor: 1,
        },
      };
      this.userProfiles.set(userId, profile);
    }

    const profile = this.userProfiles.get(userId)!;
    this.checkDailyReset(profile);
    return profile;
  }

  /**
   * Update user's risk limits
   */
  updateLimits(userId: string, limits: Partial<RiskLimits>): RiskLimits {
    const profile = this.getUserProfile(userId);
    profile.limits = { ...profile.limits, ...limits };
    return profile.limits;
  }

  /**
   * Apply a preset risk profile
   */
  applyPreset(userId: string, preset: RiskProfileType): RiskLimits {
    const limits = { ...RISK_PROFILES[preset] };
    return this.updateLimits(userId, limits);
  }

  /**
   * Check if a new position is allowed based on risk limits
   */
  checkPosition(
    userId: string,
    positionValue: number,
    portfolioValue: number,
    currentOpenPositions: number,
    leverage: number = 1
  ): PositionRiskCheck {
    const profile = this.getUserProfile(userId);
    const warnings: RiskWarning[] = [];
    let allowed = true;

    // Check position size
    const positionPercent = (positionValue / portfolioValue) * 100;
    if (positionPercent > profile.limits.maxPositionSize) {
      warnings.push({
        type: "position_size",
        severity: "warning",
        message: `Position size ${positionPercent.toFixed(1)}% exceeds limit of ${profile.limits.maxPositionSize}%`,
        timestamp: new Date(),
      });
      allowed = false;
    }

    // Check open positions count
    if (currentOpenPositions >= profile.limits.maxOpenPositions) {
      warnings.push({
        type: "concentration",
        severity: "warning",
        message: `Maximum open positions (${profile.limits.maxOpenPositions}) reached`,
        timestamp: new Date(),
      });
      allowed = false;
    }

    // Check leverage
    if (leverage > profile.limits.maxLeverage) {
      warnings.push({
        type: "leverage",
        severity: "critical",
        message: `Leverage ${leverage}x exceeds limit of ${profile.limits.maxLeverage}x`,
        timestamp: new Date(),
      });
      allowed = false;
    }

    // Check daily loss limit
    const dailyPnLPercent = this.getDailyPnLPercent(profile);
    if (dailyPnLPercent < -profile.limits.maxDailyLoss) {
      warnings.push({
        type: "daily_loss",
        severity: "critical",
        message: `Daily loss ${Math.abs(dailyPnLPercent).toFixed(1)}% exceeds limit of ${profile.limits.maxDailyLoss}%`,
        timestamp: new Date(),
      });
      allowed = false;
    }

    // Calculate suggested size if over limit
    let suggestedSize: number | undefined;
    if (positionPercent > profile.limits.maxPositionSize) {
      suggestedSize = (portfolioValue * profile.limits.maxPositionSize) / 100;
    }

    // Store warnings
    this.addWarnings(userId, warnings);

    return {
      allowed,
      warnings,
      suggestedSize,
      reason: !allowed ? warnings[0]?.message : undefined,
    };
  }

  /**
   * Record a completed trade for risk tracking
   */
  recordTrade(
    userId: string,
    pnl: number,
    currentBalance: number
  ): RiskMetrics {
    const profile = this.getUserProfile(userId);

    // Update daily stats
    profile.dailyStats.tradesCount++;
    profile.dailyStats.currentBalance = currentBalance;

    if (pnl > 0) {
      profile.dailyStats.winCount++;
      if (pnl > profile.dailyStats.largestWin) {
        profile.dailyStats.largestWin = pnl;
      }
    } else {
      profile.dailyStats.lossCount++;
      if (Math.abs(pnl) > Math.abs(profile.dailyStats.largestLoss)) {
        profile.dailyStats.largestLoss = pnl;
      }
    }

    // Update historical metrics
    this.updateHistoricalMetrics(profile);

    return this.getMetrics(userId, currentBalance, 0);
  }

  /**
   * Get current risk metrics for user
   */
  getMetrics(
    userId: string,
    portfolioValue: number,
    openPositionsCount: number
  ): RiskMetrics {
    const profile = this.getUserProfile(userId);
    const warnings: RiskWarning[] = [];

    // Calculate daily PnL
    const dailyPnL = profile.dailyStats.currentBalance - profile.dailyStats.startingBalance;
    const dailyPnLPercent = this.getDailyPnLPercent(profile);

    // Calculate drawdown
    const currentDrawdown = this.calculateDrawdown(profile, portfolioValue);

    // Generate warnings based on current state
    if (dailyPnLPercent < -profile.limits.maxDailyLoss * 0.8) {
      warnings.push({
        type: "daily_loss",
        severity: dailyPnLPercent < -profile.limits.maxDailyLoss ? "critical" : "warning",
        message: `Approaching daily loss limit (${Math.abs(dailyPnLPercent).toFixed(1)}%)`,
        timestamp: new Date(),
      });
    }

    if (currentDrawdown > profile.limits.maxDrawdown * 0.8) {
      warnings.push({
        type: "drawdown",
        severity: currentDrawdown > profile.limits.maxDrawdown ? "critical" : "warning",
        message: `Drawdown at ${currentDrawdown.toFixed(1)}%, limit is ${profile.limits.maxDrawdown}%`,
        timestamp: new Date(),
      });
    }

    // Calculate risk score (0-100)
    const riskScore = this.calculateRiskScore(
      profile,
      dailyPnLPercent,
      currentDrawdown,
      openPositionsCount
    );

    // Portfolio at risk (simple VaR estimate)
    const portfolioAtRisk = portfolioValue * (profile.limits.maxDailyLoss / 100);

    return {
      currentDrawdown,
      dailyPnL,
      dailyPnLPercent,
      openPositionsCount,
      portfolioAtRisk,
      riskScore,
      warnings,
    };
  }

  /**
   * Get risk warnings for user
   */
  getWarnings(userId: string, limit: number = 10): RiskWarning[] {
    const warnings = this.warningHistory.get(userId) || [];
    return warnings.slice(-limit);
  }

  /**
   * Calculate position size based on risk parameters
   */
  calculatePositionSize(
    userId: string,
    portfolioValue: number,
    entryPrice: number,
    stopLoss?: number,
    riskPerTrade?: number
  ): { quantity: number; riskAmount: number; riskPercent: number } {
    const profile = this.getUserProfile(userId);

    // Default risk per trade is 1% of portfolio
    const riskPercent = riskPerTrade ?? 1;
    const riskAmount = portfolioValue * (riskPercent / 100);

    let quantity: number;

    if (stopLoss && stopLoss > 0) {
      // Calculate based on stop loss distance
      const riskPerUnit = Math.abs(entryPrice - stopLoss);
      quantity = riskAmount / riskPerUnit;
    } else {
      // Use max position size limit
      const maxPositionValue = portfolioValue * (profile.limits.maxPositionSize / 100);
      quantity = maxPositionValue / entryPrice;
    }

    return {
      quantity: Math.floor(quantity * 100) / 100, // Round to 2 decimals
      riskAmount,
      riskPercent,
    };
  }

  /**
   * Reset daily stats (called at start of trading day)
   */
  resetDailyStats(userId: string, currentBalance: number): void {
    const profile = this.getUserProfile(userId);
    profile.dailyStats = {
      startingBalance: currentBalance,
      currentBalance: currentBalance,
      tradesCount: 0,
      winCount: 0,
      lossCount: 0,
      largestWin: 0,
      largestLoss: 0,
      resetAt: this.getStartOfDay(),
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private getStartOfDay(): Date {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }

  private checkDailyReset(profile: UserRiskProfile): void {
    const startOfToday = this.getStartOfDay();
    if (profile.dailyStats.resetAt < startOfToday) {
      profile.dailyStats = {
        startingBalance: profile.dailyStats.currentBalance,
        currentBalance: profile.dailyStats.currentBalance,
        tradesCount: 0,
        winCount: 0,
        lossCount: 0,
        largestWin: 0,
        largestLoss: 0,
        resetAt: startOfToday,
      };
    }
  }

  private getDailyPnLPercent(profile: UserRiskProfile): number {
    if (profile.dailyStats.startingBalance === 0) return 0;
    return (
      ((profile.dailyStats.currentBalance - profile.dailyStats.startingBalance) /
        profile.dailyStats.startingBalance) *
      100
    );
  }

  private calculateDrawdown(profile: UserRiskProfile, currentValue: number): number {
    // Simple drawdown from peak (using starting balance as peak for now)
    const peak = Math.max(profile.dailyStats.startingBalance, currentValue);
    if (peak === 0) return 0;
    const drawdown = ((peak - currentValue) / peak) * 100;

    // Update historical max drawdown
    if (drawdown > profile.historicalMetrics.maxDrawdown) {
      profile.historicalMetrics.maxDrawdown = drawdown;
    }

    return Math.max(0, drawdown);
  }

  private calculateRiskScore(
    profile: UserRiskProfile,
    dailyPnLPercent: number,
    currentDrawdown: number,
    openPositions: number
  ): number {
    // Weight different factors
    const dailyLossWeight = 40;
    const drawdownWeight = 30;
    const positionWeight = 20;
    const volatilityWeight = 10;

    // Daily loss score (0-100)
    const dailyLossScore = Math.min(
      100,
      (Math.abs(Math.min(0, dailyPnLPercent)) / profile.limits.maxDailyLoss) * 100
    );

    // Drawdown score (0-100)
    const drawdownScore = Math.min(
      100,
      (currentDrawdown / profile.limits.maxDrawdown) * 100
    );

    // Position concentration score (0-100)
    const positionScore = Math.min(
      100,
      (openPositions / profile.limits.maxOpenPositions) * 100
    );

    // Simple volatility estimate based on trades
    const volatilityScore = Math.min(
      100,
      profile.dailyStats.tradesCount * 5
    );

    return Math.round(
      (dailyLossScore * dailyLossWeight +
        drawdownScore * drawdownWeight +
        positionScore * positionWeight +
        volatilityScore * volatilityWeight) /
        100
    );
  }

  private updateHistoricalMetrics(profile: UserRiskProfile): void {
    const stats = profile.dailyStats;
    const totalTrades = stats.winCount + stats.lossCount;

    if (totalTrades > 0) {
      profile.historicalMetrics.winRate = (stats.winCount / totalTrades) * 100;

      // Profit factor (avoid division by zero)
      const totalWins = Math.abs(stats.largestWin);
      const totalLosses = Math.abs(stats.largestLoss);
      profile.historicalMetrics.profitFactor =
        totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 1;
    }
  }

  private addWarnings(userId: string, warnings: RiskWarning[]): void {
    if (warnings.length === 0) return;

    if (!this.warningHistory.has(userId)) {
      this.warningHistory.set(userId, []);
    }

    const history = this.warningHistory.get(userId)!;
    history.push(...warnings);

    // Keep last 100 warnings
    if (history.length > 100) {
      this.warningHistory.set(userId, history.slice(-100));
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const riskManager = new RiskManager();
