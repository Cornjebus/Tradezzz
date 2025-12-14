/**
 * Neural Trading API Client
 * Frontend API client for connecting to the backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  tier: 'free' | 'pro' | 'elite' | 'institutional';
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  type: 'momentum' | 'mean_reversion' | 'sentiment' | 'arbitrage' | 'trend_following' | 'custom';
  status: 'draft' | 'backtesting' | 'paper' | 'active' | 'paused' | 'archived';
  config: Record<string, any>;
  createdAt: string;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop_loss' | 'take_profit';
  quantity: number;
  price?: number;
  status: 'pending' | 'filled' | 'cancelled';
  mode: 'paper' | 'live';
  filledPrice?: number;
  createdAt: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
}

export interface ExchangeConnection {
  id: string;
  exchange: string;
  name: string;
  status: 'active' | 'inactive';
  maskedApiKey: string;
}

export interface AIProvider {
  id: string;
  provider: string;
  name: string;
  status: 'active' | 'inactive';
  defaultModel?: string;
  maskedApiKey: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// API Client Class
// ============================================================================

class APIClient {
  private accessToken: string | null = null;

  constructor() {
    // Try to restore token from localStorage
    this.accessToken = localStorage.getItem('accessToken');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  setToken(token: string): void {
    this.accessToken = token;
    localStorage.setItem('accessToken', token);
  }

  clearToken(): void {
    this.accessToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // ============================================================================
  // Auth Endpoints
  // ============================================================================

  async register(email: string, password: string, tier: string = 'free'): Promise<ApiResponse<AuthResponse>> {
    const result = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, tier }),
    });

    if (result.success && result.data) {
      this.setToken(result.data.accessToken);
      localStorage.setItem('refreshToken', result.data.refreshToken);
    }

    return result;
  }

  async login(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
    const result = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (result.success && result.data) {
      this.setToken(result.data.accessToken);
      localStorage.setItem('refreshToken', result.data.refreshToken);
    }

    return result;
  }

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      await this.request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    }
    this.clearToken();
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>('/auth/me');
  }

  async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    const result = await this.request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (result.success && result.data) {
      this.setToken(result.data.accessToken);
      localStorage.setItem('refreshToken', result.data.refreshToken);
      return true;
    }

    this.clearToken();
    return false;
  }

  // ============================================================================
  // Strategy Endpoints
  // ============================================================================

  async getStrategies(): Promise<ApiResponse<Strategy[]>> {
    return this.request<Strategy[]>('/strategies');
  }

  async getStrategy(id: string): Promise<ApiResponse<Strategy>> {
    return this.request<Strategy>(`/strategies/${id}`);
  }

  async createStrategy(data: {
    name: string;
    type: string;
    config: Record<string, any>;
  }): Promise<ApiResponse<Strategy>> {
    return this.request<Strategy>('/strategies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStrategy(id: string, data: Partial<Strategy>): Promise<ApiResponse<Strategy>> {
    return this.request<Strategy>(`/strategies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateStrategyStatus(id: string, status: string): Promise<ApiResponse<Strategy>> {
    return this.request<Strategy>(`/strategies/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async deleteStrategy(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/strategies/${id}`, { method: 'DELETE' });
  }

  // ============================================================================
  // Order Endpoints
  // ============================================================================

  async getOrders(filters?: { status?: string; symbol?: string }): Promise<ApiResponse<Order[]>> {
    const params = new URLSearchParams(filters as Record<string, string>);
    return this.request<Order[]>(`/orders?${params}`);
  }

  async createOrder(data: {
    strategyId: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop_loss' | 'take_profit';
    quantity: number;
    price?: number;
    stopPrice?: number;
    mode: 'paper' | 'live';
  }): Promise<ApiResponse<Order>> {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async executeOrder(id: string, currentPrice: number): Promise<ApiResponse<Order>> {
    return this.request<Order>(`/orders/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ currentPrice }),
    });
  }

  async cancelOrder(id: string): Promise<ApiResponse<Order>> {
    return this.request<Order>(`/orders/${id}`, { method: 'DELETE' });
  }

  async getPositions(): Promise<ApiResponse<Position[]>> {
    return this.request<Position[]>('/orders/positions/open');
  }

  async getPortfolioSummary(): Promise<ApiResponse<any>> {
    return this.request<any>('/orders/portfolio/summary');
  }

  // ============================================================================
  // Exchange Endpoints
  // ============================================================================

  async getSupportedExchanges(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/exchanges/supported');
  }

  async getExchangeConnections(): Promise<ApiResponse<ExchangeConnection[]>> {
    return this.request<ExchangeConnection[]>('/exchanges/connections');
  }

  async createExchangeConnection(data: {
    exchange: string;
    name: string;
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
  }): Promise<ApiResponse<ExchangeConnection>> {
    return this.request<ExchangeConnection>('/exchanges/connections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteExchangeConnection(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/exchanges/connections/${id}`, { method: 'DELETE' });
  }

  async getTicker(connectionId: string, symbol: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/exchanges/connections/${connectionId}/ticker/${symbol.replace('/', '-')}`);
  }

  async getBalance(connectionId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/exchanges/connections/${connectionId}/balance`);
  }

  // ============================================================================
  // AI Endpoints
  // ============================================================================

  async getSupportedAIProviders(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/ai/supported');
  }

  async getAIProviders(): Promise<ApiResponse<AIProvider[]>> {
    return this.request<AIProvider[]>('/ai/providers');
  }

  async createAIProvider(data: {
    provider: string;
    name: string;
    apiKey: string;
    defaultModel?: string;
  }): Promise<ApiResponse<AIProvider>> {
    return this.request<AIProvider>('/ai/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteAIProvider(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/ai/providers/${id}`, { method: 'DELETE' });
  }

  async analyzeSentiment(providerId: string, text: string, symbol: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/ai/providers/${providerId}/sentiment`, {
      method: 'POST',
      body: JSON.stringify({ text, symbol }),
    });
  }

  async generateSignal(providerId: string, data: {
    symbol: string;
    timeframe: string;
    priceData: any[];
    indicators?: Record<string, any>;
  }): Promise<ApiResponse<any>> {
    return this.request<any>(`/ai/providers/${providerId}/signal`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async chat(providerId: string, messages: { role: string; content: string }[]): Promise<ApiResponse<any>> {
    return this.request<any>(`/ai/providers/${providerId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async healthCheck(): Promise<ApiResponse<any>> {
    return this.request<any>('/health');
  }
}

// Export singleton instance
export const api = new APIClient();
export default api;
