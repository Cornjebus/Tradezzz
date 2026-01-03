import type {
  ExchangeAdapter,
  ExchangeAdapterContext,
  Balance,
  Ticker,
} from './ExchangeService';
import type { NeonDatabase, ExchangeConnection as NeonExchangeConnection } from '../database/NeonDatabase';

export interface NeonExchangeAdapterServiceOptions {
  db: NeonDatabase;
  adapterFactory: (exchange: string) => ExchangeAdapter | null;
  /**
   * Neon currently stores API keys as base64-encoded strings on the
   * exchange_connections table. This helper is responsible for turning the
   * stored encryptedApiKey / encryptedApiSecret into usable plaintext
   * credentials for the adapter layer.
   */
  decryptCredentials?: (conn: NeonExchangeConnection) => { apiKey: string; apiSecret: string; passphrase?: string } | null;
}

export class NeonExchangeAdapterService {
  private db: NeonDatabase;
  private adapterFactory: (exchange: string) => ExchangeAdapter | null;
  private decryptCredentials?: NeonExchangeAdapterServiceOptions['decryptCredentials'];

  constructor(options: NeonExchangeAdapterServiceOptions) {
    this.db = options.db;
    this.adapterFactory = options.adapterFactory;
    this.decryptCredentials = options.decryptCredentials;
  }

  private async getConnectionForUser(id: string, userId: string): Promise<NeonExchangeConnection> {
    const conn = await this.db.exchangeConnections.findById(id);
    if (!conn || conn.user_id !== userId) {
      throw new Error('Exchange connection not found');
    }
    return conn;
  }

  private getAdapterForConnection(conn: NeonExchangeConnection): { adapter: ExchangeAdapter; ctx: ExchangeAdapterContext } {
    const adapter = this.adapterFactory(conn.exchange);
    if (!adapter) {
      throw new Error('No adapter configured for this exchange');
    }

    const ctx: ExchangeAdapterContext = {
      connectionId: conn.id,
      userId: conn.user_id,
      exchange: conn.exchange as any,
    };

    return { adapter, ctx };
  }

  async testConnection(id: string, userId: string): Promise<{ valid: boolean; balance?: Balance }> {
    const conn = await this.getConnectionForUser(id, userId);
    const { adapter, ctx } = this.getAdapterForConnection(conn);

    const balance = await adapter.getBalance(ctx);

    return {
      valid: true,
      balance,
    };
  }

  async getBalance(id: string, userId: string): Promise<Balance> {
    const conn = await this.getConnectionForUser(id, userId);
    const { adapter, ctx } = this.getAdapterForConnection(conn);
    return adapter.getBalance(ctx);
  }

  async getTicker(id: string, userId: string, symbol: string): Promise<Ticker> {
    const conn = await this.getConnectionForUser(id, userId);
    const { adapter, ctx } = this.getAdapterForConnection(conn);
    return adapter.getTicker(ctx, symbol);
  }
}

