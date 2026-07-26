/**
 * POST /api/newsletter/subscribe
 *
 * Email capture with double opt-in (Pre-Payment Alpha).
 * Body: { email: string, source?: string }
 *
 * newsletter_subscribers is a server-only table (RLS enabled, no policies),
 * so the admin client is required here. Responses never reveal whether an
 * email already exists (anti-enumeration).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth-server";
import { sendNewsletterConfirmation } from "@/lib/email";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";

// Stricter than click-tracking limits — each success sends a real email.
const SUBSCRIBE_LIMIT = 5;
const SUBSCRIBE_WINDOW_MS = 60 * 60_000;

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(
      `newsletter:${getClientIp(request)}`,
      SUBSCRIBE_LIMIT,
      SUBSCRIBE_WINDOW_MS
    );
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    let body: { email?: unknown; source?: unknown };
    try {
      body = (await request.json()) as { email?: unknown; source?: unknown };
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address" },
        { status: 400 }
      );
    }
    const source = typeof body.source === "string" && body.source.length <= 60 ? body.source : null;

    const user = await getCurrentUser();
    const supabase = getSupabaseAdminClient();

    const { data: existing } = await supabase
      .from("newsletter_subscribers")
      .select("id, status, token")
      .eq("email", email)
      .maybeSingle();

    if (existing?.status === "confirmed") {
      // Already confirmed — succeed silently (no enumeration signal).
      return NextResponse.json({ success: true });
    }

    let token = existing?.token as string | undefined;

    if (existing) {
      // Re-request: reset to pending (covers previously unsubscribed users re-opting in).
      const { data: updated, error } = await supabase
        .from("newsletter_subscribers")
        .update({ status: "pending", source, user_id: user?.id ?? null })
        .eq("id", existing.id)
        .select("token")
        .single();
      if (error) throw error;
      token = updated.token;
    } else {
      const { data: inserted, error } = await supabase
        .from("newsletter_subscribers")
        .insert({ email, source, user_id: user?.id ?? null })
        .select("token")
        .single();
      if (error) throw error;
      token = inserted.token;
    }

    const emailSent = await sendNewsletterConfirmation({
      toEmail: email,
      confirmUrl: `${SITE_URL}/api/newsletter/confirm?token=${token}`,
    });

    if (!emailSent) {
      // Don't report success — the double opt-in link never left the server.
      // The pending row stays in place; a retry will reuse it and resend.
      return NextResponse.json(
        {
          success: false,
          error: "We couldn't send the confirmation email right now. Please try again shortly.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[newsletter/subscribe] error:", err);
    return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
  }
}
