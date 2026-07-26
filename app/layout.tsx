import type React from "react";
import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken",
  weight: ["300", "400", "500", "600", "700"],
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  adjustFontFallback: true,
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  weight: ["400", "600", "700"],
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "GetFanSee - Where fans get closer",
    template: "%s | GetFanSee",
  },
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0B0D",
  // Without viewportFit: "cover", iOS Safari never populates
  // env(safe-area-inset-*), so the bottom nav and sticky bars silently
  // ignore notch/home-indicator insets on real devices.
  viewportFit: "cover",
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
      <body className={`${hanken.variable} ${fraunces.variable} font-sans antialiased`}>
        <Suspense fallback={null}>
          <PostHogProvider>
            <AuthProvider initialAuth={initialAuth}>
              <RoutePerfTracker />
              <UnlockProvider>
                <AgeGate>{children}</AgeGate>
              </UnlockProvider>
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
