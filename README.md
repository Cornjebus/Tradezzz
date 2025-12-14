# Neural Trading System

> Multi-source AI trading platform with GOAP, SAFLA, and AgentDB vector learning

## 🚀 Quick Start

### Install Globally

```bash
npm install -g @agentdb/neural-trading
```

### Or Use with npx

```bash
npx @agentdb/neural-trading init my-trading-bot
cd my-trading-bot
npx @agentdb/neural-trading start
```

## 📊 Features

- **GOAP Planning**: Goal-Oriented Action Planning with A* search
- **SAFLA Learning**: Self-Aware Feedback Loop Algorithm for continuous improvement
- **AgentDB Vector DB**: SQLite-based vector database with 150x faster pattern search
- **Multi-Source Data**: Stock market, social sentiment, and prediction markets
- **Swarm Coordination**: Multi-agent orchestration with Claude Flow
- **Real-time Streaming**: Powered by Midstreamer
- **Web UI**: Beautiful React dashboard with real-time updates
- **CLI Interface**: Command-line tools for automation

## 🎯 Architecture

```
┌─────────────────────────────────────────┐
│           Client Layer                   │
│  CLI │ Web UI │ REST API │ WebSocket    │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│        Coordination Layer                │
│  Swarm Coordinator │ Task Orchestrator  │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│           Agent Layer                    │
│  GOAP │ SAFLA │ Strategies │ Risk Mgmt  │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│           Core Layer                     │
│  Trading Engine │ Portfolio │ Executor  │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│           Data Layer                     │
│  AgentDB │ Market Data │ Sentiment      │
└─────────────────────────────────────────┘
```

## 📦 Installation Modes

### Mode 1: Web UI (Default)

```bash
# Start web server with dashboard
neural-trading start

# Opens at http://localhost:3000
# - Real-time dashboard
# - WebSocket updates
# - Configuration UI
# - Performance charts
```

### Mode 2: CLI Trading

```bash
# Run headless trading bot
neural-trading cli --config config.yaml

# With specific symbols
neural-trading cli --symbols AAPL,GOOGL,TSLA

# Paper trading mode
neural-trading cli --mode paper --capital 100000
```

### Mode 3: Swarm Coordination

```bash
# Deploy trading swarm with 5 agents
neural-trading swarm --agents 5 --strategy adaptive

# With specific topology
neural-trading swarm --topology hierarchical --agents 8
```

### Mode 4: Lean-Agentic Integration

```bash
# Use lean-agentic for resource efficiency
neural-trading lean --agents trading,analysis,risk

# With shared memory
neural-trading lean --coordination distributed --memory shared
```

### Mode 5: Midstreamer Real-time

```bash
# Stream real-time data
neural-trading stream --sources alpaca,polygon,twitter

# With buffering
neural-trading stream --buffer 1000 --realtime
```

## 🛠️ Configuration

Create `config.yaml`:

```yaml
# Trading Configuration
mode: paper              # paper | live | backtest
initial_capital: 100000
symbols:
  - AAPL
  - GOOGL
  - MSFT
  - NVDA
  - TSLA

# Risk Management
risk_management:
  max_position_size: 0.2   # 20% of portfolio
  max_portfolio_risk: 0.5  # 50% of capital
  stop_loss: 0.05          # 5% loss limit
  take_profit: 0.15        # 15% profit target
  max_drawdown: 0.25       # 25% drawdown limit

# GOAP Configuration
goap:
  enabled: true
  planning_horizon: 10
  search_depth: 5

# SAFLA Learning
safla:
  enabled: true
  learning_rate: 0.01
  exploration_rate: 0.1
  discount_factor: 0.95
  feedback_window: 20
  adaptation_threshold: 0.7

# AgentDB Configuration
agentdb:
  path: ./data/agentdb.db
  quantization: uint8       # none | uint8 | uint4
  enable_hnsw: true        # 150x faster search
  indexing:
    M: 16
    ef_construction: 200
    ef_search: 100

# Data Feeds
data_feeds:
  alpaca:
    enabled: true
    api_key: ${ALPACA_KEY}
    api_secret: ${ALPACA_SECRET}
    paper: true

  sentiment:
    enabled: true
    twitter_token: ${TWITTER_TOKEN}
    gemini_key: ${GEMINI_KEY}

  polymarket:
    enabled: false

# Swarm Coordination
swarm:
  enabled: false
  topology: hierarchical    # mesh | hierarchical | star | ring
  max_agents: 10
  strategy: adaptive        # balanced | specialized | adaptive
```

## 🧠 GOAP Actions

Built-in actions:

```typescript
// Trading actions
- buy(symbol, quantity)
- sell(symbol, quantity)
- hold()
- rebalance()

// Analysis actions
- analyzeMarket()
- checkSentiment()
- evaluateRisk()
- updateStrategy()

// Learning actions
- recordPattern()
- adaptStrategy()
- optimizePortfolio()
```

### Custom GOAP Actions

```typescript
// src/custom-actions/my-action.ts
export class MyCustomAction implements GOAPAction {
  name = 'myAction';
  cost = 1;

  preconditions = {
    cash: (val) => val > 1000,
    marketCondition: 'bullish'
  };

  effects = {
    hasPosition: true,
    cash: (val, state) => val - 1000
  };

  async execute(state: State): Promise<State> {
    // Your logic here
    return newState;
  }
}
```

## 🎓 SAFLA Learning

The system continuously learns from trading outcomes:

```typescript
// Automatic pattern learning
trader.on('trade', (trade) => {
  // SAFLA automatically:
  // 1. Records state before trade
  // 2. Measures outcome (profit/loss)
  // 3. Stores pattern in AgentDB
  // 4. Adapts strategy
  // 5. Updates exploration rate
});
```

### Learning Metrics

```bash
# View learning progress
neural-trading metrics --learning

Output:
  Learning Rate: 0.01
  Exploration Rate: 0.15
  Success Rate: 67.3%
  Avg Reward: +$234
  Pattern Count: 1,247
```

## 🔧 Development

### Project Structure

```
neural-trading/
├── src/
│   ├── core/           # Core trading engine
│   │   ├── TradingEngine.ts
│   │   ├── NeuralTrader.ts
│   │   └── MemoryManager.ts
│   ├── agents/         # GOAP & SAFLA agents
│   │   ├── GOAPPlanner.ts
│   │   ├── SAFLALearning.ts
│   │   └── TradingAgent.ts
│   ├── data/           # Data feeds
│   │   ├── DataFeedManager.ts
│   │   ├── AlpacaFeed.ts
│   │   └── SentimentFeed.ts
│   ├── strategies/     # Trading strategies
│   │   ├── MomentumStrategy.ts
│   │   └── MeanReversionStrategy.ts
│   ├── ui/             # React UI components
│   │   ├── NeuralTradingUI.tsx
│   │   └── components/
│   ├── server.ts       # Express server
│   └── index.ts        # Main entry point
├── bin/
│   └── cli.js          # CLI executable
├── plans/              # Implementation plans
│   ├── 00-MASTER-PLAN.md
│   ├── 01-ARCHITECTURE.md
│   ├── 02-CORE-SYSTEM.md
│   ├── 03-AGENTS.md
│   ├── 04-DATA-FEEDS.md
│   ├── 05-STRATEGIES.md
│   ├── 06-SWARM-COORDINATION.md
│   ├── 07-TESTING.md
│   ├── 08-DEPLOYMENT.md
│   └── 09-MODIFICATION-GUIDE.md
├── config/             # Configuration templates
├── docs/               # Documentation
├── examples/           # Example configurations
└── tests/              # Test suite
```

### Build from Source

```bash
git clone https://github.com/ruvnet/agentdb-site.git
cd agentdb-site/neural-trading

npm install
npm run build

# Run locally
npm start

# Run in development mode
npm run dev
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test suite
npm test -- agents
```

## 🚀 Swarm Coordination

### Initialize Swarm

```bash
# Research and planning
npx claude-flow swarm "analyze trading opportunities" \
  --strategy research \
  --mode mesh \
  --agents 6

# Development and implementation
npx claude-flow swarm "build trading strategies" \
  --strategy development \
  --mode hierarchical \
  --agents 8

# Testing and validation
npx claude-flow swarm "test trading system" \
  --strategy testing \
  --mode star \
  --agents 5
```

### Swarm Topologies

**Mesh** (Peer-to-peer)
- Best for research and analysis
- All agents communicate directly
- Decentralized decision making

**Hierarchical** (Queen + Workers)
- Best for development
- Central coordinator delegates tasks
- Efficient for complex workflows

**Star** (Hub and Spoke)
- Best for testing
- Central hub manages all coordination
- Fast synchronization

**Ring** (Sequential)
- Best for pipelines
- Data flows sequentially
- Ordered processing

## 📊 Performance Monitoring

### Real-time Dashboard

Access at `http://localhost:3000` when running in web mode.

Features:
- Portfolio value chart
- Win/loss ratio
- Position tracking
- Learning metrics
- Activity log
- Performance stats

### CLI Monitoring

```bash
# Monitor trading in terminal
neural-trading monitor --interval 5s

# View swarm status
neural-trading swarm status --detailed

# Check agent metrics
neural-trading agents metrics --live

# Export metrics
neural-trading metrics export --format csv
```

## 🔐 Security & Safety

### Built-in Safeguards

- Position size limits
- Stop-loss enforcement
- Portfolio risk caps
- Drawdown limits
- Emergency shutdown
- Paper trading mode (default)

### Environment Variables

```bash
# Store API keys securely
export ALPACA_KEY=your_key
export ALPACA_SECRET=your_secret
export TWITTER_TOKEN=your_token
export GEMINI_KEY=your_key

# Or use .env file
cp .env.example .env
# Edit .env with your keys
```

## 📚 Resources

### Documentation
- [Architecture Guide](./plans/01-ARCHITECTURE.md)
- [Core System](./plans/02-CORE-SYSTEM.md)
- [Agent Implementation](./plans/03-AGENTS.md)
- [Data Feeds](./plans/04-DATA-FEEDS.md)
- [Strategies](./plans/05-STRATEGIES.md)
- [Swarm Coordination](./plans/06-SWARM-COORDINATION.md)
- [Testing](./plans/07-TESTING.md)
- [Deployment](./plans/08-DEPLOYMENT.md)
- [Modification Guide](./plans/09-MODIFICATION-GUIDE.md)

### Examples
- [Basic Trading Bot](./examples/basic-bot.ts)
- [Multi-Strategy System](./examples/multi-strategy.ts)
- [Swarm Trading](./examples/swarm-trading.ts)
- [Custom GOAP Goals](./examples/custom-goap.ts)
- [Custom Data Feed](./examples/custom-feed.ts)

### Community
- GitHub: https://github.com/ruvnet/agentdb-site
- Discord: https://discord.gg/agentdb
- Documentation: https://agentdb.ruv.io/docs

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## 📄 License

MIT License - see [LICENSE](./LICENSE)

## ⚠️ Disclaimer

This software is for educational and research purposes. Trading involves substantial risk of loss. Always test thoroughly in paper trading mode before using real capital.

---

**Version**: 1.0.0
**Author**: @ruvnet
**Powered by**: AgentDB, Claude Flow, Lean-Agentic, Midstreamer
