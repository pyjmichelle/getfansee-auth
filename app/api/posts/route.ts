import { NextRequest, NextResponse } from "next/server";
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
    const body = (await request.json()) as CreatePostPayload;
    const { title, content, mediaFiles, visibility, priceCents, previewEnabled, watermarkEnabled } =
      body;

    const postId = await createPost({
      title,
      content,
      mediaFiles,
      visibility,
      price_cents: priceCents,
      preview_enabled: previewEnabled,
      watermark_enabled: watermarkEnabled,
    });

    if (postId) {
      return NextResponse.json({ success: true, postId });
    } else {
      return NextResponse.json({ success: false, error: "Failed to create post" }, { status: 500 });
    }
  } catch (err: unknown) {
    console.error("[api] create post error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
