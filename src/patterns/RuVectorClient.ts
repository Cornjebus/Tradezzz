export interface RuVectorClientOptions {
  /**
   * Base URL of the RuVector HTTP or gRPC gateway.
   * Example: http://localhost:7700 or https://ruvector.yourdomain.com
   */
  baseUrl: string;
  /**
   * Optional API key or bearer token, if configured.
   */
  apiKey?: string;
  /**
   * Logical tenant identifier for multi-tenant isolation.
   */
  tenantId: string;
}

export interface RuVectorHealth {
  status: 'ok' | 'degraded' | 'unhealthy';
  version?: string;
  latencyMs?: number;
}

export interface VectorUpsertInput {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
  namespace?: string;
}

export interface VectorSearchQuery {
  vector: number[];
  topK: number;
  namespace?: string;
  filter?: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export class RuVectorClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly tenantId: string;

  constructor(options: RuVectorClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.tenantId = options.tenantId;
  }

  /**
   * Lightweight health check. Assumes a standard RuVector status endpoint
   * is available; in dev/test this should be mocked.
   */
  async ping(): Promise<RuVectorHealth> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        headers: this.buildHeaders(),
      });

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return { status: 'degraded', latencyMs };
      }

      const json: any = await res.json().catch(() => ({}));
      return {
        status: 'ok',
        version: json.version,
        latencyMs,
      };
    } catch {
      return { status: 'unhealthy' };
    }
  }

  /**
   * Minimal vector upsert helper. The exact shape will be adapted once the
   * concrete RuVector deployment flavor is chosen. For now, we keep it
   * intentionally generic and easy to mock in tests.
   */
  async upsertVectors(vectors: VectorUpsertInput[], index: string): Promise<void> {
    await fetch(`${this.baseUrl}/indexes/${encodeURIComponent(index)}/vectors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.buildHeaders(),
      },
      body: JSON.stringify({
        tenantId: this.tenantId,
        vectors,
      }),
    });
  }

  /**
   * Minimal similarity search helper. The concrete wire format will be
   * aligned with the deployed RuVector flavor; tests should use mocks.
   */
  async search(index: string, query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const res = await fetch(`${this.baseUrl}/indexes/${encodeURIComponent(index)}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.buildHeaders(),
      },
      body: JSON.stringify({
        tenantId: this.tenantId,
        ...query,
      }),
    });

    if (!res.ok) {
      return [];
    }

    const json: any = await res.json().catch(() => ({ results: [] }));
    const results = Array.isArray(json.results) ? json.results : [];
    return results.map((r: any) => ({
      id: r.id,
      score: typeof r.score === 'number' ? r.score : 0,
      metadata: r.metadata || undefined,
    }));
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'x-tenant-id': this.tenantId,
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }
}
