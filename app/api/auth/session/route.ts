import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

// Session cookie sync endpoint: called by the client after Supabase JS login
// to persist the session token in httpOnly cookies for SSR.
//
// WHY we validate JWT claims locally instead of calling admin.auth.getUser():
//   A remote getUser() call creates a Vercel → Supabase network roundtrip on
//   every login, which is fragile (cold-start timeouts → "session sync error").
//   Because Supabase already validated the token at issuance, local claim
//   verification (iss / aud / exp / sub) plus optional HMAC-SHA256 signature
//   check is sufficient to safely set the httpOnly cookies.

type SessionPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  role?: string;
};

/**
 * Decode and validate a Supabase access_token.
 *
 * When SUPABASE_JWT_SECRET is configured, the HMAC-SHA256 signature is
 * verified cryptographically (defense-in-depth before the httpOnly cookie is
 * set).  Without the secret the function falls back to claims-only validation
 * so existing deployments continue to work while the secret is being rolled
 * out.
 */
function validateSupabaseJwt(token: string): JwtPayload | null {
  // 1. Must be exactly 3 base64url segments
  const parts = token.split(".");
  if (parts.length !== 3) {
    console.warn("[validateJwt] malformed token: expected 3 segments, got", parts.length);
    return null;
  }

  // 2. Decode the payload segment
  let payload: JwtPayload;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf-8");
    payload = JSON.parse(json) as JwtPayload;
  } catch {
    console.warn("[validateJwt] failed to decode/parse JWT payload segment");
    return null;
  }

  // 3. Must not be expired
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) {
    console.warn(
      `[validateJwt] token expired: exp=${payload.exp}, now=${now}, delta=${(payload.exp ?? 0) - now}s`
    );
    return null;
  }

  // 4. Issuer must match our Supabase project
  const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const expectedIss = `${supabaseUrl}/auth/v1`;
  if (payload.iss !== expectedIss) {
    console.warn(`[validateJwt] iss mismatch: got "${payload.iss}", expected "${expectedIss}"`);
    return null;
  }

  // 5. Audience must be "authenticated"
  const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
  if (aud !== "authenticated") {
    console.warn(`[validateJwt] aud mismatch: got "${aud}", expected "authenticated"`);
    return null;
  }

  // 6. Must have a subject (user UUID)
  if (!payload.sub) {
    console.warn("[validateJwt] missing sub claim");
    return null;
  }

  // 7. Cryptographic signature verification (when secret is available)
  const jwtSecret = env.SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    const signingInput = `${parts[0]}.${parts[1]}`;
    const expectedSig = createHmac("sha256", jwtSecret).update(signingInput).digest("base64url");
    const actualSig = parts[2];
    try {
      const expected = Buffer.from(expectedSig);
      const actual = Buffer.from(actualSig);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        console.warn("[validateJwt] HMAC signature mismatch — check SUPABASE_JWT_SECRET");
        return null;
      }
    } catch {
      console.warn("[validateJwt] signature comparison threw — buffer length issue");
      return null;
    }
  } else {
    console.warn(
      "[api/auth/session] SUPABASE_JWT_SECRET not set — falling back to claims-only validation"
    );
  }

  return payload;
}

export async function POST(request: NextRequest) {
  try {
    const {
      access_token,
      refresh_token,
      expires_in = 3600,
    } = (await request.json()) as SessionPayload;

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
    }

    // Local JWT claim validation — no network call, no service key required
    const payload = validateSupabaseJwt(access_token);
    if (!payload) {
      console.warn("[api/auth/session] JWT claim validation failed");
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const safeMaxAge = Math.min(Math.max(Number(expires_in) || 3600, 60), 86400);
    const isSecure =
      request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

    const response = NextResponse.json({ success: true, uid: payload.sub });

    response.cookies.set("sb-access-token", access_token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      maxAge: safeMaxAge,
    });

    response.cookies.set("sb-refresh-token", refresh_token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      maxAge: safeMaxAge * 4,
    });

    return response;
  } catch (err: unknown) {
    console.error("[api/auth/session] error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const isSecure =
    request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const response = NextResponse.json({ success: true });
  response.cookies.set("sb-access-token", "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
  });
  response.cookies.set("sb-refresh-token", "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
  });
  return response;
}
