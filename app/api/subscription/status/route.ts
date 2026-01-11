import { NextRequest, NextResponse } from "next/server";
import { hasActiveSubscription } from "@/lib/paywall";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");

    if (!creatorId) {
      return NextResponse.json({ error: "creatorId is required" }, { status: 400 });
    }

    const isSubscribed = await hasActiveSubscription(creatorId);

    return NextResponse.json({ isSubscribed });
  } catch (err: unknown) {
    console.error("[api] subscription status error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
