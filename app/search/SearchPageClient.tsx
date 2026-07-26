"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Compass,
  Grid3X3,
  Rows3,
  Search,
  Sparkles,
  Star,
  TrendingUp,
} from "@/lib/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DEFAULT_AVATAR_CREATOR, DEFAULT_AVATAR_FAN } from "@/lib/image-fallbacks";
import { type Creator } from "@/lib/types";
import { MOCK_CREATORS } from "@/lib/mock-data";
import { PageShell } from "@/components/page-shell";
import { useAuth } from "@/contexts/auth-context";
import { useSkeletonMetric } from "@/hooks/use-skeleton-metric";

type Category = "all" | "trending" | "new" | "top";
type ViewMode = "grid" | "list";

type ExploreCreator = {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatar: string;
  coverImage: string;
  subscriberCount: number;
  postCount: number;
  price: number;
  verified?: boolean;
  isSubscribed?: boolean;
};

const DISCOVER_CATEGORIES: Array<{ id: Category; label: string; icon: React.ReactNode }> = [
  { id: "all", label: "All Creators", icon: <Sparkles className="h-4 w-4" /> },
  { id: "trending", label: "Trending", icon: <TrendingUp className="h-4 w-4" /> },
  { id: "new", label: "New", icon: <Star className="h-4 w-4" /> },
  { id: "top", label: "Top Rated", icon: <Compass className="h-4 w-4" /> },
];

// Cover images for showcase — local assets (no external dependency)
const SHOWCASE_COVERS = [
  "/images/placeholders/post-media-1-pc.jpg",
  "/images/auth/hero-pc.jpg",
  "/behind-the-scenes-studio.jpg",
  "/artistic-creative-work.jpg",
  "/premium-exclusive-content.jpg",
];

const SHOWCASE_CREATORS: ExploreCreator[] = MOCK_CREATORS.map((creator, index) => ({
  id: creator.id,
  name: creator.display_name,
  username: creator.username || creator.display_name.toLowerCase().replace(/\s+/g, "_"),
  bio: creator.bio,
  avatar: creator.avatar_url || DEFAULT_AVATAR_CREATOR,
  coverImage: SHOWCASE_COVERS[index % SHOWCASE_COVERS.length],
  subscriberCount: creator.subscriber_count ?? 0,
  postCount: creator.post_count ?? 0,
  price: 9.99 + index * 2,
  verified: index % 2 === 0,
}));

function formatCount(count: number): string {
  return count.toLocaleString();
}

function mapApiCreator(creator: Creator, index: number): ExploreCreator {
  return {
    id: creator.id,
    name: creator.display_name || "Creator",
    username: (creator.display_name || "creator").replace(/\s+/g, "").toLowerCase(),
    bio: creator.bio || "Exclusive creator content and community updates.",
    avatar: creator.avatar_url || DEFAULT_AVATAR_CREATOR,
    coverImage:
      index % 2 === 0
        ? "/images/placeholders/post-media-1-pc.jpg"
        : "/images/placeholders/post-media-1-mb.jpg",
    subscriberCount: 5000 + index * 1703,
    postCount: 120 + index * 37,
    price: 9.99 + (index % 4) * 2,
    verified: index % 2 === 0,
  };
}

export default function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const initialQuery = searchParams?.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<Category>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [creators, setCreators] = useState<ExploreCreator[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    avatar?: string;
    role: "fan" | "creator";
  } | null>(null);
  useSkeletonMetric("search_page", isUserLoading);

  useEffect(() => {
    if (!auth.authenticated || !auth.user) {
      setCurrentUser({
        username: "guest",
        avatar: DEFAULT_AVATAR_FAN,
        role: "fan",
      });
      setIsUserLoading(false);
      return;
    }

    setCurrentUser({
      username: auth.profile?.display_name || auth.user.email.split("@")[0] || "user",
      avatar: auth.profile?.avatar_url || DEFAULT_AVATAR_FAN,
      role: (auth.profile?.role || "fan") as "fan" | "creator",
    });
    setIsUserLoading(false);
  }, [auth.authenticated, auth.user, auth.profile]);

  const localSearchCreators = (value: string): ExploreCreator[] => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized.length < 2) return [];
    return SHOWCASE_CREATORS.filter((creator) => {
      return (
        creator.name.toLowerCase().includes(normalized) ||
        creator.username.toLowerCase().includes(normalized) ||
        creator.bio.toLowerCase().includes(normalized)
      );
    });
  };

  const performSearch = async (value: string) => {
    const normalized = value.trim();

    // Cancel any in-flight request before starting a new one — without this,
    // a slow earlier keystroke's response could resolve after a faster later
    // one and overwrite the results with stale data (classic type-ahead race).
    searchAbortRef.current?.abort();

    if (!normalized || normalized.length < 2) {
      setIsSearching(false);
      setCreators([]);
      return;
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const localMatches = localSearchCreators(normalized);
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(normalized)}&type=creators`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (data?.success && Array.isArray(data.creators)) {
        const apiCreators = data.creators.map(mapApiCreator);
        const merged = [...apiCreators, ...localMatches];
        const deduped = Array.from(
          new Map(merged.map((creator) => [creator.id, creator])).values()
        );
        setCreators(deduped);
      } else {
        setCreators(localMatches);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setCreators(localMatches);
    } finally {
      if (searchAbortRef.current === controller) {
        setIsSearching(false);
      }
    }
  };

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
    return () => {
      searchAbortRef.current?.abort();
    };
  }, [initialQuery]);

  const hasSearchQuery = query.trim().length >= 2;
  const showEmptyState = hasSearchQuery && !isSearching && creators.length === 0;

  const displayedCreators = useMemo(() => {
    const base = hasSearchQuery ? creators : SHOWCASE_CREATORS;
    if (category === "all") return base;
    if (category === "trending")
      return [...base].sort((a, b) => b.subscriberCount - a.subscriberCount);
    if (category === "new") return [...base].reverse();
    return [...base].sort((a, b) => b.postCount - a.postCount);
  }, [category, creators, hasSearchQuery]);

  const featured = displayedCreators.slice(0, 3);

  if (isUserLoading || !currentUser) {
    return <div className="min-h-dvh bg-bg-base" />;
  }

  return (
    // noPadding: this page owns its own max-w-7xl + padding below — the
    // PageShell default (max-w-4xl + px-4/6) was silently capping it to 896px
    // and double-padding it, so the 3-column featured grid never got the
    // width it was actually designed for.
    <PageShell user={currentUser} noPadding>
      <div className="max-w-7xl mx-auto px-3 md:px-5" data-testid="search-page">
        {/* Hero search section */}
        <section className="py-8 md:py-12 text-center">
          <h1 className="font-serif text-h1 md:text-[32px] text-white mb-2">Discover Creators</h1>
          <p className="text-small text-text-muted mb-6 max-w-md mx-auto">
            Explore exclusive content from talented creators around the world
          </p>

          {/* Search bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              performSearch(query);
              router.push(`/search?q=${encodeURIComponent(query)}`);
            }}
            className="relative max-w-lg mx-auto"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-[14px] text-text-muted pointer-events-none" />
            <input
              data-testid="search-input"
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => {
                  performSearch(val);
                }, 300);
              }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder={isSearchFocused ? "" : "Search creators by nickname..."}
              className="glass-input w-full h-10 pl-9 pr-4 text-small text-white placeholder:text-text-muted"
            />
          </form>

          {isSearching && <p className="mt-2 text-tiny text-text-muted">Searching...</p>}
        </section>

        {/* Featured creators hero (shown when no search) */}
        {!query && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {featured.map((c) => (
              <article
                key={c.id}
                className="relative h-[280px] md:h-[340px] overflow-hidden rounded-[var(--radius-md)] cursor-pointer group"
                onClick={() => router.push(`/creator/${c.id}`)}
              >
                <Image
                  src={c.coverImage}
                  alt={c.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />
                {c.verified && (
                  <div className="absolute top-2.5 right-2.5 size-6 rounded-full bg-[var(--wine)] flex items-center justify-center ">
                    <CheckCircle2 className="size-[12px] text-white" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Avatar className="size-9 ring-1 ring-white/20">
                      <AvatarImage src={c.avatar} />
                      <AvatarFallback>{c.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-small font-bold text-white">{c.name}</p>
                      <p className="text-tiny text-white/60">@{c.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-tiny text-white/60">
                      {formatCount(c.subscriberCount)} subscribers
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/creator/${c.id}`);
                      }}
                      className="h-7 px-3 rounded-full bg-[var(--wine)]/90 text-white text-tiny font-bold hover:bg-[var(--wine)] transition-colors "
                    >
                      ${c.price.toFixed(2)}/mo
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* Filters row */}
        <section className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-2">
            {DISCOVER_CATEGORIES.map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full border text-tiny font-medium transition-[background-color,color,border-color] ${
                    active
                      ? "bg-[var(--wine)] text-white border-transparent"
                      : "bg-white/5 border-white/8 text-text-muted hover:text-white hover:border-[var(--wine)]/40"
                  }`}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/8">
            <button
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={`size-11 flex items-center justify-center rounded-md transition-colors ${viewMode === "grid" ? "bg-[var(--wine)] text-white" : "text-text-muted hover:text-white"}`}
            >
              <Grid3X3 className="size-[13px]" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              className={`size-11 flex items-center justify-center rounded-md transition-colors ${viewMode === "list" ? "bg-[var(--wine)] text-white" : "text-text-muted hover:text-white"}`}
            >
              <Rows3 className="size-[13px]" />
            </button>
          </div>
        </section>

        {/* Empty state */}
        {showEmptyState && (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-testid="search-empty"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Search className="size-7 text-text-muted" />
            </div>
            <p className="text-[15px] font-semibold text-white mb-1">No creators found</p>
            <p className="text-small text-text-muted max-w-xs">
              Try a different nickname to find creators you love.
            </p>
          </div>
        )}

        {/* Creator grid/list */}
        {!showEmptyState && (
          <section
            className={
              viewMode === "grid"
                ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
                : "space-y-2.5"
            }
            data-testid="search-results"
          >
            {displayedCreators.map((c) =>
              viewMode === "grid" ? (
                <article
                  key={`${category}-${c.id}`}
                  className="glass-card rounded-[var(--radius-md)] overflow-hidden cursor-pointer hover:border-[var(--wine)]/30 transition-all group card-interactive"
                  onClick={() => router.push(`/creator/${c.id}`)}
                >
                  <div className="relative h-36 overflow-hidden">
                    <Image
                      src={c.coverImage}
                      alt=""
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
                    {c.verified && (
                      <div className="absolute top-2 right-2 size-5 rounded-full bg-[var(--wine)] flex items-center justify-center">
                        <CheckCircle2 className="size-[10px] text-white" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-2 -mt-5 mb-2">
                      <Avatar className="size-8 ring-2 ring-bg-base">
                        <AvatarImage src={c.avatar} />
                        <AvatarFallback className="text-[10px]">{c.name[0]}</AvatarFallback>
                      </Avatar>
                    </div>
                    <p className="text-tiny font-semibold text-white truncate">{c.name}</p>
                    <p className="text-[10px] text-text-muted mb-1">@{c.username}</p>
                    <p className="text-[10px] text-text-secondary line-clamp-2 mb-2.5">{c.bio}</p>
                    <div className="flex items-center justify-between text-[10px] text-text-muted mb-2.5">
                      <span>{formatCount(c.subscriberCount)} subs</span>
                      <span>{c.postCount} posts</span>
                    </div>
                    <Button
                      variant={c.isSubscribed ? "outline" : "violet"}
                      size="xs"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/creator/${c.id}`);
                      }}
                    >
                      {c.isSubscribed ? "View Profile" : `$${c.price.toFixed(2)}/mo`}
                    </Button>
                  </div>
                </article>
              ) : (
                <article
                  key={`${category}-${c.id}`}
                  className="glass-card rounded-[var(--radius-md)] overflow-hidden flex gap-3 p-3 cursor-pointer hover:border-[var(--wine)]/30 transition-all"
                  onClick={() => router.push(`/creator/${c.id}`)}
                >
                  <Avatar className="size-10 shrink-0 ring-1 ring-[var(--wine)]/20">
                    <AvatarImage src={c.avatar} />
                    <AvatarFallback>{c.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-small font-semibold text-white truncate">{c.name}</p>
                      {c.verified && (
                        <CheckCircle2 className="size-[12px] text-wine-text shrink-0" />
                      )}
                    </div>
                    <p className="text-tiny text-text-muted mb-1">@{c.username}</p>
                    <p className="text-tiny text-text-secondary line-clamp-1">{c.bio}</p>
                    <p className="text-[10px] text-text-muted mt-1">
                      {formatCount(c.subscriberCount)} subscribers · {c.postCount} posts
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <Button
                      variant={c.isSubscribed ? "outline" : "violet"}
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/creator/${c.id}`);
                      }}
                    >
                      {c.isSubscribed ? "View Profile" : `$${c.price.toFixed(2)}/mo`}
                    </Button>
                  </div>
                </article>
              )
            )}
          </section>
        )}
      </div>
    </PageShell>
  );
}
