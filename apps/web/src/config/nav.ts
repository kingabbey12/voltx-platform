import {
  ClipboardList,
  Bot,
  Building2,
  ClipboardCheck,
  CreditCard,
  Gauge,
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
  Target,
  UserRoundCheck,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  shortcut?: string;
  /** A navigation surface may only expose this item when the current session has every listed permission. */
  requiredPermissions?: readonly string[];
}

/** The focused operating-system navigation used by the app shell. Every entry
 * maps to an existing route; unavailable product areas are intentionally not
 * represented as misleading placeholders. */
export const workspaceNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, shortcut: "G D" },
  { label: "Inbox", href: "/inbox", icon: Inbox, shortcut: "G I" },
  { label: "Companies", href: "/crm/companies", icon: Building2, requiredPermissions: ["sales.company.read"] },
  { label: "Contacts", href: "/crm/contacts", icon: Users, requiredPermissions: ["sales.contact.read"] },
  { label: "Leads", href: "/crm/leads", icon: UserRoundCheck, requiredPermissions: ["sales.lead.read"] },
  { label: "Opportunities", href: "/crm/opportunities", icon: Target, requiredPermissions: ["sales.opportunity.read"] },
  { label: "Tasks", href: "/crm/activities", icon: ClipboardCheck },
  { label: "Automations", href: "/workflows", icon: Workflow, shortcut: "G W" },
  { label: "AI Agents", href: "/ai/agents", icon: Sparkles, shortcut: "G O" },
  { label: "Marketplace", href: "/marketplace", icon: Store, shortcut: "G M" },
];

export const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, shortcut: "G D" },
  { label: "Executive", href: "/executive", icon: Sparkles, shortcut: "G E", requiredPermissions: ["ai.agent.run"] },
  { label: "Company", href: "/company", icon: Landmark, shortcut: "G Y" },
  { label: "Promises", href: "/promises", icon: Handshake, shortcut: "G P" },
  { label: "Inbox", href: "/inbox", icon: Inbox, shortcut: "G I" },
  { label: "Assistant", href: "/assistant", icon: Bot },
  { label: "Business Intelligence", href: "/executive/business-intelligence", icon: Gauge, requiredPermissions: ["ai.agent.run"] },
  { label: "Executive Insights", href: "/executive-insights", icon: Sparkles },
  { label: "Executive Decisions", href: "/executive-decisions", icon: Gauge },
  { label: "Multi-Agent", href: "/multi-agent", icon: Users },
  { label: "Workflow Plans", href: "/workflow-plans", icon: ClipboardList },
  { label: "AI Chat", href: "/ai", icon: Bot, shortcut: "G A" },
  { label: "AI Operator", href: "/ai/operator", icon: Sparkles, shortcut: "G O" },
  { label: "AI Workflows", href: "/ai/workflows", icon: Workflow, shortcut: "G F" },
  { label: "CRM", href: "/crm", icon: Building2, shortcut: "G C", requiredPermissions: ["sales.opportunity.read"] },
  { label: "Finance", href: "/finance", icon: Landmark, requiredPermissions: ["finance.report.read"] },
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
