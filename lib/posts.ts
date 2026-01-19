import "server-only";

/**
 * Posts 数据访问层
 * Phase 1: Creator 发帖和 Feed
 *
 * 注意：此文件包含服务端逻辑，不应被客户端组件直接导入
 * 客户端应通过 API 路由访问数据
 */

import { getSupabaseServerClient } from "./supabase-server";
import { getCurrentUser } from "./auth-server";
import { getProfile } from "./profile-server";
import { isKYCVerified } from "./kyc-service";
import { getVisitorCountry, isCountryBlocked } from "./geo-utils";
import { canViewPost, hasActiveSubscription, hasPurchasedPost } from "./paywall";
import type { Post, PostVisibility } from "./types";

// 重新导出类型供其他模块使用
export type { Post, PostVisibility };

/**
 * 创建 post（仅 creator 可创建）
 * @param params Post 参数
 * @returns post.id 或 null（失败）
 */
export async function createPost(params: {
  title?: string;
  content: string;
  media_url?: string; // 向后兼容（单个媒体）
  mediaFiles?: Array<{
    // Phase 2: 多文件支持
    url: string;
    type: "image" | "video";
    fileName: string;
    fileSize: number;
  }>;
  visibility: PostVisibility;
  price_cents?: number | null;
  preview_enabled?: boolean;
  watermark_enabled?: boolean;
}): Promise<{ success: true; postId: string } | { success: false; error: string; details?: any }> {
  try {
    const supabase = await getSupabaseServerClient();
    // 检查当前用户是否为 creator
    const user = await getCurrentUser();
    if (!user) {
      console.error("[posts] createPost: no user - user not authenticated");
      return { success: false, error: "User not authenticated" };
    }

    console.log("[posts] createPost: user authenticated, userId:", user.id);

    const profile = await getProfile(user.id);
    if (!profile) {
      console.error("[posts] createPost: profile not found for user", user.id);
      return { success: false, error: "Profile not found" };
    }

    if (profile.role !== "creator") {
      console.error("[posts] createPost: user is not a creator", {
        userId: user.id,
        role: profile.role,
      });
      return { success: false, error: "User is not a creator", details: { role: profile.role } };
    }

    console.log("[posts] createPost: user is creator, proceeding");
    console.log("  userId:", user.id);
    console.log("  ageVerified:", profile.age_verified);

    // KYC 拦截：检查 age_verified 状态
    // 如果用户未完成身份验证，禁止发布 PPV 或订阅内容
    if (
      (params.visibility === "ppv" || params.visibility === "subscribers") &&
      !profile.age_verified
    ) {
      console.error(
        "[posts] createPost: KYC not verified, cannot create PPV or subscriber content",
        { userId: user.id, visibility: params.visibility }
      );
      return { success: false, error: "KYC verification required for paid content" };
    }

    // 验证参数
    if (params.visibility === "ppv" && (!params.price_cents || params.price_cents <= 0)) {
      console.error("[posts] createPost: ppv post must have price_cents > 0", {
        priceCents: params.price_cents,
      });
      return { success: false, error: "PPV posts must have a price greater than $0" };
    }

    const insertData = {
      creator_id: user.id,
      title: params.title || null,
      content: params.content,
      media_url: params.media_url || null, // 向后兼容
      visibility: params.visibility,
      price_cents: params.visibility === "ppv" ? params.price_cents! : 0, // 非 PPV 帖子价格为 0
      preview_enabled: params.preview_enabled || false,
      watermark_enabled: params.watermark_enabled !== undefined ? params.watermark_enabled : true, // 默认开启
      is_locked: params.visibility !== "free", // 向后兼容
    };

    console.log("[posts] createPost: inserting post");
    console.log("  Data:", JSON.stringify(insertData, null, 2));

    // 创建 post
    const { data, error } = await supabase.from("posts").insert(insertData).select("id").single();

    if (error) {
      console.error("[posts] createPost error:");
      console.error("  Code:", error.code);
      console.error("  Message:", error.message);
      console.error("  Details:", error.details);
      console.error("  Hint:", error.hint);
      return {
        success: false,
        error: error.message || "Database error",
        details: {
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
      };
    }

    const postId = data.id;

    // Phase 2: 如果有多个媒体文件，添加到 post_media 表
    if (params.mediaFiles && params.mediaFiles.length > 0) {
      const { addPostMedia } = await import("./post-media");
      await addPostMedia(postId, params.mediaFiles);
    }

    return { success: true, postId };
  } catch (err) {
    console.error("[posts] createPost exception:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * 获取某个 creator 的 posts
 * @param creatorId Creator ID
 * @param visitorCountry 访客国家代码（可选，用于地理屏蔽）
 * @returns Post 数组（包含 media），如果被地理屏蔽则返回空数组
 */
export async function listCreatorPosts(
  creatorId: string,
  visitorCountry?: string | null
): Promise<Post[]> {
  try {
    const supabase = await getSupabaseServerClient();
    // 如果没有提供访客国家，尝试从 headers 获取
    if (visitorCountry === undefined) {
      visitorCountry = await getVisitorCountry();
    }

    // 地理屏蔽检查：直接从 profiles 表查询 creator 的 blocked_countries
    // 先检查地理屏蔽，避免不必要的 posts 查询
    if (visitorCountry) {
      // 使用 .single() 而不是 .maybeSingle()，以便在查询失败时得到明确的错误
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("blocked_countries, role")
        .eq("id", creatorId)
        .single();

      // 调试日志
      console.log("[posts] listCreatorPosts geo-blocking check:", {
        creatorId,
        visitorCountry,
        profileData,
        profileError: profileError?.message,
        profileErrorCode: profileError?.code,
        blockedCountries: profileData?.blocked_countries,
        role: profileData?.role,
      });

      if (profileError) {
        // 如果是 "PGRST116" 错误（无法转换为单个 JSON 对象），可能是 RLS 阻止了查询
        if (
          profileError.code === "PGRST116" ||
          profileError.message?.includes("row-level security")
        ) {
          console.warn(
            `[posts] listCreatorPosts: RLS may be blocking query for creator ${creatorId}. Please execute migrations/016_geo_blocking_rls_fix.sql`
          );
        } else {
          console.warn(
            `[posts] listCreatorPosts: Cannot fetch blocked_countries for creator ${creatorId}. Error: ${profileError.message}`
          );
        }
        // 如果无法查询 blocked_countries（可能是 RLS 限制），继续查询 posts
        // 注意：这需要执行 migrations/016_geo_blocking_rls_fix.sql 来修复
      } else if (profileData) {
        const blockedCountries = profileData.blocked_countries;
        if (blockedCountries && Array.isArray(blockedCountries) && blockedCountries.length > 0) {
          const isBlocked = isCountryBlocked(blockedCountries, visitorCountry);
          console.log(
            `[posts] listCreatorPosts: Checking geo-block. blocked_countries: ${JSON.stringify(blockedCountries)}, visitorCountry: ${visitorCountry}, isBlocked: ${isBlocked}`
          );
          if (isBlocked) {
            console.log(
              `[posts] listCreatorPosts: Creator ${creatorId} blocked for country ${visitorCountry}`
            );
            return []; // 被屏蔽，返回空数组
          }
        } else {
          console.log(
            `[posts] listCreatorPosts: No blocked_countries set for creator ${creatorId}, allowing access`
          );
        }
      } else {
        console.warn(
          `[posts] listCreatorPosts: profileData is null for creator ${creatorId}. This may indicate an RLS issue.`
        );
      }
    }

    // 查询 posts（过滤已删除的，不再需要 JOIN profiles，因为我们已经单独查询了）
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("creator_id", creatorId)
      .is("deleted_at", null) // 只查询未删除的帖子
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[posts] listCreatorPosts error:", error);
      return [];
    }

    const posts = (data || []).map((post: any) => ({
      id: post.id,
      creator_id: post.creator_id,
      title: post.title,
      content: post.content,
      media_url: post.media_url,
      is_locked: post.is_locked || post.visibility !== "free",
      visibility: post.visibility || "free",
      price_cents: post.price_cents || null,
      preview_enabled: post.preview_enabled || false,
      watermark_enabled: post.watermark_enabled !== undefined ? post.watermark_enabled : true,
      created_at: post.created_at,
    }));

    // 加载媒体资源
    const postIds = posts.map((p) => p.id);
    if (postIds.length > 0) {
      const { getPostsMedia } = await import("./post-media");
      const mediaMap = await getPostsMedia(postIds);
      posts.forEach((post) => {
        const media = mediaMap.get(post.id)?.map((m) => ({
          id: m.id,
          media_url: m.media_url,
          preview_url: m.preview_url,
          watermarked_path: m.watermarked_path || null,
          media_type: m.media_type,
          file_name: m.file_name,
          file_size: m.file_size,
          sort_order: m.sort_order,
          is_locked: m.is_locked,
        }));
        if (media) {
          (post as any).media = media;
        }
      });
    }

    return posts;
  } catch (err) {
    console.error("[posts] listCreatorPosts exception:", err);
    return [];
  }
}

/**
 * 获取单个 post（用于编辑）
 * @param postId Post ID
 * @returns Post 或 null
 */
export async function getPost(postId: string): Promise<Post | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      console.error("[posts] getPost error:", error);
      return null;
    }

    const post: Post = {
      id: data.id,
      creator_id: data.creator_id,
      title: data.title,
      content: data.content,
      media_url: data.media_url,
      is_locked: data.is_locked || data.visibility !== "free",
      visibility: data.visibility || "free",
      price_cents: data.price_cents || null,
      preview_enabled: data.preview_enabled || false,
      watermark_enabled: data.watermark_enabled !== undefined ? data.watermark_enabled : true,
      created_at: data.created_at,
    };

    // 加载媒体资源
    const { getPostsMedia } = await import("./post-media");
    const mediaMap = await getPostsMedia([postId]);
    const media = mediaMap.get(postId)?.map((m) => ({
      id: m.id,
      media_url: m.media_url,
      preview_url: m.preview_url,
      watermarked_path: m.watermarked_path || null,
      media_type: m.media_type,
      file_name: m.file_name,
      file_size: m.file_size,
      sort_order: m.sort_order,
      is_locked: m.is_locked,
    }));
    if (media) {
      post.media = media;
    }

    return post;
  } catch (err) {
    console.error("[posts] getPost exception:", err);
    return null;
  }
}

/**
 * 获取 Feed（最近 N 条 posts，包含 creator 信息）
 * @param limit 限制数量，默认 20
 * @param visitorCountry 访客国家代码（可选，用于地理屏蔽）
 * @returns Post 数组（包含 creator 信息和 media，带权限检查）
 */
export async function listFeed(
  limit: number = 20,
  offset: number = 0,
  visitorCountry?: string | null
): Promise<Post[]> {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await getCurrentUser();
    const userId = user?.id || null;

    // 如果没有提供访客国家，尝试从 headers 获取
    if (visitorCountry === undefined) {
      visitorCountry = await getVisitorCountry();
    }

    // 查询 posts 并 join profiles 获取 creator 信息（包括 blocked_countries）
    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        id,
        creator_id,
        title,
        content,
        media_url,
        is_locked,
        visibility,
        price_cents,
        preview_enabled,
        watermark_enabled,
        likes_count,
        created_at,
        profiles:creator_id (
          display_name,
          avatar_url,
          blocked_countries
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit * 2); // 获取更多，因为可能被地理屏蔽过滤掉一些

    if (error) {
      console.error("[posts] listFeed error:", error);
      return [];
    }

    // 地理屏蔽过滤：移除被屏蔽国家的 creator 的 posts
    const rawPosts = (data || []) as any[];
    let filteredData = rawPosts.filter((item: any) => {
      if (!visitorCountry) {
        return true; // 无法确定国家，不过滤
      }

      const blockedCountries = item.profiles?.blocked_countries;
      if (!blockedCountries || blockedCountries.length === 0) {
        return true; // 没有屏蔽任何国家
      }

      // 检查访客国家是否被屏蔽
      const isBlocked = isCountryBlocked(blockedCountries, visitorCountry);
      if (isBlocked) {
        console.log(`[posts] listFeed: Post ${item.id} blocked for country ${visitorCountry}`);
        return false; // 被屏蔽，不返回
      }

      return true;
    });

    // 限制返回数量
    filteredData = filteredData.slice(0, limit);

    // 批量检查权限（订阅和购买状态）
    // 注意：这些函数已在文件顶部导入，因为 listFeed 只在服务端使用
    const postIds = filteredData.map((p: any) => p.id);
    const canViewMap = new Map<string, boolean>();

    if (userId) {
      for (const post of filteredData) {
        const postId = post.id;
        const creatorId = post.creator_id;
        const visibility = post.visibility || "free";
        const priceCents = post.price_cents || 0;

        // Creator 本人永远可见
        if (creatorId === userId) {
          canViewMap.set(postId, true);
          continue;
        }

        // 免费内容永远可见
        if (visibility === "free") {
          canViewMap.set(postId, true);
          continue;
        }

        // 订阅者专享：需要活跃订阅
        if (visibility === "subscribers" || priceCents === 0) {
          const hasSub = await hasActiveSubscription(creatorId);
          canViewMap.set(postId, hasSub);
          continue;
        }

        // PPV：需要购买
        if (visibility === "ppv" && priceCents > 0) {
          const hasPurchased = await hasPurchasedPost(userId, postId);
          canViewMap.set(postId, hasPurchased);
          continue;
        }

        canViewMap.set(postId, false);
      }
    } else {
      // 未登录用户：只有免费内容可见
      for (const post of filteredData) {
        const visibility = post.visibility || "free";
        canViewMap.set(post.id, visibility === "free");
      }
    }

    const posts: Post[] = filteredData.map((item: any) => {
      const canView = canViewMap.get(item.id) || false;
      const post: Post = {
        id: item.id,
        creator_id: item.creator_id,
        title: item.title,
        content: item.content,
        media_url: item.media_url,
        is_locked: !canView && item.visibility !== "free",
        visibility: item.visibility || "free",
        price_cents: item.price_cents || null,
        preview_enabled: item.preview_enabled || false,
        watermark_enabled: item.watermark_enabled !== undefined ? item.watermark_enabled : true,
        created_at: item.created_at,
        creator: {
          display_name: item.profiles?.display_name,
          avatar_url: item.profiles?.avatar_url,
        },
      };

      // 调试：检查头像数据
      if (process.env.NODE_ENV === "development" && item.profiles) {
        console.log("[posts] Post creator data:", {
          creator_id: item.creator_id,
          display_name: item.profiles.display_name,
          avatar_url: item.profiles.avatar_url,
        });
      }

      return post;
    });

    // 加载媒体资源并应用权限检查
    if (postIds.length > 0) {
      const { getPostsMedia } = await import("./post-media");
      const mediaMap = await getPostsMedia(postIds);
      posts.forEach((post) => {
        const canView = canViewMap.get(post.id) || false;
        const mediaList = mediaMap.get(post.id) || [];

        (post as Post).media = mediaList.map((m) => {
          const isLocked = !canView && post.visibility !== "free";

          // 如果未购买且是视频，返回预览 URL（原始 URL，前端控制 10 秒）
          // 如果未购买且是图片，不返回原始 URL（前端显示锁定遮罩）
          return {
            id: m.id,
            media_url:
              isLocked && m.media_type === "video" ? m.media_url : isLocked ? "" : m.media_url, // 图片锁定时不返回 URL
            preview_url:
              isLocked && m.media_type === "video" && post.preview_enabled
                ? m.media_url
                : undefined, // 视频预览 URL
            watermarked_path: m.watermarked_path,
            media_type: m.media_type,
            file_name: m.file_name,
            file_size: m.file_size,
            sort_order: m.sort_order,
            is_locked: isLocked,
          };
        });
      });
    }

    return posts;
  } catch (err) {
    console.error("[posts] listFeed exception:", err);
    return [];
  }
}

/**
 * 更新 post（仅 creator 可更新，价格和可见性锁定）
 * @param postId Post ID
 * @param updates 更新字段（title, content, mediaFiles 可更新，price_cents 和 visibility 锁定）
 * @returns true 成功，false 失败
 */
export async function updatePost(
  postId: string,
  updates: {
    title?: string;
    content?: string;
    mediaFiles?: Array<{
      url: string;
      type: "image" | "video";
      fileName: string;
      fileSize: number;
    }>;
  }
): Promise<boolean> {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await getCurrentUser();
    if (!user) {
      console.error("[posts] updatePost: no user");
      return false;
    }

    // 验证是否为 post 的 creator
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("creator_id, visibility, price_cents")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      console.error("[posts] updatePost: post not found", postError);
      return false;
    }

    if (post.creator_id !== user.id) {
      console.error("[posts] updatePost: not authorized");
      return false;
    }

    // 更新 post 基础字段（不包括 price_cents 和 visibility）
    const updateData: any = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.content !== undefined) updateData.content = updates.content;

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase.from("posts").update(updateData).eq("id", postId);

      if (error) {
        console.error("[posts] updatePost error:", error);
        return false;
      }
    }

    // 更新媒体文件（如果提供）
    if (updates.mediaFiles) {
      const { updatePostMedia } = await import("./post-media");
      const success = await updatePostMedia(postId, updates.mediaFiles);
      if (!success) {
        console.error("[posts] updatePost: failed to update media");
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error("[posts] updatePost exception:", err);
    return false;
  }
}

/**
 * 删除 post（软删除，仅 creator 可删除）
 * @param postId Post ID
 * @returns true 成功，false 失败
 */
export async function deletePost(postId: string): Promise<boolean> {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await getCurrentUser();
    if (!user) {
      console.error("[posts] deletePost: no user");
      return false;
    }

    // 验证是否为 post 的 creator
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("creator_id, deleted_at")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      console.error("[posts] deletePost: post not found", postError);
      return false;
    }

    if (post.creator_id !== user.id) {
      console.error("[posts] deletePost: not authorized");
      return false;
    }

    // 软删除：设置 deleted_at（保留购买记录）
    const { error } = await supabase
      .from("posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", postId);

    if (error) {
      console.error("[posts] deletePost error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[posts] deletePost exception:", err);
    return false;
  }
}
