/**
 * API Hooks - Frontend API Integration
 *
 * Provides authenticated API calls to backend services
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ApiError {
  message: string;
  status: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Base API hook for authenticated requests
 */
export function useApi() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const request = useCallback(async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();

      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const err = { message: data.error || 'Request failed', status: response.status };
        setError(err);
        return { success: false, error: err.message };
      }

      return { success: true, data: data.data || data };
    } catch (err: any) {
      const apiError = { message: err.message || 'Network error', status: 0 };
      setError(apiError);
      return { success: false, error: apiError.message };
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const get = useCallback(<T>(endpoint: string) =>
    request<T>(endpoint, { method: 'GET' }), [request]);

  const post = useCallback(<T>(endpoint: string, body: any) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }), [request]);

  const put = useCallback(<T>(endpoint: string, body: any) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }), [request]);

  const del = useCallback(<T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }), [request]);

  return { get, post, put, del, loading, error };
}

// ============================================
// AI PROVIDERS HOOK
// ============================================

export interface AIProvider {
  id: string;
  provider: string;
  name: string;
  status: 'active' | 'inactive';
  defaultModel?: string;
  maskedApiKey: string;
  totalTokens: number;
  totalRequests: number;
  createdAt: string;
  lastUsedAt?: string;
}

export interface SupportedProvider {
  id: string;
  name: string;
  models: string[];
  features: string[];
}

export function useAIProviders() {
  const api = useApi();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [supportedProviders, setSupportedProviders] = useState<SupportedProvider[]>([]);

  const fetchProviders = useCallback(async () => {
    const result = await api.get<AIProvider[]>('/api/ai/providers');
    if (result.success && result.data) {
      setProviders(result.data);
    }
    return result;
  }, [api]);

  const fetchSupportedProviders = useCallback(async () => {
    const result = await api.get<SupportedProvider[]>('/api/ai/supported');
    if (result.success && result.data) {
      setSupportedProviders(result.data);
    }
    return result;
  }, [api]);

  const addProvider = useCallback(async (data: {
    provider: string;
    name: string;
    apiKey: string;
    defaultModel?: string;
  }) => {
    const result = await api.post<AIProvider>('/api/ai/providers', data);
    if (result.success) {
      await fetchProviders();
    }
    return result;
  }, [api, fetchProviders]);

  const deleteProvider = useCallback(async (id: string) => {
    const result = await api.del(`/api/ai/providers/${id}`);
    if (result.success) {
      setProviders(prev => prev.filter(p => p.id !== id));
    }
    return result;
  }, [api]);

  const testProvider = useCallback(async (id: string) => {
    return api.post<{ valid: boolean; models: string[] }>(`/api/ai/providers/${id}/test`, {});
  }, [api]);

  const activateProvider = useCallback(async (id: string) => {
    const result = await api.post(`/api/ai/providers/${id}/activate`, {});
    if (result.success) {
      await fetchProviders();
    }
    return result;
  }, [api, fetchProviders]);

  const deactivateProvider = useCallback(async (id: string) => {
    const result = await api.post(`/api/ai/providers/${id}/deactivate`, {});
    if (result.success) {
      await fetchProviders();
    }
    return result;
  }, [api, fetchProviders]);

  return {
    providers,
    supportedProviders,
    loading: api.loading,
    error: api.error,
    fetchProviders,
    fetchSupportedProviders,
    addProvider,
    deleteProvider,
    testProvider,
    activateProvider,
    deactivateProvider,
  };
}

// ============================================
// EXCHANGES HOOK
// ============================================

export interface Exchange {
  id: string;
  exchange: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  maskedApiKey: string;
  permissions: string[];
  createdAt: string;
  lastSyncAt?: string;
}

export function useExchanges() {
  const api = useApi();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);

  const fetchExchanges = useCallback(async () => {
    const result = await api.get<Exchange[]>('/api/exchanges');
    if (result.success && result.data) {
      setExchanges(result.data);
    }
    return result;
  }, [api]);

  const addExchange = useCallback(async (data: {
    exchange: string;
    name: string;
    apiKey: string;
    apiSecret: string;
  }) => {
    const result = await api.post<Exchange>('/api/exchanges', data);
    if (result.success) {
      await fetchExchanges();
    }
    return result;
  }, [api, fetchExchanges]);

  const deleteExchange = useCallback(async (id: string) => {
    const result = await api.del(`/api/exchanges/${id}`);
    if (result.success) {
      setExchanges(prev => prev.filter(e => e.id !== id));
    }
    return result;
  }, [api]);

  const testExchange = useCallback(async (id: string) => {
    return api.post<{ valid: boolean; balance?: number }>(`/api/exchanges/${id}/test`, {});
  }, [api]);

  return {
    exchanges,
    loading: api.loading,
    error: api.error,
    fetchExchanges,
    addExchange,
    deleteExchange,
    testExchange,
  };
}

// ============================================
// TRADING MODE HOOK
// ============================================

export type TradingMode = 'paper' | 'live';

export interface TradingModeStatus {
  mode: TradingMode;
  canSwitchToLive: boolean;
  requirements: {
    hasExchange: boolean;
    hasAcceptedDisclaimer: boolean;
  };
}

export function useTradingMode() {
  const api = useApi();
  const [mode, setMode] = useState<TradingMode>('paper');
  const [status, setStatus] = useState<TradingModeStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    const result = await api.get<TradingModeStatus>('/api/trading/mode');
    if (result.success && result.data) {
      setStatus(result.data);
      setMode(result.data.mode);
    }
    return result;
  }, [api]);

  const switchMode = useCallback(async (newMode: TradingMode, confirmation?: {
    password: string;
    acknowledgement: string;
  }) => {
    const result = await api.post<{ mode: TradingMode }>('/api/trading/mode', {
      mode: newMode,
      ...confirmation,
    });
    if (result.success && result.data) {
      setMode(result.data.mode);
      await fetchStatus();
    }
    return result;
  }, [api, fetchStatus]);

  return {
    mode,
    status,
    loading: api.loading,
    error: api.error,
    fetchStatus,
    switchMode,
  };
}

// ============================================
// MONITORING HOOK
// ============================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, boolean>;
  uptime: number;
}

export function useMonitoring() {
  const api = useApi();
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const fetchHealth = useCallback(async () => {
    const result = await api.get<HealthStatus>('/api/monitoring/health');
    if (result.success && result.data) {
      setHealth(result.data);
    }
    return result;
  }, [api]);

  return {
    health,
    loading: api.loading,
    error: api.error,
    fetchHealth,
  };
}
