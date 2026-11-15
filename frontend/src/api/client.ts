import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const ACCESS_KEY = "cbt.access";
const REFRESH_KEY = "cbt.refresh";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const tokens = {
  get access() {
    return read(ACCESS_KEY);
  },
  get refresh() {
    return read(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    try {
      localStorage.setItem(ACCESS_KEY, access);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      /* storage unavailable: session lasts until reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const access = tokens.access;
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

let refreshing: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokens.refresh;
  if (!refresh) throw new Error("no refresh token");
  const { data } = await axios.post<{ access: string }>("/api/auth/token/refresh/", { refresh });
  tokens.set(data.access);
  return data.access;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.startsWith("/auth/token");
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        refreshing ??= refreshAccessToken().finally(() => (refreshing = null));
        const access = await refreshing;
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        tokens.clear();
        window.dispatchEvent(new Event("cbt:logout"));
      }
    }
    return Promise.reject(error);
  },
);
