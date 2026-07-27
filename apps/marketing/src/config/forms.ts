/**
 * Shared option sets for the lead-capture forms and the Industries page.
 * Kept in one place so a sales-qualification field means the same thing
 * wherever it appears — and so the Industries page and the Industry dropdown
 * cannot drift apart.
 */

export const companySizes = [
  "1–10 employees",
  "11–50 employees",
  "51–200 employees",
  "201–1,000 employees",
  "1,001–5,000 employees",
  "5,000+ employees",
] as const;

export const industries = [
  "Software & Technology",
  "Financial Services",
  "Professional Services",
  "Healthcare & Life Sciences",
  "Manufacturing & Logistics",
  "Retail & E-commerce",
  "Energy & Utilities",
  "Real Estate & Construction",
  "Education",
  "Public Sector",
  "Other",
] as const;

export type CompanySize = (typeof companySizes)[number];
export type Industry = (typeof industries)[number];
