"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
// Card, Input, Tabs, Skeleton, Badge, CenteredContainer no longer needed - using Figma inline styles
import {
  Search,
  Users,
  FileText,
  Heart,
  Loader2,
  Sparkles,
  TrendingUp,
  Star,
  Award,
  Grid3X3,
  List,
  X,
  Check,
  RefreshCw,
} from "lucide-react";
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
  const [category, setCategory] = useState<"all" | "trending" | "new" | "top">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);

  const categories = [
    { id: "all", label: "All Creators", icon: Sparkles },
    { id: "trending", label: "Trending", icon: TrendingUp },
    { id: "new", label: "New", icon: Star },
    { id: "top", label: "Top Rated", icon: Award },
  ];

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
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <LoadingState type="spinner" text="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="pt-20 md:pt-24" data-testid="search-page">
        {/* Hero Section - Figma Style */}
        <div className="relative overflow-hidden bg-gradient-dark border-b border-border-base">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-primary/30 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-accent/30 rounded-full blur-[120px]" />
          </div>

          <div className="relative px-4 md:px-6 max-w-4xl mx-auto py-12 md:py-16">
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold mb-3 text-text-primary">
                Discover Amazing Creators
              </h1>
              <p className="text-xl text-text-secondary max-w-2xl mx-auto">
                Explore exclusive content from talented creators around the world
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 max-w-4xl mx-auto py-8">
          {/* Search Bar - Figma Style */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative max-w-2xl mx-auto">
              <Search
                className="absolute left-5 top-1/2 -translate-y-1/2 text-text-quaternary"
                size={20}
              />
              <input
                type="text"
                name="search"
                placeholder="Search creators by name or username..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-14 pr-4 py-4 bg-surface-raised border border-border-base rounded-2xl text-text-primary placeholder:text-text-quaternary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
                autoComplete="off"
                spellCheck={false}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 bg-surface-overlay rounded-full flex items-center justify-center hover:bg-border-base transition-colors"
                >
                  <X size={14} className="text-text-tertiary" />
                </button>
              )}
            </div>
          </form>

          {/* Category Filters & View Toggle - Figma Style */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id as typeof category)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                    category === cat.id
                      ? "bg-brand-primary text-white shadow-md"
                      : "bg-surface-raised text-text-tertiary hover:text-text-primary hover:bg-surface-overlay border border-border-base"
                  }`}
                >
                  <cat.icon size={16} />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="hidden md:flex items-center gap-1 bg-surface-raised border border-border-base rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "grid"
                    ? "bg-brand-primary text-white"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                <Grid3X3 size={18} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "list"
                    ? "bg-brand-primary text-white"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                <List size={18} />
              </button>
            </div>
          </div>

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

          {/* Results - Figma Style Grid/List */}
          {isSearching ? (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  : "space-y-4 max-w-4xl mx-auto"
              }
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-surface-raised border border-border-base rounded-2xl p-6 animate-pulse"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-surface-overlay rounded-2xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-surface-overlay rounded" />
                      <div className="h-3 w-48 bg-surface-overlay rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Creators Grid/List */}
              {creators.length > 0 && (
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                      : "space-y-4 max-w-4xl mx-auto"
                  }
                >
                  {creators.map((creator) => (
                    <CreatorCard key={creator.id} creator={creator} viewMode={viewMode} />
                  ))}
                </div>
              )}

              {/* Posts Grid */}
              {posts.length > 0 && creators.length === 0 && (
                <div className="grid gap-4">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}

              {/* No Results - Figma Style */}
              {!isSearching && creators.length === 0 && posts.length === 0 && query && (
                <div className="text-center py-20">
                  <div className="w-24 h-24 bg-surface-raised rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Search className="w-10 h-10 text-text-quaternary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-text-primary">No results found</h3>
                  <p className="text-text-tertiary text-lg max-w-md mx-auto">
                    No results found for &quot;{query}&quot;. Try a different search term or browse
                    creators.
                  </p>
                </div>
              )}

              {/* Initial State - Figma Style */}
              {!isSearching && creators.length === 0 && posts.length === 0 && !query && (
                <div className="text-center py-20">
                  <div className="w-24 h-24 bg-brand-primary-alpha-10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="w-10 h-10 text-brand-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-text-primary">Discover Content</h3>
                  <p className="text-text-tertiary text-lg max-w-md mx-auto">
                    Search for your favorite creators or explore trending content.
                  </p>
                </div>
              )}

              {/* Load More - Figma Style */}
              {(creators.length > 0 || posts.length > 0) && (
                <div className="mt-10 text-center">
                  <Button variant="outline" size="lg" className="rounded-xl">
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Load More Creators
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
    </div>
  );
}

function CreatorCard({
  creator,
  viewMode = "grid",
}: {
  creator: Creator;
  viewMode?: "grid" | "list";
}) {
  if (viewMode === "list") {
    return (
      <div className="bg-surface-base border border-border-base rounded-2xl p-6 hover:border-brand-primary/30 transition-all">
        <Link href={`/creator/${creator.id}`} className="flex items-center gap-4">
          <Avatar className="h-16 w-16 rounded-2xl">
            <AvatarImage src={creator.avatar_url || undefined} alt={creator.display_name} />
            <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary text-lg rounded-2xl">
              {creator.display_name?.[0] || "C"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-text-primary truncate">{creator.display_name}</h3>
              {creator.role === "creator" && (
                <div className="w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </div>
            {creator.bio && (
              <p className="text-sm text-text-tertiary line-clamp-2">{creator.bio}</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl hidden sm:flex border-border-base hover:bg-surface-raised"
          >
            View Profile
          </Button>
        </Link>
      </div>
    );
  }

  // Grid view - card style
  return (
    <div className="group bg-surface-base border border-border-base rounded-2xl overflow-hidden hover:border-brand-primary/30 transition-all hover:shadow-lg">
      <Link href={`/creator/${creator.id}`}>
        {/* Cover placeholder */}
        <div className="h-32 bg-gradient-primary opacity-60" />

        {/* Creator info */}
        <div className="p-5 -mt-10 relative">
          <Avatar className="h-16 w-16 rounded-2xl border-4 border-surface-base mb-3">
            <AvatarImage src={creator.avatar_url || undefined} alt={creator.display_name} />
            <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary text-lg rounded-2xl">
              {creator.display_name?.[0] || "C"}
            </AvatarFallback>
          </Avatar>

          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-text-primary">{creator.display_name}</h3>
            {creator.role === "creator" && (
              <div className="w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center">
                <Check size={12} className="text-white" />
              </div>
            )}
          </div>

          {creator.bio && (
            <p className="text-sm text-text-tertiary line-clamp-2 mb-4">{creator.bio}</p>
          )}

          <Button
            variant="outline"
            className="w-full rounded-xl border-border-base hover:bg-surface-raised"
          >
            View Profile
          </Button>
        </div>
      </Link>
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  return (
    <div className="bg-surface-base border border-border-base rounded-2xl p-6 hover:border-brand-primary/30 transition-all">
      <div className="flex items-start gap-4">
        <Avatar className="h-12 w-12 rounded-xl">
          <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name} />
          <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary rounded-xl">
            {profile?.display_name?.[0] || "C"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link
              href={`/creator/${post.creator_id}`}
              className="font-bold text-text-primary hover:text-brand-primary transition-colors"
            >
              {profile?.display_name || "Creator"}
            </Link>
            <span className="text-sm text-text-tertiary">
              {post.created_at ? new Date(post.created_at).toLocaleDateString() : "Unknown date"}
            </span>
            {post.visibility === "ppv" && (
              <span className="px-2 py-0.5 bg-brand-accent/10 text-brand-accent text-xs font-semibold rounded-full">
                ${((post.price_cents ?? 0) / 100).toFixed(2)}
              </span>
            )}
            {post.visibility === "subscribers" && (
              <span className="px-2 py-0.5 bg-brand-primary-alpha-10 text-brand-primary text-xs font-semibold rounded-full">
                Subscribers
              </span>
            )}
          </div>
          {post.title && (
            <Link href={`/posts/${post.id}`}>
              <h3 className="font-semibold text-text-primary mb-1 hover:text-brand-primary transition-colors cursor-pointer">
                {post.title}
              </h3>
            </Link>
          )}
          <p className="text-sm text-text-tertiary line-clamp-2">{post.content}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-text-tertiary">
            {(post.likes_count ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" aria-hidden="true" />
                {post.likes_count ?? 0}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
