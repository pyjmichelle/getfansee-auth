import type React from "react";
import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { UnlockProvider } from "@/contexts/unlock-context";
import { AgeGate } from "@/components/age-gate";
import { CookieConsent } from "@/components/cookie-consent";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { RoutePerfTracker } from "@/components/providers/route-perf-tracker";
import { AuthProvider } from "@/contexts/auth-context";
import { getServerAuthState } from "@/lib/server/auth-state";
import { Suspense } from "react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  fallback: [
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "sans-serif",
  ],
  adjustFontFallback: true,
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700"],
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "GetFanSee - Where fans get closer",
  description: "Premium adult creator subscription platform",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "GetFanSee - Where fans get closer",
    description: "Premium adult creator subscription platform",
    type: "website",
    siteName: "GetFanSee",
    url: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
  },
};

const isTestMode =
  process.env.NEXT_PUBLIC_TEST_MODE === "true" || process.env.PLAYWRIGHT_TEST_MODE === "true";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Server-rendered auth state: injected once so every page knows auth at first
  // render (no client bootstrap fetch, no permanent skeletons).
  const initialAuth = await getServerAuthState();

  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#000000" />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        <Suspense fallback={null}>
          <PostHogProvider>
            <AuthProvider initialAuth={initialAuth}>
              <RoutePerfTracker />
              <UnlockProvider>
                <AgeGate>{children}</AgeGate>
              </UnlockProvider>
              <Toaster />
              <SonnerToaster richColors position="top-center" />
              {!isTestMode && <Analytics />}
              {!isTestMode && <CookieConsent />}
            </AuthProvider>
          </PostHogProvider>
        </Suspense>
      </body>
    </html>
  );
}
