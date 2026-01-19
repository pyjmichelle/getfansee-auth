"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CenteredContainer } from "@/components/layouts/centered-container";
import { Search, Users, FileText, Heart, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";

const supabase = getSupabaseBrowserClient();

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState<"all" | "creators" | "posts">("all");
  const [isSearching, setIsSearching] = useState(false);
  const [creators, setCreators] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    const loadUser = async () => {
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
    };

    loadUser();
  }, [router]);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setCreators([]);
      setPosts([]);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}`
      );
      const data = await response.json();

      if (data.success) {
        setCreators(data.creators || []);
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error("[search] Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);

    // 更新 URL
    const newUrl = `/search?q=${encodeURIComponent(query)}`;
    window.history.pushState({}, "", newUrl);
  };

  if (!currentUser) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="py-6 sm:py-8 lg:py-12">
        <CenteredContainer maxWidth="4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-2">Search</h1>
            <p className="text-lg text-muted-foreground">Find creators and content</p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search creators or content..."
                className="pl-10 pr-4 min-h-[44px] text-base rounded-xl"
                autoFocus
                aria-label="Search query"
              />
              {isSearching && (
                <Loader2
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin"
                  aria-hidden="true"
                />
              )}
            </div>
          </form>

          {/* Search Type Tabs */}
          <Tabs
            value={searchType}
            onValueChange={(value) => {
              setSearchType(value as "all" | "creators" | "posts");
              if (query) {
                performSearch(query);
              }
            }}
            className="mb-6"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" className="transition-all duration-200">
                <Search className="w-4 h-4 mr-2" aria-hidden="true" />
                All
              </TabsTrigger>
              <TabsTrigger value="creators" className="transition-all duration-200">
                <Users className="w-4 h-4 mr-2" aria-hidden="true" />
                Creators ({creators.length})
              </TabsTrigger>
              <TabsTrigger value="posts" className="transition-all duration-200">
                <FileText className="w-4 h-4 mr-2" aria-hidden="true" />
                Posts ({posts.length})
              </TabsTrigger>
            </TabsList>

            {/* All Results */}
            <TabsContent value="all" className="space-y-6">
              {isSearching ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-16 w-16 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <>
                  {/* Creators Section */}
                  {creators.length > 0 && (
                    <div>
                      <h2 className="text-xl font-semibold mb-4">Creators</h2>
                      <div className="grid gap-4">
                        {creators.slice(0, 3).map((creator) => (
                          <CreatorCard key={creator.id} creator={creator} />
                        ))}
                      </div>
                      {creators.length > 3 && (
                        <Button
                          variant="ghost"
                          onClick={() => setSearchType("creators")}
                          className="w-full mt-4 rounded-xl min-h-[44px] transition-all duration-200"
                        >
                          View all {creators.length} creators
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Posts Section */}
                  {posts.length > 0 && (
                    <div>
                      <h2 className="text-xl font-semibold mb-4">Posts</h2>
                      <div className="grid gap-4">
                        {posts.slice(0, 5).map((post) => (
                          <PostCard key={post.id} post={post} />
                        ))}
                      </div>
                      {posts.length > 5 && (
                        <Button
                          variant="ghost"
                          onClick={() => setSearchType("posts")}
                          className="w-full mt-4 rounded-xl min-h-[44px] transition-all duration-200"
                        >
                          View all {posts.length} posts
                        </Button>
                      )}
                    </div>
                  )}

                  {/* No Results */}
                  {!isSearching && creators.length === 0 && posts.length === 0 && query && (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Search className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        No results found
                      </h3>
                      <p className="text-sm text-muted-foreground text-center max-w-sm">
                        No results found for &quot;{query}&quot;. Try a different search term or
                        browse creators.
                      </p>
                    </div>
                  )}

                  {/* Initial State - No Search Yet */}
                  {!isSearching && creators.length === 0 && posts.length === 0 && !query && (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-primary" aria-hidden="true" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        Discover Content
                      </h3>
                      <p className="text-sm text-muted-foreground text-center max-w-sm">
                        Search for your favorite creators or explore trending content.
                      </p>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Creators Results */}
            <TabsContent value="creators">
              {isSearching ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-16 w-16 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4">
                  {creators.map((creator) => (
                    <CreatorCard key={creator.id} creator={creator} />
                  ))}
                  {!isSearching && creators.length === 0 && query && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Users className="w-12 h-12 text-muted-foreground mb-3" aria-hidden="true" />
                      <p className="text-muted-foreground">
                        No creators found for &quot;{query}&quot;
                      </p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Posts Results */}
            <TabsContent value="posts">
              {isSearching ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="p-4 rounded-xl border shadow-sm">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                  {!isSearching && posts.length === 0 && query && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <FileText
                        className="w-12 h-12 text-muted-foreground mb-3"
                        aria-hidden="true"
                      />
                      <p className="text-muted-foreground">
                        No posts found for &quot;{query}&quot;
                      </p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CenteredContainer>
      </main>
    </div>
  );
}

function CreatorCard({ creator }: { creator: any }) {
  return (
    <Card className="p-4 hover:bg-accent/50 transition-all duration-200 rounded-xl border shadow-sm">
      <Link href={`/creator/${creator.id}`} className="flex items-center gap-4">
        <Avatar className="h-16 w-16 ring-2 ring-border">
          <AvatarImage src={creator.avatar_url || undefined} alt={creator.display_name} />
          <AvatarFallback className="bg-primary/10 text-primary text-lg">
            {creator.display_name?.[0] || "C"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{creator.display_name}</h3>
            {creator.role === "creator" && (
              <Badge variant="secondary" className="text-xs">
                Creator
              </Badge>
            )}
          </div>
          {creator.bio && (
            <p className="text-sm text-muted-foreground line-clamp-2">{creator.bio}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl min-h-[40px] hidden sm:flex transition-all duration-200"
          aria-label={`View ${creator.display_name}'s profile`}
        >
          View Profile
        </Button>
      </Link>
    </Card>
  );
}

function PostCard({ post }: { post: any }) {
  return (
    <Card className="p-4 hover:bg-accent/50 transition-all duration-200 rounded-xl border shadow-sm">
      <div className="flex items-start gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage
            src={post.profiles?.avatar_url || undefined}
            alt={post.profiles?.display_name}
          />
          <AvatarFallback className="bg-primary/10 text-primary">
            {post.profiles?.display_name?.[0] || "C"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link
              href={`/creator/${post.creator_id}`}
              className="font-semibold text-foreground hover:text-primary transition-colors"
            >
              {post.profiles?.display_name || "Creator"}
            </Link>
            <span className="text-sm text-muted-foreground">
              {new Date(post.created_at).toLocaleDateString()}
            </span>
            {post.visibility === "ppv" && (
              <Badge variant="secondary" className="text-xs">
                ${(post.price_cents / 100).toFixed(2)}
              </Badge>
            )}
            {post.visibility === "subscribers" && (
              <Badge variant="outline" className="text-xs">
                Subscribers
              </Badge>
            )}
          </div>
          {post.title && (
            <Link href={`/posts/${post.id}`}>
              <h3 className="font-medium text-foreground mb-1 hover:text-primary transition-colors cursor-pointer">
                {post.title}
              </h3>
            </Link>
          )}
          <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            {post.likes_count > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" aria-hidden="true" />
                {post.likes_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
