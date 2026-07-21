import {
  Bot,
  Building2,
  ClipboardCheck,
  CreditCard,
  Handshake,
  Inbox,
  Landmark,
  LayoutDashboard,
  Lock,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  TerminalSquare,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  shortcut?: string;
}

export const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, shortcut: "G D" },
  { label: "Company", href: "/company", icon: Landmark, shortcut: "G Y" },
  { label: "Promises", href: "/promises", icon: Handshake, shortcut: "G P" },
  { label: "Inbox", href: "/inbox", icon: Inbox, shortcut: "G I" },
  { label: "AI Chat", href: "/ai", icon: Bot, shortcut: "G A" },
  { label: "AI Operator", href: "/ai/operator", icon: Sparkles, shortcut: "G O" },
  { label: "CRM", href: "/crm", icon: Building2, shortcut: "G C" },
  { label: "Workflows", href: "/workflows", icon: Workflow, shortcut: "G W" },
  { label: "Integrations", href: "/integrations", icon: Plug, shortcut: "G N" },
];

export const secondaryNav: NavItem[] = [
  { label: "Team", href: "/settings/team", icon: Users },
  { label: "Billing", href: "/billing", icon: CreditCard, shortcut: "G B" },
  { label: "Marketplace", href: "/marketplace", icon: Store, shortcut: "G M" },
  { label: "Security", href: "/security", icon: Lock },
  { label: "Compliance", href: "/compliance", icon: ClipboardCheck },
  { label: "Developers", href: "/developers", icon: TerminalSquare, shortcut: "G V" },
  { label: "Settings", href: "/settings", icon: Settings, shortcut: "G S" },
];

/** Only rendered for users with isPlatformAdmin (v2.2 Platform Console) — see Sidebar. */
export const platformNav: NavItem[] = [
  { label: "Platform Console", href: "/platform", icon: ShieldCheck },
];
