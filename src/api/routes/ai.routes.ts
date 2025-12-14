/**
 * AI Routes - AI Provider API Endpoints
 * Handles AI provider connections, sentiment analysis, and signal generation
 */

import { Router, Request, Response } from 'express';
import { AIProviderService, AIProviderType } from '../../ai/AIProviderService';
import { AuthService } from '../../users/AuthService';
import { createAuthMiddleware } from '../middleware/auth.middleware';
import { asyncHandler, NotFoundError } from '../middleware/error.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const createProviderSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'deepseek', 'google', 'cohere', 'mistral'], {
    message: 'Invalid AI provider',
  }),
  name: z.string().min(1, 'Name is required').max(100),
  apiKey: z.string().min(1, 'API key is required'),
  defaultModel: z.string().optional(),
});

const updateProviderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  defaultModel: z.string().optional(),
});

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().min(1),
  })).min(1),
  model: z.string().optional(),
});

const sentimentSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  symbol: z.string().min(1, 'Symbol is required'),
});

const signalSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.string().min(1),
  priceData: z.array(z.object({
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
  })).min(1),
  indicators: z.object({}).passthrough().optional(),
});

// ============================================================================
// Router Factory
// ============================================================================

export function createAIRouter(
  aiService: AIProviderService,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // ============================================================================
  // GET /supported - Get Supported Providers
  // ============================================================================

  router.get(
    '/supported',
    asyncHandler(async (req: Request, res: Response) => {
      const providers = aiService.getSupportedProviders();
      const providerInfo = providers.map(p => aiService.getProviderInfo(p));

      res.json({
        success: true,
        data: providerInfo,
      });
    })
  );

  // ============================================================================
  // GET /info/:provider - Get Provider Info
  // ============================================================================

  router.get(
    '/info/:provider',
    asyncHandler(async (req: Request, res: Response) => {
      const { provider } = req.params;
      const supported = aiService.getSupportedProviders();

      if (!supported.includes(provider as AIProviderType)) {
        res.status(400).json({
          success: false,
          error: 'Unsupported AI provider',
        });
        return;
      }

      const info = aiService.getProviderInfo(provider as AIProviderType);

      res.json({
        success: true,
        data: info,
      });
    })
  );

  // ============================================================================
  // GET /models/:provider - Get Available Models
  // ============================================================================

  router.get(
    '/models/:provider',
    asyncHandler(async (req: Request, res: Response) => {
      const { provider } = req.params;
      const models = aiService.getAvailableModels(provider as AIProviderType);

      res.json({
        success: true,
        data: models,
      });
    })
  );

  // ============================================================================
  // POST /providers - Create Provider Connection
  // ============================================================================

  router.post(
    '/providers',
    requireAuth,
    validate(createProviderSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { provider, name, apiKey, defaultModel } = req.body;

      const connection = await aiService.createProvider({
        userId,
        provider,
        name,
        apiKey,
        defaultModel,
      });

      res.status(201).json({
        success: true,
        data: connection,
      });
    })
  );

  // ============================================================================
  // GET /providers - List User Providers
  // ============================================================================

  router.get(
    '/providers',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const providers = await aiService.getUserProviders(userId);

      res.json({
        success: true,
        data: providers,
      });
    })
  );

  // ============================================================================
  // GET /providers/:id - Get Single Provider
  // ============================================================================

  router.get(
    '/providers/:id',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const provider = await aiService.getProvider(id);
      if (!provider) {
        throw new NotFoundError('Provider not found');
      }

      if (provider.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: provider,
      });
    })
  );

  // ============================================================================
  // PUT /providers/:id - Update Provider
  // ============================================================================

  router.put(
    '/providers/:id',
    requireAuth,
    validate(updateProviderSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;
      const { name, defaultModel } = req.body;

      const updated = await aiService.updateProvider(id, userId, { name, defaultModel });

      res.json({
        success: true,
        data: updated,
      });
    })
  );

  // ============================================================================
  // DELETE /providers/:id - Delete Provider
  // ============================================================================

  router.delete(
    '/providers/:id',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      await aiService.deleteProvider(id, userId);

      res.json({
        success: true,
        message: 'Provider deleted',
      });
    })
  );

  // ============================================================================
  // POST /providers/:id/test - Test Provider Connection
  // ============================================================================

  router.post(
    '/providers/:id/test',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const provider = await aiService.getProvider(id);
      if (!provider) {
        throw new NotFoundError('Provider not found');
      }

      if (provider.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const result = await aiService.testProvider(id);

      res.json({
        success: true,
        data: result,
      });
    })
  );

  // ============================================================================
  // POST /providers/:id/rotate - Rotate API Key
  // ============================================================================

  router.post(
    '/providers/:id/rotate',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;
      const { apiKey } = req.body;

      if (!apiKey) {
        res.status(400).json({
          success: false,
          error: 'API key is required',
        });
        return;
      }

      await aiService.rotateApiKey(id, userId, apiKey);

      res.json({
        success: true,
        message: 'API key rotated successfully',
      });
    })
  );

  // ============================================================================
  // POST /providers/:id/deactivate - Deactivate Provider
  // ============================================================================

  router.post(
    '/providers/:id/deactivate',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const provider = await aiService.deactivateProvider(id, userId);

      res.json({
        success: true,
        data: provider,
      });
    })
  );

  // ============================================================================
  // POST /providers/:id/activate - Activate Provider
  // ============================================================================

  router.post(
    '/providers/:id/activate',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const provider = await aiService.activateProvider(id, userId);

      res.json({
        success: true,
        data: provider,
      });
    })
  );

  // ============================================================================
  // POST /providers/:id/chat - Chat Completion
  // ============================================================================

  router.post(
    '/providers/:id/chat',
    requireAuth,
    validate(chatSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;
      const { messages, model } = req.body;

      const provider = await aiService.getProvider(id);
      if (!provider) {
        throw new NotFoundError('Provider not found');
      }

      if (provider.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const response = await aiService.chat(id, { messages, model });

      res.json({
        success: true,
        data: response,
      });
    })
  );

  // ============================================================================
  // POST /providers/:id/sentiment - Analyze Sentiment
  // ============================================================================

  router.post(
    '/providers/:id/sentiment',
    requireAuth,
    validate(sentimentSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;
      const { text, symbol } = req.body;

      const provider = await aiService.getProvider(id);
      if (!provider) {
        throw new NotFoundError('Provider not found');
      }

      if (provider.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const result = await aiService.analyzeSentiment(id, { text, symbol });

      res.json({
        success: true,
        data: result,
      });
    })
  );

  // ============================================================================
  // POST /providers/:id/signal - Generate Trading Signal
  // ============================================================================

  router.post(
    '/providers/:id/signal',
    requireAuth,
    validate(signalSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;
      const { symbol, timeframe, priceData, indicators } = req.body;

      const provider = await aiService.getProvider(id);
      if (!provider) {
        throw new NotFoundError('Provider not found');
      }

      if (provider.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const signal = await aiService.generateSignal(id, {
        symbol,
        timeframe,
        priceData,
        indicators,
      });

      res.json({
        success: true,
        data: signal,
      });
    })
  );

  // ============================================================================
  // GET /providers/:id/usage - Get Provider Usage
  // ============================================================================

  router.get(
    '/providers/:id/usage',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      const provider = await aiService.getProvider(id);
      if (!provider) {
        throw new NotFoundError('Provider not found');
      }

      if (provider.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const usage = await aiService.getProviderUsage(id);
      const daily = await aiService.getDailyUsage(id);
      const cost = await aiService.estimateCost(id);

      res.json({
        success: true,
        data: {
          usage,
          daily,
          estimatedCost: cost,
        },
      });
    })
  );

  // ============================================================================
  // GET /usage/monthly - Get Monthly Usage Summary
  // ============================================================================

  router.get(
    '/usage/monthly',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;

      const monthly = await aiService.getMonthlyUsage(userId);

      res.json({
        success: true,
        data: monthly,
      });
    })
  );

  return router;
}
