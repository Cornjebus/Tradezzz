import type { NeonDatabase } from '../database/NeonDatabase';

export type AIRoutingTask =
  | 'strategy_explain'
  | 'risk_commentary'
  | 'docs_qa'
  | 'signal'
  | 'sentiment'
  | 'generic';

export interface AIRoutingDecision {
  providerId: string | null;
  provider: string | null;
  model?: string | null;
  reason: string;
}

interface AIRoutingServiceOptions {
  db: NeonDatabase;
}

/**
 * AIRoutingService
 *
 * First iteration: chooses a provider/model for chat-style tasks based on
 * simple, task-aware heuristics over the user's active AI providers in Neon.
 * Later phases can incorporate RuVector call logs and learned policies.
 */
export class AIRoutingService {
  private readonly db: NeonDatabase;

  constructor(options: AIRoutingServiceOptions) {
    this.db = options.db;
  }

  private normalizeTask(task?: string | null): AIRoutingTask {
    if (!task) return 'generic';
    const lower = task.toLowerCase();
    if (lower === 'strategy_explain' || lower === 'strategy-explain') return 'strategy_explain';
    if (lower === 'risk_commentary' || lower === 'risk-commentary') return 'risk_commentary';
    if (lower === 'docs_qa' || lower === 'docs-qa' || lower === 'docs') return 'docs_qa';
    if (lower === 'signal') return 'signal';
    if (lower === 'sentiment') return 'sentiment';
    return 'generic';
  }

  /**
   * Select a provider for chat-like tasks. For now this uses a static
   * per-task priority ordering that roughly follows:
   *   accuracy > latency > cost > privacy
   * given the providers configured for the user.
   */
  async selectProviderForChat(
    userId: string,
    task?: string | AIRoutingTask | null,
  ): Promise<AIRoutingDecision> {
    const normalizedTask = this.normalizeTask(typeof task === 'string' ? task : null);

    const rows: any[] = await this.db.aiProviders.findByUserId(userId);
    const active = Array.isArray(rows)
      ? rows.filter((p) => (p.status || 'active') === 'active')
      : [];

    if (active.length === 0) {
      return {
        providerId: null,
        provider: null,
        model: null,
        reason: 'No active AI providers configured for user',
      };
    }

    const priorities: Record<AIRoutingTask, string[]> = {
      // Explanations and risk commentary prefer frontier, reasoning-capable models.
      strategy_explain: ['anthropic', 'openai', 'grok', 'google', 'deepseek', 'ollama'],
      risk_commentary: ['anthropic', 'openai', 'grok', 'google', 'deepseek', 'ollama'],
      // Docs Q&A and general chat can lean a bit more on cost/latency.
      docs_qa: ['deepseek', 'openai', 'anthropic', 'google', 'grok', 'ollama'],
      // Signals / sentiment can work well with fast, cost-effective providers.
      signal: ['deepseek', 'openai', 'anthropic', 'grok', 'google', 'ollama'],
      sentiment: ['deepseek', 'openai', 'anthropic', 'google', 'grok', 'ollama'],
      // Generic fallback.
      generic: ['anthropic', 'openai', 'deepseek', 'google', 'grok', 'ollama'],
    };

    const ordering = priorities[normalizedTask] || priorities.generic;

    for (const preferred of ordering) {
      const match = active.find((p) => (p.provider || '').toLowerCase() === preferred);
      if (match) {
        return {
          providerId: match.id,
          provider: match.provider,
          model: match.default_model || null,
          reason: `Selected ${match.provider} for task=${normalizedTask} using static priority ordering`,
        };
      }
    }

    const first = active[0];
    return {
      providerId: first.id,
      provider: first.provider,
      model: first.default_model || null,
      reason: `Selected first active provider (${first.provider}) as fallback for task=${normalizedTask}`,
    };
  }
}

