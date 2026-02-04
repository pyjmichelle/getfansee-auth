import { NextRequest, NextResponse } from "next/server";
import { createPost, type PostVisibility } from "@/lib/posts";

const isTestEnv = process.env.E2E === "1" || process.env.PLAYWRIGHT_TEST_MODE === "true";

function isAllowedHost(req: NextRequest): boolean {
  if (process.env.E2E_ALLOW_ANY_HOST === "true") return true;
  const host = req.headers.get("host") ?? "";
  const forwarded = req.headers.get("x-forwarded-host") ?? host;
  const h = (forwarded || host).split(":")[0].toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
}

/**
 * E2E 专用：用稳定媒体 URL 创建 post，不依赖真实上传。
 * 仅 E2E/PLAYWRIGHT_TEST_MODE 且 host 为 localhost/127.0.0.1 时启用，生产不可用。
 */
export async function POST(request: NextRequest) {
  if (!isTestEnv || !isAllowedHost(request)) {
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
