/**
 * Neural Trading System - Type Definitions
 * Based on actual library APIs: agentdb@1.6.1, lean-agentic@0.3.2, midstreamer@0.2.3
 */

// ============================================================================
// AgentDB Configuration (v1.6.1)
// ============================================================================

export interface AgentDBConfig {
  // Vector Search Configuration
  vectorSearch: {
    enabled: boolean;
    dimensions: number; // Default: 384 (all-MiniLM-L6-v2)
    metric: 'cosine' | 'euclidean' | 'dot';
    useWASM: boolean; // 150x faster than pure JS
  };

  // HNSW Index Configuration
  hnsw: {
    enabled: boolean;
    maxElements: number; // Max vectors to store
    M: number; // Number of bi-directional links (16 recommended)
    efConstruction: number; // Quality during construction (200 recommended)
    efSearch: number; // Quality during search (100 recommended)
  };

  // Reflexion Memory Configuration
  reflexion: {
    enabled: boolean;
    minReward: number; // Minimum reward threshold (0-1)
    storeFailures: boolean; // Store failed episodes for learning
    storeCritiques: boolean; // Store self-critiques
  };

  // Skill Library Configuration
  skillLibrary: {
    enabled: boolean;
    minSuccessRate: number; // Minimum success rate to keep skill (0-1)
    autoLearn: boolean; // Automatically learn new skills
  };

  // Causal Memory Configuration
  causalMemory: {
    enabled: boolean;
    minConfidence: number; // Minimum confidence for causal edges (0-1)
    minUplift: number; // Minimum uplift for causal effects
  };

  // Nightly Learner Configuration
  nightlyLearner: {
    enabled: boolean;
    minAttempts: number; // Minimum attempts to discover pattern
    minSuccessRate: number; // Minimum success rate threshold
    minConfidence: number; // Minimum statistical confidence
  };

  // MMR Diversity Ranking
  mmr: {
    enabled: boolean;
    lambda: number; // Balance relevance vs diversity (0-1, default 0.7)
  };

  // QUIC Synchronization
  quic: {
    enabled: boolean;
    port: number;
    syncInterval: number; // Milliseconds between syncs
  };
}

// ============================================================================
// Lean-Agentic Configuration (v0.3.2)
// ============================================================================

export interface LeanAgenticConfig {
  // Core Theorem Prover
  prover: {
    enabled: boolean;
    useHashConsing: boolean; // 150x faster term equality
    maxDepth: number; // Maximum proof search depth
    timeout: number; // Proof search timeout (ms)
  };

  // Ed25519 Cryptographic Signatures
  signatures: {
    enabled: boolean;
    signProofs: boolean; // Sign all generated proofs
    verifyProofs: boolean; // Verify imported proofs
  };

  // Episodic Memory (via AgentDB)
  episodicMemory: {
    enabled: boolean;
    storageKey: string; // Memory namespace
    maxEpisodes: number; // Max episodes to store
  };

  // ReasoningBank Learning
  reasoningBank: {
    enabled: boolean;
    learnFromProofs: boolean; // Learn patterns from successful proofs
    recommendProofs: boolean; // Recommend proof strategies
    adaptiveThreshold: number; // Confidence threshold for recommendations
  };

  // Formal Verification
  verification: {
    verifyStrategies: boolean; // Verify trading strategies formally
    verifyRiskManagement: boolean; // Verify risk rules
    verifyConstraints: boolean; // Verify all constraints
  };
}

// ============================================================================
// Midstreamer Configuration (v0.2.3)
// ============================================================================

export interface MidstreamerConfig {
  // Dynamic Time Warping (DTW)
  dtw: {
    enabled: boolean;
    window: number; // Sakoe-Chiba window constraint
    distance: 'euclidean' | 'manhattan' | 'chebyshev';
    normalize: boolean; // Normalize time series
  };

  // Longest Common Subsequence (LCS)
  lcs: {
    enabled: boolean;
    minLength: number; // Minimum sequence length
    tolerance: number; // Similarity tolerance
  };

  // NanoScheduler
  scheduler: {
    enabled: boolean;
    maxTasks: number; // Max concurrent tasks
    priority: 'fifo' | 'lifo' | 'priority';
    timeSlice: number; // Time slice per task (ms)
  };

  // StrangeLoop Meta-Learning
  strangeLoop: {
    enabled: boolean;
    learningRate: number; // Meta-learning rate (0-1)
    adaptationRate: number; // How fast to adapt (0-1)
    feedbackWindow: number; // Number of iterations to consider
  };

  // WebTransport/QUIC
  transport: {
    enabled: boolean;
    useWebTransport: boolean; // Use WebTransport if available
    fallbackToWebSocket: boolean;
  };
}

// ============================================================================
// GOAP (Goal-Oriented Action Planning) Configuration
// ============================================================================

export interface GOAPConfig {
  enabled: boolean;
  planningHorizon: number; // How many steps ahead to plan
  heuristic: 'manhattan' | 'euclidean' | 'chebyshev'; // A* heuristic
  maxNodes: number; // Max nodes to explore in search
  replanThreshold: number; // When to replan (0-1)

  // Goal definitions
  goals: {
    maximizeProfit: boolean;
    minimizeRisk: boolean;
    maintainDiversification: boolean;
    learnPatterns: boolean;
  };

  // Available actions
  actions: {
    buy: boolean;
    sell: boolean;
    hold: boolean;
    hedge: boolean;
    rebalance: boolean;
  };
}

// ============================================================================
// SAFLA (Self-Aware Feedback Loop Algorithm) Configuration
// ============================================================================

export interface SAFLAConfig {
  enabled: boolean;
  learningRate: number; // Base learning rate (0-1)
  explorationRate: number; // Epsilon for exploration (0-1)
  explorationDecay: number; // Decay rate for exploration
  minExploration: number; // Minimum exploration rate

  // Feedback mechanisms
  feedback: {
    rewardWindow: number; // Number of trades to consider
    discountFactor: number; // Discount future rewards (0-1)
    normalizeRewards: boolean; // Normalize reward signals
  };

  // Self-awareness
  awareness: {
    trackConfidence: boolean; // Track prediction confidence
    trackUncertainty: boolean; // Track uncertainty estimates
    adaptToMarket: boolean; // Adapt to market regime changes
  };

  // Meta-learning
  meta: {
    enabled: boolean;
    updateInterval: number; // How often to update meta-parameters
    learningRateAdaptation: boolean; // Adapt learning rate
  };
}

// ============================================================================
// Trading System Configuration
// ============================================================================

export interface TradingConfig {
  // Basic Trading Parameters
  capital: number;
  symbols: string[];
  tradingFrequency: number; // Milliseconds between checks

  // Risk Management
  riskManagement: {
    maxPositionSize: number; // As percentage of capital (0-1)
    stopLoss: number; // Stop loss percentage (0-1)
    takeProfit: number; // Take profit percentage (0-1)
    maxDrawdown: number; // Maximum allowed drawdown (0-1)
    riskPerTrade: number; // Risk per trade as % of capital
  };

  // Library Configurations
  agentdb: AgentDBConfig;
  leanAgentic: LeanAgenticConfig;
  midstreamer: MidstreamerConfig;
  goap: GOAPConfig;
  safla: SAFLAConfig;

  // API Keys
  apiKeys: {
    geminiApiKey: string;
    alpacaApiKey: string;
    alpacaSecretKey: string;
    twitterBearerToken: string;
  };

  // Data Sources
  dataSources: {
    marketData: boolean;
    socialSentiment: boolean;
    newsAnalysis: boolean;
    onChainMetrics: boolean;
  };
}

// ============================================================================
// System State Types
// ============================================================================

export interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  entryTime: Date;
  strategy: string;
}

export interface PerformanceMetrics {
  totalPnL: number;
  totalPnLPercent: number;
  winRate: number;
  totalTrades: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgReturn: number;
  avgWin: number;
  avgLoss: number;
}

export interface LearningStats {
  successRate: number;
  avgReward: number;
  learningRate: number;
  explorationRate: number;
  totalFeedback: number;
  patternsLearned: number;
  skillsAcquired: number;
  causalEdges: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: Date;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: Date;
  strategy: string;
  reasoning: string;
  confidence: number;
}

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_AGENTDB_CONFIG: AgentDBConfig = {
  vectorSearch: {
    enabled: true,
    dimensions: 384,
    metric: 'cosine',
    useWASM: true,
  },
  hnsw: {
    enabled: true,
    maxElements: 10000,
    M: 16,
    efConstruction: 200,
    efSearch: 100,
  },
  reflexion: {
    enabled: true,
    minReward: 0.6,
    storeFailures: true,
    storeCritiques: true,
  },
  skillLibrary: {
    enabled: true,
    minSuccessRate: 0.7,
    autoLearn: true,
  },
  causalMemory: {
    enabled: true,
    minConfidence: 0.8,
    minUplift: 0.1,
  },
  nightlyLearner: {
    enabled: true,
    minAttempts: 3,
    minSuccessRate: 0.65,
    minConfidence: 0.75,
  },
  mmr: {
    enabled: true,
    lambda: 0.7,
  },
  quic: {
    enabled: false,
    port: 4433,
    syncInterval: 5000,
  },
};

export const DEFAULT_LEAN_AGENTIC_CONFIG: LeanAgenticConfig = {
  prover: {
    enabled: true,
    useHashConsing: true,
    maxDepth: 10,
    timeout: 5000,
  },
  signatures: {
    enabled: true,
    signProofs: true,
    verifyProofs: true,
  },
  episodicMemory: {
    enabled: true,
    storageKey: 'lean-agentic-proofs',
    maxEpisodes: 1000,
  },
  reasoningBank: {
    enabled: true,
    learnFromProofs: true,
    recommendProofs: true,
    adaptiveThreshold: 0.7,
  },
  verification: {
    verifyStrategies: true,
    verifyRiskManagement: true,
    verifyConstraints: true,
  },
};

export const DEFAULT_MIDSTREAMER_CONFIG: MidstreamerConfig = {
  dtw: {
    enabled: true,
    window: 10,
    distance: 'euclidean',
    normalize: true,
  },
  lcs: {
    enabled: true,
    minLength: 3,
    tolerance: 0.1,
  },
  scheduler: {
    enabled: true,
    maxTasks: 100,
    priority: 'priority',
    timeSlice: 10,
  },
  strangeLoop: {
    enabled: true,
    learningRate: 0.01,
    adaptationRate: 0.1,
    feedbackWindow: 100,
  },
  transport: {
    enabled: false,
    useWebTransport: false,
    fallbackToWebSocket: true,
  },
};

export const DEFAULT_GOAP_CONFIG: GOAPConfig = {
  enabled: true,
  planningHorizon: 5,
  heuristic: 'manhattan',
  maxNodes: 1000,
  replanThreshold: 0.3,
  goals: {
    maximizeProfit: true,
    minimizeRisk: true,
    maintainDiversification: true,
    learnPatterns: true,
  },
  actions: {
    buy: true,
    sell: true,
    hold: true,
    hedge: true,
    rebalance: true,
  },
};

export const DEFAULT_SAFLA_CONFIG: SAFLAConfig = {
  enabled: true,
  learningRate: 0.01,
  explorationRate: 0.1,
  explorationDecay: 0.995,
  minExploration: 0.01,
  feedback: {
    rewardWindow: 50,
    discountFactor: 0.99,
    normalizeRewards: true,
  },
  awareness: {
    trackConfidence: true,
    trackUncertainty: true,
    adaptToMarket: true,
  },
  meta: {
    enabled: true,
    updateInterval: 100,
    learningRateAdaptation: true,
  },
};

export const DEFAULT_TRADING_CONFIG: TradingConfig = {
  capital: 100000,
  symbols: ['AAPL', 'GOOGL', 'MSFT', 'TSLA'],
  tradingFrequency: 60000,
  riskManagement: {
    maxPositionSize: 0.25,
    stopLoss: 0.02,
    takeProfit: 0.05,
    maxDrawdown: 0.15,
    riskPerTrade: 0.02,
  },
  agentdb: DEFAULT_AGENTDB_CONFIG,
  leanAgentic: DEFAULT_LEAN_AGENTIC_CONFIG,
  midstreamer: DEFAULT_MIDSTREAMER_CONFIG,
  goap: DEFAULT_GOAP_CONFIG,
  safla: DEFAULT_SAFLA_CONFIG,
  apiKeys: {
    geminiApiKey: '',
    alpacaApiKey: '',
    alpacaSecretKey: '',
    twitterBearerToken: '',
  },
  dataSources: {
    marketData: true,
    socialSentiment: false,
    newsAnalysis: false,
    onChainMetrics: false,
  },
};
