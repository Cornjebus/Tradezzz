/**
 * Console Simulation for Neural Trading System
 * Simulates realistic trading activity with GOAP, SAFLA, and AgentDB operations
 */

export class ConsoleSimulation {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private logs: string[] = [];

  constructor(private onLog: (message: string) => void) {}

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Initial startup logs
    this.log('🚀 Starting Neural Trading System...');
    setTimeout(() => this.log('✓ AgentDB WASM module loaded'), 200);
    setTimeout(() => this.log('✓ Vector search initialized (150x faster)'), 400);
    setTimeout(() => this.log('✓ HNSW index ready with 10000 max elements'), 600);
    setTimeout(() => this.log('✓ GOAP planner initialized'), 800);
    setTimeout(() => this.log('✓ SAFLA learning system active'), 1000);
    setTimeout(() => this.log('✓ Trading system started successfully'), 1200);

    // Start simulation loop
    setTimeout(() => {
      this.runSimulation();
    }, 1500);
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.log('⏸ Trading system stopped');
  }

  private runSimulation(): void {
    let cycleCount = 0;

    this.intervalId = setInterval(() => {
      if (!this.isRunning) return;

      cycleCount++;

      // Simulate different trading activities
      const activities = [
        () => this.simulateMarketAnalysis(),
        () => this.simulateGOAPPlanning(),
        () => this.simulateSAFLALearning(),
        () => this.simulateVectorSearch(),
        () => this.simulateTrade(),
        () => this.simulateRiskCheck(),
        () => this.simulatePatternRecognition()
      ];

      // Execute a random activity
      const activity = activities[Math.floor(Math.random() * activities.length)];
      activity();

      // Periodic system updates
      if (cycleCount % 10 === 0) {
        this.simulateSystemHealth();
      }

    }, 3000 + Math.random() * 2000); // 3-5 seconds between activities
  }

  private simulateMarketAnalysis(): void {
    const symbols = ['AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const price = (Math.random() * 500 + 100).toFixed(2);

    this.log(`📊 Market Analysis: ${symbol} at $${price}`);
    this.log(`   ↳ RSI: ${(Math.random() * 100).toFixed(1)}, MACD: ${(Math.random() * 10 - 5).toFixed(2)}`);
  }

  private simulateGOAPPlanning(): void {
    const goals = ['maximize_profit', 'minimize_risk', 'rebalance_portfolio', 'capture_momentum'];
    const goal = goals[Math.floor(Math.random() * goals.length)];
    const steps = Math.floor(Math.random() * 5) + 2;

    this.log(`🧠 GOAP: Planning for goal '${goal}'`);
    this.log(`   ↳ Generated ${steps}-step action sequence`);
    this.log(`   ↳ Plan cost: ${(Math.random() * 10).toFixed(2)}, confidence: ${(Math.random() * 0.3 + 0.7).toFixed(2)}`);
  }

  private simulateSAFLALearning(): void {
    const patterns = ['momentum_breakout', 'mean_reversion', 'sentiment_surge', 'volume_spike'];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const reward = (Math.random() * 200 - 50).toFixed(2);

    this.log(`🎓 SAFLA: Learning from pattern '${pattern}'`);
    this.log(`   ↳ Reward: $${reward}, updating Q-values`);
    this.log(`   ↳ Exploration rate: ${(Math.random() * 0.2).toFixed(3)}, learning rate: 0.010`);
  }

  private simulateVectorSearch(): void {
    const dimensions = 384;
    const results = Math.floor(Math.random() * 3) + 3;
    const searchTime = (Math.random() * 2 + 0.5).toFixed(2);

    this.log(`🔍 AgentDB Vector Search: ${dimensions}D embedding`);
    this.log(`   ↳ Found ${results} similar patterns in ${searchTime}ms (HNSW)`);
    this.log(`   ↳ Top match: 0.${Math.floor(Math.random() * 20 + 80)} similarity`);
  }

  private simulateTrade(): void {
    const symbols = ['AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const action = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const shares = Math.floor(Math.random() * 50) + 10;
    const price = (Math.random() * 500 + 100).toFixed(2);

    this.log(`📈 Trade Executed: ${action} ${shares} ${symbol} @ $${price}`);
    this.log(`   ↳ Strategy: ${['Momentum', 'Mean Reversion', 'Sentiment'][Math.floor(Math.random() * 3)]}`);
    this.log(`   ↳ Confidence: ${(Math.random() * 0.3 + 0.7).toFixed(2)}, Expected PnL: $${(Math.random() * 100).toFixed(2)}`);
  }

  private simulateRiskCheck(): void {
    const portfolio = (Math.random() * 0.6 + 0.2).toFixed(2);
    const drawdown = (Math.random() * 0.15).toFixed(2);
    const sharpe = (Math.random() * 2 + 0.5).toFixed(2);

    this.log(`🛡️ Risk Management Check`);
    this.log(`   ↳ Portfolio risk: ${(Number(portfolio) * 100).toFixed(0)}% (limit: 50%)`);
    this.log(`   ↳ Current drawdown: ${(Number(drawdown) * 100).toFixed(1)}%, Sharpe: ${sharpe}`);
  }

  private simulatePatternRecognition(): void {
    const patterns = Math.floor(Math.random() * 50) + 150;
    const newPatterns = Math.floor(Math.random() * 3) + 1;
    const accuracy = (Math.random() * 0.15 + 0.75).toFixed(3);

    this.log(`🤖 Pattern Recognition Update`);
    this.log(`   ↳ Total patterns in SkillLibrary: ${patterns}`);
    this.log(`   ↳ New patterns learned: ${newPatterns}`);
    this.log(`   ↳ Pattern matching accuracy: ${(Number(accuracy) * 100).toFixed(1)}%`);
  }

  private simulateSystemHealth(): void {
    const memory = Math.floor(Math.random() * 200 + 300);
    const dbSize = (Math.random() * 50 + 10).toFixed(1);
    const uptime = Math.floor(Math.random() * 3600 + 1800);

    this.log(`⚙️ System Health Check`);
    this.log(`   ↳ Memory: ${memory}MB, DB size: ${dbSize}MB`);
    this.log(`   ↳ Uptime: ${Math.floor(uptime / 60)}m ${uptime % 60}s`);
    this.log(`   ↳ AgentDB: Connected, WASM: Active, Swarm: Coordinated`);
  }

  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const fullMessage = `[${timestamp}] ${message}`;
    this.logs.push(fullMessage);
    this.onLog(fullMessage);

    // Also log to browser console
    console.log(fullMessage);
  }
}
