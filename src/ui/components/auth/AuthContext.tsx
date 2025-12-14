/**
 * Authentication Context
 * Provides authentication state and methods to the app
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User } from '../../api/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, tier?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      if (api.isAuthenticated()) {
        const result = await api.getCurrentUser();
        if (result.success && result.data) {
          setUser(result.data);
        } else {
          // Token might be expired, try to refresh
          const refreshed = await api.refreshToken();
          if (refreshed) {
            const retryResult = await api.getCurrentUser();
            if (retryResult.success && retryResult.data) {
              setUser(retryResult.data);
            }
          }
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password);
    if (result.success && result.data) {
      setUser(result.data.user);
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const register = async (email: string, password: string, tier: string = 'free') => {
    const result = await api.register(email, password, tier);
    if (result.success && result.data) {
      setUser(result.data.user);
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
