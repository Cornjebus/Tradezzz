import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrokAdapter } from './GrokAdapter';
import type { ChatCompletionParams, ExchangeAdapterContext } from './types';

describe('GrokAdapter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should_call_chat_completions_endpoint_and_map_response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'grok-2',
        choices: [
          {
            message: { content: 'Hello from Grok!' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      }),
    } as any);

    // @ts-expect-error stubbing global fetch
    globalThis.fetch = fetchMock;

    const adapter = new GrokAdapter({
      apiKey: 'test-grok-key',
      baseUrl: 'https://api.x.ai/v1',
      model: 'grok-2',
    });

    const params: ChatCompletionParams = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const result = await adapter.chat(params);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);

    expect(url).toContain('/chat/completions');
    expect(body.model).toBe('grok-2');
    expect(result.content).toBe('Hello from Grok!');
    expect(result.usage.totalTokens).toBe(15);
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });
});

