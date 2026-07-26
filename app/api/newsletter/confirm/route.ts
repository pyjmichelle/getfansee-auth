/**
 * GET /api/newsletter/confirm?token=...            — double opt-in confirmation
 * GET /api/newsletter/confirm?token=...&action=unsubscribe — one-click unsubscribe
 *
 * Both actions are token-based (no auth required; the token was delivered to
 * the inbox). Redirects back to the site with a status query param.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action") === "unsubscribe" ? "unsubscribe" : "confirm";

  if (!token) {
    return NextResponse.redirect(`${SITE_URL}/?newsletter=invalid`, { status: 302 });
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data: subscriber } = await supabase
      .from("newsletter_subscribers")
      .select("id, status")
      .eq("token", token)
      .maybeSingle();

    if (!subscriber) {
      return NextResponse.redirect(`${SITE_URL}/?newsletter=invalid`, { status: 302 });
    }

    if (action === "unsubscribe") {
      await supabase
        .from("newsletter_subscribers")
        .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
        .eq("id", subscriber.id);
      return NextResponse.redirect(`${SITE_URL}/?newsletter=unsubscribed`, { status: 302 });
    }

    if (subscriber.status !== "confirmed") {
      await supabase
        .from("newsletter_subscribers")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", subscriber.id);
    }

    return NextResponse.redirect(`${SITE_URL}/?newsletter=confirmed`, { status: 302 });
  } catch (err) {
    console.error("[newsletter/confirm] error:", err);
    return NextResponse.redirect(`${SITE_URL}/?newsletter=error`, { status: 302 });
  }
}
