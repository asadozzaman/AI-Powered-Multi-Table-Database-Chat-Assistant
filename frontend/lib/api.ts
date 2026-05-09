const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export type ApiResult = Record<string, unknown>;

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("access_token");
}

export function setToken(token: string) {
  window.localStorage.setItem("access_token", token);
  window.dispatchEvent(new Event("auth-changed"));
}

export function clearToken() {
  window.localStorage.removeItem("access_token");
  window.dispatchEvent(new Event("auth-changed"));
}

export async function apiFetch<T = ApiResult>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(String(detail.detail || response.statusText));
  }
  return response.json();
}
