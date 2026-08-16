/**
 * Central API client. All network access goes through here so the UI can be
 * pointed at a real REST backend by setting VITE_USE_MOCK_DATA=false.
 */
export const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "";
export const USE_MOCK_DATA = (import.meta.env["VITE_USE_MOCK_DATA"] ?? "true") !== "false";
export const TOKEN_STORAGE_KEY = "ncs.access_token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

const LATENCY = 240;

/** Resolves mock payloads with a realistic delay so loading states are visible. */
export function mock<T>(value: T | (() => T), delay = LATENCY): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(typeof value === "function" ? (value as () => T)() : value), delay);
  });
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_STORAGE_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.status === 401 && typeof window !== "undefined")
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    throw new ApiError(payload?.error ?? `Request to ${path} failed`, response.status);
  }
  return (await response.json()) as T;
}

export function paginate<T>(rows: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return { data: rows.slice(start, start + pageSize), total: rows.length, page, pageSize };
}
