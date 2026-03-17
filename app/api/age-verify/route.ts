import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * POST /api/age-verify
 * Records an age gate confirmation for compliance audit purposes.
 * Called client-side after the user clicks "I am 18+" on the AgeGate.
 *
 * IP address is one-way hashed (SHA-256) before storage — no PII retained.
 */
export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get("user-agent") ?? "unknown";

    // Get IP — Vercel forwards in x-forwarded-for
    const forwardedFor = request.headers.get("x-forwarded-for");
    const rawIp = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

    // Hash IP before storage (GDPR: not storing raw PII)
    const hashedIp =
      rawIp !== "unknown" ? createHash("sha256").update(rawIp).digest("hex") : "unknown";

    // Optional session ID from body (browser-generated UUID, not linked to user account)
    let sessionId: string | null = null;
    try {
      const body = await request.json();
      sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
    } catch {
      // Body is optional
    }

    const admin = getSupabaseAdminClient();
    await admin.from("age_verifications").insert({
      session_id: sessionId,
      ip_address: hashedIp,
      user_agent: userAgent.slice(0, 500), // truncate to prevent oversized storage
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    // Non-fatal — age gate is already client-side verified, logging failure shouldn't block UX
    console.error("[api/age-verify] logging error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
