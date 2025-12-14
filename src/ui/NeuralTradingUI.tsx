import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Alert, AlertDescription } from './components/ui/alert';
import { TradingDashboard } from './components/trading/TradingDashboard';
import { ConfigPanel } from './components/trading/ConfigPanel';
import { ConfigModal } from './components/trading/ConfigModal';
import { Brain, TrendingUp, Sparkles, AlertCircle, CheckCircle2, Activity, LogOut, User } from 'lucide-react';
import { useAuth } from './components/auth/AuthContext';
import { NeuralTrader } from '../core/NeuralTrader';
import { TradingConfig, DEFAULT_TRADING_CONFIG, PerformanceMetrics, Position } from '../types';
import { ConsoleSimulation } from './utils/consoleSimulation';

export const NeuralTradingUI = () => {
  const { user, logout } = useAuth();
  const [config, setConfig] = useState<TradingConfig>(DEFAULT_TRADING_CONFIG);
  const [trader, setTrader] = useState<NeuralTrader | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [cashBalance, setCashBalance] = useState(config.capital);
  const [learningStats, setLearningStats] = useState({
    totalFeedback: 0,
    successRate: 0,
    avgReward: 0,
    learningRate: config.safla.learningRate,
    explorationRate: config.safla.explorationRate,
    patternsLearned: 0,
    skillsAcquired: 0,
    causalEdges: 0
  });
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const updateInterval = useRef<NodeJS.Timeout>();
  const consoleSimulation = useRef<ConsoleSimulation | null>(null);

  useEffect(() => {
    const initTrader = async () => {
      try {
        addLog('⏳ Initializing Neural Trading System...');

        // Initialize console simulation
        consoleSimulation.current = new ConsoleSimulation(addLog);

        const newTrader = new NeuralTrader(config);
        await newTrader.initialize();

        setTrader(newTrader);
        setIsInitialized(true);
        addLog('✓ Neural Trading System initialized successfully');
        addLog('✓ AgentDB vector database ready');
        addLog('✓ GOAP planner initialized');
        addLog('✓ SAFLA learning system active');
      } catch (error) {
        console.error('Failed to initialize trader:', error);
        addLog('✗ Failed to initialize trading system');
        addLog(`✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    initTrader();

    return () => {
      if (trader) {
        trader.stop();
      }
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
      if (consoleSimulation.current) {
        consoleSimulation.current.stop();
      }
    };
  }, []);

  const addLog = (message: string) => {
    setActivityLog(prev => [...prev.slice(-19), message]); // Keep last 20 logs
  };

  const handleStart = async () => {
    if (!trader || isRunning) return;

    setIsRunning(true);
    addLog('🚀 Starting trading system...');

    try {
      await trader.start();
      addLog('✓ Trading system started successfully');

      // Start console simulation
      if (consoleSimulation.current) {
        consoleSimulation.current.start();
      }

      // Set up UI update interval
      updateInterval.current = setInterval(() => {
        const perf = trader.getPerformance();
        const portfolio = trader.getPortfolio();
        const stats = trader.getLearningStats();

        setPerformance(perf);
        setPositions(portfolio.positions);
        setCashBalance(portfolio.cashBalance);
        setLearningStats(stats);
      }, 1000);
    } catch (error) {
      console.error('Failed to start trader:', error);
      addLog('✗ Failed to start trading');
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    if (!trader) return;

    trader.stop();
    setIsRunning(false);
    addLog('⏸ Trading system stopped');

    // Stop console simulation
    if (consoleSimulation.current) {
      consoleSimulation.current.stop();
    }

    if (updateInterval.current) {
      clearInterval(updateInterval.current);
    }
  };

  const handleReset = () => {
    if (!trader) return;

    trader.reset();
    setPerformance(null);
    setPositions([]);
    setCashBalance(config.initialCapital);
    setActivityLog([]);
    addLog('🔄 Trading system reset');
  };

  const handleConfigChange = (newConfig: Partial<TradingConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-panel">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-cyan" />
              <h1 className="text-xl font-bold">Neural Trading System</h1>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={isInitialized ? "default" : "secondary"}>
                {isInitialized ? "Ready" : "Initializing..."}
              </Badge>
              {user && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{user.email}</span>
                    <Badge variant="secondary" className="text-xs">{user.tier}</Badge>
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 text-muted-foreground hover:text-red-400 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-12 bg-gradient-to-b from-background via-panel/50 to-background border-b border-border/50">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-4xl mx-auto">
              <Badge variant="secondary" className="mb-4">
                <Brain className="h-3 w-3 mr-2" />
                Advanced AI Trading
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Neural <span className="text-cyan">Trading</span> System
              </h1>
              <p className="text-lg text-muted-foreground mb-6">
                Multi-source AI trading with <strong>GOAP</strong>, <strong>SAFLA</strong>, and <strong>AgentDB</strong>.
                Integrates market data, social sentiment, and prediction markets.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
                <div className="flex items-center gap-2 px-4 py-2 bg-panel rounded-lg border border-border/50">
                  <TrendingUp className="h-4 w-4 text-cyan" />
                  <span className="text-sm">Real-time Market Data</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-panel rounded-lg border border-border/50">
                  <Brain className="h-4 w-4 text-purple-400" />
                  <span className="text-sm">GOAP Planning</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-panel rounded-lg border border-border/50">
                  <Sparkles className="h-4 w-4 text-green-400" />
                  <span className="text-sm">SAFLA Learning</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-panel rounded-lg border border-border/50">
                  <Activity className="h-4 w-4 text-cyan" />
                  <span className="text-sm">AgentDB Vector DB</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Status Alert */}
        <section className="container mx-auto px-6 py-6">
          <Alert className={isInitialized ? "border-green-500/30 bg-green-500/10" : "border-cyan/30 bg-cyan/10"}>
            {isInitialized ? (
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-cyan" />
            )}
            <AlertDescription>
              {isInitialized ? (
                <>
                  <strong>System Ready:</strong> AgentDB initialized, GOAP planner active, SAFLA learning enabled.
                  This is a realistic simulation - replace data feeds with real APIs for live trading.
                </>
              ) : (
                <>
                  <strong>Initializing:</strong> Setting up trading system components...
                </>
              )}
            </AlertDescription>
          </Alert>
        </section>

        {/* Main Dashboard */}
        <section className="container mx-auto px-6 pb-12">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: Config Panel */}
            <div className="lg:col-span-1">
              <ConfigPanel
                config={config}
                onConfigChange={handleConfigChange}
                onStart={handleStart}
                onStop={handleStop}
                onReset={handleReset}
                onShowAdvanced={() => setShowConfigModal(true)}
                isRunning={isRunning}
              />

              {/* Activity Log */}
              <Card className="bg-panel border-border mt-6">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Activity Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 font-mono text-xs max-h-96 overflow-y-auto">
                    {activityLog.length === 0 ? (
                      <div className="text-muted-foreground text-center py-4">
                        No activity yet
                      </div>
                    ) : (
                      activityLog.map((log, i) => (
                        <div key={i} className="text-muted-foreground">
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Dashboard */}
            <div className="lg:col-span-2">
              <TradingDashboard
                performance={performance}
                positions={positions}
                cashBalance={cashBalance}
                isRunning={isRunning}
                learningStats={learningStats}
              />

              {/* Information Cards */}
              <div className="grid md:grid-cols-3 gap-4 mt-6">
                <Card className="bg-panel border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-400" />
                      GOAP Planning
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Goal-Oriented Action Planning creates optimal action sequences using A* search.
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-panel border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-green-400" />
                      SAFLA Learning
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Self-Aware Feedback Loop Algorithm learns from outcomes and adapts strategies.
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-panel border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-cyan" />
                      AgentDB Vector DB
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Stores and retrieves trading patterns using vector similarity search.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Multi-Source Data Integration */}
              <Card className="bg-panel border-border mt-6">
                <CardHeader>
                  <CardTitle className="text-sm">Multi-Source Data Integration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="font-semibold text-cyan mb-2">Stock Market Data</div>
                      <div className="text-muted-foreground">
                        Real-time price, volume, and technical indicators. Replace simulation with Alpha Vantage, Yahoo Finance, or IEX Cloud APIs.
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-purple-400 mb-2">Social Sentiment</div>
                      <div className="text-muted-foreground">
                        Twitter, Reddit, and news sentiment analysis. Replace with Twitter API v2, Reddit API, or news sentiment APIs.
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-green-400 mb-2">Prediction Markets</div>
                      <div className="text-muted-foreground">
                        Polymarket probability data for market events. Replace with official Polymarket API for real predictions.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gemini Integration */}
              <Card className="bg-gradient-to-r from-purple-500/10 to-cyan/10 border-purple-500/30 mt-6">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    Gemini AI Market Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">
                    The system uses Google's Gemini AI to analyze market conditions by combining stock data, social sentiment, and prediction market probabilities into actionable insights.
                  </p>
                  <div className="text-xs bg-background/50 p-3 rounded border border-border/50">
                    <div className="font-semibold mb-2">Enable real Gemini integration:</div>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Get a free API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">Google AI Studio</a></li>
                      <li>Enable "Use Real Data Feeds" in advanced settings</li>
                      <li>Enter your Gemini API key</li>
                      <li>The system will use real AI analysis for market decisions</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-panel">
        <div className="container mx-auto px-6 py-4">
          <div className="text-center text-sm text-muted-foreground">
            <p>Neural Trading System powered by AgentDB, GOAP, and SAFLA</p>
          </div>
        </div>
      </footer>

      {/* Configuration Modal */}
      <ConfigModal
        open={showConfigModal}
        onOpenChange={setShowConfigModal}
        config={config}
        onSave={handleConfigChange}
      />
    </div>
  );
};

export default NeuralTradingUI;
