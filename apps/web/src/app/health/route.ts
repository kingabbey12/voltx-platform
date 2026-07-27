import { NextResponse } from "next/server";

// Liveness endpoint for the container healthcheck and the blackbox probe.
//
// Previously neither had a real target: /health did not exist, so the auth
// middleware 307'd it to /login, and `wget --spider` followed the redirect and
// reported the container healthy. That check passed as long as the middleware
// ran — it would have kept passing with the application badly broken.
//
// This deliberately asserts only that the Next.js server is up and serving.
// It does not probe the backend: the API has its own /readiness, and coupling
// the two would take the web app out of rotation for a backend fault it cannot
// fix, hiding which tier actually failed.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", service: "voltx-web" });
}
