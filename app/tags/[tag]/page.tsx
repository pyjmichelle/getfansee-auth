"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CenteredContainer } from "@/components/layouts/centered-container";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { type Post } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, Tag, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

        // Load posts by tag
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}
        <main className="py-6 sm:py-8 lg:py-12">
          <CenteredContainer maxWidth="4xl">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 bg-muted rounded"></div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-muted rounded-xl"></div>
                ))}
              </div>
            </div>
          </CenteredContainer>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}

      <main className="py-6 sm:py-8 lg:py-12">
        <CenteredContainer maxWidth="4xl">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            className="mb-6 -ml-2 rounded-lg min-h-[40px]"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {/* Tag Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Tag className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">#{tagName}</h1>
                {tagInfo?.category && (
                  <Badge variant="secondary" className="mt-1">
                    {tagInfo.category}
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-muted-foreground">
              {posts.length} {posts.length === 1 ? "post" : "posts"} with this tag
            </p>
          </div>

          {/* Posts List */}
          {posts.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium text-foreground mb-2">No posts found</h3>
              <p className="text-muted-foreground mb-6">
                There are no posts with the tag #{tagName} yet.
              </p>
              <Button onClick={() => router.push("/home")}>Explore Home Feed</Button>
            </div>
          ) : (
            <div className="space-y-4" data-testid="tag-posts">
              {posts.map((post) => (
                <Link key={post.id} href={`/posts/${post.id}`}>
                  <Card className="rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 p-6">
                    <div className="flex gap-4">
                      {/* Creator Avatar */}
                      <Avatar className="w-12 h-12">
                        <AvatarImage
                          src={post.creator?.avatar_url || "/placeholder.svg"}
                          alt={post.creator?.display_name || "Creator"}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                        </AvatarFallback>
                      </Avatar>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-foreground">
                            {post.creator?.display_name || "Creator"}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
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
                          <h3 className="font-medium text-foreground mb-1">{post.title}</h3>
                        )}
                        <p className="text-muted-foreground line-clamp-2">{post.content}</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CenteredContainer>
      </main>
    </div>
  );
}
