/**
 * Neural Trading API Server
 * Production server with Neon PostgreSQL + Clerk Authentication
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { NeonDatabase, initializeDatabase } from '../database/NeonDatabase';
import { requireAuth, optionalAuth, getTierLimits } from './middleware/clerk.middleware';
import tradingRoutes from './routes/trading.routes';
import onboardingRoutes from './routes/onboarding.routes';
import { rateLimit, getRateLimitStatus } from './middleware/ratelimit.middleware';
import privacyRoutes from './routes/privacy.routes';
import monitoringRoutes from './routes/monitoring.routes';
import aiProvidersRoutes from './routes/ai-providers.routes';
import exchangesRoutes from './routes/exchanges.routes';
import userSettingsRoutes from './routes/user-settings.routes';

const PORT = process.env.API_PORT || 3001;

export class NeuralTradingServer {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private db!: NeonDatabase;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
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
    this.app.get('/api/health', async (req, res) => {
      try {
        // Test database connection
        await this.db.query('SELECT 1');
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          database: 'connected',
          version: '2.0.0',
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          database: 'disconnected',
        });
      }
    });

    // ============================================
    // USER ROUTES
    // ============================================

    // Get current user profile
    this.app.get('/api/user/me', requireAuth, async (req, res) => {
      try {
        const user = req.auth!.user;
        const limits = getTierLimits(user.tier);

        res.json({
          id: user.id,
          email: user.email,
          tier: user.tier,
          isActive: user.is_active,
          limits,
          createdAt: user.created_at,
        });
      } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
      }
    });

    // Get user settings
    this.app.get('/api/user/settings', requireAuth, async (req, res) => {
      try {
        const settings = await this.db.userSettings.findByUserId(req.auth!.userId);
        res.json(settings || {
          timezone: 'UTC',
          notificationsEnabled: true,
          emailAlerts: true,
          riskLevel: 'medium',
        });
      } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
      }
    });

    // Update user settings
    this.app.put('/api/user/settings', requireAuth, async (req, res) => {
      try {
        const settings = await this.db.userSettings.upsert(req.auth!.userId, req.body);
        res.json(settings);
      } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
      }
    });

    // ============================================
    // EXCHANGE ROUTES
    // ============================================

    // List connected exchanges
    this.app.get('/api/exchanges', requireAuth, async (req, res) => {
      try {
        const connections = await this.db.exchangeConnections.findByUserId(req.auth!.userId);

        // Don't return encrypted keys
        const safe = connections.map(c => ({
          id: c.id,
          exchange: c.exchange,
          name: c.name,
          status: c.status,
          lastUsedAt: c.last_used_at,
          createdAt: c.created_at,
        }));

        res.json(safe);
      } catch (error) {
        console.error('List exchanges error:', error);
        res.status(500).json({ error: 'Failed to list exchanges' });
      }
    });

    // Get supported exchanges
    this.app.get('/api/exchanges/supported', (req, res) => {
      res.json([
        { id: 'binance', name: 'Binance', features: ['spot', 'futures', 'margin'] },
        { id: 'coinbase', name: 'Coinbase', features: ['spot'] },
        { id: 'kraken', name: 'Kraken', features: ['spot', 'futures'] },
        { id: 'bybit', name: 'Bybit', features: ['derivatives'] },
        { id: 'okx', name: 'OKX', features: ['spot', 'futures', 'options'] },
      ]);
    });

    // Connect exchange (placeholder - will add real integration)
    this.app.post('/api/exchanges', requireAuth, async (req, res) => {
      try {
        const { exchange, name, apiKey, apiSecret, passphrase } = req.body;

        // Check tier limits
        const limits = getTierLimits(req.auth!.user.tier);
        const existing = await this.db.exchangeConnections.findByUserId(req.auth!.userId);
        if (existing.length >= limits.exchanges) {
          return res.status(403).json({
            error: 'Exchange limit reached',
            limit: limits.exchanges,
            current: existing.length,
          });
        }

        // TODO: Encrypt keys properly with crypto module
        const encryptedKey = Buffer.from(apiKey).toString('base64');
        const encryptedSecret = Buffer.from(apiSecret).toString('base64');
        const encryptedPassphrase = passphrase ? Buffer.from(passphrase).toString('base64') : undefined;

        const connection = await this.db.exchangeConnections.create({
          userId: req.auth!.userId,
          exchange,
          name,
          encryptedApiKey: encryptedKey,
          encryptedApiSecret: encryptedSecret,
          encryptedPassphrase,
        });

        // Log audit
        await this.db.auditLog.log({
          userId: req.auth!.userId,
          action: 'exchange.connect',
          resourceType: 'exchange_connection',
          resourceId: connection.id,
          details: { exchange },
        });

        res.status(201).json({
          id: connection.id,
          exchange: connection.exchange,
          name: connection.name,
          status: connection.status,
        });
      } catch (error) {
        console.error('Connect exchange error:', error);
        res.status(500).json({ error: 'Failed to connect exchange' });
      }
    });

    // Delete exchange connection
    this.app.delete('/api/exchanges/:id', requireAuth, async (req, res) => {
      try {
        const connection = await this.db.exchangeConnections.findById(req.params.id);

        if (!connection || connection.user_id !== req.auth!.userId) {
          return res.status(404).json({ error: 'Exchange connection not found' });
        }

        await this.db.exchangeConnections.delete(req.params.id);

        await this.db.auditLog.log({
          userId: req.auth!.userId,
          action: 'exchange.disconnect',
          resourceType: 'exchange_connection',
          resourceId: req.params.id,
        });

        res.json({ success: true });
      } catch (error) {
        console.error('Delete exchange error:', error);
        res.status(500).json({ error: 'Failed to delete exchange' });
      }
    });

    // ============================================
    // AI PROVIDER ROUTES
    // ============================================

    // List AI providers
    this.app.get('/api/ai-providers', requireAuth, async (req, res) => {
      try {
        const providers = await this.db.aiProviders.findByUserId(req.auth!.userId);

        const safe = providers.map(p => ({
          id: p.id,
          provider: p.provider,
          name: p.name,
          status: p.status,
          defaultModel: p.default_model,
          totalTokensUsed: p.total_tokens_used,
          totalRequests: p.total_requests,
          lastUsedAt: p.last_used_at,
        }));

        res.json(safe);
      } catch (error) {
        console.error('List AI providers error:', error);
        res.status(500).json({ error: 'Failed to list AI providers' });
      }
    });

    // Get supported AI providers
    this.app.get('/api/ai-providers/supported', (req, res) => {
      res.json([
        { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
        { id: 'anthropic', name: 'Anthropic', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
        { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'] },
        { id: 'google', name: 'Google AI', models: ['gemini-pro', 'gemini-ultra'] },
      ]);
    });

    // Add AI provider
    this.app.post('/api/ai-providers', requireAuth, async (req, res) => {
      try {
        const { provider, name, apiKey, defaultModel } = req.body;

        // TODO: Encrypt key properly
        const encryptedKey = Buffer.from(apiKey).toString('base64');

        const aiProvider = await this.db.aiProviders.create({
          userId: req.auth!.userId,
          provider,
          name,
          encryptedApiKey: encryptedKey,
          defaultModel,
        });

        await this.db.auditLog.log({
          userId: req.auth!.userId,
          action: 'ai_provider.add',
          resourceType: 'ai_provider',
          resourceId: aiProvider.id,
          details: { provider },
        });

        res.status(201).json({
          id: aiProvider.id,
          provider: aiProvider.provider,
          name: aiProvider.name,
          status: aiProvider.status,
        });
      } catch (error) {
        console.error('Add AI provider error:', error);
        res.status(500).json({ error: 'Failed to add AI provider' });
      }
    });

    // Delete AI provider
    this.app.delete('/api/ai-providers/:id', requireAuth, async (req, res) => {
      try {
        const provider = await this.db.aiProviders.findById(req.params.id);

        if (!provider || provider.user_id !== req.auth!.userId) {
          return res.status(404).json({ error: 'AI provider not found' });
        }

        await this.db.aiProviders.delete(req.params.id);

        await this.db.auditLog.log({
          userId: req.auth!.userId,
          action: 'ai_provider.remove',
          resourceType: 'ai_provider',
          resourceId: req.params.id,
        });

        res.json({ success: true });
      } catch (error) {
        console.error('Delete AI provider error:', error);
        res.status(500).json({ error: 'Failed to delete AI provider' });
      }
    });

    // ============================================
    // STRATEGY ROUTES
    // ============================================

    // List strategies
    this.app.get('/api/strategies', requireAuth, async (req, res) => {
      try {
        const strategies = await this.db.strategies.findByUserId(req.auth!.userId);
        res.json(strategies);
      } catch (error) {
        console.error('List strategies error:', error);
        res.status(500).json({ error: 'Failed to list strategies' });
      }
    });

    // Create strategy
    this.app.post('/api/strategies', requireAuth, async (req, res) => {
      try {
        const { name, description, type, config } = req.body;

        // Check tier limits
        const limits = getTierLimits(req.auth!.user.tier);
        const count = await this.db.strategies.countByUserId(req.auth!.userId);
        if (count >= limits.strategies) {
          return res.status(403).json({
            error: 'Strategy limit reached',
            limit: limits.strategies,
            current: count,
          });
        }

        const strategy = await this.db.strategies.create({
          userId: req.auth!.userId,
          name,
          description,
          type,
          config,
        });

        res.status(201).json(strategy);
      } catch (error) {
        console.error('Create strategy error:', error);
        res.status(500).json({ error: 'Failed to create strategy' });
      }
    });

    // Get strategy
    this.app.get('/api/strategies/:id', requireAuth, async (req, res) => {
      try {
        const strategy = await this.db.strategies.findById(req.params.id);

        if (!strategy || strategy.user_id !== req.auth!.userId) {
          return res.status(404).json({ error: 'Strategy not found' });
        }

        res.json(strategy);
      } catch (error) {
        console.error('Get strategy error:', error);
        res.status(500).json({ error: 'Failed to get strategy' });
      }
    });

    // Update strategy
    this.app.put('/api/strategies/:id', requireAuth, async (req, res) => {
      try {
        const strategy = await this.db.strategies.findById(req.params.id);

        if (!strategy || strategy.user_id !== req.auth!.userId) {
          return res.status(404).json({ error: 'Strategy not found' });
        }

        const updated = await this.db.strategies.update(req.params.id, req.body);
        res.json(updated);
      } catch (error) {
        console.error('Update strategy error:', error);
        res.status(500).json({ error: 'Failed to update strategy' });
      }
    });

    // Delete strategy
    this.app.delete('/api/strategies/:id', requireAuth, async (req, res) => {
      try {
        const strategy = await this.db.strategies.findById(req.params.id);

        if (!strategy || strategy.user_id !== req.auth!.userId) {
          return res.status(404).json({ error: 'Strategy not found' });
        }

        await this.db.strategies.delete(req.params.id);
        res.json({ success: true });
      } catch (error) {
        console.error('Delete strategy error:', error);
        res.status(500).json({ error: 'Failed to delete strategy' });
      }
    });

    // ============================================
    // ORDER ROUTES
    // ============================================

    // List orders
    this.app.get('/api/orders', requireAuth, async (req, res) => {
      try {
        const { status, mode, limit } = req.query;
        const orders = await this.db.orders.findByUserId(req.auth!.userId, {
          status: status as string,
          mode: mode as string,
          limit: limit ? parseInt(limit as string) : undefined,
        });
        res.json(orders);
      } catch (error) {
        console.error('List orders error:', error);
        res.status(500).json({ error: 'Failed to list orders' });
      }
    });

    // ============================================
    // POSITION ROUTES
    // ============================================

    // List open positions
    this.app.get('/api/positions', requireAuth, async (req, res) => {
      try {
        const positions = await this.db.positions.findOpen(req.auth!.userId);
        res.json(positions);
      } catch (error) {
        console.error('List positions error:', error);
        res.status(500).json({ error: 'Failed to list positions' });
      }
    });

    // ============================================
    // TRADING MODE & PAPER TRADING ROUTES (Phase 10)
    // ============================================
    this.app.use('/api/trading', tradingRoutes);

    // ============================================
    // ONBOARDING & DISCLAIMER ROUTES (Phase 11)
    // ============================================
    this.app.use('/api/onboarding', onboardingRoutes);

    // ============================================
    // RATE LIMITING (Phase 12)
    // ============================================
    // Apply global rate limiting to all API routes
    this.app.use('/api', rateLimit({ tierBased: true }));

    // Rate limit status endpoint
    this.app.get('/api/ratelimit/status', requireAuth, getRateLimitStatus);

    // ============================================
    // PRIVACY & DATA EXPORT ROUTES (Phase 13)
    // ============================================
    this.app.use('/api/privacy', privacyRoutes);

    // ============================================
    // MONITORING & ALERTING ROUTES (Phase 15)
    // ============================================
    this.app.use('/api/monitoring', monitoringRoutes);

    // ============================================
    // AI PROVIDER ROUTES (Phase 16)
    // ============================================
    this.app.use('/api/ai', aiProvidersRoutes);

    // ============================================
    // EXCHANGE ROUTES (Phase 9)
    // ============================================
    this.app.use('/api/exchanges', exchangesRoutes);

    // ============================================
    // USER SETTINGS ROUTES
    // ============================================
    this.app.use('/api/settings', userSettingsRoutes);

    // Error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      console.log('✓ WebSocket client connected');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch {
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log('✗ WebSocket client disconnected');
      });

      ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
    });
  }

  private handleWebSocketMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      case 'subscribe':
        ws.send(JSON.stringify({ type: 'subscribed', channel: data.channel }));
        break;
      default:
        ws.send(JSON.stringify({ type: 'unknown', received: data.type }));
    }
  }

  async start(): Promise<void> {
    // Initialize database
    this.db = await initializeDatabase();

    return new Promise((resolve) => {
      this.httpServer.listen(PORT, () => {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║                                                            ║');
        console.log('║   🧠 Neural Trading API v2.0                               ║');
        console.log('║                                                            ║');
        console.log(`║   API:        http://localhost:${PORT}                        ║`);
        console.log(`║   WebSocket:  ws://localhost:${PORT}                          ║`);
        console.log('║   Database:   Neon PostgreSQL (connected)                  ║');
        console.log('║   Auth:       Clerk                                        ║');
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
    await this.db.close();
  }
}

// CLI entry point
if (require.main === module) {
  const server = new NeuralTradingServer();

  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

export default NeuralTradingServer;
