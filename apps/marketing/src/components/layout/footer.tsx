import Link from "next/link";
import { Github, Linkedin, Twitter, Zap } from "lucide-react";
import { footerNav, siteConfig } from "@/config/site";

function isExternal(href: string) {
  return href.startsWith("http");
}

export function Footer() {
  return (
    <footer className="relative border-t border-border/70">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-primary/[0.03]" />
      <div className="container py-16 md:py-20">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2 flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground">
                <Zap className="h-4.5 w-4.5" strokeWidth={0} fill="currentColor" />
              </span>
              {siteConfig.name}
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {siteConfig.tagline}. Built for teams who move fast and think bigger.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href={siteConfig.links.twitter}
                aria-label="Voltx on X (Twitter)"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href={siteConfig.links.linkedin}
                aria-label="Voltx on LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href={siteConfig.links.github}
                aria-label="Voltx on GitHub"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          {footerNav.map((group) => (
            <div key={group.title} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
              <ul className="flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    {isExternal(link.href) ? (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        target={link.href.includes("usevoltx.com") ? undefined : "_blank"}
                        rel={link.href.includes("usevoltx.com") ? undefined : "noopener noreferrer"}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
            <h3 className="text-sm font-semibold text-foreground">Platform</h3>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a
                  href={siteConfig.appUrl}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  app.usevoltx.com
                </a>
              </li>
              <li>
                <a
                  href={siteConfig.apiUrl}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  api.usevoltx.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border/70 pt-8 md:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Made for teams who build the future.
          </p>
        </div>
      </div>
    </footer>
  );
}
