import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { unlockPost } from "@/lib/paywall";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendPPVConfirmation } from "@/lib/email";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";

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

    if (result.success) {
      // Send PPV receipt email (non-blocking)
      try {
        const admin = getSupabaseAdminClient();
        const [profileRes, postRes] = await Promise.all([
          admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
          admin
            .from("posts")
            .select("title, creator_id, price_cents, profiles:creator_id(display_name)")
            .eq("id", postId)
            .maybeSingle(),
        ]);

        const fanName = profileRes.data?.display_name || user.email.split("@")[0];
        const post = postRes.data as {
          title: string | null;
          creator_id: string;
          price_cents: number;
          profiles: { display_name: string | null } | null;
        } | null;
        const creatorName = post?.profiles?.display_name || "Creator";
        const contentTitle = post?.title || "Premium Content";
        const resolvedPrice = priceCents ?? post?.price_cents ?? 0;

        await sendPPVConfirmation({
          toEmail: user.email,
          toName: fanName,
          creatorName,
          contentTitle,
          amountCents: resolvedPrice,
          contentUrl: `${SITE_URL}/posts/${postId}`,
          transactionDate: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        });
      } catch (emailErr) {
        console.error("[api/unlock] email send error (non-fatal):", emailErr);
      }
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    // HttpError（如 401/403）由 jsonError 规范输出
    return jsonError(err);
  }
}
