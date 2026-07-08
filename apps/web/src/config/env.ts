// Server-configurable via NEXT_PUBLIC_API_BASE_URL; defaults to the real
// production backend since this app has no local/staging backend of its
// own yet (mirrors the mobile app's environment.dart pattern).
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "https://api.usevoltx.com/api/v1";
