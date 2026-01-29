"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, ArrowLeft } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type PublishSuccessPageClientProps = {
  postType: "free" | "subscribers" | "ppv";
  price: string;
};

export default function PublishSuccessPageClient({
  postType,
  price,
}: PublishSuccessPageClientProps) {
  const router = useRouter();
  const currentUser = {
    username: "sophia_creative",
    role: "creator" as const,
    avatar: "/creator-avatar.png",
  };

  // Mock post ID for demonstration
  const postId = "demo-post-" + Date.now();

  useEffect(() => {
    const timer = setTimeout(() => {
      // 可在此处触发动画或埋点
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const getPostTypeLabel = () => {
    if (postType === "free") return "Free Post";
    if (postType === "subscribers") return "Exclusive Post";
    return `Premium Post ($${price})`;
  };

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={5} />

      <main className="container max-w-2xl mx-auto px-4 py-12">
        <Card className="p-8 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full glass bg-subscribe-gradient/20 flex items-center justify-center mx-auto mb-6 shadow-subscribe-glow">
            <Check className="w-10 h-10 text-[var(--color-pink-400)]" aria-hidden="true" />
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-foreground mb-3">Post Published Successfully!</h1>
          <p className="text-muted-foreground mb-8">
            Your {getPostTypeLabel().toLowerCase()} is now live and visible to your audience
          </p>

          {/* Post Info */}
          <div className="bg-muted/30 rounded-lg p-6 mb-8 text-left">
            <h3 className="font-semibold text-foreground mb-4">What happens next?</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <Check
                  className="w-5 h-5 text-[var(--color-pink-400)] flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-foreground font-semibold">Post is live on your profile</p>
                  <p className="text-muted-foreground text-sm">
                    {postType === "free"
                      ? "Anyone can view this post"
                      : postType === "subscribers"
                        ? "Only your subscribers can access this exclusive content"
                        : "Fans can purchase to unlock this hot content"}
                  </p>
                </div>
              </li>
              {postType !== "free" && (
                <li className="flex items-start gap-3">
                  <Check
                    className="w-5 h-5 text-[var(--color-pink-400)] flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-foreground font-semibold">Notifications sent</p>
                    <p className="text-muted-foreground text-sm">
                      Your {postType === "subscribers" ? "subscribers" : "followers"} will be
                      notified about your new content
                    </p>
                  </div>
                </li>
              )}
              <li className="flex items-start gap-3">
                <Check
                  className="w-5 h-5 text-[var(--color-pink-400)] flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-foreground font-semibold">Analytics tracking started</p>
                  <p className="text-muted-foreground text-sm">
                    Track views, likes, and earnings in your studio
                  </p>
                </div>
              </li>
            </ul>
          </div>

          {/* Primary Actions */}
          <div className="space-y-3 mb-6">
            <Button
              size="lg"
              variant="subscribe-gradient"
              className="w-full font-bold shadow-lg"
              onClick={() =>
                router.push(`/creator/${currentUser.username}?viewAs=fan&postId=${postId}`)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/creator/${currentUser.username}?viewAs=fan&postId=${postId}`);
                }
              }}
              aria-label="View post as a fan would see it"
            >
              <Eye className="w-5 h-5 mr-2" aria-hidden="true" />
              View as Fan
            </Button>
            <p className="text-xs text-muted-foreground">
              See exactly how fans see your post (locked/unlocked state)
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="flex-1 border-2 hover:border-primary/50"
            >
              <Link href="/creator/studio">
                <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                Back to Studio
              </Link>
            </Button>
            <Button
              asChild
              variant="subscribe-gradient"
              size="lg"
              className="flex-1 font-semibold shadow-lg"
            >
              <Link href="/creator/studio/post/new">Create Another Post</Link>
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
