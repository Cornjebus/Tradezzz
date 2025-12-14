/**
 * Neural Trading System - Main Entry Point
 * Multi-source AI trading with GOAP, SAFLA, and AgentDB
 */

import { TradingServer } from './server';
import { NeuralTrader } from './core/NeuralTrader';
import type { TradingConfig, TradingMode } from './types';

// Re-export core components
export { TradingServer } from './server';
export { NeuralTrader } from './core/NeuralTrader';
export * from './types';

// Default configuration
const defaultConfig: TradingConfig = {
  mode: 'paper' as TradingMode,
  initialCapital: 100000,
  symbols: ['AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA'],
  riskManagement: {
    maxPositionSize: 0.2,
    maxPortfolioRisk: 0.5,
    stopLoss: 0.05,
    takeProfit: 0.15,
    maxDrawdown: 0.25
  },
  goap: {
    enabled: true,
    planningHorizon: 10,
    searchDepth: 5
  },
  safla: {
    enabled: true,
    learningRate: 0.01,
    explorationRate: 0.1,
    discountFactor: 0.95,
    feedbackWindow: 20,
    adaptationThreshold: 0.7
  },
  agentdb: {
    path: './data/agentdb.db',
    quantization: 'uint8',
    enableHnsw: true
  }
};

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                   Neural Trading System                       ║
║          Multi-source AI Trading with GOAP & SAFLA           ║
╚══════════════════════════════════════════════════════════════╝
`);

  switch (command) {
    case 'start':
    case 'server': {
      const port = parseInt(process.env.PORT || '3000');
      const server = new TradingServer(port);

      await server.start();

      // Graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n\n🛑 Shutting down...');
        await server.stop();
        process.exit(0);
      });
      break;
    }

    case 'cli': {
      console.log('🤖 Starting CLI trading mode...\n');
      const trader = new NeuralTrader(defaultConfig);
      await trader.initialize();
      await trader.start();

      process.on('SIGINT', () => {
        console.log('\n\n🛑 Stopping trader...');
        trader.stop();
        process.exit(0);
      });
      break;
    }

    case 'help':
    default:
      console.log(`
Usage: neural-trading <command> [options]

Commands:
  start, server    Start the web server with dashboard
  cli              Run in CLI trading mode (headless)
  help             Show this help message

Options:
  --port <number>  Server port (default: 3000)
  --mode <mode>    Trading mode: paper | live | backtest
  --symbols <list> Comma-separated stock symbols

Examples:
  neural-trading start
  neural-trading cli --mode paper --symbols AAPL,GOOGL
  PORT=8080 neural-trading server

Environment Variables:
  PORT             Server port
  ALPACA_KEY       Alpaca API key
  ALPACA_SECRET    Alpaca API secret
  TWITTER_TOKEN    Twitter API token
  GEMINI_KEY       Google Gemini API key
`);
      break;
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
