import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";

export const metadata: Metadata = {
  title: "Home — GetFanSee",
  description: "Discover exclusive content from your favorite creators on GetFanSee.",
  robots: { index: false, follow: false },
};
import { ensureProfile, getCurrentUser } from "@/lib/auth-server";
import { getProfile } from "@/lib/profile-server";
import { listFeed } from "@/lib/posts";
import { type Post } from "@/lib/types";
import { canViewPost } from "@/lib/paywall";
import { HomeFeedClient } from "./components/HomeFeedClient";
import { MOCK_POSTS, MOCK_CREATORS } from "@/lib/mock-data";

// 使用 React.cache() 进行请求去重（server-cache-react 规则）
const getCachedUser = cache(getCurrentUser);
const getCachedProfile = cache(getProfile);
const getCachedFeed = cache(listFeed);

export default async function HomePage() {
  const user = await getCachedUser();

  if (!user) {
    redirect("/auth");
  }

  // 使用已解析的 user，避免 ensureProfile 内部重复 getCurrentUser 请求。
  await ensureProfile(user);

  // 3. 获取用户 profile（使用缓存版本）
  const userProfile = await getCachedProfile(user.id);
  if (!userProfile) {
    redirect("/auth");
  }

  // 4. 获取 feed 数据（使用缓存版本）
  // Always call listFeed in E2E mode so test-created posts appear in the feed.
  // The old guard (skip listFeed when isTestMode) caused E2E tests to see mock posts
  // instead of real posts they just created.
  let posts: Post[] = [];
  const isE2EMode =
    process.env.E2E === "1" ||
    process.env.PLAYWRIGHT_TEST_MODE === "true" ||
    process.env.NEXT_PUBLIC_TEST_MODE === "true";
  try {
    posts = await getCachedFeed(20);
  } catch (err) {
    console.error("[home] listFeed error", err);
  }

  // Use mock posts as fallback only when:
  // 1. The database returned no posts, AND
  // 2. We are NOT in an E2E test run (to avoid hiding freshly created test posts)
  const usingMockPosts = !isE2EMode && posts.length === 0;
  if (usingMockPosts) {
    const creatorMap = new Map(MOCK_CREATORS.map((c) => [c.id, c]));
    posts = MOCK_POSTS.map((mp) => ({
      id: mp.id,
      creator_id: mp.creator_id,
      title: mp.title,
      content: mp.content,
      media_url: mp.media_url,
      visibility: mp.visibility,
      price_cents: mp.price_cents,
      is_locked: mp.visibility !== "free",
      likes_count: mp.likes_count,
      created_at: mp.created_at,
      preview_enabled: true,
      creator: {
        display_name: creatorMap.get(mp.creator_id)?.display_name,
        avatar_url: creatorMap.get(mp.creator_id)?.avatar_url,
      },
    })) as Post[];
  }

  // 5. 在服务端检查每个 post 的可见性状态（并行执行，避免异步瀑布流）
  const unlockedStates = new Map<string, boolean>();

  // Mock 帖子直接预设解锁状态（ID 非真实 DB ID，跳过 canViewPost 查询）
  if (usingMockPosts) {
    posts.forEach((post) => {
      unlockedStates.set(post.id, post.visibility === "free");
    });
  }

  // 先处理不需要异步检查的 posts（creator 本人和免费内容）
  const postsToCheck: Array<{ post: Post; index: number }> = [];
  if (!usingMockPosts) {
    posts.forEach((post, index) => {
      // Creator 本人永远可见
      if (post.creator_id === user.id) {
        unlockedStates.set(post.id, true);
      } else if (post.visibility === "free") {
        // 免费内容永远可见
        unlockedStates.set(post.id, true);
      } else {
        // 需要异步检查的 posts
        postsToCheck.push({ post, index });
      }
    });
  }

  // 并行执行所有 canViewPost 检查（使用 Promise.all 避免瀑布流）
  if (postsToCheck.length > 0) {
    const checkPromises = postsToCheck.map(async ({ post }) => {
      try {
        const canView = await canViewPost(post.id, post.creator_id);
        return { postId: post.id, canView };
      } catch (err) {
        console.error("[home] canViewPost error", err);
        return { postId: post.id, canView: false };
      }
    });

    const results = await Promise.all(checkPromises);
    results.forEach(({ postId, canView }) => {
      unlockedStates.set(postId, canView);
    });
  }

  // 6. 传递数据给 Client Component
  return (
    <HomeFeedClient
      initialPosts={posts}
      initialUnlockedStates={unlockedStates}
      currentUser={{
        id: user.id,
        email: user.email || "",
        role: userProfile.role || "fan",
        user_metadata: {
          avatar_url: userProfile.avatar_url || undefined,
        },
        username: userProfile.display_name,
      }}
    />
  );
}
