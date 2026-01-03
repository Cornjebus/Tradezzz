import type { NeonDatabase } from '../database/NeonDatabase';
import type { NeonAIAdapterService } from '../ai/NeonAIAdapterService';
import type { AIRoutingService } from '../ai/AIRoutingService';
import type { RuVectorClient } from './RuVectorClient';

export interface StrategyGenerationInput {
  symbols?: string[];
  riskLevel?: string;
}

export interface GeneratedStrategyDraft {
  name: string;
  type: string;
  description?: string;
  config?: Record<string, unknown>;
}

interface StrategyGenerationServiceOptions {
  db: NeonDatabase;
  aiAdapterService: NeonAIAdapterService;
  aiRoutingService: AIRoutingService;
  patternClient: RuVectorClient | null;
}

/**
 * StrategyGenerationService
 *
 * Uses the user's existing strategies and backtests plus an AI provider
 * (selected via AIRoutingService) to propose a new draft strategy. The
 * first iteration uses Neon data only; RuVector can later enrich the
 * context with regime and pattern information.
 */
export class StrategyGenerationService {
  private readonly db: NeonDatabase;
  private readonly aiAdapterService: NeonAIAdapterService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private readonly patternClient: RuVectorClient | null;
  private readonly aiRoutingService: AIRoutingService;

  constructor(options: StrategyGenerationServiceOptions) {
    this.db = options.db;
    this.aiAdapterService = options.aiAdapterService;
    this.aiRoutingService = options.aiRoutingService;
    this.patternClient = options.patternClient;
  }

  async generateForUser(
    userId: string,
    input: StrategyGenerationInput = {},
  ): Promise<any> {
    const strategies = await this.db.strategies.findByUserId(userId);

    const summaryLines: string[] = [];
    if (Array.isArray(strategies) && strategies.length > 0) {
      summaryLines.push(
        `You are designing a new strategy for a user who already has ${strategies.length} strategies.`,
      );

      const maxSummaries = Math.min(3, strategies.length);
      for (let i = 0; i < maxSummaries; i += 1) {
        const s: any = strategies[i];
        summaryLines.push(`Existing strategy #${i + 1}: ${s.name} (type=${s.type}).`);
      }
    } else {
      summaryLines.push(
        'You are designing the first strategy for this user. Favour simple, robust behaviour.',
      );
    }

    if (input.symbols && input.symbols.length > 0) {
      summaryLines.push(`User is interested in symbols: ${input.symbols.join(', ')}.`);
    }
    if (input.riskLevel) {
      summaryLines.push(`User risk preference: ${input.riskLevel}.`);
    }

    summaryLines.push(
      'Propose a single new strategy as concise JSON with fields: name, type, description, config.',
    );
    summaryLines.push(
      'The config field should be an object. Include a symbols array in config when appropriate.',
    );

    const decision = await this.aiRoutingService.selectProviderForChat(userId, 'generic');
    if (!decision.providerId || !decision.provider) {
      throw new Error('No active AI providers available for strategy generation');
    }

    const result = await this.aiAdapterService.chat(decision.providerId, userId, {
      messages: [
        {
          role: 'system',
          content:
            'You are an experienced systematic trading strategist. You design simple, robust, risk-aware strategies and never promise profits.',
        },
        {
          role: 'user',
          content: summaryLines.join('\n'),
        },
      ],
      model: decision.model || undefined,
    } as any);

    const raw: any = (result as any).content;
    let text: string;

    if (typeof raw === 'string') {
      text = raw;
    } else if (Array.isArray(raw)) {
      text = raw
        .map((p: any) => (typeof p === 'string' ? p : p.text || ''))
        .join('\n');
    } else if (raw && typeof raw === 'object' && typeof raw.text === 'string') {
      text = raw.text;
    } else {
      throw new Error('Unable to parse AI response content for strategy generation');
    }

    let parsed: GeneratedStrategyDraft;
    try {
      parsed = JSON.parse(text) as GeneratedStrategyDraft;
    } catch {
      throw new Error('AI response for strategy generation was not valid JSON');
    }

    if (!parsed || typeof parsed.name !== 'string' || typeof parsed.type !== 'string') {
      throw new Error('AI response did not include required strategy fields');
    }

    const config: Record<string, unknown> = parsed.config ? { ...parsed.config } : {};
    if (input.symbols && input.symbols.length > 0 && !Array.isArray((config as any).symbols)) {
      (config as any).symbols = input.symbols;
    }

    const created = await this.db.strategies.create({
      userId,
      name: parsed.name,
      description: parsed.description,
      type: parsed.type,
      config,
      executionMode: 'manual',
    });

    return {
      strategy: created,
      routing: {
        providerId: decision.providerId,
        provider: decision.provider,
        model: decision.model || null,
        reason: decision.reason,
      },
    };
  }
}

