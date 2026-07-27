import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Voltx",
    template: "%s — Voltx",
  },
  description: "The AI Business Operating System.",
  robots: { index: false, follow: false },
  applicationName: "Voltx",
  keywords: ["AI", "business", "operating system", "automation", "workflow"],
  authors: [{ name: "Voltx" }],
  creator: "Voltx",
  publisher: "Voltx",
  openGraph: {
    title: "Voltx",
    description: "The AI Business Operating System.",
    type: "website",
    locale: "en_US",
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
