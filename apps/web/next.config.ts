import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * The API origin is baked into the CSP at build time from the same env
 * var the ApiClient uses, so connect-src can never drift from where the
 * app actually calls. Socket.io needs the ws(s): scheme alongside https.
 * Falls back to permitting nothing extra if unset — the build fails
 * loudly in src/config/env.ts in that case anyway.
 */
function apiOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!raw) return [];
  try {
    const url = new URL(raw);
    const wsScheme = url.protocol === "https:" ? "wss:" : "ws:";
    return [url.origin, `${wsScheme}//${url.host}`];
  } catch {
    return [];
  }
}

const csp = [
  "default-src 'self'",
  // Next.js requires inline bootstrap scripts; dev HMR additionally needs
  // eval. No third-party script host is allowed except Stripe's.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  // Org logos and user avatars are operator-supplied URLs, so https: is
  // deliberately broad for images only.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigins().join(" ")} https://api.stripe.com`.replace(/\s+/g, " "),
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
