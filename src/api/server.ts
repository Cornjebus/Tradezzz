/**
 * Neural Trading API Server
 * Full-stack server with all API routes and services
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createMockDatabase } from '../../tests/helpers/mock-db';
import { AuthService } from '../users/AuthService';
import { ConfigService } from '../config/ConfigService';
import { StrategyService } from '../strategies/StrategyService';
import { BacktestService } from '../backtesting/BacktestService';
import { OrderService } from '../execution/OrderService';
import { ExchangeService, ExchangeType } from '../exchanges/ExchangeService';
import { AIProviderService, AIProviderType } from '../ai/AIProviderService';
import { createAdapter, SupportedProvider } from '../ai/adapters';
import { createAuthRouter } from './routes/auth.routes';
import { createStrategyRouter } from './routes/strategy.routes';
import { createBacktestRouter } from './routes/backtest.routes';
import { createOrderRouter } from './routes/order.routes';
import { createExchangeRouter } from './routes/exchange.routes';
import { createAIRouter } from './routes/ai.routes';
import { createPublicMarketRouter } from './routes/public-market.routes';
import { errorHandler } from './middleware/error.middleware';
import { BinanceAdapter } from '../exchanges/adapters/BinanceAdapter';
import { CoinbaseAdapter } from '../exchanges/adapters/CoinbaseAdapter';
import { KrakenAdapter } from '../exchanges/adapters/KrakenAdapter';

const PORT = process.env.API_PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'neural-trading-jwt-secret-min-32-chars!!';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'neural-trading-encryption-key-32!!';

export class APIServer {
  private app: express.Application;
  private httpServer: any;
  private wss: WebSocketServer;
  private port: number;

  // Services
  public db: any;
  public authService!: AuthService;
  public configService!: ConfigService;
  public strategyService!: StrategyService;
  public backtestService!: BacktestService;
  public orderService!: OrderService;
  public exchangeService!: ExchangeService;
  public aiService!: AIProviderService;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    this.httpServer = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private initializeServices(): void {
    // Initialize mock database (replace with real PostgreSQL in production)
    this.db = createMockDatabase();

    // Initialize services
    this.configService = new ConfigService({ db: this.db });

    this.authService = new AuthService({
      db: this.db,
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '24h',
      refreshTokenExpiresIn: '7d',
    });

    this.strategyService = new StrategyService({
      db: this.db,
      configService: this.configService
    });

    this.backtestService = new BacktestService({
      db: this.db,
      configService: this.configService,
      strategyService: this.strategyService
    });

    this.orderService = new OrderService({
      db: this.db,
      configService: this.configService,
      strategyService: this.strategyService,
      backtestService: this.backtestService,
    });

    this.exchangeService = new ExchangeService({
      db: this.db,
      configService: this.configService,
      encryptionKey: ENCRYPTION_KEY,
      adapterFactory: (exchange: ExchangeType) => {
        if (exchange === 'binance') {
          return new BinanceAdapter();
        }
        if (exchange === 'coinbase') {
          return new CoinbaseAdapter();
        }
        if (exchange === 'kraken') {
          return new KrakenAdapter();
        }
        // For exchanges without a concrete adapter, fall back to the simulated
        // implementation by returning null.
        return null as any;
      },
    });

    this.aiService = new AIProviderService({
      db: this.db,
      configService: this.configService,
      encryptionKey: ENCRYPTION_KEY,
      adapterFactory: (provider: AIProviderType, config: { apiKey: string; model?: string }) => {
        // Only providers that have a concrete adapter are routed through
        // createAdapter; others fall back to AIProviderService's simulated logic.
        const supported: SupportedProvider[] = ['openai', 'anthropic', 'deepseek', 'ollama', 'grok', 'google'];
        if (!supported.includes(provider as SupportedProvider)) {
          return null;
        }

        return createAdapter({
          provider: provider as SupportedProvider,
          apiKey: config.apiKey,
          model: config.model,
        });
      },
    });
  }

  private setupMiddleware(): void {
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
    }));
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          auth: 'ready',
          strategies: 'ready',
          backtesting: 'ready',
          orders: 'ready',
          exchanges: 'ready',
          ai: 'ready',
        }
      });
    });

    // Public API Routes (No Authentication Required)
    this.app.use('/api/public', createPublicMarketRouter(new CoinbaseAdapter()));

    // API Routes (Authentication Required)
    this.app.use('/api/auth', createAuthRouter(this.authService));
    this.app.use('/api/strategies', createStrategyRouter(this.strategyService, this.authService, this.backtestService));
    this.app.use('/api/backtests', createBacktestRouter(this.backtestService, this.strategyService, this.authService));
    this.app.use('/api/orders', createOrderRouter(this.orderService, this.strategyService, this.authService));
    this.app.use('/api/exchanges', createExchangeRouter(this.exchangeService, this.authService));
    this.app.use('/api/ai', createAIRouter(this.aiService, this.authService));

    // Error handler
    this.app.use(errorHandler);
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      console.log('✓ WebSocket client connected');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (e) {
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log('✗ WebSocket client disconnected');
      });

      // Send initial connection confirmation
      ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
    });
  }

  private handleWebSocketMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'subscribe':
        ws.send(JSON.stringify({ type: 'subscribed', channel: data.channel }));
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      default:
        ws.send(JSON.stringify({ type: 'unknown', received: data.type }));
    }
  }

  broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║                                                            ║');
        console.log('║   🧠 Neural Trading API Server                             ║');
        console.log('║                                                            ║');
        console.log(`║   API Server:  http://localhost:${this.port}                    ║`);
        console.log(`║   WebSocket:   ws://localhost:${this.port}                      ║`);
        console.log('║                                                            ║');
        console.log('║   API Endpoints:                                           ║');
        console.log('║   PUBLIC (No Auth):                                        ║');
        console.log('║   ├─ GET  /api/public/prices    Live prices (all coins)    ║');
        console.log('║   ├─ GET  /api/public/ticker/:s Single ticker              ║');
        console.log('║   ├─ GET  /api/public/orderbook Order book                 ║');
        console.log('║   ├─ GET  /api/public/candles   OHLCV data                 ║');
        console.log('║   └─ GET  /api/public/symbols   Available symbols          ║');
        console.log('║   AUTHENTICATED:                                           ║');
        console.log('║   ├─ POST /api/auth/register    Register new user          ║');
        console.log('║   ├─ POST /api/auth/login       Login                      ║');
        console.log('║   ├─ GET  /api/auth/me          Current user               ║');
        console.log('║   ├─ GET  /api/strategies       List strategies            ║');
        console.log('║   ├─ POST /api/strategies       Create strategy            ║');
        console.log('║   ├─ POST /api/backtests        Run backtest               ║');
        console.log('║   ├─ GET  /api/orders           List orders                ║');
        console.log('║   ├─ POST /api/orders           Create order               ║');
        console.log('║   ├─ GET  /api/exchanges/supported  List exchanges         ║');
        console.log('║   └─ GET  /api/ai/supported     List AI providers          ║');
        console.log('║                                                            ║');
        console.log('║   Frontend: http://localhost:3000                          ║');
        console.log('║                                                            ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.wss.close();
    this.httpServer.close();
    console.log('\n⏸ API Server stopped');
  }

  getApp(): express.Application {
    return this.app;
  }
}

// CLI entry point
if (require.main === module) {
  const port = parseInt(process.env.API_PORT || '3001');
  const server = new APIServer(port);

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

export default APIServer;
