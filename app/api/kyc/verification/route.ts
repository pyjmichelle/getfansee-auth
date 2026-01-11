import { NextRequest, NextResponse } from "next/server";
import { getUserVerification } from "@/lib/kyc-server";
import { getCurrentUser } from "@/lib/auth-server";

/**
 * GET /api/kyc/verification
 * 获取当前用户的 KYC 验证状态
 */
export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verification = await getUserVerification(user.id);

    return NextResponse.json({ verification });
  } catch (err: unknown) {
    console.error("[api] kyc verification GET error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
