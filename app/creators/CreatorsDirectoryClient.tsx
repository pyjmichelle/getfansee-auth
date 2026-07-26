"use client";

/**
 * Public creator directory (Pre-Payment Alpha discovery).
 *
 * - Category chips + tag filters + Featured/Trending/New sort
 * - First-visit preference quiz (tag picker) → default tag filter +
 *   recommendation cold start; stored locally, tracked via Analytics.
 * - Guests can browse; follow/save live on the profile page.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FoundingCreatorBadge } from "@/components/founding-creator-badge";
import { VerifiedBadge } from "@/components/verified-badge";
import { ErrorState } from "@/components/error-state";
import { CREATOR_CATEGORIES } from "@/lib/constants/creator-categories";
import { DEFAULT_AVATAR_CREATOR } from "@/lib/image-fallbacks";
import { useAuth } from "@/contexts/auth-context";
import { Analytics } from "@/lib/analytics";
import { Users, FileText, Sparkles, X } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface DirectoryCreator {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  is_founding_creator: boolean;
  category: string | null;
  tags: { name: string; slug: string }[];
  follower_count: number;
  post_count: number;
}

interface TagOption {
  name: string;
  slug: string;
}

type Sort = "featured" | "trending" | "newest";

const PREF_TAGS_KEY = "gfs_pref_tags";
const QUIZ_DISMISSED_KEY = "gfs_pref_quiz_dismissed";

const SORT_TABS: { value: Sort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "trending", label: "Trending" },
  { value: "newest", label: "New" },
];

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

export default function CreatorsDirectoryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();

  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creators, setCreators] = useState<DirectoryCreator[]>([]);
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);

  const [category, setCategory] = useState<string>(searchParams?.get("category") || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    (searchParams?.get("tags") || "").split(",").filter(Boolean)
  );
  const [sort, setSort] = useState<Sort>("featured");

  // Preference quiz state
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizPicks, setQuizPicks] = useState<string[]>([]);

  useEffect(() => {
    if (auth.profile) {
      setCurrentUser({
        username: auth.profile.display_name || "user",
        role: (auth.profile.role || "fan") as "fan" | "creator",
        avatar: auth.profile.avatar_url || undefined,
      });
    }
  }, [auth.profile]);

  // First visit: apply saved preference tags, or offer the quiz.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PREF_TAGS_KEY);
      if (saved) {
        const tags = JSON.parse(saved) as string[];
        if (Array.isArray(tags) && tags.length > 0 && selectedTags.length === 0) {
          setSelectedTags(tags.filter((tag) => typeof tag === "string"));
        }
        return;
      }
      if (!window.localStorage.getItem(QUIZ_DISMISSED_KEY) && selectedTags.length === 0) {
        setShowQuiz(true);
      }
    } catch {
      // localStorage unavailable — skip quiz persistence.
    }
  }, []);

  const loadCreators = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
      params.set("sort", sort);

      const response = await fetch(`/api/creators/directory?${params.toString()}`);
      const data = response.ok ? await response.json() : null;
      if (data?.success) {
        setCreators(data.creators || []);
        setAvailableTags(data.availableTags || []);
      } else {
        setLoadError("Failed to load creators. Please try again.");
      }
    } catch (err) {
      console.error("[CreatorsDirectory] load error:", err);
      setLoadError("Failed to load creators. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [category, selectedTags, sort]);

  useEffect(() => {
    loadCreators();
  }, [loadCreators]);

  const toggleTag = (slug: string) => {
    setSelectedTags((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
    Analytics.track("directory_tag_filtered", { tag: slug });
  };

  const completeQuiz = () => {
    try {
      window.localStorage.setItem(PREF_TAGS_KEY, JSON.stringify(quizPicks));
      window.localStorage.setItem(QUIZ_DISMISSED_KEY, "1");
    } catch {
      // ignore persistence failure
    }
    if (quizPicks.length > 0) {
      setSelectedTags(quizPicks);
    }
    setShowQuiz(false);
    Analytics.track("preference_quiz_completed", { tags: quizPicks, count: quizPicks.length });
  };

  const dismissQuiz = () => {
    try {
      window.localStorage.setItem(QUIZ_DISMISSED_KEY, "1");
    } catch {
      // ignore persistence failure
    }
    setShowQuiz(false);
    Analytics.track("preference_quiz_dismissed");
  };

  const hasFilters = !!category || selectedTags.length > 0;

  const quizTagOptions = useMemo(() => availableTags.slice(0, 12), [availableTags]);

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
      <div className="section-block py-6 sm:py-8 lg:py-12">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-2">
            Discover Creators
          </h1>
          <p className="text-text-secondary">
            Verified creators you&apos;ll actually want to follow. Browse by category, filter by
            what you&apos;re into.
          </p>
        </div>

        {/* Preference quiz (first visit) */}
        {showQuiz && quizTagOptions.length > 0 && (
          <div
            className="card-block bg-gradient-subtle p-5 md:p-6 mb-8 relative"
            data-testid="preference-quiz"
          >
            <button
              onClick={dismissQuiz}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors"
              aria-label="Dismiss preferences quiz"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-wine-text" />
              <h2 className="font-semibold text-text-primary">What are you into?</h2>
            </div>
            <p className="text-small text-text-secondary mb-4">
              Pick a few interests and we&apos;ll tailor the directory for you.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {quizTagOptions.map((tag) => {
                const picked = quizPicks.includes(tag.slug);
                return (
                  <button
                    key={tag.slug}
                    onClick={() =>
                      setQuizPicks((prev) =>
                        picked ? prev.filter((s) => s !== tag.slug) : [...prev, tag.slug]
                      )
                    }
                    className={cn(
                      "px-3 py-1.5 rounded-full text-small border transition-colors min-h-11",
                      picked
                        ? "bg-brand-primary text-white border-brand-primary"
                        : "bg-surface-raised text-text-secondary border-border-subtle hover:border-brand-primary/50"
                    )}
                    aria-pressed={picked}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
            <Button
              size="sm"
              onClick={completeQuiz}
              className="bg-brand-primary text-white"
              data-testid="preference-quiz-save"
            >
              {quizPicks.length > 0 ? `Show me these (${quizPicks.length})` : "Skip for now"}
            </Button>
          </div>
        )}

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1" role="tablist">
          <button
            onClick={() => setCategory("")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-small whitespace-nowrap border transition-colors min-h-11",
              !category
                ? "bg-brand-primary text-white border-brand-primary"
                : "bg-surface-raised text-text-secondary border-border-subtle hover:border-brand-primary/50"
            )}
            role="tab"
            aria-selected={!category}
          >
            All
          </button>
          {CREATOR_CATEGORIES.map((option) => (
            <button
              key={option}
              onClick={() => setCategory(category === option ? "" : option)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-small whitespace-nowrap border transition-colors min-h-11",
                category === option
                  ? "bg-brand-primary text-white border-brand-primary"
                  : "bg-surface-raised text-text-secondary border-border-subtle hover:border-brand-primary/50"
              )}
              role="tab"
              aria-selected={category === option}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Tag filters */}
        {availableTags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
            {availableTags.map((tag) => {
              const active = selectedTags.includes(tag.slug);
              return (
                <button
                  key={tag.slug}
                  onClick={() => toggleTag(tag.slug)}
                  className={cn(
                    // font-medium is applied unconditionally (not just when
                    // active) — toggling it on/off shifted the character
                    // width of every tag label, nudging neighboring chips
                    // sideways on every click.
                    "px-3 py-1 rounded-full text-tiny font-medium whitespace-nowrap border transition-colors min-h-11",
                    active
                      ? "bg-brand-primary/15 text-wine-text border-brand-primary/50"
                      : "bg-transparent text-text-tertiary border-border-subtle hover:text-text-secondary"
                  )}
                  aria-pressed={active}
                >
                  #{tag.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Sort tabs + result meta */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-surface-raised rounded-lg p-1">
            {SORT_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setSort(tab.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-small font-medium transition-colors min-h-11",
                  sort === tab.value
                    ? "bg-background text-text-primary shadow-sm"
                    : "text-text-tertiary hover:text-text-secondary"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCategory("");
                setSelectedTags([]);
              }}
              className="text-text-tertiary"
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse"
            data-testid="creators-grid-loading"
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-40 bg-surface-raised rounded-xl" />
            ))}
          </div>
        ) : loadError ? (
          <ErrorState
            variant="centered"
            title="Couldn't load creators"
            message={loadError}
            retry={loadCreators}
            className="card-block"
          />
        ) : creators.length === 0 ? (
          <div className="card-block text-center py-16" data-testid="creators-empty">
            <Users className="w-12 h-12 mx-auto mb-4 text-text-tertiary/50" />
            <h3 className="text-lg font-medium text-text-primary mb-2">No creators found</h3>
            <p className="text-text-secondary mb-6">
              {hasFilters
                ? "Try removing some filters to see more creators."
                : "Creators are joining during Alpha — check back soon."}
            </p>
            {hasFilters && (
              <Button
                onClick={() => {
                  setCategory("");
                  setSelectedTags([]);
                }}
                className="bg-brand-primary text-white"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            data-testid="creators-grid"
          >
            {creators.map((creator, index) => (
              <Link
                key={creator.id}
                href={`/creator/${creator.id}`}
                onClick={() =>
                  Analytics.track("directory_creator_clicked", { creator_id: creator.id })
                }
              >
                <article
                  className="card-block p-5 hover-bold h-full animate-profile-reveal"
                  style={{ animationDelay: `${Math.min(index, 12) * 50}ms` }}
                  data-testid="creator-directory-card"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar className="w-14 h-14 shrink-0">
                      <AvatarImage
                        src={creator.avatar_url || DEFAULT_AVATAR_CREATOR}
                        alt={creator.display_name || "Creator"}
                      />
                      <AvatarFallback className="bg-brand-primary/10 text-wine-text text-lg">
                        {(creator.display_name?.[0] || "C").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-text-primary truncate">
                          {creator.display_name || "Creator"}
                        </span>
                        {creator.is_verified && <VerifiedBadge size={15} />}
                        {creator.is_founding_creator && <FoundingCreatorBadge size={14} />}
                      </div>
                      {creator.category && (
                        <Badge variant="secondary" className="mt-1 text-tiny">
                          {creator.category}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {creator.bio && (
                    <p className="text-small text-text-secondary line-clamp-2 mb-3">
                      {creator.bio}
                    </p>
                  )}

                  {creator.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {creator.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag.slug}
                          className="text-tiny text-text-tertiary bg-surface-raised px-2 py-0.5 rounded-full"
                        >
                          #{tag.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-tiny text-text-tertiary mt-auto">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {formatCount(creator.follower_count)} followers
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {formatCount(creator.post_count)} posts
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {/* Creator CTA */}
        {!isLoading && (
          <div className="card-block bg-gradient-subtle p-6 mt-10 text-center">
            <h2 className="text-lg font-semibold text-text-primary mb-1">Are you a creator?</h2>
            <p className="text-small text-text-secondary mb-4">
              Join during Alpha to become a Founding Creator — permanent badge and 0% platform
              commission when payments launch.
            </p>
            <Button
              onClick={() => router.push("/creator/upgrade")}
              className="bg-brand-primary text-white shadow-glow hover-bold"
            >
              Become a Creator
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
