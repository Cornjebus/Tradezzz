import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NeonDatabase } from '../database/NeonDatabase';
import { AIRoutingService } from './AIRoutingService';

function createStubDb(): NeonDatabase {
  const db: any = {
    aiProviders: {
      findByUserId: vi.fn(),
    },
  };
  return db as NeonDatabase;
}

describe('AIRoutingService', () => {
  let db: NeonDatabase;
  let service: AIRoutingService;

  beforeEach(() => {
    db = createStubDb();
    service = new AIRoutingService({ db });
  });

  it('returns null provider when user has no active providers', async () => {
    (db.aiProviders.findByUserId as any).mockResolvedValue([]);

    const decision = await service.selectProviderForChat('user-1', 'generic');

    expect(decision.providerId).toBeNull();
    expect(decision.provider).toBeNull();
    expect(decision.reason).toContain('No active AI providers');
  });

  it('prefers anthropic over openai for strategy explanations when both are active', async () => {
    (db.aiProviders.findByUserId as any).mockResolvedValue([
      {
        id: 'prov-openai',
        user_id: 'user-1',
        provider: 'openai',
        name: 'OpenAI',
        status: 'active',
        default_model: 'gpt-4o',
      },
      {
        id: 'prov-claude',
        user_id: 'user-1',
        provider: 'anthropic',
        name: 'Claude',
        status: 'active',
        default_model: 'claude-3-5-sonnet',
      },
    ]);

    const decision = await service.selectProviderForChat('user-1', 'strategy_explain');

    expect(decision.providerId).toBe('prov-claude');
    expect(decision.provider).toBe('anthropic');
    expect(decision.reason).toContain('strategy_explain');
  });

  it('falls back to first active provider when none match the priority list', async () => {
    (db.aiProviders.findByUserId as any).mockResolvedValue([
      {
        id: 'prov-other',
        user_id: 'user-1',
        provider: 'other-ai',
        name: 'Other AI',
        status: 'active',
        default_model: 'other-model',
      },
    ]);

    const decision = await service.selectProviderForChat('user-1', 'strategy_explain');

    expect(decision.providerId).toBe('prov-other');
    expect(decision.provider).toBe('other-ai');
  });
});

