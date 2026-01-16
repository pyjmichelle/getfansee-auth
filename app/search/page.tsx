"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, FileText } from "lucide-react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";

const supabase = getSupabaseBrowserClient();

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="container max-w-4xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Search</h1>
          <p className="text-muted-foreground">Find creators and content</p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search creators or content..."
              className="pl-10 pr-4 h-12 text-base"
              autoFocus
            />
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
            <TabsTrigger value="all">
              <Search className="w-4 h-4 mr-2" />
              All
            </TabsTrigger>
            <TabsTrigger value="creators">
              <Users className="w-4 h-4 mr-2" />
              Creators ({creators.length})
            </TabsTrigger>
            <TabsTrigger value="posts">
              <FileText className="w-4 h-4 mr-2" />
              Posts ({posts.length})
            </TabsTrigger>
          </TabsList>

          {/* All Results */}
          <TabsContent value="all" className="space-y-6">
            {isSearching ? (
              <p className="text-center text-muted-foreground py-8">Searching...</p>
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
                        className="w-full mt-4"
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
                        className="w-full mt-4"
                      >
                        View all {posts.length} posts
                      </Button>
                    )}
                  </div>
                )}

                {/* No Results */}
                {!isSearching && creators.length === 0 && posts.length === 0 && query && (
                  <p className="text-center text-muted-foreground py-8">
                    No results found for &quot;{query}&quot;
                  </p>
                )}
              </>
            )}
          </TabsContent>

          {/* Creators Results */}
          <TabsContent value="creators">
            {isSearching ? (
              <p className="text-center text-muted-foreground py-8">Searching...</p>
            ) : (
              <div className="grid gap-4">
                {creators.map((creator) => (
                  <CreatorCard key={creator.id} creator={creator} />
                ))}
                {!isSearching && creators.length === 0 && query && (
                  <p className="text-center text-muted-foreground py-8">
                    No creators found for &quot;{query}&quot;
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          {/* Posts Results */}
          <TabsContent value="posts">
            {isSearching ? (
              <p className="text-center text-muted-foreground py-8">Searching...</p>
            ) : (
              <div className="grid gap-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
                {!isSearching && posts.length === 0 && query && (
                  <p className="text-center text-muted-foreground py-8">
                    No posts found for &quot;{query}&quot;
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function CreatorCard({ creator }: { creator: any }) {
  return (
    <Card className="p-4 hover:bg-accent/50 transition-colors">
      <Link href={`/creator/${creator.id}`} className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={creator.avatar_url || undefined} />
          <AvatarFallback>{creator.display_name?.[0] || "C"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{creator.display_name}</h3>
          {creator.bio && (
            <p className="text-sm text-muted-foreground line-clamp-2">{creator.bio}</p>
          )}
        </div>
        <Button variant="outline" size="sm">
          View Profile
        </Button>
      </Link>
    </Card>
  );
}

function PostCard({ post }: { post: any }) {
  return (
    <Card className="p-4 hover:bg-accent/50 transition-colors">
      <div className="flex items-start gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={post.profiles?.avatar_url || undefined} />
          <AvatarFallback>{post.profiles?.display_name?.[0] || "C"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/creator/${post.creator_id}`}
              className="font-semibold text-foreground hover:underline"
            >
              {post.profiles?.display_name || "Creator"}
            </Link>
            <span className="text-sm text-muted-foreground">
              {new Date(post.created_at).toLocaleDateString()}
            </span>
          </div>
          {post.title && <h3 className="font-medium text-foreground mb-1">{post.title}</h3>}
          <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {post.visibility === "ppv" && (
              <span className="font-medium text-primary">
                ${(post.price_cents / 100).toFixed(2)}
              </span>
            )}
            {post.likes_count > 0 && <span>{post.likes_count} likes</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}
