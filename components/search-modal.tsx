"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Users, FileText, Loader2, Tag } from "@/lib/icons";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Creator {
  id: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
}

interface Post {
  id: string;
  title?: string;
  content: string;
  creator_id: string;
  profiles?: {
    display_name: string;
    avatar_url?: string;
  };
}

interface TagResult {
  id: string;
  name: string;
  category: string;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [creators, setCreators] = React.useState<Creator[]>([]);
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [tags, setTags] = React.useState<TagResult[]>([]);

  const isTagSearch = query.startsWith("#");

  React.useEffect(() => {
    if (!query || query.trim().length < 2) {
      setCreators([]);
      setPosts([]);
      setTags([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (isTagSearch) {
          const tagQuery = query.slice(1).trim();
          if (tagQuery.length > 0) {
            const response = await fetch(`/api/tags`);
            const data = await response.json();
            if (data.success && data.tags) {
              const matchingTags = data.tags.filter((tag: TagResult) =>
                tag.name.toLowerCase().includes(tagQuery.toLowerCase())
              );
              setTags(matchingTags);
            }
          }
          setCreators([]);
          setPosts([]);
        } else {
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=all`);
          const data = await response.json();
          if (data.success) {
            setCreators(data.creators || []);
            setPosts(data.posts || []);
          }
          setTags([]);
        }
      } catch (err) {
        console.error("[search-modal] Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isTagSearch]);

  const handleSelectCreator = (creatorId: string) => {
    onOpenChange(false);
    router.push(`/creator/${creatorId}`);
  };

  const handleSelectPost = (postId: string) => {
    onOpenChange(false);
    router.push(`/posts/${postId}`);
  };

  const handleSelectTag = (tagName: string) => {
    onOpenChange(false);
    router.push(`/tags/${encodeURIComponent(tagName)}`);
  };

  const handleViewAll = () => {
    onOpenChange(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const hasResults = creators.length > 0 || posts.length > 0 || tags.length > 0;
  const showDualColumn = creators.length > 0 && posts.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search for creators and content"
    >
      <div data-testid="search-modal">
        <CommandInput
          placeholder="Search creators, posts… or #tag"
          value={query}
          onValueChange={setQuery}
          data-testid="search-input"
          aria-label="Search GetFanSee"
        />
        <CommandList
          className={showDualColumn ? "md:grid md:grid-cols-2 md:max-h-[480px]" : undefined}
        >
          {/* Loading */}
          {isSearching && (
            <div className="flex items-center justify-center py-8 col-span-2">
              <Loader2
                className="h-6 w-6 animate-spin text-brand-primary"
                aria-label="Searching…"
              />
            </div>
          )}

          {/* Empty — no results */}
          {!isSearching && query.length >= 2 && !hasResults && (
            <CommandEmpty className="py-12 col-span-2">
              <div className="flex flex-col items-center gap-3">
                <Search className="h-10 w-10 text-text-tertiary" aria-hidden="true" />
                <p className="text-sm font-medium text-text-primary">No results found</p>
                <p className="text-xs text-text-tertiary text-center max-w-sm">
                  No results for &quot;{query}&quot;. Try a different term or browse creators.
                </p>
              </div>
            </CommandEmpty>
          )}

          {/* Initial prompt */}
          {!isSearching && query.length < 2 && (
            <CommandEmpty className="py-12 col-span-2">
              <div className="flex flex-col items-center gap-3">
                <Search className="h-10 w-10 text-text-tertiary" aria-hidden="true" />
                <p className="text-sm font-medium text-text-primary">Start searching</p>
                <p className="text-xs text-text-tertiary text-center max-w-sm">
                  Type at least 2 characters. Use{" "}
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-surface-raised rounded border border-border-base">
                    #
                  </kbd>{" "}
                  to search tags.
                </p>
              </div>
            </CommandEmpty>
          )}

          {/* Tags */}
          {!isSearching && tags.length > 0 && (
            <CommandGroup heading="Tags" className="col-span-2">
              {tags.slice(0, 8).map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={`tag-${tag.id}`}
                  onSelect={() => handleSelectTag(tag.name)}
                  className="cursor-pointer hover:bg-brand-primary/5 active:scale-[0.98] transition-all rounded-lg"
                  data-testid="search-result-tag"
                  aria-label={`Search tag #${tag.name}`}
                >
                  <Tag className="h-4 w-4 mr-2 text-text-tertiary" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary">#{tag.name}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-xs ml-2 bg-surface-raised text-text-tertiary"
                  >
                    {tag.category}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Creators — left column on desktop when dual-column */}
          {!isSearching && creators.length > 0 && (
            <CommandGroup heading="Creators">
              {creators.slice(0, 5).map((creator) => (
                <CommandItem
                  key={creator.id}
                  value={`creator-${creator.id}`}
                  onSelect={() => handleSelectCreator(creator.id)}
                  className="cursor-pointer hover:bg-brand-primary/5 active:scale-[0.98] transition-all rounded-lg"
                  data-testid="search-result-creator"
                  aria-label={`View ${creator.display_name}'s profile`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="ring-2 ring-transparent hover:ring-brand-primary/30 transition-all rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={creator.avatar_url || undefined}
                          alt={creator.display_name}
                        />
                        <AvatarFallback className="bg-brand-primary/10 text-brand-primary text-xs">
                          {creator.display_name?.[0]?.toUpperCase() || "C"}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-text-primary">
                        {creator.display_name}
                      </p>
                      {creator.bio && (
                        <p className="text-xs text-text-tertiary truncate">{creator.bio}</p>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-xs ml-2 shrink-0 bg-surface-raised text-text-tertiary"
                    >
                      <Users className="h-3 w-3 mr-1" aria-hidden="true" />
                      Creator
                    </Badge>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Posts — right column on desktop when dual-column */}
          {!isSearching && posts.length > 0 && (
            <CommandGroup heading="Posts">
              {posts.slice(0, 5).map((post) => (
                <CommandItem
                  key={post.id}
                  value={`post-${post.id}`}
                  onSelect={() => handleSelectPost(post.id)}
                  className="cursor-pointer hover:bg-brand-primary/5 active:scale-[0.98] transition-all rounded-lg"
                  aria-label={`View post: ${post.title || post.content.substring(0, 40)}`}
                >
                  <FileText
                    className="h-4 w-4 mr-2 text-text-tertiary shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-text-primary">
                      {post.title || post.content.substring(0, 50)}
                    </p>
                    <p className="text-xs text-text-tertiary truncate">
                      by {post.profiles?.display_name || "Creator"}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* View all — always shown when query is long enough */}
          {!isSearching && query.length >= 2 && (
            <CommandGroup className={showDualColumn ? "col-span-2" : undefined}>
              <CommandItem
                value="view-all"
                onSelect={handleViewAll}
                className="cursor-pointer justify-center text-brand-primary hover:bg-brand-primary/5 active:scale-[0.98] transition-all rounded-lg"
                aria-label={`View all results for ${query}`}
              >
                <Search className="h-4 w-4 mr-2" aria-hidden="true" />
                See all results for &quot;{query}&quot;
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </div>
    </CommandDialog>
  );
}
