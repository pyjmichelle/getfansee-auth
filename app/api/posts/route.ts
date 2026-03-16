import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { createPost, type PostVisibility } from "@/lib/posts";

type CreatePostPayload = {
  title?: string;
  content: string;
  mediaFiles?: Array<{
    url: string;
    type: "image" | "video";
    fileName: string;
    fileSize: number;
  }>;
  visibility: PostVisibility;
  priceCents?: number;
  previewEnabled?: boolean;
  watermarkEnabled?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    // 路由层显式鉴权，避免仅依赖下层隐式校验
    await requireUser();

    const body = (await request.json()) as CreatePostPayload;
    const { title, content, mediaFiles, visibility, priceCents, previewEnabled, watermarkEnabled } =
      body;

    const result = await createPost({
      title,
      content,
      mediaFiles,
      visibility,
      price_cents: priceCents,
      preview_enabled: previewEnabled,
      watermark_enabled: watermarkEnabled,
    });

    if (result.success) {
      return NextResponse.json({ success: true, postId: result.postId });
    } else {
      console.error("[api/posts] createPost failed:", result.error);
      if (result.details) {
        console.error("[api/posts] Error details:", JSON.stringify(result.details, null, 2));
      }
      // Do not forward internal details (may contain DB role / schema info) to client
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (err: unknown) {
    return jsonError(err);
  }
}
