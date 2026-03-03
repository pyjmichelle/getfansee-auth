import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { unlockPost } from "@/lib/paywall";

type UnlockPayload = {
  postId?: string;
  priceCents?: number;
};

export async function POST(request: NextRequest) {
  try {
    // 路由层显式鉴权：未登录直接 401，不依赖下层隐式判断
    const { user } = await requireUser();

    const { postId, priceCents } = (await request.json()) as UnlockPayload;

    if (!postId) {
      return NextResponse.json({ success: false, error: "postId is required" }, { status: 400 });
    }

    const idempotencyKey = request.headers.get("Idempotency-Key") ?? randomUUID();
    // 将已验证的 userId 显式传入，避免下层重复获取 session 的竞态
    const result = await unlockPost(postId, priceCents, idempotencyKey, user.id);

    return NextResponse.json(result);
  } catch (err: unknown) {
    // HttpError（如 401/403）由 jsonError 规范输出
    return jsonError(err);
  }
}
