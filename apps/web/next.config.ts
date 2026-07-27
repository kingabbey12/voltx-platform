import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * The API almost always lives on a different origin from the app
 * (api.usevoltx.com vs app.usevoltx.com), and `connect-src 'self'` does not
 * cover it — the browser would block every XHR and every socket.io
 * connection, with the app rendering fine and no data ever loading.
 *
 * Derived from the same value the client is built against so the two cannot
 * drift. Both the HTTP origin and its ws:// equivalent are allowed, because
 * useCommsRealtime connects to the API origin for the live inbox.
 */
function apiConnectSources(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!configured) return "";
  try {
    const { origin } = new URL(configured);
    const socketOrigin = origin.replace(/^http/, "ws");
    return ` ${origin} ${socketOrigin}`;
  } catch {
    // A malformed URL is caught by src/config/env.ts at import time; do not
    // widen the policy to compensate for it here.
    return "";
  }
}

const csp = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://*.stripe.com https://js.stripe.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self'${apiConnectSources()} https://api.stripe.com https://*.ingest.sentry.io;
  frame-src https://*.stripe.com https://js.stripe.com https://hooks.stripe.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'self';
`
  .replace(/\s+/g, " ")
  .trim();

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : undefined,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "framer-motion",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "sonner",
    ],
  },
};

export default nextConfig;
