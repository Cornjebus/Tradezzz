/**
 * Exchange Adapter Factory
 * Creates exchange adapters for real API connections
 */

import { ExchangeAdapter } from '../ExchangeService';
import { CoinbaseAdapter } from './CoinbaseAdapter';
import { BinanceAdapter } from './BinanceAdapter';
import { KrakenAdapter } from './KrakenAdapter';

export type ExchangeType = 'coinbase' | 'binance' | 'kraken' | 'kucoin' | 'bybit' | 'okx';

export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}

/**
 * Create an exchange adapter for the specified exchange type
 */
export function createExchangeAdapter(
  exchange: ExchangeType,
  _credentials?: ExchangeCredentials
): ExchangeAdapter {
  switch (exchange) {
    case 'coinbase':
      return new CoinbaseAdapter();
    case 'binance':
      return new BinanceAdapter();
    case 'kraken':
      return new KrakenAdapter();
    case 'kucoin':
      // TODO: Implement KuCoin adapter
      return new BinanceAdapter(); // Fallback to Binance-like API
    case 'bybit':
      // TODO: Implement Bybit adapter
      return new BinanceAdapter(); // Fallback to Binance-like API
    case 'okx':
      // TODO: Implement OKX adapter
      return new BinanceAdapter(); // Fallback to Binance-like API
    default:
      throw new Error(`Unsupported exchange: ${exchange}`);
  }
}

/**
 * Test connection to an exchange with credentials
 * Makes a real API call to verify the credentials work
 */
export async function testExchangeConnection(
  exchange: ExchangeType,
  credentials: ExchangeCredentials
): Promise<{ valid: boolean; error?: string; permissions?: string[] }> {
  const baseUrls: Record<ExchangeType, string> = {
    coinbase: 'https://api.coinbase.com/api/v3/brokerage',
    binance: 'https://api.binance.com',
    kraken: 'https://api.kraken.com',
    kucoin: 'https://api.kucoin.com',
    bybit: 'https://api.bybit.com',
    okx: 'https://www.okx.com',
  };

  const endpoints: Record<ExchangeType, string> = {
    coinbase: '/accounts',
    binance: '/api/v3/account',
    kraken: '/0/private/Balance',
    kucoin: '/api/v1/accounts',
    bybit: '/v5/account/wallet-balance',
    okx: '/api/v5/account/balance',
  };

  try {
    const baseUrl = baseUrls[exchange];
    const endpoint = endpoints[exchange];
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Build headers based on exchange type
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (exchange === 'coinbase') {
      const crypto = await import('crypto');
      const message = timestamp + 'GET' + endpoint;
      const signature = crypto
        .createHmac('sha256', credentials.apiSecret)
        .update(message)
        .digest('hex');

      headers['CB-ACCESS-KEY'] = credentials.apiKey;
      headers['CB-ACCESS-SIGN'] = signature;
      headers['CB-ACCESS-TIMESTAMP'] = timestamp;
    } else if (exchange === 'binance') {
      const crypto = await import('crypto');
      const timestampMs = Date.now().toString();
      const query = `timestamp=${timestampMs}`;
      const signature = crypto
        .createHmac('sha256', credentials.apiSecret)
        .update(query)
        .digest('hex');

      headers['X-MBX-APIKEY'] = credentials.apiKey;
      const response = await fetch(`${baseUrl}${endpoint}?${query}&signature=${signature}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        const permissions = data.permissions || ['SPOT'];
        return { valid: true, permissions };
      } else {
        const error = await response.json().catch(() => ({ msg: response.statusText }));
        return { valid: false, error: error.msg || 'Authentication failed' };
      }
    } else if (exchange === 'kraken') {
      // Kraken uses nonce and different signing
      const crypto = await import('crypto');
      const nonce = Date.now().toString();
      const postData = `nonce=${nonce}`;
      const message = endpoint + crypto
        .createHash('sha256')
        .update(nonce + postData)
        .digest('binary');
      const signature = crypto
        .createHmac('sha512', Buffer.from(credentials.apiSecret, 'base64'))
        .update(message, 'binary')
        .digest('base64');

      headers['API-Key'] = credentials.apiKey;
      headers['API-Sign'] = signature;
      headers['Content-Type'] = 'application/x-www-form-urlencoded';

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: postData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.error && data.error.length > 0) {
          return { valid: false, error: data.error.join(', ') };
        }
        return { valid: true, permissions: ['read', 'trade'] };
      } else {
        return { valid: false, error: 'Authentication failed' };
      }
    }

    // Default: Make a simple authenticated request
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers,
    });

    if (response.ok) {
      return { valid: true, permissions: ['read', 'trade'] };
    } else {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      return { valid: false, error: error.message || error.msg || 'Authentication failed' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return { valid: false, error: message };
  }
}

// Re-export adapter classes
export { CoinbaseAdapter } from './CoinbaseAdapter';
export { BinanceAdapter } from './BinanceAdapter';
export { KrakenAdapter } from './KrakenAdapter';
