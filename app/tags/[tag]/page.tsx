"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { type Post } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, Tag, FileText } from "@/lib/icons";
import { formatDistanceToNow } from "date-fns";
import { useCountUp } from "@/hooks/use-count-up";
import { DEFAULT_AVATAR_CREATOR } from "@/lib/image-fallbacks";

const supabase = getSupabaseBrowserClient();

export default function TagPage() {
  const params = useParams();
  const router = useRouter();
  const tagName = decodeURIComponent((params?.tag as string) || "");

  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tagInfo, setTagInfo] = useState<{ name: string; category: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/auth");
          return;
        }

        await ensureProfile();
        const profile = await getProfile(session.user.id);
        if (profile) {
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          });
        }

        const response = await fetch(`/api/tags/${encodeURIComponent(tagName)}/posts`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setPosts(data.posts || []);
            setTagInfo(data.tag);
          }
        }
      } catch (err) {
        console.error("[TagPage] loadData error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (tagName) {
      loadData();
    }
  }, [tagName, router]);

  const animatedPostCount = useCountUp(posts.length, { duration: 700, decimals: 0 });

  if (isLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="4xl">
        <div className="py-8 animate-pulse space-y-4">
          <div className="h-8 w-48 bg-surface-raised rounded"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-surface-raised rounded-xl"></div>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="4xl">
      <div className="section-block py-6 sm:py-8 lg:py-12">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 -ml-2 rounded-lg min-h-[40px]"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Tag Hero */}
        <div className="card-block bg-gradient-subtle p-6 md:p-8 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center">
              <Tag className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-primary">#{tagName}</h1>
              {tagInfo?.category && (
                <Badge variant="secondary" className="mt-1">
                  {tagInfo.category}
                </Badge>
              )}
            </div>
          </div>
          <p className="text-text-secondary mt-2">
            <span className="font-bold text-brand-primary">{animatedPostCount.toFixed(0)}</span>{" "}
            {posts.length === 1 ? "post" : "posts"} with this tag
          </p>
        </div>

        {/* Posts List */}
        {posts.length === 0 ? (
          <div className="card-block text-center py-16">
            <FileText className="w-12 h-12 mx-auto mb-4 text-text-tertiary/50" />
            <h3 className="text-lg font-medium text-text-primary mb-2">No posts found</h3>
            <p className="text-text-secondary mb-6">
              There are no posts with the tag #{tagName} yet.
            </p>
            <Button
              onClick={() => router.push("/home")}
              className="bg-brand-primary text-white shadow-glow hover-bold"
            >
              Explore Home Feed
            </Button>
          </div>
        ) : (
          <div className="space-y-4" data-testid="tag-posts">
            {posts.map((post, index) => (
              <Link key={post.id} href={`/posts/${post.id}`}>
                <div
                  className="card-block p-6 hover-bold animate-profile-reveal"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="flex gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage
                        src={post.creator?.avatar_url || DEFAULT_AVATAR_CREATOR}
                        alt={post.creator?.display_name || "Creator"}
                      />
                      <AvatarFallback className="bg-brand-primary/10 text-brand-primary">
                        {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-text-primary">
                          {post.creator?.display_name || "Creator"}
                        </span>
                        <span className="text-sm text-text-tertiary">
                          {post.created_at
                            ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
                            : "Unknown date"}
                        </span>
                        {post.visibility !== "free" && (
                          <Badge
                            variant={post.visibility === "ppv" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {post.visibility === "ppv"
                              ? `$${((post.price_cents || 0) / 100).toFixed(2)}`
                              : "Subscribers"}
                          </Badge>
                        )}
                      </div>
                      {post.title && (
                        <h3 className="font-medium text-text-primary mb-1">{post.title}</h3>
                      )}
                      <p className="text-text-secondary line-clamp-2">{post.content}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
