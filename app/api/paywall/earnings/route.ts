import { NextResponse } from "next/server";
import { getCreatorEarnings } from "@/lib/paywall";
import { getCurrentUser } from "@/lib/auth-server";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const earnings = await getCreatorEarnings(user.id);

    return NextResponse.json(earnings);
  } catch (err: unknown) {
    console.error("[api] paywall earnings error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
