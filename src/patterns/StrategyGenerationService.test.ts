import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NeonDatabase } from '../database/NeonDatabase';
import { StrategyGenerationService } from './StrategyGenerationService';

function createStubDb(): NeonDatabase {
  const db: any = {
    strategies: {
      findByUserId: vi.fn(),
      create: vi.fn(),
    },
  };
  return db as NeonDatabase;
}

describe('StrategyGenerationService', () => {
  let db: NeonDatabase;
  let service: StrategyGenerationService;
  let aiAdapterService: any;
  let aiRoutingService: any;

  beforeEach(() => {
    db = createStubDb();
    (db.strategies.findByUserId as any).mockResolvedValue([]);
    (db.strategies.create as any).mockImplementation(async (data: any) => ({
      id: 'strat-generated-1',
      user_id: data.userId,
      name: data.name,
      description: data.description,
      type: data.type,
      config: data.config,
      status: 'draft',
    }));

    aiAdapterService = {
      chat: vi.fn(),
    };

    aiRoutingService = {
      selectProviderForChat: vi.fn().mockResolvedValue({
        providerId: 'prov-openai',
        provider: 'openai',
        model: 'gpt-stub',
        reason: 'test routing',
      }),
    };

    service = new StrategyGenerationService({
      db,
      aiAdapterService,
      aiRoutingService,
      patternClient: null,
    });
  });

  it('creates a new strategy from valid JSON response', async () => {
    aiAdapterService.chat.mockResolvedValue({
      content: JSON.stringify({
        name: 'Generated Momentum BTC',
        type: 'momentum',
        description: 'Auto-generated momentum strategy for BTC',
        config: { timeframe: '1h' },
      }),
      model: 'gpt-stub',
      usage: { totalTokens: 100 },
    });

    const result = await service.generateForUser('user-1', {
      symbols: ['BTC/USDT'],
      riskLevel: 'moderate',
    });

    expect(db.strategies.create).toHaveBeenCalledTimes(1);
    const args = (db.strategies.create as any).mock.calls[0][0];
    expect(args.userId).toBe('user-1');
    expect(args.name).toBe('Generated Momentum BTC');
    expect(args.type).toBe('momentum');
    expect((args.config as any).symbols).toEqual(['BTC/USDT']);

    expect(result.strategy.id).toBe('strat-generated-1');
    expect(result.routing.provider).toBe('openai');
  });

  it('throws when AI response is not valid JSON', async () => {
    aiAdapterService.chat.mockResolvedValue({
      content: 'not-json',
      model: 'gpt-stub',
      usage: { totalTokens: 10 },
    });

    await expect(
      service.generateForUser('user-1', { symbols: ['ETH/USDT'] }),
    ).rejects.toThrow('AI response for strategy generation was not valid JSON');
  });
});

