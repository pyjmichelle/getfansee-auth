import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { unlockPost } from "@/lib/paywall";

type UnlockPayload = {
  postId?: string;
  priceCents?: number;
};

export async function POST(request: NextRequest) {
  try {
    const { postId, priceCents } = (await request.json()) as UnlockPayload;

    if (!postId) {
      return NextResponse.json({ success: false, error: "postId is required" }, { status: 400 });
    }

    const idempotencyKey = request.headers.get("Idempotency-Key") ?? randomUUID();
    const result = await unlockPost(postId, priceCents, idempotencyKey);

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[api] unlock error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
