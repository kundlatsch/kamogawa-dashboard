import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { isAxiosError } from "axios";

import { api, tokens } from "../api/client";
import type { User } from "../api/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  /** Reload the signed-in user (e.g. after the gym name or color changed). */
  refreshUser: () => Promise<void>;
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
    let cancelled = false;
    // Retry transient failures (e.g. backend restarting) instead of logging the user out;
    // only a rejected token ends the session.
    const restore = async (attempt: number): Promise<void> => {
      try {
        const { data } = await api.get<User>("/auth/me/");
        if (!cancelled) setUser(data);
      } catch (error) {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        if (status === 401 || status === 403 || attempt >= 5) {
          tokens.clear();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        if (!cancelled) return restore(attempt + 1);
      }
    };
    restore(0).finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
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

  const refreshUser = useCallback(async () => {
    const { data } = await api.get<User>("/auth/me/");
    setUser(data);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
