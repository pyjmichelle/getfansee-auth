/**
 * 评论系统服务层
 * 处理帖子评论的 CRUD 操作
 */

import { createClient } from "@supabase/supabase-js";
import { resolveSubscriptionUserColumn } from "./subscriptions";

// 使用 Service Role Key 进行特权操作
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: {
    display_name: string;
    avatar_url?: string;
  };
}

/**
 * 获取帖子的评论列表
 * @param postId 帖子 ID
 * @param limit 返回数量限制
 * @param offset 偏移量（用于分页）
 */
export async function getPostComments(
  postId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ comments: Comment[]; total: number }> {
  const supabase = getSupabaseAdmin();

  try {
    // 获取评论列表，包含用户信息
    const {
      data: comments,
      error,
      count,
    } = await supabase
      .from("post_comments")
      .select(
        `
        id,
        post_id,
        user_id,
        content,
        created_at,
        profiles:user_id (
          display_name,
          avatar_url
        )
      `,
        { count: "exact" }
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[getPostComments] Error:", error);
      throw new Error(`Failed to fetch comments: ${error.message}`);
    }

    // 转换数据格式
    interface CommentData {
      id: string;
      post_id: string;
      user_id: string;
      content: string;
      created_at: string;
      profiles?:
        | {
            display_name?: string;
            avatar_url?: string;
          }
        | Array<{
            display_name?: string;
            avatar_url?: string;
          }>
        | null;
    }
    const formattedComments: Comment[] = (comments || []).map((comment: CommentData) => {
      const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
      return {
        id: comment.id,
        post_id: comment.post_id,
        user_id: comment.user_id,
        content: comment.content,
        created_at: comment.created_at,
        user: {
          display_name: profile?.display_name || "Anonymous",
          avatar_url: profile?.avatar_url,
        },
      };
    });

    return {
      comments: formattedComments,
      total: count || 0,
    };
  } catch (err) {
    console.error("[getPostComments] Exception:", err);
    throw err;
  }
}

/**
 * 创建评论
 * @param postId 帖子 ID
 * @param userId 用户 ID
 * @param content 评论内容
 */
export async function createComment(
  postId: string,
  userId: string,
  content: string
): Promise<Comment> {
  const supabase = getSupabaseAdmin();

  try {
    // 验证帖子是否存在
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, creator_id")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      throw new Error("Post not found");
    }

    // 验证用户权限（是否可以评论）
    const canComment = await checkCommentPermission(postId, userId, post.creator_id);

    if (!canComment) {
      throw new Error("You must be subscribed or have purchased this content to comment");
    }

    // 创建评论
    const { data: comment, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: postId,
        user_id: userId,
        content: content.trim(),
      })
      .select(
        `
        id,
        post_id,
        user_id,
        content,
        created_at,
        profiles:user_id (
          display_name,
          avatar_url
        )
      `
      )
      .single();

    if (error) {
      console.error("[createComment] Error:", error);
      throw new Error(`Failed to create comment: ${error.message}`);
    }

    const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
    return {
      id: comment.id,
      post_id: comment.post_id,
      user_id: comment.user_id,
      content: comment.content,
      created_at: comment.created_at,
      user: {
        display_name: profile?.display_name || "Anonymous",
        avatar_url: profile?.avatar_url,
      },
    };
  } catch (err) {
    console.error("[createComment] Exception:", err);
    throw err;
  }
}

/**
 * 删除评论
 * @param commentId 评论 ID
 * @param userId 用户 ID（用于权限验证）
 */
export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  try {
    // 验证评论是否属于该用户
    const { data: comment, error: fetchError } = await supabase
      .from("post_comments")
      .select("user_id")
      .eq("id", commentId)
      .single();

    if (fetchError || !comment) {
      throw new Error("Comment not found");
    }

    if (comment.user_id !== userId) {
      throw new Error("You can only delete your own comments");
    }

    // 删除评论
    const { error } = await supabase.from("post_comments").delete().eq("id", commentId);

    if (error) {
      console.error("[deleteComment] Error:", error);
      throw new Error(`Failed to delete comment: ${error.message}`);
    }
  } catch (err) {
    console.error("[deleteComment] Exception:", err);
    throw err;
  }
}

/**
 * 检查用户是否有权限评论
 * @param postId 帖子 ID
 * @param userId 用户 ID
 * @param creatorId 创作者 ID
 */
async function checkCommentPermission(
  postId: string,
  userId: string,
  creatorId: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  // 1. 如果是 Creator 自己，可以评论
  if (userId === creatorId) {
    return true;
  }

  // 2. 检查是否已订阅该 Creator
  const subscriptionUserColumn = await resolveSubscriptionUserColumn(supabase);
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq(subscriptionUserColumn, userId)
    .eq("creator_id", creatorId)
    .eq("status", "active")
    .single();

  if (subscription) {
    return true;
  }

  // 3. 检查是否已购买该帖子
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id")
    .eq("fan_id", userId)
    .eq("post_id", postId)
    .single();

  if (purchase) {
    return true;
  }

  return false;
}

/**
 * 获取帖子的评论数量
 * @param postId 帖子 ID
 */
export async function getCommentCount(postId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  try {
    const { count, error } = await supabase
      .from("post_comments")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);

    if (error) {
      console.error("[getCommentCount] Error:", error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error("[getCommentCount] Exception:", err);
    return 0;
  }
}
