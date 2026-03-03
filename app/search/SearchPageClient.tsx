"use client";

import { useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
import { useSkeletonMetric } from "@/hooks/use-skeleton-metric";

// Creator cover images — local assets (no external dependency)
const COVER_ELENA = "/images/placeholders/post-media-1-pc.jpg";
const COVER_MAYA = "/images/auth/hero-pc.jpg";
const COVER_ALEX = "/behind-the-scenes-studio.jpg";
const COVER_SOPHIE = "/artistic-creative-work.jpg";
const COVER_DAVID = "/premium-exclusive-content.jpg";
const COVER_LUNA = "/creative-artwork-preview.jpg";

// Creator avatars — local assets
const AVATAR_ELENA = "/professional-woman-creator-avatar.jpg";
const AVATAR_MAYA = "/female-creator-avatar.jpg";
const AVATAR_ALEX = "/male-creator-avatar.jpg";
const AVATAR_SOPHIE = "/artist-creator-avatar.jpg";
const AVATAR_DAVID = "/placeholder-user.jpg";
const AVATAR_LUNA = "/creator-avatar.jpg";

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

const SHOWCASE_CREATORS: ExploreCreator[] = [
  {
    id: "showcase-1",
    name: "Elena Rivers",
    username: "elenarivs",
    bio: "Lifestyle & fashion creator sharing exclusive content and behind-the-scenes moments ✨",
    avatar: AVATAR_ELENA,
    coverImage: COVER_ELENA,
    subscriberCount: 12847,
    postCount: 342,
    price: 14.99,
    verified: true,
  },
  {
    id: "showcase-2",
    name: "Maya Chen",
    username: "mayacres",
    bio: "Digital artist and content creator. Join me for exclusive art tutorials and creative inspiration 🎨",
    avatar: AVATAR_MAYA,
    coverImage: COVER_MAYA,
    subscriberCount: 8234,
    postCount: 186,
    price: 12.99,
    verified: true,
  },
  {
    id: "showcase-3",
    name: "Alex Martinez",
    username: "alexfit",
    bio: "Fitness coach & wellness creator. Premium workout plans and nutrition guides available 💪",
    avatar: AVATAR_ALEX,
    coverImage: COVER_ALEX,
    subscriberCount: 15623,
    postCount: 428,
    price: 19.99,
    verified: true,
  },
  {
    id: "showcase-4",
    name: "Sophie Laurent",
    username: "sophieur",
    bio: "Professional photographer and visual storyteller. Exclusive photo sets and editing tutorials 📷",
    avatar: AVATAR_SOPHIE,
    coverImage: COVER_SOPHIE,
    subscriberCount: 9456,
    postCount: 267,
    price: 11.99,
    isSubscribed: true,
  },
  {
    id: "showcase-5",
    name: "David Kim",
    username: "davidco",
    bio: "Chef & culinary creator. Premium recipes, cooking masterclasses, and kitchen secrets 🍳",
    avatar: AVATAR_DAVID,
    coverImage: COVER_DAVID,
    subscriberCount: 11234,
    postCount: 392,
    price: 13.99,
  },
  {
    id: "showcase-6",
    name: "Luna Rose",
    username: "lunarose",
    bio: "Beauty & wellness expert. Skincare routines, makeup tutorials, and self-care content 💄",
    avatar: AVATAR_LUNA,
    coverImage: COVER_LUNA,
    subscriberCount: 18945,
    postCount: 521,
    price: 15.99,
    verified: true,
  },
];

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
  const initialQuery = searchParams?.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<Category>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isSearching, setIsSearching] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [creators, setCreators] = useState<ExploreCreator[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    avatar?: string;
    role: "fan" | "creator";
  } | null>(null);
  useSkeletonMetric("search_page", isUserLoading);

  useEffect(() => {
    const initUser = async () => {
      try {
        const bootstrap = await getAuthBootstrap();
        if (!bootstrap.authenticated || !bootstrap.user) {
          setCurrentUser({
            username: "guest",
            avatar: DEFAULT_AVATAR_FAN,
            role: "fan",
          });
          return;
        }

        setCurrentUser({
          username: bootstrap.profile?.display_name || bootstrap.user.email.split("@")[0] || "user",
          avatar: bootstrap.profile?.avatar_url || DEFAULT_AVATAR_FAN,
          role: (bootstrap.profile?.role || "fan") as "fan" | "creator",
        });
      } catch {
        setCurrentUser({
          username: "guest",
          avatar: DEFAULT_AVATAR_FAN,
          role: "fan",
        });
      } finally {
        setIsUserLoading(false);
      }
    };
    initUser();
  }, []);

  const performSearch = async (value: string) => {
    if (!value.trim() || value.trim().length < 2) {
      setCreators([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(value)}&type=creators`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.creators)) {
        setCreators(data.creators.map(mapApiCreator));
      } else {
        setCreators([]);
      }
    } catch {
      setCreators([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const displayedCreators = useMemo(() => {
    const base = creators.length > 0 ? creators : SHOWCASE_CREATORS;
    if (category === "all") return base;
    if (category === "trending")
      return [...base].sort((a, b) => b.subscriberCount - a.subscriberCount);
    if (category === "new") return [...base].reverse();
    return [...base].sort((a, b) => b.postCount - a.postCount);
  }, [category, creators]);

  const featured = displayedCreators.slice(0, 3);

  if (isUserLoading || !currentUser) {
    return <div className="min-h-screen bg-bg-base" />;
  }

  return (
    <PageShell user={currentUser}>
      <div className="max-w-5xl mx-auto px-3 md:px-5 pb-16" data-testid="search-page">
        {/* Hero search section */}
        <section className="py-8 md:py-12 text-center">
          <h1 className="font-serif text-h1 md:text-[32px] text-white mb-2">Discover Creators</h1>
          <p className="text-[13px] text-text-muted mb-6 max-w-md mx-auto">
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
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                performSearch(e.target.value);
              }}
              placeholder="Search creators by name or username..."
              className="glass-input w-full h-10 pl-9 pr-4 text-[13px] text-white placeholder:text-text-muted"
            />
          </form>

          {isSearching && <p className="mt-2 text-[11px] text-text-muted">Searching...</p>}
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
                <img
                  src={c.coverImage}
                  alt={c.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />
                {c.verified && (
                  <div className="absolute top-2.5 right-2.5 size-6 rounded-full bg-violet-500 flex items-center justify-center shadow-glow-violet">
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
                      <p className="text-[14px] font-bold text-white">{c.name}</p>
                      <p className="text-[11px] text-white/60">@{c.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/60">
                      {formatCount(c.subscriberCount)} subscribers
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.success(`Subscribed to ${c.name}!`);
                      }}
                      className="h-7 px-3 rounded-full bg-violet-500/90 text-white text-[11px] font-bold hover:bg-violet-500 transition-colors shadow-glow-violet"
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
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium transition-all ${
                    active
                      ? "bg-violet-500 text-white shadow-glow-violet"
                      : "bg-white/5 border border-white/8 text-text-muted hover:text-white hover:border-violet-500/40"
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
              className={`size-7 flex items-center justify-center rounded-md transition-all ${viewMode === "grid" ? "bg-violet-500 text-white" : "text-text-muted hover:text-white"}`}
            >
              <Grid3X3 className="size-[13px]" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`size-7 flex items-center justify-center rounded-md transition-all ${viewMode === "list" ? "bg-violet-500 text-white" : "text-text-muted hover:text-white"}`}
            >
              <Rows3 className="size-[13px]" />
            </button>
          </div>
        </section>

        {/* Creator grid/list */}
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
                className="glass-card rounded-[var(--radius-md)] overflow-hidden cursor-pointer hover:border-violet-500/30 transition-all group card-interactive"
                onClick={() => router.push(`/creator/${c.id}`)}
              >
                <div className="relative h-28 overflow-hidden">
                  <img
                    src={c.coverImage}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
                  {c.verified && (
                    <div className="absolute top-2 right-2 size-5 rounded-full bg-violet-500 flex items-center justify-center">
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
                  <p className="text-[12px] font-semibold text-white truncate">{c.name}</p>
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
                      toast.success(
                        c.isSubscribed ? `Viewing ${c.name}` : `Subscribed to ${c.name}!`
                      );
                    }}
                  >
                    {c.isSubscribed ? "View Profile" : `$${c.price.toFixed(2)}/mo`}
                  </Button>
                </div>
              </article>
            ) : (
              <article
                key={`${category}-${c.id}`}
                className="glass-card rounded-[var(--radius-md)] overflow-hidden flex gap-3 p-3 cursor-pointer hover:border-violet-500/30 transition-all"
                onClick={() => router.push(`/creator/${c.id}`)}
              >
                <Avatar className="size-10 shrink-0 ring-1 ring-violet-500/20">
                  <AvatarImage src={c.avatar} />
                  <AvatarFallback>{c.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-[13px] font-semibold text-white truncate">{c.name}</p>
                    {c.verified && (
                      <CheckCircle2 className="size-[12px] text-violet-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mb-1">@{c.username}</p>
                  <p className="text-[11px] text-text-secondary line-clamp-1">{c.bio}</p>
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
                      toast.success(`Subscribed to ${c.name}!`);
                    }}
                  >
                    {c.isSubscribed ? "Subscribed" : `$${c.price.toFixed(2)}/mo`}
                  </Button>
                </div>
              </article>
            )
          )}
        </section>

        <div className="mt-8 flex justify-center">
          <Button variant="outline" size="sm">
            Load More Creators
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
