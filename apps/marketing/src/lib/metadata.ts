import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

export function createPageMetadata(
  title: string,
  description: string,
  pathname: string,
): Metadata {
  const url = `${siteConfig.url}${pathname}`;
  const pageTitle = `${title} — ${siteConfig.name}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: pageTitle,
      description,
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
    },
  };
}