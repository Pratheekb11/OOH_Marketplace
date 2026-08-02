import { clearToken, getToken } from "./auth-storage";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

/** Dispatched on `window` whenever a request comes back 401. AuthProvider
 * listens for this so a user with a stale/expired token gets bounced to
 * `unauthenticated` instead of silently seeing empty grids everywhere. */
export const AUTH_EXPIRED_EVENT = "auth:expired";

/** Thrown for any non-OK response. Carries FastAPI's `detail` verbatim
 * (string, or its structured validation-error array) so callers can
 * special-case status codes, e.g. a 409 on overlapping bookings. */
export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export interface ApiOptions extends RequestInit {
  /** Skip attaching the Authorization header even if a token is stored. */
  skipAuth?: boolean;
}

/**
 * Typed fetch wrapper mirroring Ui_Prototype_MVP_Prep/js/api.js's `api()`
 * helper: same base URL env var, same bearer-token localStorage key
 * (adspace_access_token via lib/auth-storage), same "throw on non-OK".
 */
export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { skipAuth, headers, body, ...rest } = options;
  const token = getToken();
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const finalHeaders: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    body,
    headers: finalHeaders,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      }
    }
    throw new ApiError(response.status, payload?.detail ?? "Request failed");
  }

  return payload as T;
}

export default api;
