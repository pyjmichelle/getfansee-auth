"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Users, FileText, Loader2, Tag } from "lucide-react";
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

  // Check if searching for tags
  const isTagSearch = query.startsWith("#");

  // Debounced search
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
        // If searching for tags (starts with #)
        if (isTagSearch) {
          const tagQuery = query.slice(1).trim();
          if (tagQuery.length > 0) {
            const response = await fetch(`/api/tags`);
            const data = await response.json();
            if (data.success && data.tags) {
              // Filter tags by name match
              const matchingTags = data.tags.filter((tag: TagResult) =>
                tag.name.toLowerCase().includes(tagQuery.toLowerCase())
              );
              setTags(matchingTags);
            }
          }
          setCreators([]);
          setPosts([]);
        } else {
          // Regular search
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

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search for creators and content"
    >
      <div data-testid="search-modal">
        <CommandInput
          placeholder="Search creators, posts..."
          value={query}
          onValueChange={setQuery}
          data-testid="search-input"
        />
        <CommandList>
          {isSearching && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isSearching &&
            query.length >= 2 &&
            creators.length === 0 &&
            posts.length === 0 &&
            tags.length === 0 && <CommandEmpty>No results found for "{query}"</CommandEmpty>}

          {!isSearching && tags.length > 0 && (
            <CommandGroup heading="Tags">
              {tags.slice(0, 8).map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={`tag-${tag.id}`}
                  onSelect={() => handleSelectTag(tag.name)}
                  className="cursor-pointer"
                  data-testid="search-result-tag"
                >
                  <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">#{tag.name}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs ml-2">
                    {tag.category}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!isSearching && query.length < 2 && (
            <CommandEmpty>Type at least 2 characters to search</CommandEmpty>
          )}

          {!isSearching && creators.length > 0 && (
            <CommandGroup heading="Creators">
              {creators.slice(0, 5).map((creator) => (
                <CommandItem
                  key={creator.id}
                  value={`creator-${creator.id}`}
                  onSelect={() => handleSelectCreator(creator.id)}
                  className="cursor-pointer"
                  data-testid="search-result-creator"
                >
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarImage src={creator.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {creator.display_name?.[0]?.toUpperCase() || "C"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{creator.display_name}</p>
                    {creator.bio && (
                      <p className="text-xs text-muted-foreground truncate">{creator.bio}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs ml-2">
                    <Users className="h-3 w-3 mr-1" />
                    Creator
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!isSearching && posts.length > 0 && (
            <CommandGroup heading="Posts">
              {posts.slice(0, 5).map((post) => (
                <CommandItem
                  key={post.id}
                  value={`post-${post.id}`}
                  onSelect={() => handleSelectPost(post.id)}
                  className="cursor-pointer"
                >
                  <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {post.title || post.content.substring(0, 50)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      by {post.profiles?.display_name || "Creator"}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!isSearching && query.length >= 2 && (creators.length > 0 || posts.length > 0) && (
            <CommandGroup>
              <CommandItem
                value="view-all"
                onSelect={handleViewAll}
                className="cursor-pointer justify-center text-primary"
              >
                <Search className="h-4 w-4 mr-2" />
                View all results for "{query}"
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </div>
    </CommandDialog>
  );
}
