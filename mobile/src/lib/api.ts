import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "saas_jwt";
const BASE_KEY = "saas_base";

export const DEFAULT_BASE = "https://diplomatic-simplicity-production-70e0.up.railway.app/v1";

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
export async function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveBase(url: string) {
  await SecureStore.setItemAsync(BASE_KEY, url);
}
export async function loadBase(): Promise<string> {
  const v = await SecureStore.getItemAsync(BASE_KEY);
  return v || DEFAULT_BASE;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await loadToken();
  const base = await loadBase();
  const url = path.startsWith("http") ? path : `${base}/${path.replace(/^\//, "")}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as any),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = typeof data === "object" && data?.error ? data.error : text || res.statusText;
    const err: any = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
