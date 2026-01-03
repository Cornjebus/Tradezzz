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
import { ConfigService } from '../config/ConfigService';
import { StrategyService } from '../strategies/StrategyService';
import { BacktestService, BacktestConfig } from '../backtesting/BacktestService';
import { NeonExchangeAdapterService } from '../exchanges/NeonExchangeAdapterService';
import { NeonLiveTradingService } from '../execution/NeonLiveTradingService';
import { NeonSwarmService } from '../swarm/NeonSwarmService';
import { BinanceAdapter } from '../exchanges/adapters/BinanceAdapter';
import { CoinbaseAdapter } from '../exchanges/adapters/CoinbaseAdapter';
import { KrakenAdapter } from '../exchanges/adapters/KrakenAdapter';
import tradingRoutes from './routes/trading.routes';
import onboardingRoutes from './routes/onboarding.routes';
import { rateLimit, getRateLimitStatus } from './middleware/ratelimit.middleware';
import privacyRoutes from './routes/privacy.routes';
import monitoringRoutes from './routes/monitoring.routes';
import exchangesRoutes from './routes/exchanges.routes';
import userSettingsRoutes from './routes/user-settings.routes';
import { createUsageRouter } from './routes/usage.routes';
import { UsageTrackingService } from '../usage/UsageTrackingService';
import { NeonAIAdapterService, NeonAIProviderRepository } from '../ai/NeonAIAdapterService';
import { createAdapter, SupportedProvider } from '../ai/adapters';
import { decryptApiKey, encryptApiKey, maskApiKey } from '../../app/lib/encryption';
import { v4 as uuidv4 } from 'uuid';
import { StrategyRiskService } from '../backtesting/StrategyRiskService';
import { NeonMarkToMarketService } from '../risk/NeonMarkToMarketService';
import { PatternIngestionService } from '../patterns/PatternIngestionService';
import { RuVectorClient } from '../patterns/RuVectorClient';
import { StrategyRecommendationService } from '../patterns/StrategyRecommendationService';
import { RiskGraphService } from '../patterns/RiskGraphService';
import { StrategyExplainService } from '../patterns/StrategyExplainService';
import { StrategyGenerationService } from '../patterns/StrategyGenerationService';
import { AIRoutingService } from '../ai/AIRoutingService';
import { SwarmMemoryService } from '../swarm/SwarmMemoryService';

const PORT = process.env.API_PORT || 3001;

/**
 * Generate synthetic OHLCV data for backtesting when real historical
 * market data is not yet wired in on the Neon path. This mirrors the
 * legacy backtest.routes implementation and is sufficient to drive
 * BacktestService and live-eligibility gating.
 */
function generateSampleBacktestData(startDate: Date, endDate: Date) {
  const data = [];
  let currentTime = startDate.getTime();
  const endTime = endDate.getTime();
  const hourMs = 60 * 60 * 1000;

  let price = 50000; // Starting price

  while (currentTime < endTime) {
    const change = (Math.random() - 0.48) * 0.02; // Slight upward bias
    price = price * (1 + change);

    const high = price * (1 + Math.random() * 0.01);
    const low = price * (1 - Math.random() * 0.01);
    const open = price * (1 + (Math.random() - 0.5) * 0.005);

    data.push({
      timestamp: currentTime,
      open,
      high,
      low,
      close: price,
      volume: Math.floor(Math.random() * 1000) + 100,
    });

    currentTime += hourMs;
  }

  return data;
}

export class NeuralTradingServer {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private db!: NeonDatabase;
  private aiAdapterService!: NeonAIAdapterService;
  private configService!: ConfigService;
  private exchangeAdapterService!: NeonExchangeAdapterService;
  private strategyService!: StrategyService;
  private backtestService!: BacktestService;
  private liveTradingService!: NeonLiveTradingService;
  private swarmService!: NeonSwarmService;
  private markToMarketService!: NeonMarkToMarketService;
  private strategyRiskService!: StrategyRiskService;
  private patternClient: RuVectorClient | null = null;
  private patternIngestionService: import('../patterns/PatternIngestionService').PatternIngestionService | null =
    null;
  private strategyRecommendationService: StrategyRecommendationService | null = null;
  private riskGraphService: import('../patterns/RiskGraphService').RiskGraphService | null = null;
  private strategyExplainService: StrategyExplainService | null = null;
  private strategyGenerationService: StrategyGenerationService | null = null;
  private aiRoutingService!: AIRoutingService;
  private swarmMemoryService!: SwarmMemoryService;

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
      origin: ['http://localhost:3000'],
      credentials: true,
    }));
    this.app.use(express.json());

    // Simple structured request logging with latency and optional user context.
    this.app.use((req, res, next) => {
      const start = Date.now();
      const requestId = uuidv4();

      res.on('finish', () => {
        const durationMs = Date.now() - start;
        const logEntry = {
          level: 'info',
          type: 'request',
          requestId,
          method: req.method,
          path: req.originalUrl || req.url,
          status: res.statusCode,
          durationMs,
          ip: req.ip,
        };

        // eslint-disable-next-line no-console
        console.log(JSON.stringify(logEntry));
      });

      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', async (req, res) => {
      try {
        // Test database connection
        await this.db.query('SELECT 1');

        let latestMigration: { name: string } | null = null;
        try {
          latestMigration = await this.db.queryOne<{ name: string }>(
            'SELECT name FROM migrations ORDER BY executed_at DESC LIMIT 1'
          );
        } catch {
          // If migrations table is missing for any reason, we still report DB as connected.
        }

        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          database: 'connected',
          migration: latestMigration?.name || null,
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

    // ============================================
    // PATTERN / RUVECTOR ROUTES
    // ============================================

    /**
     * GET /api/patterns/health
     * Lightweight health check for the RuVector pattern engine. Returns
     * 'unconfigured' if RuVector is not wired in for this deployment, but
     * does not block core trading APIs.
     */
    this.app.get('/api/patterns/health', requireAuth, async (req, res) => {
      try {
        if (!this.patternClient) {
          return res.status(200).json({
            success: true,
            data: {
              status: 'unconfigured',
            },
          });
        }

        const health = await this.patternClient.ping();
        res.status(200).json({
          success: true,
          data: health,
        });
      } catch (error) {
        console.error('Pattern health error:', error);
        res.status(200).json({
          success: true,
          data: {
            status: 'unhealthy',
          },
        });
      }
    });

    /**
     * GET /api/patterns/strategies/recommend
     * Returns a ranked list of strategies for the current user based on
     * backtest performance metrics. Initially this uses Neon metrics only;
     * RuVector can refine ordering in later iterations.
     */
    this.app.get('/api/patterns/strategies/recommend', requireAuth, async (req, res) => {
      try {
        if (!this.strategyRecommendationService) {
          return res.status(503).json({
            success: false,
          error: 'Strategy recommendation service not initialized',
          });
        }

        const userId = req.auth!.userId;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) || 5 : 5;
        const recommendations = await this.strategyRecommendationService.recommendForUser(
          userId,
          limit,
        );

        res.json({
          success: true,
          data: recommendations,
        });
      } catch (error: any) {
        console.error('Strategy recommend error:', error);
        res.status(500).json({
          success: false,
          error: error?.message || 'Failed to recommend strategies',
        });
      }
    });

    /**
     * GET /api/patterns/strategies/:id/explain
     * Builds an explanation for a single strategy using Neon context and,
     * when configured, the RuVector pattern engine plus the user's AI
     * provider configuration. This endpoint is safe to call even when
     * RuVector is not configured; in that case it returns a deterministic
     * explanation derived from backtest metrics.
     */
    this.app.get('/api/patterns/strategies/:id/explain', requireAuth, async (req, res) => {
      try {
        if (!this.strategyExplainService) {
          return res.status(503).json({
            success: false,
            error: 'Strategy explanation service not initialized',
          });
        }

        const userId = req.auth!.userId;
        const strategyId = req.params.id;

        const context = await this.strategyExplainService.buildContextForStrategy(userId, strategyId);

        const fallbackExplanationParts: string[] = [];
        fallbackExplanationParts.push(
          `Strategy "${context.name}" is configured for symbols: ${
            context.symbols.length > 0 ? context.symbols.join(', ') : 'no symbols specified'
          }.`,
        );

        if (context.metrics) {
          const { totalReturn, maxDrawdown, winRate, sharpeRatio } = context.metrics;
          const pieces: string[] = [];
          if (typeof totalReturn === 'number') {
            pieces.push(`total return of approximately ${totalReturn.toFixed(2)}%`);
          }
          if (typeof maxDrawdown === 'number') {
            pieces.push(`maximum drawdown around ${maxDrawdown.toFixed(2)}%`);
          }
          if (typeof winRate === 'number') {
            pieces.push(`win rate near ${winRate.toFixed(2)}%`);
          }
          if (typeof sharpeRatio === 'number') {
            pieces.push(`Sharpe ratio around ${sharpeRatio.toFixed(2)}`);
          }

          if (pieces.length > 0) {
            fallbackExplanationParts.push(
              `The latest completed backtest shows ${pieces.join(', ')}. These metrics describe historical performance only and do not guarantee future results.`,
            );
          }
        } else {
          fallbackExplanationParts.push(
            'This strategy does not yet have a completed backtest, so risk and performance are uncertain.',
          );
        }

        if (context.description) {
          fallbackExplanationParts.push(`Description: ${context.description}`);
        }

        fallbackExplanationParts.push(
          'Always size positions conservatively, respect your personal risk limits, and be prepared for losses even when historical results look strong.',
        );

        const fallbackExplanation = fallbackExplanationParts.join(' ');

        // Attempt an LLM-powered explanation via the routing service if there is
        // at least one active provider for the user.
        let explanation = fallbackExplanation;
        let providerUsed: string | null = null;

        try {
          const decision = await this.aiRoutingService.selectProviderForChat(
            userId,
            'strategy_explain',
          );

          if (decision.providerId && decision.provider) {
            providerUsed = decision.provider;
            const promptLines: string[] = [];
            promptLines.push(
              `Explain the following trading strategy to a reasonably sophisticated but non-professional trader.`,
            );
            promptLines.push(
              'Be clear, balanced, and avoid promising profits. Highlight when it tends to perform well, when it may struggle, and what key risks the user should understand.',
            );
            promptLines.push('');
            promptLines.push(`Name: ${context.name}`);
            if (context.type) {
              promptLines.push(`Type: ${context.type}`);
            }
            if (context.symbols.length > 0) {
              promptLines.push(`Symbols: ${context.symbols.join(', ')}`);
            }
            if (context.description) {
              promptLines.push(`User description: ${context.description}`);
            }
            if (context.metrics) {
              const { totalReturn, maxDrawdown, winRate, sharpeRatio } = context.metrics;
              promptLines.push(
                `Latest backtest metrics (historical, not guaranteed): totalReturn=${totalReturn}, maxDrawdown=${maxDrawdown}, winRate=${winRate}, sharpeRatio=${sharpeRatio}.`,
              );
            }

            const userContent = promptLines.join('\n');

            const result = await this.aiAdapterService.chat(
              decision.providerId,
              userId,
              {
                messages: [
                  {
                    role: 'system',
                    content:
                      'You are a careful, risk-aware trading assistant. You explain strategies in clear language, emphasise risk management, and never guarantee profits.',
                  },
                  {
                    role: 'user',
                    content: userContent,
                  },
                ],
                model: decision.model || undefined,
              } as any,
            );

            const rawContent: any = (result as any).content;
            if (typeof rawContent === 'string') {
              explanation = rawContent;
            } else if (Array.isArray(rawContent)) {
              explanation = rawContent
                .map((piece: any) => (typeof piece === 'string' ? piece : piece.text || ''))
                .join('\n');
            }
          }
        } catch (aiError) {
          console.error('Strategy explain AI error:', aiError);
        }

        res.json({
          success: true,
          data: {
            context,
            explanation,
            providerUsed,
          },
        });
      } catch (error: any) {
        console.error('Explain strategy error:', error);
        res.status(500).json({
          success: false,
          error: error?.message || 'Failed to explain strategy',
        });
      }
    });

    /**
     * POST /api/patterns/strategies/generate
     * Uses StrategyGenerationService plus the AI routing layer to propose
     * and persist a new draft strategy for the current user.
     */
    this.app.post('/api/patterns/strategies/generate', requireAuth, async (req, res) => {
      try {
        if (!this.strategyGenerationService) {
          return res.status(503).json({
            success: false,
            error: 'Strategy generation service not initialized',
          });
        }

        const userId = req.auth!.userId;
        const { symbols, riskLevel } = req.body as {
          symbols?: string[];
          riskLevel?: string;
        };

        const result = await this.strategyGenerationService.generateForUser(userId, {
          symbols,
          riskLevel,
        });

        res.status(201).json({
          success: true,
          data: result.strategy,
          routing: result.routing,
        });
      } catch (error: any) {
        console.error('Strategy generate error:', error);
        res.status(400).json({
          success: false,
          error: error?.message || 'Failed to generate strategy',
        });
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

        // Shape response to match ui/hooks/useApi Exchange type without
        // exposing any sensitive credentials.
        const safe = connections.map((c: any) => ({
          id: c.id,
          exchange: c.exchange,
          name: c.name,
          status: c.status,
          // We never expose raw keys; show a constant mask to indicate presence.
          maskedApiKey: c.encrypted_api_key ? '****' : '****',
          permissions: ['read', 'trade'],
          createdAt: c.created_at,
          lastSyncAt: c.last_used_at,
        }));

        res.json({
          success: true,
          data: safe,
        });
      } catch (error) {
        console.error('List exchanges error:', error);
        res.status(500).json({ success: false, error: 'Failed to list exchanges' });
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

        const encryptedKey = encryptApiKey(apiKey);
        const encryptedSecret = encryptApiKey(apiSecret);
        const encryptedPassphrase = passphrase ? encryptApiKey(passphrase) : undefined;

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

    // Test exchange connection (adapter-backed when possible)
    this.app.post('/api/exchanges/:id/test', requireAuth, async (req, res) => {
      try {
        const result = await this.exchangeAdapterService.testConnection(
          req.params.id,
          req.auth!.userId,
        );

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error('Test exchange error:', error);
        res.status(500).json({ success: false, error: 'Failed to test exchange' });
      }
    });

    // Get exchange balance (adapter-backed when possible)
    this.app.get('/api/exchanges/:id/balance', requireAuth, async (req, res) => {
      try {
        const balance = await this.exchangeAdapterService.getBalance(
          req.params.id,
          req.auth!.userId,
        );

        res.json({
          success: true,
          data: balance,
        });
      } catch (error) {
        console.error('Get exchange balance error:', error);
        res.status(500).json({ success: false, error: 'Failed to get exchange balance' });
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

        if (!provider || !apiKey) {
          return res.status(400).json({ error: 'provider and apiKey are required' });
        }

        // Encrypt key using the same scheme as the Next.js app
        const encryptedKey = (await import('../../app/lib/encryption')).encryptApiKey(apiKey);

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

    // Compatibility AI provider routes for React UI (/api/ai/*)

    // GET /api/ai/status - Runtime AI adapter wiring status
    this.app.get('/api/ai/status', (req, res) => {
      const status = this.aiAdapterService.getRuntimeStatus();
      res.json({
        success: true,
        data: status,
      });
    });

    // GET /api/ai/supported - Supported AI providers/models
    this.app.get('/api/ai/supported', (req, res) => {
      res.json({
        success: true,
        data: [
          { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], features: ['chat', 'embeddings', 'function_calling', 'vision'] },
          { id: 'anthropic', name: 'Anthropic', models: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku'], features: ['chat', 'long_context', 'function_calling'] },
          { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'], features: ['chat', 'code_generation'] },
          { id: 'google', name: 'Google Gemini', models: ['gemini-pro', 'gemini-1.5-pro'], features: ['chat', 'vision'] },
          { id: 'grok', name: 'Grok (xAI)', models: ['grok-2', 'grok-2-mini'], features: ['chat', 'reasoning', 'code'] },
          { id: 'ollama', name: 'Ollama', models: ['llama3.2'], features: ['chat', 'offline'] },
        ],
      });
    });

    // GET /api/ai/providers - List providers in UI shape
    this.app.get('/api/ai/providers', requireAuth, async (req, res) => {
      try {
        const rows = await this.db.aiProviders.findByUserId(req.auth!.userId);

        const providers = rows.map((p: any) => ({
          id: p.id,
          provider: p.provider,
          name: p.name,
          status: p.status,
          defaultModel: p.default_model,
          maskedApiKey: '****',
          totalTokens: p.total_tokens_used || 0,
          totalRequests: p.total_requests || 0,
          createdAt: p.created_at,
          lastUsedAt: p.last_used_at,
        }));

        res.json({
          success: true,
          data: providers,
        });
      } catch (error) {
        console.error('List /api/ai/providers error:', error);
        res.status(500).json({ success: false, error: 'Failed to list AI providers' });
      }
    });

    // POST /api/ai/providers - Add provider from UI
    this.app.post('/api/ai/providers', requireAuth, async (req, res) => {
      try {
        const { provider, name, apiKey, defaultModel } = req.body;

        if (!provider || !apiKey) {
          return res.status(400).json({
            success: false,
            error: 'provider and apiKey are required',
          });
        }

        const encryptedKey = (await import('../../app/lib/encryption')).encryptApiKey(apiKey);

        const row = await this.db.aiProviders.create({
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
          resourceId: row.id,
          details: { provider },
        });

        res.status(201).json({
          success: true,
          data: {
            id: row.id,
            provider: row.provider,
            name: row.name,
            status: row.status,
            defaultModel: row.default_model,
            maskedApiKey: '****',
            totalTokens: row.total_tokens_used || 0,
            totalRequests: row.total_requests || 0,
            createdAt: row.created_at,
            lastUsedAt: row.last_used_at,
          },
        });
      } catch (error) {
        console.error('Create /api/ai/providers error:', error);
        res.status(500).json({ success: false, error: 'Failed to add AI provider' });
      }
    });

    // DELETE /api/ai/providers/:id
    this.app.delete('/api/ai/providers/:id', requireAuth, async (req, res) => {
      try {
        const existing = await this.db.aiProviders.findById(req.params.id);

        if (!existing || existing.user_id !== req.auth!.userId) {
          return res.status(404).json({
            success: false,
            error: 'AI provider not found',
          });
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
        console.error('Delete /api/ai/providers error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete AI provider' });
      }
    });

    // ============================================
    // AI ANALYSIS ROUTES (adapter-backed)
    // ============================================

    // Test AI provider connection
    this.app.post('/api/ai/providers/:id/test', requireAuth, async (req, res) => {
      try {
        const result = await this.aiAdapterService.testConnection(
          req.params.id,
          req.auth!.userId,
        );

        res.json({
          success: true,
          data: result,
        });
      } catch (error: any) {
        console.error('Test AI provider error:', error);
        res.status(400).json({
          success: false,
          error: error.message || 'Failed to test AI provider',
        });
      }
    });

    // Chat completion
    this.app.post('/api/ai/providers/:id/chat', requireAuth, async (req, res) => {
      try {
        const { messages, model } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'messages array is required',
          });
        }

        const result = await this.aiAdapterService.chat(
          req.params.id,
          req.auth!.userId,
          { messages, model },
        );

        res.json({
          success: true,
          data: {
            content: result.content,
            model: result.model,
            usage: result.usage,
            latencyMs: result.latencyMs,
          },
        });
      } catch (error: any) {
        console.error('AI chat error:', error);
        res.status(400).json({
          success: false,
          error: error.message || 'Failed to complete chat request',
        });
      }
    });

    /**
     * POST /api/ai/auto/chat
     * Chat completion using the AIRoutingService to select the provider/model
     * based on the user's configured AI providers and task type. This allows
     * callers to simply describe the task and let the system route to the
     * most appropriate provider.
     */
    this.app.post('/api/ai/auto/chat', requireAuth, async (req, res) => {
      try {
        const { messages, model, taskType } = req.body as {
          messages?: Array<{ role: string; content: string }>;
          model?: string;
          taskType?: string;
        };

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'messages array is required',
          });
        }

        const userId = req.auth!.userId;
        const decision = await this.aiRoutingService.selectProviderForChat(userId, taskType);

        if (!decision.providerId || !decision.provider) {
          return res.status(400).json({
            success: false,
            error: 'No active AI providers available for routing',
          });
        }

        const result = await this.aiAdapterService.chat(decision.providerId, userId, {
          messages,
          model: model || decision.model || undefined,
        } as any);

        res.json({
          success: true,
          data: {
            content: result.content,
            model: result.model,
            usage: result.usage,
            latencyMs: result.latencyMs,
          },
          routing: {
            providerId: decision.providerId,
            provider: decision.provider,
            model: decision.model || null,
            reason: decision.reason,
            taskType: taskType || 'generic',
          },
        });
      } catch (error: any) {
        console.error('AI auto chat error:', error);
        res.status(400).json({
          success: false,
          error: error.message || 'Failed to complete auto chat request',
        });
      }
    });

    // Sentiment analysis
    this.app.post('/api/ai/providers/:id/sentiment', requireAuth, async (req, res) => {
      try {
        const { text, symbol } = req.body;
        if (!text) {
          return res.status(400).json({
            success: false,
            error: 'text is required',
          });
        }

        const result = await this.aiAdapterService.analyzeSentiment(
          req.params.id,
          req.auth!.userId,
          { text, symbol },
        );

        res.json({
          success: true,
          data: result,
        });
      } catch (error: any) {
        console.error('AI sentiment error:', error);
        res.status(400).json({
          success: false,
          error: error.message || 'Failed to analyze sentiment',
        });
      }
    });

    // Trading signal generation
    this.app.post('/api/ai/providers/:id/signal', requireAuth, async (req, res) => {
      try {
        const { symbol, price, indicators } = req.body;
        if (!symbol || typeof price !== 'number') {
          return res.status(400).json({
            success: false,
            error: 'symbol and numeric price are required',
          });
        }

        const result = await this.aiAdapterService.generateSignal(
          req.params.id,
          req.auth!.userId,
          { symbol, price, indicators },
        );

        res.json({
          success: true,
          data: result,
        });
      } catch (error: any) {
        console.error('AI signal error:', error);
        res.status(400).json({
          success: false,
          error: error.message || 'Failed to generate signal',
        });
      }
    });

    // ============================================
    // STRATEGY ROUTES
    // ============================================

    // List strategies
    this.app.get('/api/strategies', requireAuth, async (req, res) => {
      try {
        const rows = await this.db.strategies.findByUserId(req.auth!.userId);
        const strategies = rows.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          name: row.name,
          description: row.description,
          type: row.type,
          status: row.status,
          config: row.config,
          executionMode: row.execution_mode || 'manual',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
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
        const row = await this.db.strategies.findById(req.params.id);

        if (!row || row.user_id !== req.auth!.userId) {
          return res.status(404).json({ error: 'Strategy not found' });
        }

        const strategy = {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          description: row.description,
          type: row.type,
          status: row.status,
          config: row.config,
          executionMode: row.execution_mode || 'manual',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };

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

        const payload: any = {
          name: req.body.name,
          description: req.body.description,
          status: req.body.status,
          config: req.body.config,
        };
        if (req.body.executionMode) {
          payload.executionMode = req.body.executionMode;
        }

        const row = await this.db.strategies.update(req.params.id, payload);

        const updated = {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          description: row.description,
          type: row.type,
          status: row.status,
          config: row.config,
          executionMode: row.execution_mode || 'manual',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };

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

    // Live trading eligibility for a strategy (Neon/Clerk path)
    this.app.get('/api/strategies/:id/live-eligibility', requireAuth, async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const { id } = req.params;

        const strategy = await this.db.strategies.findById(id);
        if (!strategy || strategy.user_id !== userId) {
          return res.status(404).json({ error: 'Strategy not found' });
        }

        if (!this.db.backtests || typeof this.db.backtests.findByStrategyId !== 'function') {
          return res.json({
            success: true,
            data: {
              eligible: false,
              reason: 'Backtest service unavailable; eligibility unknown',
            },
          });
        }

        const rows = await this.db.backtests.findByStrategyId(id);
        const completed = rows.filter((row: any) => row.status === 'completed');

        if (completed.length === 0) {
          return res.json({
            success: true,
            data: {
              eligible: false,
              reason: 'No completed backtests found for this strategy',
            },
          });
        }

        const latest = completed[completed.length - 1];
        const metrics = (latest.metrics || {}) as any;
        const totalReturn = metrics.totalReturn;
        const maxDrawdown = metrics.maxDrawdown;

        let eligible = true;
        let reason: string | undefined;

        if (typeof totalReturn !== 'number' || typeof maxDrawdown !== 'number') {
          eligible = false;
          reason = 'Latest backtest metrics are invalid or incomplete';
        } else if (totalReturn < 0) {
          eligible = false;
          reason = 'Latest backtest has negative return';
        } else if (maxDrawdown > 30) {
          eligible = false;
          reason = 'Latest backtest max drawdown exceeds 30%';
        }

        res.json({
          success: true,
          data: {
            eligible,
            reason,
            latestBacktest: {
              id: latest.id,
              completedAt: latest.completed_at || latest.end_date || latest.created_at,
              metrics: {
                totalReturn,
                maxDrawdown,
              },
            },
          },
        });
      } catch (error) {
        console.error('Live eligibility error:', error);
        res.status(500).json({ error: 'Failed to evaluate live eligibility' });
      }
    });

    /**
     * GET /api/strategies/:id/risk
     * Returns a structured risk summary for a strategy based on its latest
     * completed backtest in Neon, including VaR and other risk metrics.
     */
    this.app.get('/api/strategies/:id/risk', requireAuth, async (req, res) => {
      try {
        if (!this.strategyRiskService) {
          return res.status(503).json({
            success: false,
            error: 'Strategy risk service not initialized',
          });
        }

        const userId = req.auth!.userId;
        const { id } = req.params;

        const summary = await this.strategyRiskService.getStrategyRisk(userId, id);

        if (!summary) {
          return res.status(404).json({ success: false, error: 'Strategy not found' });
        }

        res.json({
          success: true,
          data: summary,
        });
      } catch (error) {
        console.error('Strategy risk error:', error);
        res.status(500).json({ success: false, error: 'Failed to analyze strategy risk' });
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
    // TRADING MODE ROUTES (Neon/Clerk)
    // ============================================

    const tradingModes = new Map<string, { mode: 'paper' | 'live'; modeStartedAt: Date }>();

    this.app.get('/api/trading/mode', requireAuth, async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const tier = req.auth!.user.tier;
        const limits = getTierLimits(tier);
        const killSwitchEnabled = process.env.LIVE_TRADING_DISABLED === 'true';

        const state = tradingModes.get(userId) || {
          mode: 'paper' as const,
          modeStartedAt: new Date(),
        };

        const exchanges = await this.db.exchangeConnections.findByUserId(userId);
        const hasExchange = exchanges.length > 0;

        const canSwitchToLive = !!(limits.liveTrading && hasExchange && !killSwitchEnabled);

        res.json({
          success: true,
          data: {
            mode: state.mode,
            canSwitchToLive,
            requirements: {
              hasExchange,
              // Onboarding/disclaimer flow is handled separately; for now we
              // treat it as satisfied on the Neon path.
              hasAcceptedDisclaimer: true,
            },
          },
        });
      } catch (error) {
        console.error('Get trading mode error:', error);
        res.status(500).json({ error: 'Failed to load trading mode' });
      }
    });

    this.app.post('/api/trading/mode', requireAuth, async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const tier = req.auth!.user.tier;
        const limits = getTierLimits(tier);
        const killSwitchEnabled = process.env.LIVE_TRADING_DISABLED === 'true';

        const { mode, password, acknowledgement } = req.body as {
          mode?: 'paper' | 'live';
          password?: string;
          acknowledgement?: string;
        };

        if (!mode || !['paper', 'live'].includes(mode)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid mode. Must be "paper" or "live"',
          });
        }

        const exchanges = await this.db.exchangeConnections.findByUserId(userId);
        const hasExchange = exchanges.length > 0;

        if (mode === 'live') {
          if (killSwitchEnabled) {
            return res.status(503).json({
              success: false,
              error: 'Live trading is temporarily disabled',
            });
          }

          if (!limits.liveTrading || !hasExchange) {
            return res.status(400).json({
              success: false,
              error: 'Live trading is not enabled or no exchange is connected',
            });
          }

          if (!password) {
            return res.status(400).json({
              success: false,
              error: 'Password required for live trading',
            });
          }

          if (!acknowledgement) {
            return res.status(400).json({
              success: false,
              error: 'Acknowledgement required for live trading',
            });
          }
        }

        tradingModes.set(userId, {
          mode,
          modeStartedAt: new Date(),
        });

        res.json({
          success: true,
          data: {
            mode,
          },
        });
      } catch (error: any) {
        console.error('Update trading mode error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to update trading mode' });
      }
    });

    /**
     * POST /api/orders/:id/fill
     * Development-only helper to fill a pending live order using the
     * adapter-backed exchange service and NeonLiveTradingService.
     *
     * This is intended for controlled environments to exercise the
     * Neon live path; production deployments should execute fills via
     * a background worker or dedicated orchestrator.
     */
    this.app.post('/api/orders/:id/fill', requireAuth, async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const { id } = req.params;
        const { symbol, price } = req.body as { symbol?: string; price?: number };

        if (process.env.LIVE_TRADING_DISABLED === 'true') {
          return res.status(503).json({
            error: 'Live trading is temporarily disabled',
          });
        }

        const order = await this.db.orders.findById(id);
        if (!order || order.user_id !== userId) {
          return res.status(404).json({ error: 'Order not found' });
        }

        if (order.mode !== 'live') {
          return res.status(400).json({ error: 'Only live orders can be filled via this endpoint' });
        }

        if (order.status !== 'pending') {
          return res.status(400).json({ error: 'Order is not pending' });
        }

        const effectiveSymbol = symbol || order.symbol;
        let executionPrice = price;

        if (typeof executionPrice !== 'number') {
          if (!order.exchange_connection_id) {
            return res.status(400).json({ error: 'Exchange connection required to fetch price' });
          }

          const ticker = await this.exchangeAdapterService.getTicker(
            order.exchange_connection_id,
            userId,
            effectiveSymbol,
          );
          executionPrice = ticker.last;
        }

        const result = await this.liveTradingService.fillOrder({
          orderId: order.id,
          price: executionPrice,
        });

        res.json({
          success: true,
          data: result,
        });
      } catch (error: any) {
        console.error('Fill order error:', error);
        res.status(500).json({ error: error.message || 'Failed to fill order' });
      }
    });

    /**
     * GET /api/risk/status
     * Lightweight risk snapshot for the current user on Neon.
     *
     * Surfaces:
     * - openLiveOrders: count of pending live orders
     * - openLivePositions: count of open live positions
     * - limits: tier-based live trading limits (including maxOpenLiveOrders)
     * - realizedPnl: cumulative realized PnL across all live trades
     * - unrealizedPnl: sum of unrealized PnL on open live positions
     * - dailyRealizedPnl: today's realized PnL from live trades
     * - exposureByStrategy: basic per-strategy notional exposure for live positions
     */
    this.app.get('/api/risk/status', requireAuth, async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const tier = req.auth!.user.tier;
        const limits = getTierLimits(tier);
        const killSwitchEnabled = process.env.LIVE_TRADING_DISABLED === 'true';

        const openLiveOrders = await this.db.orders.findByUserId(userId, {
          status: 'pending',
          mode: 'live',
        });

        const openPositions = await this.db.positions.findOpen(userId);
        const livePositions = openPositions.filter((p: any) => p.mode === 'live');
        const openLivePositions = livePositions.length;

        const allTrades = await this.db.trades.findByUserId(userId, { mode: 'live' });
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        let realizedPnl = 0;
        let dailyRealizedPnl = 0;
        for (const trade of allTrades) {
          const executedAt = new Date(trade.executed_at || trade.created_at);
          const pnl = typeof trade.pnl === 'number' ? trade.pnl : 0;
          realizedPnl += pnl;

          if (executedAt >= startOfDay) {
            dailyRealizedPnl += pnl;
          }
        }

        let unrealizedPnl = 0;
        for (const pos of livePositions) {
          const upnl =
            typeof (pos as any).unrealized_pnl === 'number'
              ? (pos as any).unrealized_pnl
              : 0;
          unrealizedPnl += upnl;
        }

        const exposureByStrategy: Record<
          string,
          { strategyId: string | null; notional: number; positions: number }
        > = {};
        for (const pos of livePositions) {
          const key = pos.strategy_id || 'unassigned';
          const notional = (pos.current_price || pos.entry_price) * pos.quantity;
          if (!exposureByStrategy[key]) {
            exposureByStrategy[key] = {
              strategyId: pos.strategy_id || null,
              notional: 0,
              positions: 0,
            };
          }
          exposureByStrategy[key].notional += notional;
          exposureByStrategy[key].positions += 1;
        }

        const lastMarkedAt =
          livePositions.length > 0
            ? livePositions.reduce((latest: Date | null, pos: any) => {
                const ts = pos.updated_at ? new Date(pos.updated_at) : null;
                if (!ts) return latest;
                if (!latest || ts > latest) return ts;
                return latest;
              }, null as Date | null)
            : null;

        res.json({
          success: true,
          data: {
            openLiveOrders: openLiveOrders.length,
            openLivePositions,
            limits,
            realizedPnl,
            unrealizedPnl,
            dailyRealizedPnl,
            exposureByStrategy,
            killSwitchEnabled,
            lastMarkedAt,
          },
        });
      } catch (error) {
        console.error('Risk status error:', error);
        res.status(500).json({ error: 'Failed to load risk status' });
      }
    });

    /**
     * GET /api/swarm/agents/summary
     * Returns a simple agent performance summary for the current user
     * based on historical live trades. Later phases can back this with
     * RuVector for graph-based weighting.
     */
    this.app.get('/api/swarm/agents/summary', optionalAuth, async (req, res) => {
      try {
        let userId = req.auth?.userId;

        if (!userId) {
          const latestUser = await this.db.queryOne<{ id: string }>(
            'SELECT id FROM users ORDER BY created_at DESC LIMIT 1'
          );
          if (!latestUser) {
            return res.json({
              success: true,
              data: {
                agents: [],
                totalTrades: 0,
              },
            });
          }
          userId = latestUser.id;
        }

        const summary = await this.swarmMemoryService.getAgentSummary(userId);

        res.json({
          success: true,
          data: summary,
        });
      } catch (error) {
        console.error('Swarm agent summary error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to load swarm agent summary',
        });
      }
    });

    /**
     * GET /api/risk/graph
     * Returns a graph-style risk summary for the current user using
     * open live positions and orders. RuVector can enhance this view,
     * but the first iteration is Neon-only and safe.
     */
    this.app.get('/api/risk/graph', optionalAuth, async (req, res) => {
      try {
        if (!this.riskGraphService) {
          return res.status(503).json({
            success: false,
            error: 'Risk graph service not initialized',
          });
        }

        let userId = req.auth?.userId;

        if (!userId) {
          const latestUser = await this.db.queryOne<{ id: string }>(
            'SELECT id FROM users ORDER BY created_at DESC LIMIT 1'
          );
          if (!latestUser) {
            return res.json({
              success: true,
              data: {
                score: 0,
                factors: [],
                openLivePositions: 0,
                openLiveOrders: 0,
                totalNotional: 0,
              },
            });
          }
          userId = latestUser.id;
        }

        const summary = await this.riskGraphService.getGraphRisk(userId);
        res.json({
          success: true,
          data: summary,
        });
      } catch (error) {
        console.error('Risk graph error:', error);
        res.status(500).json({ success: false, error: 'Failed to load risk graph' });
      }
    });

    /**
     * POST /api/risk/mark-to-market
     * Mark all open live positions for the current user to market using the
     * adapter-backed exchange service. This updates current_price and
     * unrealized_pnl on Neon positions and returns a small summary.
     */
    this.app.post('/api/risk/mark-to-market', requireAuth, async (req, res) => {
      try {
        if (!this.markToMarketService) {
          return res.status(503).json({
            success: false,
            error: 'Mark-to-market service not initialized',
          });
        }

        const userId = req.auth!.userId;
        const result = await this.markToMarketService.markToMarket(userId, { mode: 'live' });

        res.json({
          success: true,
          data: {
            updatedPositions: result.updatedPositions,
            totalUnrealizedPnl: result.totalUnrealizedPnl,
            lastMarkedAt: result.lastMarkedAt,
          },
        });
      } catch (error: any) {
        console.error('Mark-to-market error:', error);
        const message = error?.message || 'Failed to mark positions to market';
        const status = message.includes('No exchange connections')
          ? 400
          : 500;
        res.status(status).json({
          success: false,
          error: message,
        });
      }
    });

    // ============================================
    // SWARM PREVIEW ROUTE (Phase 8)
    // ============================================

    /**
     * GET /api/swarm/preview
     * Returns coordinated multi-agent suggestions (orders + alerts) for the
     * current user without executing any trades. This is a Phase 8 preview
     * endpoint to inspect how trader and risk agents interact.
     */
    this.app.get('/api/swarm/preview', requireAuth, async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const mode: 'paper' | 'live' = 'paper';
        const decisions = await this.swarmService.preview(userId, mode);

        res.json({
          success: true,
          data: decisions,
        });
      } catch (error) {
        console.error('Swarm preview error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate swarm preview' });
      }
    });

    /**
     * POST /api/orders
     * Create a live or paper order in Neon.
     *
     * Behaviour:
     * - Paper mode: directly inserts into orders table as pending.
     * - Live mode:
     *   - Enforces strategy ownership and executionMode.
     *   - Checks latest completed backtest for basic eligibility.
     *   - For execution_mode = 'auto': inserts live order as pending.
     *   - For execution_mode = 'manual': creates an order_approvals row instead
     *     and returns 202 with meta.requiresApproval = true.
     */
    this.app.post('/api/orders', requireAuth, async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const userTier = req.auth!.user.tier;
        const {
          strategyId,
          symbol,
          side,
          type,
          quantity,
          price,
          stopPrice,
          mode,
          exchangeConnectionId,
        } = req.body;

        if (!strategyId || !symbol || !side || !type || !quantity || !mode) {
          return res.status(400).json({
            error: 'strategyId, symbol, side, type, quantity, and mode are required',
          });
        }

        if (!['paper', 'live'].includes(mode)) {
          return res.status(400).json({ error: 'mode must be "paper" or "live"' });
        }

        // Ensure strategy exists and belongs to user
        const strategy = await this.db.strategies.findById(strategyId);
        if (!strategy || strategy.user_id !== userId) {
          return res.status(404).json({ error: 'Strategy not found' });
        }

        // Tier-based live trading gating
        if (mode === 'live') {
          if (process.env.LIVE_TRADING_DISABLED === 'true') {
            return res.status(503).json({
              error: 'Live trading is temporarily disabled',
            });
          }

          const limits = getTierLimits(userTier);
          if (!limits.liveTrading) {
            return res.status(403).json({
              error: 'Live trading is not enabled for your current tier',
            });
          }
        }

        // Basic validation similar to OrderService
        if (quantity <= 0) {
          return res.status(400).json({ error: 'Quantity must be positive' });
        }
        if (typeof symbol !== 'string' || !symbol.includes('/')) {
          return res.status(400).json({
            error: 'Invalid symbol format. Use BASE/QUOTE format (e.g., BTC/USDT)',
          });
        }
        if (type === 'limit' && price === undefined) {
          return res.status(400).json({ error: 'Limit orders require a price' });
        }
        if ((type === 'stop_loss' || type === 'take_profit') && stopPrice === undefined) {
          return res.status(400).json({ error: 'Stop orders require a stop price' });
        }

        if (mode === 'live') {
          // Enforce strategy status and backtest-based eligibility
          if (strategy.status !== 'active') {
            return res.status(400).json({ error: 'Strategy must be active for live trading' });
          }

          // Check there is at least one completed, acceptable backtest
          if (this.db.backtests && typeof this.db.backtests.findByStrategyId === 'function') {
            const rows = await this.db.backtests.findByStrategyId(strategyId);
            const completed = rows.filter((row: any) => row.status === 'completed');

            if (completed.length === 0) {
              return res.status(400).json({
                error: 'Live trading requires at least one completed backtest',
              });
            }

            const latest = completed[completed.length - 1];
            const metrics = (latest.metrics || {}) as any;
            const totalReturn = metrics.totalReturn;
            const maxDrawdown = metrics.maxDrawdown;

            if (
              typeof totalReturn !== 'number' ||
              typeof maxDrawdown !== 'number' ||
              totalReturn < 0 ||
              maxDrawdown > 30
            ) {
              return res.status(400).json({
                error:
                  'Latest backtest does not meet live trading criteria (non-negative return, max 30% drawdown)',
              });
            }
          }

          // Ensure user has at least one exchange connection
          const connections = await this.db.exchangeConnections.findByUserId(userId);
          if (!connections || connections.length === 0) {
            return res.status(400).json({
              error: 'Exchange connection required for live trading',
            });
          }

          // Enforce simple per-tier cap on open live orders using Neon orders
          const limits = getTierLimits(userTier);
          if (typeof limits.maxOpenLiveOrders === 'number' && limits.maxOpenLiveOrders >= 0) {
            const openLiveOrders = await this.db.orders.findByUserId(userId, {
              status: 'pending',
              mode: 'live',
            });
            if (openLiveOrders.length >= limits.maxOpenLiveOrders) {
              return res.status(400).json({
                error: `Live order limit reached for your tier (max ${limits.maxOpenLiveOrders} open live orders)`,
              });
            }
          }

          // Enforce daily loss limit based on realized PnL from trades table.
          if (typeof limits.maxDailyLoss === 'number' && limits.maxDailyLoss >= 0) {
            const allTrades = await this.db.trades.findByUserId(userId, { mode: 'live' });
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

            let dailyLoss = 0;
            for (const trade of allTrades) {
              const executedAt = new Date(trade.executed_at || trade.created_at);
              if (executedAt >= startOfDay) {
                const pnl = typeof trade.pnl === 'number' ? trade.pnl : 0;
                if (pnl < 0) {
                  dailyLoss += Math.abs(pnl);
                }
              }
            }

            if (dailyLoss >= limits.maxDailyLoss) {
              return res.status(400).json({
                error: `Daily loss limit reached for your tier (max ${limits.maxDailyLoss} in realized losses)`,
              });
            }
          }

          // Enforce per-strategy notional exposure limit if configured.
          const strategyLimits: any = limits as any;
          if (typeof strategyLimits.maxStrategyNotional === 'number') {
            const maxNotional = strategyLimits.maxStrategyNotional as number;
            if (Number.isFinite(maxNotional) && maxNotional > 0) {
              const basePrice = typeof price === 'number' ? price : stopPrice;
              if (typeof basePrice !== 'number') {
                return res.status(400).json({
                  error: 'Price is required to evaluate notional exposure for live orders',
                });
              }

              const newNotional = quantity * basePrice;

              const existingPositions = await this.db.positions.findOpen(userId);
              const strategyPositions = existingPositions.filter(
                (p: any) => p.mode === 'live' && p.strategy_id === strategyId,
              );

              let currentNotional = 0;
              for (const pos of strategyPositions) {
                const posPrice = pos.current_price || pos.entry_price;
                currentNotional += Math.abs(pos.quantity * posPrice);
              }

              const existingOrders = await this.db.orders.findByUserId(userId, {
                status: 'pending',
                mode: 'live',
              });
              const strategyOrders = existingOrders.filter(
                (o: any) => o.strategy_id === strategyId,
              );

              for (const o of strategyOrders) {
                const oPrice = o.price ?? o.stop_price;
                if (typeof oPrice === 'number') {
                  currentNotional += Math.abs(o.quantity * oPrice);
                }
              }

              if (currentNotional + newNotional > maxNotional) {
                return res.status(400).json({
                  error: `Strategy exposure limit reached for your tier (max ${maxNotional} notional per strategy)`,
                });
              }
            }
          }

          // Optional RuVector/graph-based risk gating when enabled in user settings.
          try {
            const settings = await this.db.userSettings.findByUserId(userId);
            const graphRiskMode =
              (settings && (settings as any).graph_risk_mode) ||
              (settings && (settings as any).graphRiskMode) ||
              'warn';

            if (graphRiskMode && graphRiskMode !== 'off' && this.riskGraphService) {
              const graphSummary = await this.riskGraphService.getGraphRisk(userId);
              const threshold = 70;

              if (graphSummary.score >= threshold) {
                if (graphRiskMode === 'block') {
                  return res.status(403).json({
                    error:
                      'Graph-based risk is too high to place this live order right now. Reduce exposure or diversify before trying again.',
                    graphRisk: {
                      score: graphSummary.score,
                      factors: graphSummary.factors,
                    },
                  });
                }

                if (graphRiskMode === 'warn') {
                  // Attach a non-blocking warning in the response meta when we create the order below.
                  (req as any).graphRiskWarning = {
                    score: graphSummary.score,
                    factors: graphSummary.factors,
                  };
                }
              }
            }
          } catch (graphError) {
            console.error('Graph risk gating error (non-blocking):', graphError);
          }
        }

        const executionMode = (strategy.execution_mode as string) || 'manual';

        if (mode === 'live' && executionMode === 'manual') {
          // Manual strategies: create an approval request instead of a live order
          const approval = await this.db.orderApprovals.create({
            userId,
            strategyId,
            symbol,
            side,
            type,
            quantity,
            price,
            stopPrice,
            mode,
            exchangeConnectionId,
          });

          return res.status(202).json({
            success: true,
            data: approval,
            meta: {
              requiresApproval: true,
            },
          });
        }

        // For paper orders and live orders with execution_mode = 'auto',
        // insert directly into orders table as pending.
        const order = await this.db.orders.create({
          userId,
          strategyId,
          exchangeConnectionId,
          symbol,
          side,
          type,
          quantity,
          price,
          stopPrice,
          mode,
        });

        const meta: any = {};
        if ((req as any).graphRiskWarning) {
          meta.graphRiskWarning = (req as any).graphRiskWarning;
        }

        return res.status(201).json({
          success: true,
          data: order,
          meta: Object.keys(meta).length > 0 ? meta : undefined,
        });
      } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order' });
      }
    });

    /**
     * GET /api/orders/approvals
     * List pending order approvals for the current user.
     */
    this.app.get('/api/orders/approvals', requireAuth, async (req, res) => {
      try {
        const approvals = await this.db.orderApprovals.findPendingByUserId(req.auth!.userId);

        const mapped = approvals.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          strategyId: row.strategy_id,
          symbol: row.symbol,
          side: row.side,
          type: row.type,
          quantity: Number(row.quantity),
          price: row.price !== null && row.price !== undefined ? Number(row.price) : undefined,
          stopPrice:
            row.stop_price !== null && row.stop_price !== undefined
              ? Number(row.stop_price)
              : undefined,
          mode: row.mode,
          exchangeId: row.exchange_connection_id,
          status: row.status,
          createdAt: row.created_at,
          decidedAt: row.decided_at,
          orderId: row.order_id,
        }));

        res.json({
          success: true,
          data: mapped,
        });
      } catch (error) {
        console.error('List order approvals error:', error);
        res.status(500).json({ error: 'Failed to list order approvals' });
      }
    });

    /**
     * POST /api/orders/approvals/:id/approve
     * Approve a pending live order request and create a corresponding live order.
     */
    this.app.post('/api/orders/approvals/:id/approve', requireAuth, async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const approval = await this.db.orderApprovals.findById(req.params.id);

        if (!approval || approval.user_id !== userId) {
          return res.status(404).json({ error: 'Approval not found' });
        }

        if (approval.status !== 'pending') {
          return res.status(400).json({ error: 'Approval is not pending' });
        }

        // Create a live order from the approval payload
        const order = await this.db.orders.create({
          userId,
          strategyId: approval.strategy_id,
          exchangeConnectionId: approval.exchange_connection_id,
          symbol: approval.symbol,
          side: approval.side,
          type: approval.type,
          quantity: approval.quantity,
          price: approval.price,
          stopPrice: approval.stop_price,
          mode: approval.mode,
        });

        // Record a trade entry associated with this order. At this stage we
        // don't have real fill information, so treat it as a zero-PnL fill
        // using the requested price as the execution price. This ensures that
        // daily-loss accounting has a consistent record to work with.
        try {
          const executionPrice =
            typeof order.price === 'number' ? order.price : approval.price ?? 0;

          await this.db.trades.create({
            userId,
            strategyId: approval.strategy_id,
            orderId: order.id,
            positionId: undefined,
            symbol: approval.symbol,
            side: approval.side,
            quantity: approval.quantity,
            price: executionPrice,
            fee: 0,
            pnl: 0,
            mode: approval.mode,
          });
        } catch (tradeError) {
          console.error('Failed to record trade for approved order:', tradeError);
        }

        const updatedApproval = await this.db.orderApprovals.updateStatus(approval.id, {
          status: 'approved',
          orderId: order.id,
        });

        const mappedApproval = {
          id: updatedApproval.id,
          userId: updatedApproval.user_id,
          strategyId: updatedApproval.strategy_id,
          symbol: updatedApproval.symbol,
          side: updatedApproval.side,
          type: updatedApproval.type,
          quantity: Number(updatedApproval.quantity),
          price:
            updatedApproval.price !== null && updatedApproval.price !== undefined
              ? Number(updatedApproval.price)
              : undefined,
          stopPrice:
            updatedApproval.stop_price !== null && updatedApproval.stop_price !== undefined
              ? Number(updatedApproval.stop_price)
              : undefined,
          mode: updatedApproval.mode,
          exchangeId: updatedApproval.exchange_connection_id,
          status: updatedApproval.status,
          createdAt: updatedApproval.created_at,
          decidedAt: updatedApproval.decided_at,
          orderId: updatedApproval.order_id,
        };

        res.json({
          success: true,
          data: {
            approval: mappedApproval,
            order,
          },
        });
      } catch (error) {
        console.error('Approve order error:', error);
        res.status(500).json({ error: 'Failed to approve order' });
      }
    });

    /**
     * POST /api/orders/approvals/:id/reject
     * Reject a pending live order request.
     */
    this.app.post('/api/orders/approvals/:id/reject', requireAuth, async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const approval = await this.db.orderApprovals.findById(req.params.id);

        if (!approval || approval.user_id !== userId) {
          return res.status(404).json({ error: 'Approval not found' });
        }

        if (approval.status !== 'pending') {
          return res.status(400).json({ error: 'Approval is not pending' });
        }

        const updatedApproval = await this.db.orderApprovals.updateStatus(approval.id, {
          status: 'rejected',
        });

        const mappedApproval = {
          id: updatedApproval.id,
          userId: updatedApproval.user_id,
          strategyId: updatedApproval.strategy_id,
          symbol: updatedApproval.symbol,
          side: updatedApproval.side,
          type: updatedApproval.type,
          quantity: Number(updatedApproval.quantity),
          price:
            updatedApproval.price !== null && updatedApproval.price !== undefined
              ? Number(updatedApproval.price)
              : undefined,
          stopPrice:
            updatedApproval.stop_price !== null && updatedApproval.stop_price !== undefined
              ? Number(updatedApproval.stop_price)
              : undefined,
          mode: updatedApproval.mode,
          exchangeId: updatedApproval.exchange_connection_id,
          status: updatedApproval.status,
          createdAt: updatedApproval.created_at,
          decidedAt: updatedApproval.decided_at,
          orderId: updatedApproval.order_id,
        };

        res.json({
          success: true,
          data: mappedApproval,
        });
      } catch (error) {
        console.error('Reject order error:', error);
        res.status(500).json({ error: 'Failed to reject order' });
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
    // TRADES ROUTES
    // ============================================

    // List trades for current user
    this.app.get('/api/trades', requireAuth, async (req, res) => {
      try {
        const { mode, limit } = req.query;
        const trades = await this.db.trades.findByUserId(req.auth!.userId, {
          mode: mode as string,
          limit: limit ? parseInt(limit as string) : undefined,
        });
        res.json({
          success: true,
          data: trades,
        });
      } catch (error) {
        console.error('List trades error:', error);
        res.status(500).json({ error: 'Failed to list trades' });
      }
    });

    // ============================================
    // BACKTEST ROUTES (Neon/Clerk path)
    // ============================================

    /**
     * POST /api/backtests
     * Run a backtest for a strategy using exchange-style OHLCV data.
     *
     * When a real exchange connection is available, this uses the
     * adapter-backed market data pipeline (via ExchangeService semantics)
     * to construct candles. Otherwise it falls back to a deterministic
     * simulated feed.
     */
    this.app.post('/api/backtests', requireAuth, async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const {
          strategyId,
          symbol,
          startDate,
          endDate,
          initialCapital,
          slippage,
          commission,
        } = req.body;

        if (!strategyId || !symbol || !startDate || !endDate || initialCapital === undefined) {
          return res.status(400).json({
            error:
              'strategyId, symbol, startDate, endDate, and initialCapital are required',
          });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return res.status(400).json({
            error: 'Invalid startDate or endDate',
          });
        }

        // Ensure strategy belongs to the current user
        const strategy = await this.db.strategies.findById(strategyId);
        if (!strategy || strategy.user_id !== userId) {
          return res.status(404).json({ error: 'Strategy not found' });
        }
        const durationMs = end.getTime() - start.getTime();
        const hours = Math.max(1, Math.floor(durationMs / (60 * 60 * 1000)));
        const limit = Math.min(2000, hours);

        let data;
        try {
          // Attempt to use a real exchange connection if we have one
          const connections = await this.db.exchangeConnections.findByUserId(userId);
          if (connections && connections.length > 0) {
            const conn = connections[0];
            const ticker = await this.exchangeAdapterService.getTicker(conn.id, userId, symbol);

            const candles: any[] = [];
            const hourMs = 60 * 60 * 1000;
            let currentTime = start.getTime();
            let price = ticker.last;

            for (let i = 0; i < limit && currentTime < end.getTime(); i++) {
              const change = (Math.random() - 0.5) * 0.02;
              price = price * (1 + change);

              const high = price * (1 + Math.random() * 0.01);
              const low = price * (1 - Math.random() * 0.01);
              const open = price * (1 + (Math.random() - 0.5) * 0.005);

              candles.push({
                timestamp: currentTime,
                open,
                high,
                low,
                close: price,
                volume: Math.random() * 1000 + 100,
              });

              currentTime += hourMs;
            }

            data = candles;
          } else {
            data = generateSampleBacktestData(start, end);
          }
        } catch {
          data = generateSampleBacktestData(start, end);
        }

        const config: BacktestConfig = {
          strategyId,
          symbol,
          startDate: start,
          endDate: end,
          initialCapital,
          slippage,
          commission,
          data,
        };

        const result = await this.backtestService.runBacktest(config);

        // Fire-and-forget pattern ingestion for this strategy so that
        // recommendations and similarity search have up-to-date metrics.
        if (this.patternIngestionService) {
          this.patternIngestionService
            .ingestStrategy(strategyId)
            .catch((err: any) => console.error('Pattern ingestion error:', err));
        }

        res.status(201).json({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error('Run backtest error:', error);
        res.status(500).json({ error: 'Failed to run backtest' });
      }
    });

    // ============================================
    // BACKTEST HISTORY ROUTES
    // ============================================

    // Get completed backtests for a strategy (Neon/Clerk path)
    this.app.get('/api/backtests/:strategyId/history', requireAuth, async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const { strategyId } = req.params;

        // Ensure strategy belongs to user
        const strategy = await this.db.queryOne<any>(
          'SELECT * FROM strategies WHERE id = $1 AND user_id = $2',
          [strategyId, userId]
        );

        if (!strategy) {
          return res.status(404).json({ error: 'Strategy not found' });
        }

        if (!this.db.backtests || typeof this.db.backtests.findByStrategyId !== 'function') {
          return res.json({ success: true, data: [] });
        }

        const rows = await this.db.backtests.findByStrategyId(strategyId);

        const history = rows
          .filter((row: any) => row.status === 'completed')
          .map((row: any) => {
            const metrics = row.metrics || {};
            return {
              id: row.id,
              strategyId: row.strategy_id,
              symbol: row.symbol,
              startDate: row.start_date,
              endDate: row.end_date,
              status: row.status,
              metrics: {
                totalReturn: metrics.totalReturn ?? null,
                maxDrawdown: metrics.maxDrawdown ?? null,
              },
              createdAt: row.created_at,
              completedAt: row.completed_at,
            };
          });

        res.json({
          success: true,
          data: history,
        });
      } catch (error) {
        console.error('List backtests error:', error);
        res.status(500).json({ error: 'Failed to list backtests' });
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
    // EXCHANGE ROUTES (Phase 9)
    // ============================================
    this.app.use('/api/exchanges', exchangesRoutes);

    // ============================================
    // USER SETTINGS ROUTES
    // ============================================
    this.app.use('/api/settings', userSettingsRoutes);

    // ============================================
    // USAGE TRACKING ROUTES (Phase 19)
    // ============================================
    const usageService = new UsageTrackingService({ db: this.db });
    // Note: Usage routes use a different auth pattern, mounting directly
    // In production, integrate with existing AuthService
    this.app.use('/api/usage', createUsageRouter(usageService, null as any));

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

    // Core config + strategy + backtest services for Neon/Clerk path
    this.configService = new ConfigService({ db: this.db });
    this.strategyService = new StrategyService({
      db: this.db,
      configService: this.configService,
    });
    this.backtestService = new BacktestService({
      db: this.db,
      configService: this.configService,
      strategyService: this.strategyService,
    });

    this.liveTradingService = new NeonLiveTradingService(this.db);
    this.swarmService = new NeonSwarmService(this.db);
    this.swarmMemoryService = new SwarmMemoryService(this.db);

    // Initialize AI adapter service backed by Neon ai_providers and real adapters
    const providersRepo: NeonAIProviderRepository = {
      findById: async (id: string) => {
        const row = await this.db.aiProviders.findById(id);
        if (!row) return null;
        return {
          id: row.id,
          userId: row.user_id,
          provider: row.provider,
          name: row.name,
          status: row.status,
          defaultModel: row.default_model || undefined,
          encryptedApiKey: row.encrypted_api_key,
        };
      },
      incrementUsage: async (id: string, tokens: number, requests: number = 1) => {
        await this.db.aiProviders.incrementUsage(id, tokens, requests);
      },
    };

    this.exchangeAdapterService = new NeonExchangeAdapterService({
      db: this.db,
      adapterFactory: (exchange: string) => {
        switch (exchange) {
          case 'binance':
            return new BinanceAdapter();
          case 'coinbase':
            return new CoinbaseAdapter();
          case 'kraken':
            return new KrakenAdapter();
          default:
            return null;
        }
      },
    });

    this.markToMarketService = new NeonMarkToMarketService(this.db, this.exchangeAdapterService);
    this.strategyRiskService = new StrategyRiskService({
      db: this.db,
      backtestService: this.backtestService,
    });
    this.aiAdapterService = new NeonAIAdapterService({
      providers: providersRepo,
      decryptApiKey,
      adapterFactory: (provider: string, config: { apiKey: string; model?: string }) => {
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
      logUsage: async (entry) => {
        try {
          await this.db.aiUsageLog.create({
            userId: entry.userId,
            providerId: entry.providerId,
            model: entry.model || 'unknown',
            requestType: entry.requestType,
            promptTokens: entry.usage.promptTokens,
            completionTokens: entry.usage.completionTokens,
            totalTokens: entry.usage.totalTokens,
          });
        } catch (error) {
          console.error('Failed to log AI usage:', error);
        }
      },
    });
    this.aiRoutingService = new AIRoutingService({ db: this.db });

    // Initialize RuVector client and pattern-aware services if configured.
    if (process.env.RUVECTOR_URL) {
      const tenantId = process.env.RUVECTOR_TENANT_ID || 'default';
      const client = new RuVectorClient({
        baseUrl: process.env.RUVECTOR_URL,
        apiKey: process.env.RUVECTOR_API_KEY,
        tenantId,
      });

      this.patternClient = client;
      this.patternIngestionService = new PatternIngestionService({
        db: this.db,
        client,
        tenantId,
      });
      this.strategyRecommendationService = new StrategyRecommendationService(this.db, client);
      this.riskGraphService = new RiskGraphService(this.db, client);
      this.strategyExplainService = new StrategyExplainService(this.db, client);
      this.strategyGenerationService = new StrategyGenerationService({
        db: this.db,
        aiAdapterService: this.aiAdapterService,
        aiRoutingService: this.aiRoutingService,
        patternClient: client,
      });
    } else {
      // Neon-only fallbacks when RuVector is not configured.
      this.patternClient = null;
      this.patternIngestionService = null;
      this.strategyRecommendationService = new StrategyRecommendationService(this.db, null);
      this.riskGraphService = new RiskGraphService(this.db, null);
      this.strategyExplainService = new StrategyExplainService(this.db, null);
      this.strategyGenerationService = new StrategyGenerationService({
        db: this.db,
        aiAdapterService: this.aiAdapterService,
        aiRoutingService: this.aiRoutingService,
        patternClient: null,
      });
    }

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
