import { NextRequest, NextResponse } from "next/server";
import { createPost, type PostVisibility } from "@/lib/posts";
import { canAccessTestRoute } from "@/lib/test-route-guard";

/**
 * E2E 专用：用稳定媒体 URL 创建 post，不依赖真实上传。
 * 仅 E2E/PLAYWRIGHT_TEST_MODE 且 host 为 localhost/127.0.0.1 时启用，生产不可用。
 */
export async function POST(request: NextRequest) {
  if (!canAccessTestRoute(request)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  let body: { content?: string; visibility?: PostVisibility; mediaUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { content, visibility, mediaUrl } = body;
  if (!content || !visibility) {
    return NextResponse.json({ error: "content and visibility are required" }, { status: 400 });
  }

  const mediaUrlToUse =
    mediaUrl ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000"}/artist-creator-avatar.jpg`;

  const result = await createPost({
    content,
    visibility: visibility as PostVisibility,
    mediaFiles: [{ url: mediaUrlToUse, type: "image", fileName: "e2e-fixture.jpg", fileSize: 0 }],
  });

  if (result.success) {
    return NextResponse.json({ success: true, postId: result.postId });
  }
  return NextResponse.json({ success: false, error: result.error }, { status: 500 });
}
