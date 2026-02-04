/**
 * 共享类型定义
 * 这些类型可以在客户端和服务端安全使用
 */

export type PostVisibility = "free" | "subscribers" | "ppv";

export type Notification = {
  id: string;
  user_id: string;
  type: "like" | "comment" | "subscription" | "payment" | "mention";
  title: string;
  message: string;
  link?: string;
  actionUrl?: string; // 兼容旧字段名
  read: boolean;
  created_at?: string;
  createdAt?: string; // 兼容旧字段名
};

export type Creator = {
  id: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  role?: "fan" | "creator";
  created_at?: string;
};

export type Post = {
  id: string;
  creator_id?: string;
  title?: string | null;
  content: string;
  media_url?: string | null; // 保留向后兼容（单个媒体）
  is_locked?: boolean; // 保留向后兼容
  visibility?: PostVisibility | string;
  price_cents?: number | null;
  preview_enabled?: boolean;
  watermark_enabled?: boolean | null;
  likes_count?: number; // 点赞数
  created_at?: string;
  creator?: {
    display_name?: string;
    avatar_url?: string;
  };
  profiles?:
    | {
        display_name?: string;
        avatar_url?: string;
      }
    | Array<{
        display_name?: string;
        avatar_url?: string;
      }>;
  media?: Array<{
    id: string;
    media_url: string;
    preview_url?: string; // 预览 URL（10秒限制，仅视频）
    watermarked_path: string | null;
    media_type: "image" | "video";
    file_name: string | null;
    file_size: number | null;
    sort_order: number;
    is_locked?: boolean; // 单个媒体是否锁定
  }>;
  isLikedByCurrentUser?: boolean; // 当前用户是否已点赞（前端使用）
};
