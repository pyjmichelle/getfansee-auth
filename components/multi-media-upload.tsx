"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Video, Loader2 } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { uploadFiles, validateFile, type MediaFile } from "@/lib/storage";

export type MultiMediaUploadProps = {
  onUploadComplete: (files: MediaFile[]) => void;
  onUploadError?: (error: string) => void;
  onUploadStateChange?: (isUploading: boolean) => void;
  maxFiles?: number;
  className?: string;
};

export function MultiMediaUpload({
  onUploadComplete,
  onUploadError,
  onUploadStateChange,
  maxFiles = 10,
  className = "",
}: MultiMediaUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<
    Map<number, { loaded: number; total: number; percentage: number }>
  >(new Map());
  const [uploadedFiles, setUploadedFiles] = useState<MediaFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // 验证文件数量
      if (uploadedFiles.length + fileArray.length > maxFiles) {
        onUploadError?.(`Maximum ${maxFiles} files allowed`);
        return;
      }

      // 验证每个文件
      for (const file of fileArray) {
        const validation = validateFile(file);
        if (!validation.valid) {
          onUploadError?.(validation.error || "File validation failed");
          return;
        }
      }

      try {
        setIsUploading(true);
        onUploadStateChange?.(true);

        // 初始化进度
        const progressMap = new Map<
          number,
          { loaded: number; total: number; percentage: number }
        >();
        fileArray.forEach((_, index) => {
          progressMap.set(index, { loaded: 0, total: fileArray[index].size, percentage: 0 });
        });
        setUploadProgress(progressMap);

        // 模拟进度更新
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            const newMap = new Map(prev);
            prev.forEach((progress, index) => {
              if (progress.percentage < 90) {
                newMap.set(index, {
                  ...progress,
                  percentage: Math.min(progress.percentage + 5, 90),
                  loaded: (progress.total * Math.min(progress.percentage + 5, 90)) / 100,
                });
              }
            });
            return newMap;
          });
        }, 200);

        // 上传文件
        const results = await uploadFiles(
          fileArray,
          undefined, // postId (可选)
          (fileIndex: number, progress: { loaded: number; total: number; percentage: number }) => {
            setUploadProgress((prev) => {
              const newMap = new Map(prev);
              newMap.set(fileIndex, progress);
              return newMap;
            });
          }
        );

        clearInterval(progressInterval);

        // 更新已上传文件列表
        const newFiles = [...uploadedFiles, ...results];
        setUploadedFiles(newFiles);
        onUploadComplete(newFiles);
        setUploadProgress(new Map());
      } catch (err: unknown) {
        console.error("[MultiMediaUpload] upload error:", err);
        const message = err instanceof Error ? err.message : "Upload failed";
        onUploadError?.(message);
        setUploadProgress(new Map());
      } finally {
        setIsUploading(false);
        onUploadStateChange?.(false);
      }
    },
    [uploadedFiles, maxFiles, onUploadComplete, onUploadError, onUploadStateChange]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // 重置 input，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleRemove = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onUploadComplete(newFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  return (
    <div className={className}>
      {uploadedFiles.length === 0 && !isUploading ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-xl p-8 md:p-12 text-center cursor-pointer
            transition-all focus-visible:outline-2 focus-visible:outline-brand-primary
            ${isDragging ? "border-brand-primary bg-brand-primary/5" : "border-border-base"}
            hover:border-brand-primary/50 active:border-brand-primary
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/quicktime"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
            data-testid="file-input"
          />

          <Upload className="w-12 h-12 mx-auto mb-4 text-text-tertiary" aria-hidden="true" />
          <p className="text-sm font-medium mb-1 text-text-primary">
            Click or drag files here to upload
          </p>
          <p className="text-xs text-text-tertiary">
            Supports images (jpg, png, webp) and videos (mp4, mov)
          </p>
          <p className="text-xs text-text-tertiary mt-1">
            Images max 20MB, videos max 2GB, up to {maxFiles} files
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 上传区域（如果还有空间） */}
          {uploadedFiles.length < maxFiles && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-xl p-4 text-center cursor-pointer
                transition-all focus-visible:outline-2 focus-visible:outline-brand-primary
                ${isDragging ? "border-brand-primary bg-brand-primary/5" : "border-border-base"}
                ${isUploading ? "opacity-50 cursor-not-allowed" : "hover:border-brand-primary/50 active:border-brand-primary"}
              `}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/quicktime"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />

              {isUploading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-primary" aria-hidden="true" />
                  <span className="text-sm text-text-tertiary">Uploading...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
                  <span className="text-sm text-text-tertiary">Add more files</span>
                </div>
              )}
            </div>
          )}

          {/* Uploaded files list */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4" data-testid="upload-preview">
            {uploadedFiles.map((file, index) => {
              const progress = uploadProgress.get(index);
              const isUploadingFile = progress && progress.percentage < 100;

              return (
                <div key={index} className="relative group">
                  <div className="relative rounded-xl overflow-hidden border border-border-base bg-surface-base">
                    {file.type === "image" ? (
                      <img
                        src={file.url}
                        alt={file.fileName}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 bg-surface-raised flex items-center justify-center">
                        <Video className="w-8 h-8 text-text-tertiary" aria-hidden="true" />
                      </div>
                    )}

                    {isUploadingFile && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                        <Loader2
                          className="w-6 h-6 mb-2 animate-spin text-white"
                          aria-hidden="true"
                        />
                        <p className="text-xs text-white mb-2">
                          {progress?.percentage.toFixed(0)}%
                        </p>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-base">
                          <div
                            className="h-full bg-brand-primary transition-[width] duration-300"
                            style={{ width: `${progress?.percentage || 0}%` }}
                            role="progressbar"
                            aria-valuenow={Math.round(progress?.percentage || 0)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                      </div>
                    )}

                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 active:opacity-100 focus-visible:opacity-100 transition-opacity min-h-[44px] min-w-[44px] active:scale-95"
                      onClick={() => handleRemove(index)}
                      disabled={!!isUploadingFile}
                      aria-label={`Remove ${file.fileName}`}
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>

                  <div className="mt-1 text-xs text-text-secondary truncate">{file.fileName}</div>
                  <div className="text-xs text-text-tertiary">{formatFileSize(file.fileSize)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
