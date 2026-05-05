#!/usr/bin/env bash
set -e

BASE="/home/nodejs/library/library-frontend/src"

# 1. Обновлённый API-клиент с управлением токенами
cat > "$BASE/api/client.ts" << 'EOF'
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://jhonstar.ru/library_ES/api/v1';

let authToken: string | null = localStorage.getItem('library_token');

const client = axios.create({
  baseURL: API_BASE,
  headers: {}
});

// Автоматически подставляем токен в каждый запрос
client.interceptors.request.use(config => {
  const token = localStorage.getItem('library_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Экспортные функции для обновления/очистки токена
export const setTokens = (token: string) => {
  authToken = token;
  localStorage.setItem('library_token', token);
};

export const clearTokens = () => {
  authToken = null;
  localStorage.removeItem('library_token');
};

export default client;
EOF

# 2. Контекст авторизации, использующий исправленный клиент
cat > "$BASE/context/AuthContext.tsx" << 'EOF'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient, { setTokens, clearTokens } from '../api/client';

interface User {
  id: number;
  email: string;
  role: 'user' | 'admin';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен быть внутри AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Проверка токена при загрузке страницы
  useEffect(() => {
    const tryLoadSession = async () => {
      const token = localStorage.getItem('library_token');
      if (token) {
        try {
          const res = await apiClient.get('/auth/me');
          setUser(res.data.user);
        } catch (e) {
          clearTokens();
          setUser(null);
        }
      }
      setLoading(false);
    };
    tryLoadSession();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    setTokens(res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
EOF

echo "✅ Последние правки применены. Запустите npm run build."