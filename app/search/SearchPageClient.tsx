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
import { type Creator, type Post } from "@/lib/types";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { BottomNavigation } from "@/components/bottom-navigation";

const supabase = getSupabaseBrowserClient();

export default function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState<"all" | "creators" | "posts">("all");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
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
    setSearchError(null);

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}`
      );
      const data = await response.json();

      if (data.success) {
        setCreators(data.creators || []);
        setPosts(data.posts || []);
      } else {
        setSearchError(data.error || "Search failed. Please try again.");
      }
    } catch (err) {
      console.error("[search] Search error:", err);
      setSearchError("Unable to search. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);

    // 更新 URL
    const newUrl = `/search?q=${encodeURIComponent(query)}`;
    router.push(newUrl);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingState type="spinner" text="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="py-5 sm:py-6 lg:py-8" data-testid="search-page">
        <CenteredContainer maxWidth="4xl">
          <div className="mb-6 text-center sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mb-1 text-foreground">
              Search
            </h1>
            <p className="text-base text-muted-foreground">Find creators and content</p>
          </div>

          {/* Search Form - 居中且显眼 */}
          <form onSubmit={handleSearch} className="mb-6 max-w-2xl mx-auto sm:mx-0">
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <Input
                type="text"
                name="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search creators, posts, tags…"
                className="pl-12 pr-12 min-h-[52px] text-base rounded-xl border-2 shadow-md focus-visible:shadow-lg focus-visible:border-primary transition-[border-color,box-shadow] duration-200 motion-safe:transition-[border-color,box-shadow] motion-reduce:transition-none"
                autoFocus={typeof window !== "undefined" && window.innerWidth >= 768}
                aria-label="Search query"
                disabled={isSearching}
                autoComplete="off"
                spellCheck={false}
              />
              {isSearching && (
                <Loader2
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary animate-spin"
                  aria-hidden="true"
                  aria-live="polite"
                />
              )}
              {!isSearching && query.length >= 2 && (
                <Button
                  type="submit"
                  size="sm"
                  variant="subscribe-gradient"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 min-h-[36px] px-4 font-semibold shadow-sm"
                  aria-label="Search"
                >
                  Search
                </Button>
              )}
            </div>
            {!query && (
              <p className="mt-3 text-sm text-muted-foreground text-center sm:text-left px-1">
                Try searching for creators, posts, or use{" "}
                <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded border">#</kbd>{" "}
                to search tags
              </p>
            )}
          </form>

          {/* Search Error */}
          {searchError && (
            <ErrorState
              title="Search failed"
              message={searchError}
              retry={() => query && performSearch(query)}
              variant="inline"
              className="mb-6"
            />
          )}

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
            <TabsList className="grid w-full grid-cols-3 h-12">
              <TabsTrigger value="all" className="text-sm sm:text-base">
                <Search className="w-4 h-4 mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">All</span>
                <span className="sm:hidden">All</span>
              </TabsTrigger>
              <TabsTrigger value="creators" className="text-sm sm:text-base">
                <Users className="w-4 h-4 mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Creators ({creators.length})</span>
                <span className="sm:hidden">Creators</span>
              </TabsTrigger>
              <TabsTrigger value="posts" className="text-sm sm:text-base">
                <FileText className="w-4 h-4 mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Posts ({posts.length})</span>
                <span className="sm:hidden">Posts</span>
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
                      <div className="grid gap-6">
                        {creators.slice(0, 3).map((creator) => (
                          <CreatorCard key={creator.id} creator={creator} />
                        ))}
                      </div>
                      {creators.length > 3 && (
                        <Button
                          variant="ghost"
                          onClick={() => setSearchType("creators")}
                          className="w-full mt-4 rounded-xl min-h-[44px] transition-[transform,opacity] duration-200 motion-safe:transition-[transform,opacity] motion-reduce:transition-none"
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
                      <div className="grid gap-6">
                        {posts.slice(0, 5).map((post) => (
                          <PostCard key={post.id} post={post} />
                        ))}
                      </div>
                      {posts.length > 5 && (
                        <Button
                          variant="ghost"
                          onClick={() => setSearchType("posts")}
                          className="w-full mt-4 rounded-xl min-h-[44px] transition-[transform,opacity] duration-200 motion-safe:transition-[transform,opacity] motion-reduce:transition-none"
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
                <LoadingState type="skeleton" />
              ) : creators.length > 0 ? (
                <div className="grid gap-4">
                  {creators.map((creator) => (
                    <CreatorCard key={creator.id} creator={creator} />
                  ))}
                </div>
              ) : query ? (
                <EmptyState
                  icon={<Users className="w-8 h-8 text-muted-foreground" />}
                  title="No creators found"
                  description={`No creators found for "${query}". Try a different search term.`}
                />
              ) : (
                <EmptyState
                  icon={<Users className="w-8 h-8 text-muted-foreground" />}
                  title="Search creators"
                  description="Enter a search term to find creators."
                />
              )}
            </TabsContent>

            {/* Posts Results */}
            <TabsContent value="posts">
              {isSearching ? (
                <LoadingState type="skeleton" />
              ) : posts.length > 0 ? (
                <div className="grid gap-4">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              ) : query ? (
                <EmptyState
                  icon={<FileText className="w-8 h-8 text-muted-foreground" />}
                  title="No posts found"
                  description={`No posts found for "${query}". Try a different search term.`}
                />
              ) : (
                <EmptyState
                  icon={<FileText className="w-8 h-8 text-muted-foreground" />}
                  title="Search posts"
                  description="Enter a search term to find posts."
                />
              )}
            </TabsContent>
          </Tabs>
        </CenteredContainer>
      </main>

      <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
    </div>
  );
}

function CreatorCard({ creator }: { creator: Creator }) {
  return (
    <Card className="p-6 hover:bg-accent/50 transition-[background-color,transform] duration-300 motion-safe:transition-[background-color,transform] motion-reduce:transition-none rounded-2xl border border-border/50 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
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
          className="rounded-xl min-h-[40px] hidden sm:flex transition-[transform,opacity] duration-200 motion-safe:transition-[transform,opacity] motion-reduce:transition-none"
          aria-label={`View ${creator.display_name}'s profile`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              window.location.href = `/creator/${creator.id}`;
            }
          }}
        >
          View Profile
        </Button>
      </Link>
    </Card>
  );
}

function PostCard({ post }: { post: Post }) {
  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  return (
    <Card className="p-6 hover:bg-accent/50 transition-[background-color,transform] duration-300 motion-safe:transition-[background-color,transform] motion-reduce:transition-none rounded-2xl border border-border/50 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
      <div className="flex items-start gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {profile?.display_name?.[0] || "C"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link
              href={`/creator/${post.creator_id}`}
              className="font-semibold text-foreground hover:text-primary transition-[color] motion-safe:transition-[color] motion-reduce:transition-none"
            >
              {profile?.display_name || "Creator"}
            </Link>
            <span className="text-sm text-muted-foreground">
              {post.created_at ? new Date(post.created_at).toLocaleDateString() : "Unknown date"}
            </span>
            {post.visibility === "ppv" && (
              <Badge variant="secondary" className="text-xs">
                ${((post.price_cents ?? 0) / 100).toFixed(2)}
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
              <h3 className="font-medium text-foreground mb-1 hover:text-primary transition-[color] motion-safe:transition-[color] motion-reduce:transition-none cursor-pointer">
                {post.title}
              </h3>
            </Link>
          )}
          <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            {(post.likes_count ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" aria-hidden="true" />
                {post.likes_count ?? 0}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
