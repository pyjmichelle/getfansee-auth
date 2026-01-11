import { NextRequest, NextResponse } from "next/server";
import { subscribe30d } from "@/lib/paywall";

type SubscribePayload = {
  creatorId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { creatorId } = (await request.json()) as SubscribePayload;

    if (!creatorId) {
      return NextResponse.json({ success: false, error: "creatorId is required" }, { status: 400 });
    }

    const success = await subscribe30d(creatorId);

    if (success) {
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
