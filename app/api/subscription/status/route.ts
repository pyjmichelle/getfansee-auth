import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { hasActiveSubscription } from "@/lib/paywall";
import { jsonError } from "@/lib/http-errors";

export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");

    if (!creatorId) {
      return NextResponse.json({ error: "creatorId is required" }, { status: 400 });
    }

    const isSubscribed = await hasActiveSubscription(creatorId);

    return NextResponse.json({ isSubscribed });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
