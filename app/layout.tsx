import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/toaster";
import { UnlockProvider } from "@/contexts/unlock-context";
import { AgeGate } from "@/components/age-gate";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GetFanSee - Where fans get closer",
  description: "Premium adult creator subscription platform",
  generator: "v0.app",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
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
      <body className={`${inter.className} antialiased`}>
        <UnlockProvider>
          <AgeGate>{children}</AgeGate>
        </UnlockProvider>
        <Toaster />
        {!isTestMode && <Analytics />}
      </body>
    </html>
  );
}
