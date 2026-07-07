export const siteConfig = {
  name: "Voltx",
  tagline: "The AI Business Operating System",
  description:
    "AI agents, CRM, workflows, knowledge, meetings, and automation in one platform. Voltx is the operating system for modern business teams.",
  url: "https://www.usevoltx.com",
  appUrl: "https://app.usevoltx.com",
  apiUrl: "https://api.usevoltx.com",
  links: {
    twitter: "https://twitter.com/usevoltx",
    github: "https://github.com/voltx",
    linkedin: "https://linkedin.com/company/usevoltx",
  },
  email: {
    sales: "sales@usevoltx.com",
    support: "support@usevoltx.com",
  },
} as const;

export type NavLink = {
  label: string;
  href: string;
};

export const mainNav: NavLink[] = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Sign in", href: siteConfig.appUrl },
      { label: "API reference", href: siteConfig.apiUrl },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];
