import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { cancelSubscription } from "@/lib/paywall";

type CancelSubscriptionPayload = {
  creatorId?: string;
};

export async function POST(request: NextRequest) {
  try {
    // 路由层显式鉴权，统一 401/403 语义
    await requireUser();

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
    return jsonError(err);
  }
}
