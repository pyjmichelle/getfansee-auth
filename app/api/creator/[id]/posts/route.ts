import { NextRequest, NextResponse } from "next/server";
import { listCreatorPosts } from "@/lib/posts";
import { batchCheckSubscriptions, batchCheckPurchases } from "@/lib/paywall";
import { getCurrentUser } from "@/lib/auth-server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const creatorId = id;

    const posts = await listCreatorPosts(creatorId);

    const unlockedStates: Record<string, boolean> = {};

    // Creator owns all their own posts
    if (user.id === creatorId) {
      posts.forEach((post) => {
        unlockedStates[post.id] = true;
      });
    } else {
      // Separate free posts from gated posts to avoid unnecessary DB queries
      const gatedPosts = posts.filter((p) => p.visibility !== "free");
      const ppvPostIds = gatedPosts.filter((p) => p.visibility === "ppv").map((p) => p.id);
      const subscriberPostCreatorIds = gatedPosts
        .filter((p) => p.visibility === "subscribers" && p.creator_id !== undefined)
        .map((p) => p.creator_id as string);
      const uniqueCreatorIds = [...new Set(subscriberPostCreatorIds)];

      // 2 queries regardless of post count (eliminates N+1)
      const [subscriptionMap, purchaseMap] = await Promise.all([
        batchCheckSubscriptions(user.id, uniqueCreatorIds),
        batchCheckPurchases(user.id, ppvPostIds),
      ]);

      posts.forEach((post) => {
        if (post.visibility === "free") {
          unlockedStates[post.id] = true;
        } else if (post.visibility === "ppv") {
          unlockedStates[post.id] = purchaseMap.get(post.id) ?? false;
        } else {
          // subscribers-only: check subscription to the post's creator
          unlockedStates[post.id] = post.creator_id
            ? (subscriptionMap.get(post.creator_id) ?? false)
            : false;
        }
      });
    }

    // Strip sensitive fields for locked posts to prevent content leaking
    const safePosts = posts.map((post) =>
      unlockedStates[post.id] ? post : { ...post, content: null, media_url: null }
    );

    return NextResponse.json({
      posts: safePosts,
      unlockedStates,
    });
  } catch (err: unknown) {
    console.error("[api] creator posts error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
