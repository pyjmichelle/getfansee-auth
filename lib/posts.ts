/**
 * Posts 数据访问层
 * Phase 1: Creator 发帖和 Feed
 */

import { supabase } from "./supabase-client"
import { getCurrentUser } from "./auth"
import { getProfile } from "./profile"

export type PostVisibility = 'free' | 'subscribers' | 'ppv'

export type Post = {
  id: string
  creator_id: string
  title?: string
  content: string
  media_url?: string // 保留向后兼容（单个媒体）
  is_locked: boolean // 保留向后兼容
  visibility: PostVisibility
  price_cents: number | null
  preview_enabled: boolean
  watermark_enabled: boolean
  created_at: string
  creator?: {
    display_name?: string
    avatar_url?: string
  }
  media?: Array<{
    id: string
    media_url: string
    preview_url?: string // 预览 URL（10秒限制，仅视频）
    watermarked_path: string | null
    media_type: 'image' | 'video'
    file_name: string | null
    file_size: number | null
    sort_order: number
    is_locked?: boolean // 单个媒体是否锁定
  }>
}

/**
 * 创建 post（仅 creator 可创建）
 * @param params Post 参数
 * @returns post.id 或 null（失败）
 */
export async function createPost(params: {
  title?: string
  content: string
  media_url?: string // 向后兼容（单个媒体）
  mediaFiles?: Array<{ // Phase 2: 多文件支持
    url: string
    type: 'image' | 'video'
    fileName: string
    fileSize: number
  }>
  visibility: PostVisibility
  price_cents?: number | null
  preview_enabled?: boolean
  watermark_enabled?: boolean
}): Promise<string | null> {
  try {
    // 检查当前用户是否为 creator
    const user = await getCurrentUser()
    if (!user) {
      console.error("[posts] createPost: no user")
      return null
    }

    const profile = await getProfile(user.id)
    if (!profile || profile.role !== "creator") {
      console.error("[posts] createPost: user is not a creator", profile?.role)
      return null
    }

    // 验证参数
    if (params.visibility === 'ppv' && (!params.price_cents || params.price_cents <= 0)) {
      console.error("[posts] createPost: ppv post must have price_cents > 0")
      return null
    }

    // 创建 post
    const { data, error } = await supabase
      .from("posts")
      .insert({
        creator_id: user.id,
        title: params.title || null,
        content: params.content,
        media_url: params.media_url || null, // 向后兼容
        visibility: params.visibility,
        price_cents: params.visibility === 'ppv' ? params.price_cents! : null,
        preview_enabled: params.preview_enabled || false,
        watermark_enabled: params.watermark_enabled !== undefined ? params.watermark_enabled : true, // 默认开启
        is_locked: params.visibility !== 'free', // 向后兼容
      })
      .select("id")
      .single()

    if (error) {
      console.error("[posts] createPost error:", error)
      return null
    }

    const postId = data.id

    // Phase 2: 如果有多个媒体文件，添加到 post_media 表
    if (params.mediaFiles && params.mediaFiles.length > 0) {
      const { addPostMedia } = await import("./post-media")
      await addPostMedia(postId, params.mediaFiles)
    }

    return postId
  } catch (err) {
    console.error("[posts] createPost exception:", err)
    return null
  }
}

/**
 * 获取某个 creator 的 posts
 * @param creatorId Creator ID
 * @returns Post 数组（包含 media）
 */
export async function listCreatorPosts(creatorId: string): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[posts] listCreatorPosts error:", error)
      return []
    }

    const posts = (data || []).map((post) => ({
      id: post.id,
      creator_id: post.creator_id,
      title: post.title,
      content: post.content,
      media_url: post.media_url,
      is_locked: post.is_locked || post.visibility !== 'free',
      visibility: post.visibility || 'free',
      price_cents: post.price_cents || null,
      preview_enabled: post.preview_enabled || false,
      watermark_enabled: post.watermark_enabled !== undefined ? post.watermark_enabled : true,
      created_at: post.created_at,
    }))

    // 加载媒体资源
    const postIds = posts.map(p => p.id)
    if (postIds.length > 0) {
      const { getPostsMedia } = await import("./post-media")
      const mediaMap = await getPostsMedia(postIds)
      posts.forEach(post => {
        post.media = mediaMap.get(post.id)?.map(m => ({
          id: m.id,
          media_url: m.media_url,
          media_type: m.media_type,
          file_name: m.file_name,
          file_size: m.file_size,
          sort_order: m.sort_order,
        }))
      })
    }

    return posts
  } catch (err) {
    console.error("[posts] listCreatorPosts exception:", err)
    return []
  }
}

/**
 * 获取 Feed（最近 N 条 posts，包含 creator 信息）
 * @param limit 限制数量，默认 20
 * @returns Post 数组（包含 creator 信息和 media，带权限检查）
 */
export async function listFeed(limit: number = 20): Promise<Post[]> {
  try {
    const user = await getCurrentUser()
    const userId = user?.id || null

    // 查询 posts 并 join profiles 获取 creator 信息
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
        created_at,
        profiles:creator_id (
          display_name,
          avatar_url
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[posts] listFeed error:", error)
      return []
    }

    // 批量检查权限（订阅和购买状态）
    const { canViewPost, hasActiveSubscription, hasPurchasedPost } = await import("./paywall")
    const postIds = (data || []).map((p: any) => p.id)
    const canViewMap = new Map<string, boolean>()

    if (userId) {
      for (const post of data || []) {
        const postId = post.id
        const creatorId = post.creator_id
        const visibility = post.visibility || 'free'
        const priceCents = post.price_cents || 0

        // Creator 本人永远可见
        if (creatorId === userId) {
          canViewMap.set(postId, true)
          continue
        }

        // 免费内容永远可见
        if (visibility === 'free') {
          canViewMap.set(postId, true)
          continue
        }

        // 订阅者专享：需要活跃订阅
        if (visibility === 'subscribers' || priceCents === 0) {
          const hasSub = await hasActiveSubscription(creatorId)
          canViewMap.set(postId, hasSub)
          continue
        }

        // PPV：需要购买
        if (visibility === 'ppv' && priceCents > 0) {
          const hasPurchased = await hasPurchasedPost(userId, postId)
          canViewMap.set(postId, hasPurchased)
          continue
        }

        canViewMap.set(postId, false)
      }
    } else {
      // 未登录用户：只有免费内容可见
      for (const post of data || []) {
        const visibility = post.visibility || 'free'
        canViewMap.set(post.id, visibility === 'free')
      }
    }

    const posts = (data || []).map((item: any) => {
      const canView = canViewMap.get(item.id) || false
      const post = {
        id: item.id,
        creator_id: item.creator_id,
        title: item.title,
        content: item.content,
        media_url: item.media_url,
        is_locked: !canView && (item.visibility !== 'free'),
        visibility: item.visibility || 'free',
        price_cents: item.price_cents || null,
        preview_enabled: item.preview_enabled || false,
        watermark_enabled: item.watermark_enabled !== undefined ? item.watermark_enabled : true,
        created_at: item.created_at,
        creator: {
          display_name: item.profiles?.display_name,
          avatar_url: item.profiles?.avatar_url,
        },
      }
      
      // 调试：检查头像数据
      if (process.env.NODE_ENV === 'development' && item.profiles) {
        console.log('[posts] Post creator data:', {
          creator_id: item.creator_id,
          display_name: item.profiles.display_name,
          avatar_url: item.profiles.avatar_url,
        })
      }
      
      return post
    })

    // 加载媒体资源并应用权限检查
    if (postIds.length > 0) {
      const { getPostsMedia } = await import("./post-media")
      const mediaMap = await getPostsMedia(postIds)
      posts.forEach(post => {
        const canView = canViewMap.get(post.id) || false
        const mediaList = mediaMap.get(post.id) || []
        
        post.media = mediaList.map(m => {
          const isLocked = !canView && (post.visibility !== 'free')
          
          // 如果未购买且是视频，返回预览 URL（原始 URL，前端控制 10 秒）
          // 如果未购买且是图片，不返回原始 URL（前端显示锁定遮罩）
          return {
            id: m.id,
            media_url: isLocked && m.media_type === 'video' ? m.media_url : (isLocked ? '' : m.media_url), // 图片锁定时不返回 URL
            preview_url: isLocked && m.media_type === 'video' && post.preview_enabled ? m.media_url : undefined, // 视频预览 URL
            watermarked_path: m.watermarked_path,
            media_type: m.media_type,
            file_name: m.file_name,
            file_size: m.file_size,
            sort_order: m.sort_order,
            is_locked: isLocked,
          }
        })
      })
    }

    return posts
  } catch (err) {
    console.error("[posts] listFeed exception:", err)
    return []
  }
}

/**
 * 删除 post（仅 creator 可删除）
 * @param postId Post ID
 * @returns true 成功，false 失败
 */
export async function deletePost(postId: string): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      console.error("[posts] deletePost: no user")
      return false
    }

    // 验证是否为 post 的 creator
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("creator_id")
      .eq("id", postId)
      .single()

    if (postError || !post) {
      console.error("[posts] deletePost: post not found", postError)
      return false
    }

    if (post.creator_id !== user.id) {
      console.error("[posts] deletePost: not authorized")
      return false
    }

    // 删除 post（CASCADE 会自动删除 post_media）
    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)

    if (error) {
      console.error("[posts] deletePost error:", error)
      return false
    }

    return true
  } catch (err) {
    console.error("[posts] deletePost exception:", err)
    return false
  }
}

