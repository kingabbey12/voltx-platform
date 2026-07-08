"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useRecentPagesStore } from "@/lib/stores/recent-pages-store";
import { useMyOrganizations } from "@/hooks/use-organizations";
import { mainNav, secondaryNav } from "@/config/nav";

function labelForPath(pathname: string): string {
  const item = [...mainNav, ...secondaryNav].find(
    (nav) => pathname === nav.href || pathname.startsWith(`${nav.href}/`),
  );
  return item?.label ?? pathname;
}

// RunAgentDto/RunAutonomousAgentDto cap each workspaceContext entry at 500
// chars — a fresh org owner alone has 40+ permission keys, easily blowing
// past that in one joined string, so long lists get split across several
// prefixed lines instead of truncated (server-side RBAC is the real
// enforcement; this is only for the model's situational awareness).
export function pushChunked(context: string[], prefix: string, items: string[], maxLen = 480): void {
  let line = prefix;
  for (const item of items) {
    const candidate = line === prefix ? `${line}${item}` : `${line}, ${item}`;
    if (candidate.length > maxLen && line !== prefix) {
      context.push(line);
      line = `${prefix}${item}`;
    } else {
      line = candidate;
    }
  }
  if (line !== prefix) context.push(line);
}

/**
 * The AI Context Engine (Phase 5, requirement #6): every AI request should
 * automatically carry current page, organization, selected record,
 * permissions, and recent history — without every call site having to
 * assemble it by hand. Returns the exact `workspaceContext: string[]`
 * shape RunAgentDto/RunAutonomousAgentDto expect.
 *
 * `recordContext` is for page-specific detail the hook can't know on its
 * own (e.g. "Viewing company: Acme Corp (id abc-123)") — callers on detail
 * pages pass it in; list/dashboard pages omit it.
 */
export function useWorkspaceContext(recordContext?: string[]): string[] {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const recentVisits = useRecentPagesStore((state) => state.visits);
  const { data: organizations } = useMyOrganizations();

  const context: string[] = [];

  context.push(`Current page: ${labelForPath(pathname)} (${pathname})`);

  const currentOrg = organizations?.find((org) => org.organizationId === user?.organizationId);
  if (currentOrg) {
    context.push(`Organization: ${currentOrg.organizationName}`);
  }

  if (user) {
    context.push(`User role: ${user.roles.join(", ") || "member"}`);
    pushChunked(context, "User permissions: ", user.permissions);
  }

  if (recordContext && recordContext.length > 0) {
    context.push(...recordContext);
  }

  const otherRecentVisits = recentVisits.filter((v) => v.path !== pathname).slice(0, 4);
  if (otherRecentVisits.length > 0) {
    context.push(`Recently viewed: ${otherRecentVisits.map((v) => v.label).join(", ")}`);
  }

  return context;
}

/** Records the current route into the recent-pages store — mount once in the shell. */
export function useTrackPageVisit(): void {
  const pathname = usePathname();
  const record = useRecentPagesStore((state) => state.record);

  useEffect(() => {
    record(labelForPath(pathname), pathname);
  }, [pathname, record]);
}
