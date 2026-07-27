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
  { label: "Product", href: "/features" },
  { label: "AI", href: "/ai" },
  { label: "Solutions", href: "/solutions" },
  { label: "Industries", href: "/industries" },
  { label: "Enterprise", href: "/enterprise" },
  { label: "Pricing", href: "/pricing" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "AI Capabilities", href: "/ai" },
      { label: "Solutions", href: "/solutions" },
      { label: "Industries", href: "/industries" },
      { label: "Enterprise", href: "/enterprise" },
      { label: "Pricing", href: "/pricing" },
      { label: "Sign in", href: siteConfig.appUrl },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Developers", href: "/developers" },
      { label: "Docs", href: "/docs" },
      { label: "API reference", href: siteConfig.apiUrl },
      { label: "Changelog", href: `${siteConfig.appUrl}/developers/changelog` },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
      { label: "Book a demo", href: "/book-demo" },
      { label: "Join the beta", href: "/join-beta" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Security", href: "/security" },
      { label: "FAQ", href: "/faq" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];
