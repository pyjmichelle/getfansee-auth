import { redirect } from "next/navigation";
import { ensureProfile, getCurrentUser } from "@/lib/auth-server";
import { getProfile } from "@/lib/profile-server";
import { listFeed } from "@/lib/posts";
import { type Post } from "@/lib/types";
import { canViewPost } from "@/lib/paywall";
import { HomeFeedClient } from "./components/HomeFeedClient";

export default async function HomePage() {
  // 1. 检查认证和获取用户信息
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }

  // 2. 确保 profile 存在
  await ensureProfile();

  // 3. 获取用户 profile
  const userProfile = await getProfile(user.id);
  if (!userProfile) {
    redirect("/auth");
  }

  // 4. 获取 feed 数据
  let posts: Post[] = [];
  try {
    posts = await listFeed(20);
  } catch (err) {
    console.error("[home] listFeed error", err);
  }

  // 5. 在服务端检查每个 post 的可见性状态
  const unlockedStates = new Map<string, boolean>();
  for (const post of posts) {
    // Creator 本人永远可见
    if (post.creator_id === user.id) {
      unlockedStates.set(post.id, true);
    } else if (post.visibility === "free") {
      // 免费内容永远可见
      unlockedStates.set(post.id, true);
    } else {
      // 调用服务端函数检查解锁状态
      try {
        const canView = await canViewPost(post.id, post.creator_id);
        unlockedStates.set(post.id, canView);
      } catch (err) {
        console.error("[home] canViewPost error", err);
        unlockedStates.set(post.id, false);
      }
    }
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
