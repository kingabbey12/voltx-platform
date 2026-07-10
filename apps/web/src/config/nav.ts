import {
  Bot,
  Building2,
  Inbox,
  LayoutDashboard,
  Plug,
  Settings,
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
  { label: "Inbox", href: "/inbox", icon: Inbox, shortcut: "G I" },
  { label: "AI Chat", href: "/ai", icon: Bot, shortcut: "G A" },
  { label: "CRM", href: "/crm", icon: Building2, shortcut: "G C" },
  { label: "Workflows", href: "/workflows", icon: Workflow, shortcut: "G W" },
  { label: "Integrations", href: "/integrations", icon: Plug, shortcut: "G N" },
];

export const secondaryNav: NavItem[] = [
  { label: "Team", href: "/settings/team", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings, shortcut: "G S" },
];
