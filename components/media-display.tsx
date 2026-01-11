"use client";

import { useState, useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addWatermarkToImage, shouldAddWatermark } from "@/lib/watermark";
import { getCurrentUser } from "@/lib/auth";
import { PaywallModal } from "@/components/paywall-modal";
import type { Post } from "@/lib/types";

// 视频播放器组件（支持自动播放和预览标签）
function VideoPlayer({
  mediaId,
  videoUrl,
  canView,
  post,
  videoRefs,
  setShowPaywallModal,
}: {
  mediaId: string;
  videoUrl: string;
  canView: boolean;
  post: Post;
  videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  setShowPaywallModal: (show: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // 视频自动播放（仅当内容已解锁时）
  useEffect(() => {
    if (!canView || !videoRef.current) return;

    const video = videoRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            // 视频在视口中央，自动播放（静音）
            video.muted = true;
            video.play().catch(() => {
              // 自动播放失败时忽略错误
            });
          } else {
            // 视频不在视口中央，暂停
            video.pause();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
    };
  }, [canView]);

  return (
    <div className="relative">
      <video
        ref={(el) => {
          if (el) {
            videoRefs.current.set(mediaId, el);
            videoRef.current = el;
          } else {
            videoRefs.current.delete(mediaId);
            videoRef.current = null;
          }
        }}
        src={videoUrl}
        controls
        className="w-full h-auto max-h-[600px] rounded-3xl"
        onError={(e) => {
          console.error("[MediaDisplay] Video load error:", videoUrl);
        }}
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          // 如果内容被锁定且启用了预览，设置 10 秒限制
          if (!canView && post.preview_enabled) {
            const timeUpdateHandler = () => {
              if (video.currentTime >= 10) {
                video.pause();
                video.currentTime = 10;
                // 呼出支付弹窗
                setShowPaywallModal(true);
                video.removeEventListener("timeupdate", timeUpdateHandler);
              }
            };
            video.addEventListener("timeupdate", timeUpdateHandler);

            // 清理函数
            return () => {
              video.removeEventListener("timeupdate", timeUpdateHandler);
            };
          }
        }}
      >
        Your browser does not support the video tag.
      </video>

      {/* PPV 视频封面左下角 "10s Preview" 渐变标签 */}
      {!canView && post.preview_enabled && post.visibility === "ppv" && (
        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-accent-gradient rounded-lg text-white text-xs font-semibold shadow-lg">
          10s Preview
        </div>
      )}
    </div>
  );
}

export type MediaDisplayProps = {
  post: Post;
  canView: boolean;
  isCreator: boolean;
  onSubscribe?: () => void;
  onUnlock?: () => void;
  creatorDisplayName?: string;
};

export function MediaDisplay({
  post,
  canView,
  isCreator,
  onSubscribe,
  onUnlock,
  creatorDisplayName,
}: MediaDisplayProps) {
  const [watermarkedImages, setWatermarkedImages] = useState<Map<string, string>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    const checkUser = async () => {
      const user = await getCurrentUser();
      setCurrentUserId(user?.id || null);
    };
    checkUser();
  }, []);

  // 处理图片水印（新逻辑：仅当 watermark_enabled=true 且 media_type=image）
  useEffect(() => {
    if (!canView || isCreator || !creatorDisplayName) return;

    const imageMedia = post.media?.filter((m) => m.media_type === "image") || [];

    imageMedia.forEach(async (media) => {
      // 检查是否需要添加水印
      const needsWatermark = shouldAddWatermark(
        post.watermark_enabled,
        media.media_type,
        isCreator
      );

      if (!needsWatermark) {
        // 不需要水印，使用原图
        return;
      }

      // 如果已有水印版本路径，使用它
      if (media.watermarked_path) {
        setWatermarkedImages((prev) => {
          const newMap = new Map(prev);
          newMap.set(media.id, media.watermarked_path!);
          return newMap;
        });
        return;
      }

      // 否则动态生成水印（客户端）
      if (!watermarkedImages.has(media.id)) {
        try {
          const watermarkedUrl = await addWatermarkToImage(media.media_url, creatorDisplayName);
          setWatermarkedImages((prev) => {
            const newMap = new Map(prev);
            newMap.set(media.id, watermarkedUrl);
            return newMap;
          });
        } catch (err) {
          console.error("[MediaDisplay] watermark error:", err);
          // 失败时使用原图
          setWatermarkedImages((prev) => {
            const newMap = new Map(prev);
            newMap.set(media.id, media.media_url);
            return newMap;
          });
        }
      }
    });
  }, [
    canView,
    isCreator,
    creatorDisplayName,
    post.watermark_enabled,
    post.media,
    watermarkedImages,
  ]);

  // 获取媒体 URL（带水印或原图）
  const getMediaUrl = (media: {
    id: string;
    media_url: string;
    watermarked_path: string | null;
    media_type: string;
  }) => {
    // 如果有水印版本路径，使用它
    if (media.watermarked_path) {
      return media.watermarked_path;
    }

    // 如果客户端生成了水印，使用它
    if (media.media_type === "image" && watermarkedImages.has(media.id)) {
      return watermarkedImages.get(media.id)!;
    }

    // 否则使用原图
    return media.media_url;
  };

  if (!canView) {
    // 显示遮罩 - 使用高级磨砂模糊效果
    return (
      <div className="space-y-4">
        {post.media?.map((media) => (
          <div key={media.id} className="relative rounded-lg overflow-hidden">
            {media.media_type === "image" ? (
              <div className="relative aspect-video bg-black/40 rounded-lg overflow-hidden">
                <img
                  src={media.media_url}
                  alt="Locked content"
                  className="w-full h-full object-cover blur-2xl scale-110"
                />
                <div className="absolute inset-0 backdrop-blur-2xl bg-black/30 flex items-center justify-center">
                  <div className="text-center text-white z-10">
                    <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                      <Lock className="w-8 h-8 text-white" />
                    </div>
                    <p className="mb-4 text-lg font-medium">
                      {post.visibility === "subscribers"
                        ? "This content is for subscribers only"
                        : `Unlock for $${((post.price_cents || 0) / 100).toFixed(2)}`}
                    </p>
                    {post.visibility === "subscribers" ? (
                      <Button
                        size="sm"
                        onClick={onSubscribe}
                        variant="gradient"
                        className="rounded-xl"
                      >
                        Subscribe to view
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={onUnlock}
                        variant="gradient"
                        className="rounded-xl"
                      >
                        Unlock for ${((post.price_cents || 0) / 100).toFixed(2)}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative aspect-video bg-black/40 rounded-lg overflow-hidden">
                {post.preview_enabled ? (
                  <>
                    <video
                      src={media.media_url}
                      className="w-full h-full object-cover blur-2xl scale-110"
                      muted
                      loop
                    />
                    <div className="absolute inset-0 backdrop-blur-2xl bg-black/30 flex items-center justify-center">
                      <div className="text-center text-white z-10 w-full max-w-md px-4">
                        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                          <Lock className="w-8 h-8 text-white" />
                        </div>
                        <p className="mb-3 text-sm text-white/80">Preview: First 10 seconds</p>
                        <div className="relative w-full mb-4 rounded-lg overflow-hidden">
                          <video
                            src={media.media_url}
                            controls
                            className="w-full rounded-lg"
                            onLoadedMetadata={(e) => {
                              const video = e.currentTarget;
                              video.currentTime = 0;
                              const timeUpdateHandler = () => {
                                if (video.currentTime >= 10) {
                                  video.pause();
                                  video.currentTime = 10;
                                  video.removeEventListener("timeupdate", timeUpdateHandler);
                                }
                              };
                              video.addEventListener("timeupdate", timeUpdateHandler);
                            }}
                          />
                        </div>
                        <div className="mt-3">
                          {post.visibility === "subscribers" ? (
                            <Button
                              size="sm"
                              onClick={onSubscribe}
                              className="bg-[#14B8A6] hover:bg-[#14B8A6]/90 text-[#050505]"
                            >
                              Subscribe to view full video
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={onUnlock}
                              className="bg-[#14B8A6] hover:bg-[#14B8A6]/90 text-[#050505]"
                            >
                              Unlock for ${((post.price_cents || 0) / 100).toFixed(2)}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <video
                      src={media.media_url}
                      className="w-full h-full object-cover blur-2xl scale-110"
                      muted
                      loop
                    />
                    <div className="absolute inset-0 backdrop-blur-2xl bg-black/30 flex items-center justify-center">
                      <div className="text-center text-white z-10">
                        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                          <Lock className="w-8 h-8 text-white" />
                        </div>
                        <p className="mb-4 text-lg font-medium">
                          {post.visibility === "subscribers"
                            ? "This content is for subscribers only"
                            : `Unlock for $${((post.price_cents || 0) / 100).toFixed(2)}`}
                        </p>
                        {post.visibility === "subscribers" ? (
                          <Button
                            size="sm"
                            onClick={onSubscribe}
                            variant="gradient"
                            className="rounded-xl"
                          >
                            Subscribe to view
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={onUnlock}
                            variant="gradient"
                            className="rounded-xl"
                          >
                            Unlock for ${((post.price_cents || 0) / 100).toFixed(2)}
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // 显示内容（带水印，如果启用）
  return (
    <>
      <div className="space-y-4">
        {post.media && post.media.length > 0 ? (
          post.media.map((media) => {
            // 如果内容被锁定且是视频，使用预览 URL
            const videoUrl =
              !canView && media.is_locked && media.media_type === "video" && post.preview_enabled
                ? media.preview_url || media.media_url
                : media.media_url;

            return (
              <div key={media.id} className="relative rounded-3xl overflow-hidden">
                {media.media_type === "image" ? (
                  <img
                    src={getMediaUrl(media)}
                    alt={media.file_name || "Post media"}
                    className="w-full h-auto object-contain max-h-[600px] rounded-3xl"
                    onError={(e) => {
                      console.error("[MediaDisplay] Image load error:", media.media_url);
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                ) : (
                  <VideoPlayer
                    mediaId={media.id}
                    videoUrl={videoUrl}
                    canView={canView}
                    post={post}
                    videoRefs={videoRefs}
                    setShowPaywallModal={setShowPaywallModal}
                  />
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No media available</p>
          </div>
        )}
      </div>

      {/* 支付弹窗 */}
      {post.visibility === "ppv" && post.price_cents && post.price_cents > 0 && (
        <PaywallModal
          open={showPaywallModal}
          onOpenChange={setShowPaywallModal}
          type="ppv"
          creatorName={creatorDisplayName || "Creator"}
          price={post.price_cents / 100}
          postId={post.id}
          benefits={["Unlock full video", "Access to all content"]}
          onSuccess={async () => {
            // 支付成功后调用解锁回调，由父组件处理状态更新
            if (onUnlock) {
              await onUnlock();
            }
            setShowPaywallModal(false);
          }}
        />
      )}
    </>
  );
}
