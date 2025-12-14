/**
 * StrategyService - Strategy Management and Execution
 * Handles strategy creation, validation, status management, and statistics
 */

import { Strategy, StrategyType, StrategyStatus, CreateStrategyInput } from '../database/types';
import { ConfigService } from '../config/ConfigService';

// ============================================================================
// Types
// ============================================================================

export interface CreateStrategyParams {
  userId: string;
  name: string;
  description?: string;
  type: StrategyType;
  config: Record<string, any>;
}

export interface UpdateStrategyParams {
  name?: string;
  description?: string;
  config?: Record<string, any>;
  type?: StrategyType; // Not allowed but typed for validation
}

export interface StrategyFilters {
  status?: StrategyStatus;
  type?: StrategyType;
}

export interface StrategyStats {
  totalTrades: number;
  winRate: number;
  profitLoss: number;
  avgTradeSize: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export interface StrategyServiceOptions {
  db: any;
  configService: ConfigService;
}

// ============================================================================
// Valid Transitions State Machine
// ============================================================================

const VALID_TRANSITIONS: Record<StrategyStatus, StrategyStatus[]> = {
  draft: ['backtesting', 'archived'],
  backtesting: ['draft', 'paper', 'archived'],
  paper: ['backtesting', 'active', 'paused', 'archived'],
  active: ['paused', 'archived'],
  paused: ['active', 'paper', 'archived'],
  archived: [], // Terminal state
};

// ============================================================================
// Valid Timeframes
// ============================================================================

const VALID_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '1w', '1M'];

// ============================================================================
// StrategyService Implementation
// ============================================================================

export class StrategyService {
  private db: any;
  private configService: ConfigService;

  constructor(options: StrategyServiceOptions) {
    this.db = options.db;
    this.configService = options.configService;
  }

  // ============================================================================
  // Strategy Creation
  // ============================================================================

  async createStrategy(params: CreateStrategyParams): Promise<Strategy> {
    // Validate name
    if (!params.name || params.name.trim() === '') {
      throw new Error('Strategy name is required');
    }

    // Validate type
    const validTypes: StrategyType[] = ['momentum', 'mean_reversion', 'sentiment', 'arbitrage', 'trend_following', 'custom'];
    if (!validTypes.includes(params.type)) {
      throw new Error('Invalid strategy type');
    }

    // Check tier limits
    const user = await this.db.users.findById(params.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const tierFeatures = this.configService.getTierFeatures(user.tier);
    const existingStrategies = await this.db.strategies.findByUserId(params.userId);

    if (tierFeatures.maxStrategies !== -1 && existingStrategies.length >= tierFeatures.maxStrategies) {
      throw new Error(`Strategy limit reached for ${user.tier} tier`);
    }

    // Validate config
    const validatedConfig = this.validateConfig(params.type, params.config);

    // Apply default risk parameters
    const configWithDefaults = this.applyDefaultRiskParams(validatedConfig);

    // Create strategy
    const strategy = await this.db.strategies.create({
      userId: params.userId,
      name: params.name.trim(),
      description: params.description,
      type: params.type,
      config: configWithDefaults,
      status: 'draft',
    });

    return strategy;
  }

  // ============================================================================
  // Config Validation
  // ============================================================================

  private validateConfig(type: StrategyType, config: Record<string, any>): Record<string, any> {
    // Validate symbols
    if (config.symbols) {
      if (!Array.isArray(config.symbols) || config.symbols.length === 0) {
        throw new Error('At least one symbol is required');
      }

      for (const symbol of config.symbols) {
        if (!symbol.includes('/')) {
          throw new Error('Invalid symbol format. Use BASE/QUOTE format (e.g., BTC/USDT)');
        }
      }
    }

    // Validate timeframe
    if (config.timeframe && !VALID_TIMEFRAMES.includes(config.timeframe)) {
      throw new Error(`Invalid timeframe. Valid options: ${VALID_TIMEFRAMES.join(', ')}`);
    }

    // Validate risk parameters
    if (config.stopLossPercent !== undefined) {
      if (config.stopLossPercent < 0 || config.stopLossPercent > 100) {
        throw new Error('Stop loss must be between 0 and 100');
      }
    }

    if (config.takeProfitPercent !== undefined) {
      if (config.takeProfitPercent < 0 || config.takeProfitPercent > 1000) {
        throw new Error('Take profit must be between 0 and 1000');
      }
    }

    // Type-specific validation
    switch (type) {
      case 'momentum':
        this.validateMomentumConfig(config);
        break;
      case 'mean_reversion':
        this.validateMeanReversionConfig(config);
        break;
      case 'sentiment':
        this.validateSentimentConfig(config);
        break;
      case 'arbitrage':
        this.validateArbitrageConfig(config);
        break;
      case 'trend_following':
        this.validateTrendFollowingConfig(config);
        break;
    }

    return config;
  }

  private validateMomentumConfig(config: Record<string, any>): void {
    if (config.lookbackPeriod !== undefined && config.lookbackPeriod < 1) {
      throw new Error('Lookback period must be at least 1');
    }
  }

  private validateMeanReversionConfig(config: Record<string, any>): void {
    if (config.bollingerPeriod !== undefined && config.bollingerPeriod < 2) {
      throw new Error('Bollinger period must be at least 2');
    }
    if (config.rsiPeriod !== undefined && config.rsiPeriod < 2) {
      throw new Error('RSI period must be at least 2');
    }
  }

  private validateSentimentConfig(config: Record<string, any>): void {
    if (config.aiProvider) {
      const supportedProviders = this.configService.getSupportedAIProviders();
      if (!supportedProviders.includes(config.aiProvider)) {
        throw new Error(`Unsupported AI provider: ${config.aiProvider}`);
      }
    }
  }

  private validateArbitrageConfig(config: Record<string, any>): void {
    if (config.exchanges) {
      const supportedExchanges = this.configService.getSupportedExchanges();
      for (const exchange of config.exchanges) {
        if (!supportedExchanges.includes(exchange)) {
          throw new Error(`Unsupported exchange: ${exchange}`);
        }
      }
    }
  }

  private validateTrendFollowingConfig(config: Record<string, any>): void {
    if (config.fastMaPeriod !== undefined && config.slowMaPeriod !== undefined) {
      if (config.fastMaPeriod >= config.slowMaPeriod) {
        throw new Error('Fast MA period must be less than slow MA period');
      }
    }
  }

  private applyDefaultRiskParams(config: Record<string, any>): Record<string, any> {
    const defaults = this.configService.getDefaultTradingConfig();

    return {
      ...config,
      stopLossPercent: config.stopLossPercent ?? defaults.defaultStopLossPercent,
      takeProfitPercent: config.takeProfitPercent ?? defaults.defaultTakeProfitPercent,
      maxPositionPercent: config.maxPositionPercent ?? 10,
    };
  }

  // ============================================================================
  // Strategy Retrieval
  // ============================================================================

  async getStrategy(strategyId: string): Promise<Strategy | null> {
    return await this.db.strategies.findById(strategyId);
  }

  async getUserStrategies(userId: string, filters?: StrategyFilters): Promise<Strategy[]> {
    let strategies = await this.db.strategies.findByUserId(userId);

    if (filters?.status) {
      strategies = strategies.filter((s: Strategy) => s.status === filters.status);
    }

    if (filters?.type) {
      strategies = strategies.filter((s: Strategy) => s.type === filters.type);
    }

    return strategies;
  }

  // ============================================================================
  // Strategy Update
  // ============================================================================

  async updateStrategy(strategyId: string, updates: UpdateStrategyParams): Promise<Strategy> {
    const strategy = await this.db.strategies.findById(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    // Prevent type change
    if (updates.type !== undefined) {
      throw new Error('Cannot change strategy type');
    }

    // Prevent config changes on active strategy
    if (updates.config !== undefined && strategy.status === 'active') {
      throw new Error('Cannot modify config of active strategy');
    }

    // Validate new config if provided
    if (updates.config) {
      this.validateConfig(strategy.type, updates.config);
    }

    const updateData: Partial<Strategy> = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.config) updateData.config = updates.config;

    return await this.db.strategies.update(strategyId, updateData);
  }

  // ============================================================================
  // Status Management
  // ============================================================================

  async updateStatus(strategyId: string, newStatus: StrategyStatus): Promise<Strategy> {
    const strategy = await this.db.strategies.findById(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    // Check valid transition
    const allowedTransitions = VALID_TRANSITIONS[strategy.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${strategy.status} to ${newStatus}`);
    }

    // Check tier permissions for live trading
    if (newStatus === 'active') {
      const user = await this.db.users.findById(strategy.userId);
      const tierFeatures = this.configService.getTierFeatures(user.tier);

      if (!tierFeatures.liveTradingEnabled) {
        throw new Error(`Live trading not available for ${user.tier} tier`);
      }
    }

    return await this.db.strategies.update(strategyId, { status: newStatus });
  }

  // ============================================================================
  // Strategy Deletion
  // ============================================================================

  async deleteStrategy(strategyId: string): Promise<void> {
    const strategy = await this.db.strategies.findById(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    // Cannot delete active strategy
    if (strategy.status === 'active') {
      throw new Error('Cannot delete active strategy. Pause or stop it first.');
    }

    // Check if strategy has trades
    const trades = await this.db.trades.findByStrategyId(strategyId);
    if (trades.length > 0) {
      // Archive instead of delete
      await this.db.strategies.update(strategyId, { status: 'archived' });
    } else {
      await this.db.strategies.delete(strategyId);
    }
  }

  // ============================================================================
  // Strategy Cloning
  // ============================================================================

  async cloneStrategy(strategyId: string, newName: string, requesterId?: string): Promise<Strategy> {
    const strategy = await this.db.strategies.findById(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    // If requesterId provided, verify ownership
    if (requesterId && strategy.userId !== requesterId) {
      throw new Error('Cannot clone another user\'s strategy');
    }

    return await this.createStrategy({
      userId: strategy.userId,
      name: newName,
      description: strategy.description,
      type: strategy.type,
      config: { ...strategy.config },
    });
  }

  // ============================================================================
  // Strategy Statistics
  // ============================================================================

  async getStrategyStats(strategyId: string): Promise<StrategyStats> {
    const trades = await this.db.trades.findByStrategyId(strategyId);

    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        profitLoss: 0,
        avgTradeSize: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
      };
    }

    // Calculate basic stats
    const filledTrades = trades.filter((t: any) => t.status === 'filled');
    const totalTrades = filledTrades.length;

    // For now, return basic stats
    // Full P&L calculation would require matching buys with sells
    return {
      totalTrades,
      winRate: 0, // Requires closed position analysis
      profitLoss: 0, // Requires closed position analysis
      avgTradeSize: filledTrades.reduce((sum: number, t: any) => sum + t.quantity * t.price, 0) / totalTrades || 0,
      maxDrawdown: 0, // Requires equity curve analysis
      sharpeRatio: 0, // Requires returns analysis
    };
  }
}
