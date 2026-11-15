import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, tokens } from "../api/client";
import type { User } from "../api/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(tokens.access));

  const logout = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!tokens.access) return;
    api
      .get<User>("/auth/me/")
      .then(({ data }) => setUser(data))
      .catch(() => tokens.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    window.addEventListener("cbt:logout", logout);
    return () => window.removeEventListener("cbt:logout", logout);
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post<{ access: string; refresh: string }>("/auth/token/", {
      username,
      password,
    });
    tokens.set(data.access, data.refresh);
    const me = await api.get<User>("/auth/me/");
    setUser(me.data);
    return me.data;
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
