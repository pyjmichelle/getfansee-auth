"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadFile, type UploadProgress } from "@/lib/storage";

export type MediaUploadProps = {
  onUploadComplete: (url: string) => void;
  onUploadError?: (error: string) => void;
  accept?: string;
  maxSize?: number; // in bytes
  className?: string;
};

export function MediaUpload({
  onUploadComplete,
  onUploadError,
  accept = "image/*,video/*",
  maxSize,
  className = "",
}: MediaUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // 验证文件类型
      if (!file.type.match(/^(image|video)\//)) {
        onUploadError?.("Only image and video files are supported");
        return;
      }

      // 验证文件大小
      if (maxSize && file.size > maxSize) {
        onUploadError?.(`File size exceeds limit: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        return;
      }

      // 创建预览
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      try {
        setIsUploading(true);
        setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });

        // 上传文件（注意：Supabase Storage 不支持实时进度，这里模拟进度）
        // 模拟上传进度（实际进度需要等待上传完成）
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (!prev) return { loaded: 0, total: file.size, percentage: 0 };
            const newPercentage = Math.min(prev.percentage + 10, 90);
            return {
              loaded: (file.size * newPercentage) / 100,
              total: file.size,
              percentage: newPercentage,
            };
          });
        }, 200);

        const mediaFile = await uploadFile(file);

        clearInterval(progressInterval);

        setUploadedUrl(mediaFile.url);
        onUploadComplete(mediaFile.url);
        setUploadProgress(null);
      } catch (err: unknown) {
        console.error("[MediaUpload] upload error:", err);
        const message = err instanceof Error ? err.message : "Upload failed";
        onUploadError?.(message);
        setPreviewUrl(null);
        setUploadProgress(null);
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadComplete, onUploadError, maxSize]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setUploadedUrl(null);
    setUploadProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isImage = previewUrl && previewUrl.startsWith("blob:") && !uploadedUrl;

  return (
    <div className={className}>
      {!previewUrl && !uploadedUrl ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors
            ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
            ${isUploading ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50"}
          `}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <>
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground mb-2">Uploading…</p>
              {uploadProgress && (
                <div className="w-full max-w-xs mx-auto">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-[width] duration-300 motion-safe:transition-[width] motion-reduce:transition-none"
                      style={{ width: `${uploadProgress.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {uploadProgress.percentage.toFixed(0)}%
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Click or drag files here to upload</p>
              <p className="text-xs text-muted-foreground">
                Supports images and videos (images max 10MB, videos max 200MB)
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="relative">
          {uploadedUrl ? (
            <div className="relative rounded-lg overflow-hidden border border-border">
              {uploadedUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img
                  src={uploadedUrl}
                  alt="Uploaded media"
                  className="w-full h-auto max-h-96 object-contain"
                />
              ) : (
                <video src={uploadedUrl} controls className="w-full h-auto max-h-96" />
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleRemove}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-border">
              {isImage ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-auto max-h-96 object-contain"
                />
              ) : (
                <video src={previewUrl || undefined} controls className="w-full h-auto max-h-96" />
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center text-white">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    <p className="text-sm">Uploading…</p>
                    {uploadProgress && (
                      <p className="text-xs mt-1">{uploadProgress.percentage.toFixed(0)}%</p>
                    )}
                  </div>
                </div>
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleRemove}
                disabled={isUploading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
