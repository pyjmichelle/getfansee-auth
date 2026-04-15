/**
 * POST /api/webhooks/didit
 *
 * Receives Didit v3 webhook events for KYC status changes.
 *
 * Security:
 * - Verifies X-Signature-V2 (recommended) with fallback to X-Signature-Simple
 * - Idempotent via webhook_events table
 * - No user session required (webhook auth is signature-based)
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { processWebhookEvent } from "@/lib/kyc/kyc-service";
import type { DiditWebhookPayload } from "@/lib/kyc/didit-mapper";

// ─── Signature Verification ──────────────────────────────

/**
 * Process floats to match Didit's server-side behavior.
 * Converts float values that are whole numbers to integers.
 */
function shortenFloats(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(shortenFloats);
  } else if (data !== null && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([key, value]) => [
        key,
        shortenFloats(value),
      ])
    );
  } else if (typeof data === "number" && !Number.isInteger(data) && data % 1 === 0) {
    return Math.trunc(data);
  }
  return data;
}

/**
 * Verify X-Signature-V2 (recommended by Didit).
 * Re-encodes the parsed JSON with sorted keys and unescaped Unicode,
 * matching what most middleware produces.
 */
function verifySignatureV2(parsedBody: unknown, signatureHeader: string, secret: string): boolean {
  try {
    const processed = shortenFloats(parsedBody);
    const canonical = JSON.stringify(processed, Object.keys(processed as object).sort());
    const expected = createHmac("sha256", secret).update(canonical).digest("hex");

    const sigBuf = Buffer.from(signatureHeader, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Verify X-Signature-Simple (fallback).
 * Signs only core fields: "{timestamp}:{session_id}:{status}:{webhook_type}"
 */
function verifySignatureSimple(
  payload: DiditWebhookPayload,
  signatureHeader: string,
  timestamp: string,
  secret: string
): boolean {
  try {
    const message = `${timestamp}:${payload.session_id}:${payload.status}:${payload.webhook_type}`;
    const expected = createHmac("sha256", secret).update(message).digest("hex");

    const sigBuf = Buffer.from(signatureHeader, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Verify webhook authenticity using available signature headers.
 */
function verifyWebhook(parsedBody: DiditWebhookPayload, headers: Headers, secret: string): boolean {
  const timestamp = headers.get("x-timestamp") ?? "";

  // Reject stale requests (> 5 min)
  if (timestamp) {
    const ts = parseInt(timestamp, 10);
    if (!isNaN(ts) && Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) {
      logger.warn("[webhook/didit] Stale timestamp", { timestamp });
      return false;
    }
  }

  // Try X-Signature-V2 first (recommended)
  const sigV2 = headers.get("x-signature-v2");
  if (sigV2 && verifySignatureV2(parsedBody, sigV2, secret)) {
    return true;
  }

  // Fallback to X-Signature-Simple
  const sigSimple = headers.get("x-signature-simple");
  if (sigSimple && timestamp && verifySignatureSimple(parsedBody, sigSimple, timestamp, secret)) {
    return true;
  }

  // Legacy fallback: X-Signature (raw body HMAC) — only if raw body available
  const sigRaw = headers.get("x-signature");
  if (sigRaw) {
    logger.warn(
      "[webhook/didit] X-Signature present but V2/Simple failed; raw body verification not available in parsed mode"
    );
  }

  return false;
}

// ─── Route Handlers ──────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = env.DIDIT_WEBHOOK_SECRET;

    // Parse body
    let body: DiditWebhookPayload;
    try {
      body = (await request.json()) as DiditWebhookPayload;
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
    }

    // Verify signature
    if (!webhookSecret) {
      if (process.env.NODE_ENV === "production") {
        logger.error(
          "[webhook/didit] DIDIT_WEBHOOK_SECRET not configured in production",
          new Error("Missing secret")
        );
        return NextResponse.json(
          { success: false, error: "Webhook not configured" },
          { status: 500 }
        );
      }
      logger.warn(
        "[webhook/didit] DIDIT_WEBHOOK_SECRET not set, skipping verification in development"
      );
    } else {
      const isValid = verifyWebhook(body, request.headers, webhookSecret);
      if (!isValid) {
        logger.warn("[webhook/didit] Invalid webhook signature", {
          sessionId: body.session_id,
        });
        return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
      }
    }

    // Validate minimum required fields
    if (!body.session_id || !body.status) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: session_id, status" },
        { status: 400 }
      );
    }

    logger.info("[webhook/didit] Processing event", {
      sessionId: body.session_id,
      status: body.status,
      webhookType: body.webhook_type,
      vendorData: body.vendor_data,
    });

    // Process the event
    const result = await processWebhookEvent(body);

    if (result.isDuplicate) {
      return NextResponse.json({
        success: true,
        message: "Event already processed",
        dedup: true,
      });
    }

    if (!result.processed) {
      return NextResponse.json(
        { success: false, error: "Failed to process event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Event processed" });
  } catch (err: unknown) {
    logger.error("[webhook/didit] Unhandled error", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Didit webhook endpoint",
    status: "ready",
    version: "v3",
  });
}
