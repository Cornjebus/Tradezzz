import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import * as path from 'path';
import * as fs from 'fs/promises';
import { NeuralTrader } from './core/NeuralTrader';
import { TradingConfig } from './types';

export class TradingServer {
  private app: express.Application;
  private httpServer: any;
  private wss: WebSocketServer;
  private trader: NeuralTrader | null = null;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.httpServer = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../dist/ui')));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        trader: this.trader ? 'initialized' : 'not initialized',
        timestamp: Date.now()
      });
    });

    // Initialize trader
    this.app.post('/api/trader/init', async (req, res) => {
      try {
        const config: TradingConfig = req.body;
        this.trader = new NeuralTrader(config);
        await this.trader.initialize();

        res.json({
          success: true,
          message: 'Trader initialized successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Start trading
    this.app.post('/api/trader/start', async (req, res) => {
      if (!this.trader) {
        return res.status(400).json({
          success: false,
          error: 'Trader not initialized'
        });
      }

      try {
        await this.trader.start();

        // Set up real-time updates via WebSocket
        this.startBroadcasting();

        res.json({
          success: true,
          message: 'Trading started'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Stop trading
    this.app.post('/api/trader/stop', (req, res) => {
      if (!this.trader) {
        return res.status(400).json({
          success: false,
          error: 'Trader not initialized'
        });
      }

      this.trader.stop();
      res.json({
        success: true,
        message: 'Trading stopped'
      });
    });

    // Get performance
    this.app.get('/api/trader/performance', (req, res) => {
      if (!this.trader) {
        return res.status(400).json({
          success: false,
          error: 'Trader not initialized'
        });
      }

      const performance = this.trader.getPerformance();
      res.json(performance);
    });

    // Get portfolio
    this.app.get('/api/trader/portfolio', (req, res) => {
      if (!this.trader) {
        return res.status(400).json({
          success: false,
          error: 'Trader not initialized'
        });
      }

      const portfolio = this.trader.getPortfolio();
      res.json(portfolio);
    });

    // Get learning stats
    this.app.get('/api/trader/learning', (req, res) => {
      if (!this.trader) {
        return res.status(400).json({
          success: false,
          error: 'Trader not initialized'
        });
      }

      const stats = this.trader.getLearningStats();
      res.json(stats);
    });

    // Serve UI
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../dist/ui/index.html'));
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      console.log('✓ WebSocket client connected');

      ws.on('message', (message) => {
        console.log('Received:', message.toString());
      });

      ws.on('close', () => {
        console.log('✗ WebSocket client disconnected');
      });
    });
  }

  private startBroadcasting(): void {
    setInterval(() => {
      if (!this.trader) return;

      const data = {
        performance: this.trader.getPerformance(),
        portfolio: this.trader.getPortfolio(),
        learning: this.trader.getLearningStats(),
        timestamp: Date.now()
      };

      this.broadcast(JSON.stringify(data));
    }, 1000);
  }

  private broadcast(message: string): void {
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        console.log(`\n🚀 Neural Trading Server running on http://localhost:${this.port}`);
        console.log(`📊 Dashboard: http://localhost:${this.port}`);
        console.log(`🔌 WebSocket: ws://localhost:${this.port}`);
        console.log(`📡 API: http://localhost:${this.port}/api`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.trader) {
      this.trader.stop();
    }

    this.wss.close();
    this.httpServer.close();
    console.log('\n⏸ Server stopped');
  }
}

// CLI entry point
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000');
  const server = new TradingServer(port);

  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

export default TradingServer;
