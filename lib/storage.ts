"use client";

/**
 * Storage upload utilities
 * Phase 2: Real content upload and basic content protection
 */

import { getSupabaseBrowserClient } from "./supabase-browser";
import { getCurrentUser } from "./auth";

const supabase = getSupabaseBrowserClient();

export type UploadProgress = {
  loaded: number;
  total: number;
  percentage: number;
};

export type MediaFile = {
  url: string;
  type: "image" | "video";
  fileName: string;
  fileSize: number;
};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"]; // mp4, mov
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB

export function validateFile(file: File): { valid: boolean; error?: string } {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type}. Supported formats: images (jpg, png, webp), videos (mp4, mov)`,
    };
  }

  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0);
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    return {
      valid: false,
      error: `File too large: ${fileSizeMB} MB (max ${maxSizeMB} MB)`,
    };
  }

  return { valid: true };
}

/**
 * Upload a single file to Supabase Storage
 * @param file File to upload
 * @param postId Post ID (for tracking)
 * @param mediaId Media ID (for tracking)
 * @param onProgress Progress callback (optional)
 * @returns MediaFile object
 */
export async function uploadFile(
  file: File,
  postId?: string,
  mediaId?: string,
  _onProgress?: (progress: UploadProgress) => void
): Promise<MediaFile> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Not authenticated. Please sign in to upload files.");
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const mediaType = isImage ? "image" : "video";

    // Path format: creatorId/postId/mediaId/timestamp-uuid.ext
    const now = new Date();
    const timestamp = now.getTime();
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "bin";
    const uuid = crypto.randomUUID();

    const pathParts = [
      user.id,
      postId || "pending",
      mediaId || uuid,
      `${timestamp}-${uuid}.${fileExt}`,
    ];
    const filePath = pathParts.join("/");

    const metadata: Record<string, string> = {
      platform: "getfansee",
      creator_id: user.id,
      uploaded_at: now.toISOString(),
    };

    if (postId) {
      metadata.post_id = postId;
    }
    if (mediaId) {
      metadata.media_id = mediaId;
    }

    const { data: _data, error } = await supabase.storage.from("media").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      metadata: metadata,
    });

    if (error) {
      console.error("[storage] upload error:", error);
      if (error.message?.toLowerCase().includes("bucket not found")) {
        throw new Error(
          "Storage not configured. Please run: pnpm tsx scripts/setup-storage-buckets.ts"
        );
      }
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Signed URL valid for 1 year
    const { data: urlData, error: urlError } = await supabase.storage
      .from("media")
      .createSignedUrl(filePath, 31536000);

    if (urlError || !urlData) {
      console.error("[storage] createSignedUrl error:", urlError);
      throw new Error(`Failed to generate URL: ${urlError?.message}`);
    }

    return {
      url: urlData.signedUrl,
      type: mediaType,
      fileName: file.name,
      fileSize: file.size,
    };
  } catch (err: unknown) {
    console.error("[storage] uploadFile exception:", err);
    throw err;
  }
}

/**
 * Upload multiple files
 * @param files Array of files
 * @param postId Post ID (for tracking)
 * @param onProgress Progress callback (receives current file index and progress)
 * @returns Array of MediaFile
 */
export async function uploadFiles(
  files: File[],
  postId?: string,
  onProgress?: (fileIndex: number, progress: UploadProgress) => void
): Promise<MediaFile[]> {
  const results: MediaFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      // 为每个文件生成唯一的 mediaId
      const mediaId = crypto.randomUUID();
      const result = await uploadFile(file, postId, mediaId, (progress) => {
        onProgress?.(i, progress);
      });
      results.push(result);
    } catch (err: unknown) {
      console.error(`[storage] uploadFiles: file ${i} failed:`, err);
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new Error(`File "${file.name}" upload failed: ${message}`);
    }
  }

  return results;
}

/**
 * Upload avatar to Supabase Storage
 * @param file Avatar image file
 * @param userId User ID
 * @returns Public avatar URL
 */
export async function uploadAvatar(
  file: File,
  userId: string,
  _onProgress?: (progress: UploadProgress) => void
): Promise<string> {
  try {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}. Supported formats: jpg, png, webp`);
    }

    if (file.size > MAX_IMAGE_SIZE) {
      const maxSizeMB = (MAX_IMAGE_SIZE / 1024 / 1024).toFixed(0);
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      throw new Error(`File too large: ${fileSizeMB} MB (max ${maxSizeMB} MB)`);
    }

    // Path: userId/timestamp-uuid.ext
    const now = new Date();
    const timestamp = now.getTime();
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const uuid = crypto.randomUUID();
    const filePath = `${userId}/${timestamp}-${uuid}.${fileExt}`;

    const { data: _data, error } = await supabase.storage.from("avatars").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      console.error("[storage] uploadAvatar error:", error);
      if (error.message?.toLowerCase().includes("bucket not found")) {
        throw new Error(
          "Storage not configured. Please run: pnpm tsx scripts/setup-storage-buckets.ts"
        );
      }
      throw new Error(`Upload failed: ${error.message}`);
    }

    // 获取公共 URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    return publicUrl;
  } catch (err: unknown) {
    console.error("[storage] uploadAvatar exception:", err);
    throw err;
  }
}

/**
 * Delete a file from storage
 * @param filePath File path relative to bucket
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error("[storage] deleteFile: no user");
      return false;
    }

    if (!filePath.startsWith(`${user.id}/`)) {
      console.error("[storage] deleteFile: permission denied");
      return false;
    }

    const { error } = await supabase.storage.from("media").remove([filePath]);

    if (error) {
      console.error("[storage] deleteFile error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[storage] deleteFile exception:", err);
    return false;
  }
}

/**
 * Extract file path from a signed URL (used for deletion)
 * @param signedUrl Supabase signed URL
 * @returns File path or null
 */
export function extractFilePathFromUrl(signedUrl: string): string | null {
  try {
    const url = new URL(signedUrl);
    // Supabase signed URL 格式: https://<project>.supabase.co/storage/v1/object/sign/media/path?token=...
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/sign\/media\/(.+)/);
    if (pathMatch) {
      return decodeURIComponent(pathMatch[1]);
    }
    return null;
  } catch {
    return null;
  }
}
