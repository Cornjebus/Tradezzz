import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuVectorClient } from './RuVectorClient';

describe('RuVectorClient', () => {
  const baseUrl = 'https://ruvector.local';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok health when /health responds 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.0.0' }),
    });
    // @ts-expect-error override global
    global.fetch = fetchMock;

    const client = new RuVectorClient({
      baseUrl,
      tenantId: 'tenant-1',
    });

    const health = await client.ping();
    expect(health.status).toBe('ok');
    expect(health.version).toBe('1.0.0');
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/health`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-tenant-id': 'tenant-1',
        }),
      }),
    );
  });

  it('returns unhealthy when fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    // @ts-expect-error override global
    global.fetch = fetchMock;

    const client = new RuVectorClient({
      baseUrl,
      tenantId: 'tenant-1',
    });

    const health = await client.ping();
    expect(health.status).toBe('unhealthy');
  });
});

