"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Blocks, Plus } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { mainNav, platformNav, secondaryNav } from "@/config/nav";
import { useInstalledExtensions } from "@/hooks/use-extensions";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

function NavLink({ item, collapsed }: { item: (typeof mainNav)[number]; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors duration-200 hover:bg-white/[0.04] hover:text-sidebar-foreground",
        active && "text-foreground hover:text-foreground",
        collapsed && "justify-center px-2",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-lg border border-primary/20 bg-primary/[0.09]"
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      {/* A gold rail on the active item. Reads as position at a glance, which
          a background tint alone does not — especially when collapsed. */}
      {active && !collapsed && (
        <motion.span
          layoutId="sidebar-active-rail"
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      <item.icon
        className={cn(
          "relative h-[18px] w-[18px] shrink-0 text-sidebar-foreground/45 transition-colors duration-200 group-hover:text-sidebar-foreground/80",
          active && "text-primary group-hover:text-primary",
        )}
      />
      {!collapsed && <span className="relative truncate">{item.label}</span>}
      {/* Shortcut hints turn the sidebar into a way to *learn* the keyboard
          model rather than just a list of links. */}
      {!collapsed && item.shortcut && (
        <kbd
          className={cn(
            "relative ml-auto hidden font-mono text-[10px] tracking-wider text-muted-foreground/40 lg:block",
            active && "text-primary/50",
          )}
        >
          {item.shortcut}
        </kbd>
      )}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">
        {item.label}
        {item.shortcut && <span className="ml-2 opacity-50">{item.shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

/** Section label. Collapses to a hairline so the grouping survives collapse. */
function NavGroup({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="mx-auto my-2 h-px w-6 bg-sidebar-border" />;
  return (
    <div className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">
      {label}
    </div>
  );
}

export function Sidebar({
  collapsed,
  onQuickCreate,
}: {
  collapsed: boolean;
  /** Opens the command palette — the same surface ⌘K uses, so Quick Create
   *  teaches the shortcut instead of competing with it. */
  onQuickCreate?: () => void;
}) {
  const isPlatformAdmin = useAuthStore((state) => state.user?.isPlatformAdmin);
  const { data: installedExtensions } = useInstalledExtensions();

  // Grouped presentationally rather than by changing config/nav.ts, which the
  // command palette and mobile nav also consume. Ten flat links with unlabelled
  // dividers is what made this read as an admin template; the AI surfaces in
  // particular were buried mid-list in a product whose whole premise is AI.
  const aiNav = mainNav.filter((item) => item.href === "/ai" || item.href.startsWith("/ai/"));
  const workspaceNav = mainNav.filter((item) => !aiNav.includes(item));

  // A developer's manifest only ever supplies a `label`/`targetPath`
  // (see manifest-validator.util.ts) — never an icon component, so every
  // installed app's nav entry renders with the same fixed Blocks icon
  // rather than evaluating a developer-supplied icon name into a
  // component lookup.
  const extensionNav = (installedExtensions?.navEntries ?? []).map((entry) => ({
    label: entry.label,
    href: `/apps${entry.targetPath}`,
    icon: Blocks,
  }));

  return (
    <aside
      className={cn(
        // No h-svh here. The workspace switcher is a sibling rendered *below*
        // this element, so claiming the full viewport height pushed it off
        // screen and clipped the end of the nav — Settings became unreachable.
        // The wrapper in dashboard-shell.tsx owns the height; this fills what
        // is left. min-h-0 is what lets the nav below actually scroll rather
        // than forcing the column taller than its parent.
        "hidden min-h-0 flex-1 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-[68px]" : "w-[248px]",
      )}
    >
      <div className={cn("flex h-16 items-center gap-2.5 px-4", collapsed && "justify-center px-0")}>
        <BrandMark className="h-8 w-8" />
        {!collapsed && <span className="text-base font-semibold tracking-tight">Voltx</span>}
      </div>

      {onQuickCreate && (
        <div className={cn("pb-1", collapsed ? "px-2" : "px-3")}>
          {collapsed ? (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onQuickCreate}
                  aria-label="Quick create"
                  className="flex h-9 w-full items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary transition-colors duration-200 hover:bg-primary/15"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Quick create <span className="ml-2 opacity-50">⌘K</span>
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={onQuickCreate}
              className="group flex h-9 w-full items-center gap-2.5 rounded-lg border border-primary/25 bg-primary/10 px-3 text-sm font-medium text-primary transition-colors duration-200 hover:bg-primary/15"
            >
              <Plus className="h-4 w-4" />
              <span>Quick create</span>
              <kbd className="ml-auto font-mono text-[10px] tracking-wider text-primary/50">⌘K</kbd>
            </button>
          )}
        </div>
      )}

      <nav className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2">
        <NavGroup label="Workspace" collapsed={collapsed} />
        {workspaceNav.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}

        {aiNav.length > 0 && (
          <>
            <NavGroup label="Intelligence" collapsed={collapsed} />
            {aiNav.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </>
        )}

        <NavGroup label="Manage" collapsed={collapsed} />
        {secondaryNav.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}

        {extensionNav.length > 0 && (
          <>
            <NavGroup label="Apps" collapsed={collapsed} />
            {extensionNav.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </>
        )}

        {isPlatformAdmin && (
          <>
            <NavGroup label="Platform" collapsed={collapsed} />
            {platformNav.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
