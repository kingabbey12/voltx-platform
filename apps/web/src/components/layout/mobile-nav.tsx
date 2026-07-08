"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BrandMark } from "@/components/brand-mark";
import { mainNav, secondaryNav } from "@/config/nav";
import { cn } from "@/lib/utils";

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="left-0 top-0 h-svh max-w-[280px] translate-x-0 translate-y-0 rounded-none border-r border-border p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
          <BrandMark className="h-8 w-8" />
          <span className="text-base font-semibold tracking-tight">Voltx</span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {mainNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/70 hover:bg-secondary hover:text-foreground",
                  active && "bg-primary/10 text-foreground",
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            );
          })}
          <div className="my-2 h-px bg-border" />
          {secondaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/70 hover:bg-secondary hover:text-foreground"
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
