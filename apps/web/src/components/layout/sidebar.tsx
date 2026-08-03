"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Blocks, Crown, Plus } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { platformNav, secondaryNav, workspaceNav, type NavItem } from "@/config/nav";
import { useInstalledExtensions } from "@/hooks/use-extensions";
import { useAuthStore } from "@/lib/stores/auth-store";
import { transition } from "@/lib/design-language";
import { cn } from "@/lib/utils";

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex min-h-10 items-center gap-2.5 overflow-hidden rounded-xl px-2.5 text-sm font-medium text-sidebar-foreground/70 transition-[background-color,color,box-shadow,transform] duration-200 hover:bg-white/[0.055] hover:text-sidebar-foreground hover:shadow-[0_8px_20px_-18px_hsl(0_0%_0%/0.9)]",
        active && "text-foreground shadow-[0_10px_24px_-20px_hsl(var(--primary)/0.65)] hover:text-foreground",
        collapsed && "justify-center px-2",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-xl border border-primary/25 bg-[linear-gradient(105deg,hsl(var(--primary)/0.16),hsl(268_83%_68%/0.06))]"
          transition={transition()}
        />
      )}
      {/* A gold rail on the active item. Reads as position at a glance, which
          a background tint alone does not — especially when collapsed. */}
      {active && !collapsed && (
        <motion.span
          layoutId="sidebar-active-rail"
          className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.9)]"
          transition={transition()}
        />
      )}
      <span
        className={cn(
          "relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sidebar-foreground/45 transition-[background-color,color,transform] duration-200 group-hover:bg-white/[0.055] group-hover:text-sidebar-foreground/85",
          active && "bg-primary/[0.13] text-primary shadow-[0_8px_18px_-14px_hsl(var(--primary)/0.9)] group-hover:bg-primary/[0.16] group-hover:text-primary",
        )}
      >
        <item.icon className="h-[16px] w-[16px]" />
      </span>
      {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
      {/* Shortcut hints turn the sidebar into a way to *learn* the keyboard
          model rather than just a list of links. */}
      {!collapsed && item.shortcut && (
        <kbd
          className={cn(
            "relative z-10 ml-auto hidden rounded-md px-1 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground/40 lg:block",
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
  return <div className="flex items-center gap-2 px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/45"><span>{label}</span><span className="h-px flex-1 bg-white/[0.055]" /></div>;
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
  const intelligenceNav = workspaceNav.filter((item) => item.href === "/ai/agents" || item.href === "/workflows");
  const crmNav = workspaceNav.filter((item) => item.href.startsWith("/crm/"));
  const coreNav = workspaceNav.filter((item) => !intelligenceNav.includes(item) && !crmNav.includes(item));

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
        "hidden min-h-0 flex-1 flex-col border-r border-sidebar-border bg-[radial-gradient(110%_36%_at_50%_0%,hsl(var(--primary)/0.07),transparent_68%),hsl(var(--sidebar))] shadow-[16px_0_44px_-34px_hsl(0_0%_0%/0.95)] transition-[width] duration-200 md:flex",
        collapsed ? "w-[68px]" : "w-[248px]",
      )}
    >
      <div className={cn("relative flex h-[72px] items-center gap-2.5 border-b border-white/[0.055] px-4", collapsed && "justify-center px-0")}>
        <div aria-hidden className="absolute inset-x-5 bottom-0 h-px bg-[linear-gradient(90deg,transparent,hsl(var(--primary)/0.35),transparent)]" />
        <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-primary/20 bg-primary/[0.08] shadow-[0_10px_22px_-16px_hsl(var(--primary)/0.85)]"><BrandMark className="h-6 w-6" /></span>
        {!collapsed && <span className="text-[17px] font-semibold tracking-tight">Voltx</span>}
      </div>

      {onQuickCreate && (
        <div className={cn("pb-1 pt-3", collapsed ? "px-2" : "px-3")}>
          {collapsed ? (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onQuickCreate}
                  aria-label="Quick create"
                  className="flex h-10 w-full items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_10px_22px_-18px_hsl(var(--primary)/0.9)] transition-[background-color,transform] duration-200 hover:-translate-y-px hover:bg-primary/15"
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
              className="group flex h-10 w-full items-center gap-2.5 rounded-xl border border-primary/25 bg-[linear-gradient(100deg,hsl(var(--primary)/0.16),hsl(268_83%_68%/0.07))] px-3 text-sm font-medium text-primary shadow-[0_12px_26px_-20px_hsl(var(--primary)/0.95)] transition-[background-color,transform] duration-200 hover:-translate-y-px hover:bg-primary/15"
            >
              <Plus className="h-4 w-4" />
              <span>Quick create</span>
              <kbd className="ml-auto font-mono text-[10px] tracking-wider text-primary/50">⌘K</kbd>
            </button>
          )}
        </div>
      )}

      <nav className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
        <NavGroup label="Overview" collapsed={collapsed} />
        {coreNav.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}

        {crmNav.length > 0 && (
          <>
            <NavGroup label="Customer workspace" collapsed={collapsed} />
            {crmNav.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </>
        )}

        <NavGroup label="Intelligence" collapsed={collapsed} />
        {intelligenceNav.map((item) => <NavLink key={item.href} item={item} collapsed={collapsed} />)}

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

        {!collapsed && <Link href="/billing" className="group relative mt-5 overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.15),hsl(268_83%_68%/0.10))] p-3.5 shadow-[0_16px_30px_-24px_hsl(var(--primary)/0.8)] transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:border-primary/40 hover:shadow-[0_20px_34px_-24px_hsl(var(--primary)/1)]"><span aria-hidden className="absolute -right-5 -top-7 h-20 w-20 rounded-full bg-primary/20 blur-2xl transition-transform duration-300 group-hover:scale-125" /><span className="relative flex items-center gap-2 text-xs font-semibold text-primary"><span className="grid h-6 w-6 place-items-center rounded-lg border border-primary/25 bg-primary/10"><Crown className="h-3.5 w-3.5" /></span>Unlock more operating power</span><span className="relative mt-2 block text-[11px] leading-relaxed text-sidebar-foreground/65">Explore the plan built for your growing team.</span></Link>}
      </nav>
    </aside>
  );
}
