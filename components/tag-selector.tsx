"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  slug: string;
  category: string;
}

interface TagSelectorProps {
  category: "content" | "creator";
  selectedTags: string[]; // tag IDs
  onChange: (tagIds: string[]) => void;
  maxTags?: number;
}

export function TagSelector({ category, selectedTags, onChange, maxTags = 5 }: TagSelectorProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const response = await fetch(`/api/tags?category=${category}`);
        const data = await response.json();

        if (data.success) {
          setAvailableTags(data.tags || []);
        }
      } catch (err) {
        console.error("[TagSelector] Load tags error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTags();
  }, [category]);

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      // 移除标签
      onChange(selectedTags.filter((id) => id !== tagId));
    } else {
      // 添加标签（检查最大数量）
      if (selectedTags.length < maxTags) {
        onChange([...selectedTags, tagId]);
      }
    }
  };

  const getTagName = (tagId: string) => {
    return availableTags.find((tag) => tag.id === tagId)?.name || "";
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading tags...</p>;
  }

  return (
    <div className="space-y-3">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tagId) => (
            <Badge key={tagId} variant="secondary" className="px-3 py-1">
              {getTagName(tagId)}
              <button
                type="button"
                onClick={() => toggleTag(tagId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleTag(tagId);
                  }
                }}
                className="ml-2 hover:text-destructive min-h-[20px] min-w-[20px]"
                aria-label={`Remove tag ${getTagName(tagId)}`}
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Available Tags */}
      <div className="flex flex-wrap gap-2">
        {availableTags
          .filter((tag) => !selectedTags.includes(tag.id))
          .map((tag) => (
            <Button
              key={tag.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleTag(tag.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (selectedTags.length < maxTags) {
                    toggleTag(tag.id);
                  }
                }
              }}
              disabled={selectedTags.length >= maxTags}
              className="h-8 min-h-[32px]"
              aria-label={`Add tag ${tag.name}`}
              aria-disabled={selectedTags.length >= maxTags}
            >
              {tag.name}
            </Button>
          ))}
      </div>

      {selectedTags.length >= maxTags && (
        <p className="text-xs text-muted-foreground">Maximum {maxTags} tags selected</p>
      )}
    </div>
  );
}
