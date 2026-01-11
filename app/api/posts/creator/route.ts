import { NextResponse } from "next/server";
import { listCreatorPosts } from "@/lib/posts";
import { getCurrentUser } from "@/lib/auth-server";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const posts = await listCreatorPosts(user.id);

    return NextResponse.json({ posts });
  } catch (err: unknown) {
    console.error("[api] creator posts error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
