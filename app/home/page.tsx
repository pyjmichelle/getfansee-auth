import { redirect } from "next/navigation";
import { cache } from "react";
import { ensureProfile, getCurrentUser } from "@/lib/auth-server";
import { getProfile } from "@/lib/profile-server";
import { listFeed } from "@/lib/posts";
import { type Post } from "@/lib/types";
import { canViewPost } from "@/lib/paywall";
import { HomeFeedClient } from "./components/HomeFeedClient";

// 使用 React.cache() 进行请求去重（server-cache-react 规则）
const getCachedUser = cache(getCurrentUser);
const getCachedProfile = cache(getProfile);
const getCachedFeed = cache(listFeed);

export default async function HomePage() {
  // 1-3. 并行获取用户信息、确保 profile、获取 profile（server-parallel-fetching 规则）
  const [user, _] = await Promise.all([
    getCachedUser(),
    ensureProfile(), // ensureProfile 不需要缓存，因为它可能有副作用
  ]);

  if (!user) {
    redirect("/auth");
  }

  // 3. 获取用户 profile（使用缓存版本）
  const userProfile = await getCachedProfile(user.id);
  if (!userProfile) {
    redirect("/auth");
  }

  // 4. 获取 feed 数据（使用缓存版本）
  let posts: Post[] = [];
  try {
    posts = await getCachedFeed(20);
  } catch (err) {
    console.error("[home] listFeed error", err);
  }

  // 5. 在服务端检查每个 post 的可见性状态（并行执行，避免异步瀑布流）
  const unlockedStates = new Map<string, boolean>();

  // 先处理不需要异步检查的 posts（creator 本人和免费内容）
  const postsToCheck: Array<{ post: Post; index: number }> = [];
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
      currentUserId={user.id}
      userProfile={{
        role: userProfile.role || "fan",
        display_name: userProfile.display_name,
        avatar_url: userProfile.avatar_url || undefined,
      }}
    />
  );
}
