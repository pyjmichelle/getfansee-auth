/**
 * Storage 上传工具函数
 * Phase 2: 真实内容上传与基础内容保护
 */

import { supabase } from "./supabase-client"
import { getCurrentUser } from "./auth"

export type UploadProgress = {
  loaded: number
  total: number
  percentage: number
}

export type MediaFile = {
  url: string
  type: 'image' | 'video'
  fileName: string
  fileSize: number
}

// 允许的文件类型
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'] // mp4, mov
const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024 // 2GB

/**
 * 验证文件类型和大小
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // 验证文件类型
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type)
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type)
  
  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: `不支持的文件类型: ${file.type}。支持格式：图片 (jpg, png, webp)，视频 (mp4, mov)`
    }
  }

  // 验证文件大小
  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0)
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2)
    return {
      valid: false,
      error: `文件大小超过限制：${fileSizeMB}MB（最大 ${maxSizeMB}MB）`
    }
  }

  return { valid: true }
}

/**
 * 上传单个文件到 Supabase Storage
 * @param file 要上传的文件
 * @param postId Post ID（用于追踪）
 * @param mediaId Media ID（用于追踪）
 * @param onProgress 进度回调（可选）
 * @returns MediaFile 对象（包含追踪路径）
 */
export async function uploadFile(
  file: File,
  postId?: string,
  mediaId?: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<MediaFile> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("用户未登录")
    }

    // 验证文件
    const validation = validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type)
    const mediaType = isImage ? 'image' : 'video'

    // 生成文件路径: creatorId/postId/mediaId/timestamp-uuid.ext
    // 包含追踪标识符：creatorId, postId, mediaId, timestamp
    const now = new Date()
    const timestamp = now.getTime()
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "bin"
    const uuid = crypto.randomUUID()
    
    // 路径格式：creatorId/postId/mediaId/timestamp-uuid.ext
    // 如果 postId 或 mediaId 未提供，使用占位符
    const pathParts = [
      user.id, // creatorId (always present)
      postId || 'pending', // postId
      mediaId || uuid, // mediaId (use uuid if not provided)
      `${timestamp}-${uuid}.${fileExt}` // timestamp-uuid.ext
    ]
    const filePath = pathParts.join('/')

    // 上传文件（包含元数据用于追踪）
    const metadata: Record<string, string> = {
      platform: 'getfansee',
      creator_id: user.id,
      uploaded_at: now.toISOString(),
    }
    
    if (postId) {
      metadata.post_id = postId
    }
    if (mediaId) {
      metadata.media_id = mediaId
    }

    const { data, error } = await supabase.storage
      .from("media")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        metadata: metadata,
      })

    if (error) {
      console.error("[storage] upload error:", error)
      throw new Error(`上传失败: ${error.message}`)
    }

    // 获取 signed URL（有效期 1 年）
    const { data: urlData, error: urlError } = await supabase.storage
      .from("media")
      .createSignedUrl(filePath, 31536000) // 1 year

    if (urlError || !urlData) {
      console.error("[storage] createSignedUrl error:", urlError)
      throw new Error(`生成 URL 失败: ${urlError?.message}`)
    }

    return {
      url: urlData.signedUrl,
      type: mediaType,
      fileName: file.name,
      fileSize: file.size,
    }
  } catch (err: any) {
    console.error("[storage] uploadFile exception:", err)
    throw err
  }
}

/**
 * 批量上传文件
 * @param files 文件数组
 * @param postId Post ID（用于追踪）
 * @param onProgress 进度回调（可选，接收当前文件索引和进度）
 * @returns MediaFile 数组
 */
export async function uploadFiles(
  files: File[],
  postId?: string,
  onProgress?: (fileIndex: number, progress: UploadProgress) => void
): Promise<MediaFile[]> {
  const results: MediaFile[] = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      // 为每个文件生成唯一的 mediaId
      const mediaId = crypto.randomUUID()
      const result = await uploadFile(file, postId, mediaId, (progress) => {
        onProgress?.(i, progress)
      })
      results.push(result)
    } catch (err: any) {
      console.error(`[storage] uploadFiles: file ${i} failed:`, err)
      throw new Error(`文件 "${file.name}" 上传失败: ${err.message}`)
    }
  }
  
  return results
}

/**
 * 删除文件
 * @param filePath 文件路径（相对于 bucket）
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      console.error("[storage] deleteFile: no user")
      return false
    }

    // 验证文件路径属于当前用户
    if (!filePath.startsWith(`${user.id}/`)) {
      console.error("[storage] deleteFile: 无权删除此文件")
      return false
    }

    const { error } = await supabase.storage.from("media").remove([filePath])

    if (error) {
      console.error("[storage] deleteFile error:", error)
      return false
    }

    return true
  } catch (err) {
    console.error("[storage] deleteFile exception:", err)
    return false
  }
}

/**
 * 从 signed URL 中提取文件路径（用于删除）
 * @param signedUrl signed URL
 * @returns 文件路径或 null
 */
export function extractFilePathFromUrl(signedUrl: string): string | null {
  try {
    const url = new URL(signedUrl)
    // Supabase signed URL 格式: https://<project>.supabase.co/storage/v1/object/sign/media/path?token=...
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/sign\/media\/(.+)/)
    if (pathMatch) {
      return decodeURIComponent(pathMatch[1])
    }
    return null
  } catch {
    return null
  }
}
