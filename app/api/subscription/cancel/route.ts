import { NextRequest, NextResponse } from "next/server";
import { cancelSubscription } from "@/lib/paywall";

type CancelSubscriptionPayload = {
  creatorId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { creatorId } = (await request.json()) as CancelSubscriptionPayload;

    if (!creatorId) {
      return NextResponse.json({ success: false, error: "creatorId is required" }, { status: 400 });
    }

    const success = await cancelSubscription(creatorId);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: "Failed to cancel subscription" },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    console.error("[api] cancel subscription error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
