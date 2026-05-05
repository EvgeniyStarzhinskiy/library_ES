#!/bin/bash
set -e

# Путь к исходникам
SRC="/home/nodejs/library/library-frontend/src"

# === 1. Исправляем AuthContext – убираем неиспользуемый параметр ===
cat > "$SRC/context/AuthContext.tsx" << 'EOF'
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
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
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('library_token');
    if (token) {
      apiClient.get('/auth/me')
        .then(res => setUser(res.data.user))
        .catch(() => clearTokens())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    setTokens(res.data.token);
    setUser(res.data.user);
  };

  const register = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/register', { email, password });
    setTokens(res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
EOF

# === 2. Правим RegisterPage – вызов register только с двумя аргументами ===
# Заменяем строку вызова register(...) на вызов без displayName
sed -i "s/await register(values\.email, values\.password, values\.displayName)/await register(values.email, values.password)/g" \
  "$SRC/pages/RegisterPage.tsx"

echo "✅ Финальные правки применены. Запустите npm run build"