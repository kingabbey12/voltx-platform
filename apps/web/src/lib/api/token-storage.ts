// Client-side token storage. Tokens live in localStorage rather than an
// httpOnly cookie because this app calls the backend directly from the
// browser (no Next.js BFF/proxy layer) — the access token is short-lived
// (15 min, matching the backend's ACCESS_TOKEN_EXPIRES_IN) and every
// mutating request still requires it explicitly, which bounds the blast
// radius of an XSS token theft to that window. Revisit with an httpOnly
// cookie + server-side proxy if this app later needs to defend against
// XSS specifically (e.g. before handling more sensitive data).
const ACCESS_TOKEN_KEY = "voltx.accessToken";
const REFRESH_TOKEN_KEY = "voltx.refreshToken";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export const tokenStorage = {
  read(): StoredTokens | null {
    if (!isBrowser()) return null;
    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  },

  readAccessToken(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  readRefreshToken(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  save(tokens: StoredTokens): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },

  saveAccessToken(accessToken: string): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },

  clear(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
