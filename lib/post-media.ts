/**
 * Post Media 数据访问层
 * Phase 2: 多媒体资源管理
 */

import { supabase } from "./supabase-client"

export type PostMedia = {
  id: string
  post_id: string
  media_url: string
  watermarked_path: string | null // 水印版本路径（仅图片，可选）
  media_type: 'image' | 'video'
  file_name: string | null
  file_size: number | null
  sort_order: number
  created_at: string
}

/**
 * 为 post 添加媒体资源
 * @param postId Post ID
 * @param mediaFiles 媒体文件数组
 * @returns 成功添加的数量
 */
export async function addPostMedia(
  postId: string,
  mediaFiles: Array<{
    url: string
    type: 'image' | 'video'
    fileName: string
    fileSize: number
  }>
): Promise<number> {
  try {
    const mediaRecords = mediaFiles.map((file, index) => ({
      post_id: postId,
      media_url: file.url,
      watermarked_path: null, // 水印版本将在需要时生成并更新
      media_type: file.type,
      file_name: file.fileName,
      file_size: file.fileSize,
      sort_order: index,
    }))

    const { data, error } = await supabase
      .from("post_media")
      .insert(mediaRecords)
      .select("id")

    if (error) {
      console.error("[post-media] addPostMedia error:", error)
      return 0
    }

    return data?.length || 0
  } catch (err) {
    console.error("[post-media] addPostMedia exception:", err)
    return 0
  }
}

/**
 * 获取 post 的所有媒体资源
 * @param postId Post ID
 * @returns PostMedia 数组
 */
export async function getPostMedia(postId: string): Promise<PostMedia[]> {
  try {
    const { data, error } = await supabase
      .from("post_media")
      .select("*")
      .eq("post_id", postId)
      .order("sort_order", { ascending: true })

    if (error) {
      console.error("[post-media] getPostMedia error:", error)
      return []
    }

    return (data || []) as PostMedia[]
  } catch (err) {
    console.error("[post-media] getPostMedia exception:", err)
    return []
  }
}

/**
 * 删除 post 的媒体资源
 * @param mediaId Media ID
 * @returns true 成功，false 失败
 */
export async function deletePostMedia(mediaId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("post_media")
      .delete()
      .eq("id", mediaId)

    if (error) {
      console.error("[post-media] deletePostMedia error:", error)
      return false
    }

    return true
  } catch (err) {
    console.error("[post-media] deletePostMedia exception:", err)
    return false
  }
}

/**
 * 批量获取多个 posts 的媒体资源
 * @param postIds Post ID 数组
 * @returns Map<postId, PostMedia[]>
 */
export async function getPostsMedia(postIds: string[]): Promise<Map<string, PostMedia[]>> {
  try {
    if (postIds.length === 0) {
      return new Map()
    }

    const { data, error } = await supabase
      .from("post_media")
      .select("*")
      .in("post_id", postIds)
      .order("post_id, sort_order", { ascending: true })

    if (error) {
      console.error("[post-media] getPostsMedia error:", error)
      return new Map()
    }

    const mediaMap = new Map<string, PostMedia[]>()
    for (const media of data || []) {
      const existing = mediaMap.get(media.post_id) || []
      existing.push(media as PostMedia)
      mediaMap.set(media.post_id, existing)
    }

    return mediaMap
  } catch (err) {
    console.error("[post-media] getPostsMedia exception:", err)
    return new Map()
  }
}

