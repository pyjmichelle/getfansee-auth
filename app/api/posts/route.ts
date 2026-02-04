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
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          details: result.details,
        },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    console.error("[api/posts] Exception in POST:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
