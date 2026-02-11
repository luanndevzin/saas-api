import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, type ApiOptions, type AuthResponse, type UserRole } from "./api";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface MeInfo {
  userId: number;
  tenantId: number;
  role: UserRole;
}

interface ApiContextValue {
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  token: string;
  setToken: (v: string) => void;
  me: MeInfo | null;
  request: <T>(path: string, options?: ApiOptions) => Promise<T>;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (payload: { company_name: string; name: string; email: string; password: string; }) => Promise<AuthResponse>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [baseUrl, setBaseUrl] = useLocalStorage<string>("saas_api_base", import.meta.env.VITE_API_URL || "http://localhost:8080/v1");
  const [token, setToken] = useLocalStorage<string>("saas_api_token", "");
  const [me, setMe] = useState<MeInfo | null>(null);

  const config = useMemo(() => ({ baseUrl, token, onUnauthorized: () => setToken("") }), [baseUrl, token, setToken]);

  const request = useCallback(<T,>(path: string, options: ApiOptions = {}) => apiFetch<T>(config, path, options), [config]);

  const refreshMe = useCallback(async () => {
    if (!token) { setMe(null); return; }
    try {
      const res = await apiFetch<{ user_id: number; tenant_id: number; role: UserRole }>(config, "/me");
      setMe({ userId: res.user_id, tenantId: res.tenant_id, role: res.role });
    } catch (err) {
      setMe(null);
    }
  }, [config, token]);

  useEffect(() => { refreshMe(); }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<AuthResponse>({ baseUrl, onUnauthorized: () => setToken("") }, "/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    setToken(data.access_token);
    setMe({ userId: data.user_id, tenantId: data.tenant_id, role: data.role });
    return data;
  }, [baseUrl, setToken]);

  const register = useCallback(async (payload: { company_name: string; name: string; email: string; password: string; }) => {
    const data = await apiFetch<AuthResponse>({ baseUrl, onUnauthorized: () => setToken("") }, "/auth/register", {
      method: "POST",
      body: payload,
      auth: false,
    });
    setToken(data.access_token);
    setMe({ userId: data.user_id, tenantId: data.tenant_id, role: data.role });
    return data;
  }, [baseUrl, setToken]);

  const logout = useCallback(() => {
    setToken("");
    setMe(null);
  }, [setToken]);

  const value: ApiContextValue = {
    baseUrl,
    setBaseUrl,
    token,
    setToken,
    me,
    request,
    login,
    register,
    logout,
    refreshMe,
  };

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi() {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi must be used inside ApiProvider");
  return ctx;
}



