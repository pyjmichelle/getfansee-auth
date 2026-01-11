import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export default function TestPage() {
  // Only accessible when NEXT_PUBLIC_TEST_MODE is enabled
  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Test Mode</h1>
          <p className="text-muted-foreground">Testing entry point for development and QA</p>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Quick Navigation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/auth">
              <Button variant="outline" className="w-full justify-start">
                /auth
              </Button>
            </Link>
            <Link href="/home">
              <Button variant="outline" className="w-full justify-start">
                /home
              </Button>
            </Link>
            <Link href="/me">
              <Button variant="outline" className="w-full justify-start">
                /me
              </Button>
            </Link>
            <Link href="/subscriptions">
              <Button variant="outline" className="w-full justify-start">
                /subscriptions
              </Button>
            </Link>
            <Link href="/purchases">
              <Button variant="outline" className="w-full justify-start">
                /purchases
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Test Flow Checklist</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Sign up / log in</p>
                <p className="text-xs text-muted-foreground">
                  Create a new account or sign in with existing credentials
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Visit /home and open a creator
                </p>
                <p className="text-xs text-muted-foreground">
                  Browse creators list and navigate to a creator profile
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Subscribe</p>
                <p className="text-xs text-muted-foreground">
                  Subscribe to a creator to unlock subscriber-only content
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Unlock PPV</p>
                <p className="text-xs text-muted-foreground">
                  Purchase and unlock a pay-per-view post
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Check /subscriptions and /purchases
                </p>
                <p className="text-xs text-muted-foreground">
                  Verify that subscriptions and purchases are recorded correctly
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Use /me to create creator profile (if applicable)
                </p>
                <p className="text-xs text-muted-foreground">
                  Convert your account to a creator and set up your profile
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
