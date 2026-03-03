import type React from "react";
import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/toaster";
import { UnlockProvider } from "@/contexts/unlock-context";
import { AgeGate } from "@/components/age-gate";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { RoutePerfTracker } from "@/components/providers/route-perf-tracker";
import { AuthSyncProvider } from "@/components/providers/auth-sync-provider";
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

export const metadata: Metadata = {
  title: "GetFanSee - Where fans get closer",
  description: "Premium adult creator subscription platform",
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
  },
  robots: {
    index: true,
    follow: true,
  },
};

const isTestMode =
  process.env.NEXT_PUBLIC_TEST_MODE === "true" || process.env.PLAYWRIGHT_TEST_MODE === "true";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#000000" />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        <Suspense fallback={null}>
          <PostHogProvider>
            <AuthSyncProvider>
              <RoutePerfTracker />
              <UnlockProvider>
                <AgeGate>{children}</AgeGate>
              </UnlockProvider>
              <Toaster />
              {!isTestMode && <Analytics />}
            </AuthSyncProvider>
          </PostHogProvider>
        </Suspense>
      </body>
    </html>
  );
}
