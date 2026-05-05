import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient, { setTokens, clearTokens } from '../api/client';

// Временно описываем типы прямо здесь
interface User {
  id: number;
  email: string;
  display_name: string;
  role: 'user' | 'admin';
  oauth_provider: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  isAdmin: false
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiClient.get('/auth/me');
      setUser(res.data);
    } catch (err) {
      clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    setTokens(res.data.access_token, res.data.refresh_token);
    setUser(res.data.user);
  };

  const register = async (email: string, password: string, displayName: string) => {
    await apiClient.post('/auth/register', {
      email,
      password,
      display_name: displayName
    });
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};