import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, refreshSession, setAccessToken, setSessionExpiredHandler } from './api';

export interface Me {
  id: string;
  email: string;
  name: string;
  roles: { key: string; name: string }[];
  permissions: string[];
  twoFactorEnabled?: boolean;
  lastLoginAt?: string | null;
}

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string, totp?: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  can: (...perms: string[]) => boolean;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setUser(await api.get<Me>('/admin/auth/me'));
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setAccessToken(null);
      setUser(null);
    });
    (async () => {
      if (await refreshSession()) await reload().catch(() => setUser(null));
      setLoading(false);
    })();
  }, [reload]);

  const login = async (email: string, password: string, totp?: string) => {
    const res = await api.post<{ accessToken: string }>('/admin/auth/login', { email, password, ...(totp ? { totp } : {}) });
    setAccessToken(res.accessToken);
    await reload();
  };

  const logout = async () => {
    await api.post('/admin/auth/logout').catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  };

  const can = useCallback((...perms: string[]) => !!user && perms.every((p) => user.permissions.includes(p)), [user]);

  return <AuthContext.Provider value={{ user, loading, login, logout, reload, can }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
