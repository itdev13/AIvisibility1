import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/seo";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-display", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url()),
  title: { default: "BayClusterLab — Get recommended when buyers ask AI", template: "%s · BayClusterLab" },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    url: "/",
    title: "BayClusterLab — When buyers ask AI, be the answer.",
    description: SITE.description,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: "BayClusterLab — When buyers ask AI, be the answer.", description: SITE.description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" } },
  formatDetection: { telephone: false, email: false, address: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
