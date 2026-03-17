import { NextRequest, NextResponse } from "next/server";
import { subscribe30d } from "@/lib/paywall";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendSubscriptionConfirmation } from "@/lib/email";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";

type SubscribePayload = {
  creatorId?: string;
  priceCents?: number;
};

export async function POST(request: NextRequest) {
  try {
    const { creatorId, priceCents } = (await request.json()) as SubscribePayload;

    if (!creatorId) {
      return NextResponse.json({ success: false, error: "creatorId is required" }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const success = await subscribe30d(creatorId);

    if (success) {
      // Send order confirmation email (non-blocking — don't fail the request if email fails)
      try {
        const admin = getSupabaseAdminClient();
        const [profileRes, creatorRes] = await Promise.all([
          admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
          admin.from("profiles").select("display_name").eq("id", creatorId).maybeSingle(),
        ]);
        const fanName = profileRes.data?.display_name || user.email.split("@")[0];
        const creatorName = creatorRes.data?.display_name || "Creator";
        const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(
          "en-US",
          { year: "numeric", month: "long", day: "numeric" }
        );

        await sendSubscriptionConfirmation({
          toEmail: user.email,
          toName: fanName,
          creatorName,
          amountCents: priceCents ?? 0,
          nextBillingDate,
          cancelUrl: `${SITE_URL}/subscriptions`,
        });
      } catch (emailErr) {
        console.error("[api/subscribe] email send error (non-fatal):", emailErr);
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: "Failed to subscribe" }, { status: 500 });
    }
  } catch (err: unknown) {
    console.error("[api] subscribe error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
