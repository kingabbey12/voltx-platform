"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Blocks } from "lucide-react";
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
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors duration-200 hover:bg-primary/5 hover:text-sidebar-foreground",
        active && "text-primary hover:text-primary",
        collapsed && "justify-center px-2",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-lg bg-primary/10"
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      <item.icon
        className={cn(
          "relative h-4.5 w-4.5 shrink-0 text-primary/50 transition-colors duration-200 group-hover:text-primary",
          active && "text-primary",
        )}
      />
      {!collapsed && <span className="relative truncate">{item.label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const isPlatformAdmin = useAuthStore((state) => state.user?.isPlatformAdmin);
  const { data: installedExtensions } = useInstalledExtensions();

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
        "hidden h-svh flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-[68px]" : "w-[248px]",
      )}
    >
      <div className={cn("flex h-16 items-center gap-2.5 px-4", collapsed && "justify-center px-0")}>
        <BrandMark className="h-8 w-8" />
        {!collapsed && <span className="text-base font-semibold tracking-tight">Voltx</span>}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {mainNav.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
        <div className="my-2 h-px bg-sidebar-border" />
        {secondaryNav.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
        {extensionNav.length > 0 && (
          <>
            <div className="my-2 h-px bg-sidebar-border" />
            {extensionNav.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </>
        )}
        {isPlatformAdmin && (
          <>
            <div className="my-2 h-px bg-sidebar-border" />
            {platformNav.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
