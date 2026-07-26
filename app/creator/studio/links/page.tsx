"use client";

/**
 * Creator Studio — Public Profile: external links, category & tags manager
 * (Pre-Payment Alpha). Links go through admin review before public display.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { StudioShell } from "@/components/shells/studio-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { EXTERNAL_LINK_ALLOWED_DOMAINS, MAX_LINKS_PER_CREATOR } from "@/lib/external-links";
import { CREATOR_CATEGORIES } from "@/lib/constants/creator-categories";
import { ArrowLeft, ExternalLink, Plus, Trash2, Clock, CheckCircle, X } from "@/lib/icons";

interface LinkRow {
  id: string;
  url: string;
  label: string;
  status: "pending" | "approved" | "rejected";
  click_count: number;
  rejection_reason: string | null;
}

interface TagOption {
  id: string;
  name: string;
}

const CATEGORY_OPTIONS = CREATOR_CATEGORIES;

const STATUS_UI: Record<LinkRow["status"], { className: string; label: string }> = {
  pending: { className: "bg-warning/10 text-warning", label: "In review" },
  approved: { className: "bg-success/10 text-success", label: "Live" },
  rejected: { className: "bg-error/10 text-error", label: "Rejected" },
};

export default function CreatorLinksPage() {
  const router = useRouter();
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);

  const [links, setLinks] = useState<LinkRow[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [category, setCategory] = useState<string>("");
  const [allTags, setAllTags] = useState<TagOption[]>([]);
  const [myTagIds, setMyTagIds] = useState<string[]>([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const loadLinks = useCallback(async () => {
    const res = await fetch("/api/creator/links");
    if (res.ok) {
      const json = await res.json();
      setLinks(json.links ?? []);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        if (!auth.authenticated || !auth.user) {
          router.push("/auth");
          return;
        }
        if (auth.profile?.role !== "creator") {
          router.push("/home");
          return;
        }
        setCurrentUser({
          username: auth.profile?.display_name || "creator",
          role: "creator",
          avatar: auth.profile?.avatar_url || undefined,
        });

        const [, tagsRes, profileRes] = await Promise.all([
          loadLinks(),
          fetch("/api/creator/tags"),
          fetch(`/api/creator/${auth.user.id}`),
        ]);

        if (tagsRes.ok) {
          const json = await tagsRes.json();
          setAllTags(json.allTags ?? []);
          setMyTagIds(json.myTagIds ?? []);
        }
        if (profileRes.ok) {
          const json = await profileRes.json();
          setCategory(json.creator?.category ?? "");
        }
      } catch (err) {
        console.error("[creator/links] load error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [router, loadLinks, auth.authenticated, auth.user, auth.profile]);

  const handleAddLink = async () => {
    if (!newUrl || !newLabel) {
      toast.error("Please fill in both URL and label");
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/creator/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl, label: newLabel }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Link submitted for review");
        setNewUrl("");
        setNewLabel("");
        await loadLinks();
      } else {
        toast.error(json.error || "Failed to submit link");
      }
    } catch {
      toast.error("Failed to submit link");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLink = async (id: string) => {
    try {
      const res = await fetch(`/api/creator/links?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("Link removed");
        setLinks((prev) => prev.filter((l) => l.id !== id));
      } else {
        toast.error(json.error || "Failed to remove link");
      }
    } catch {
      toast.error("Failed to remove link");
    }
  };

  const toggleTag = (tagId: string) => {
    setMyTagIds((prev) => {
      if (prev.includes(tagId)) return prev.filter((id) => id !== tagId);
      if (prev.length >= 5) {
        toast.error("You can pick at most 5 tags");
        return prev;
      }
      return [...prev, tagId];
    });
  };

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);
      const [tagsRes, profileRes] = await Promise.all([
        fetch("/api/creator/tags", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: myTagIds }),
        }),
        fetch("/api/profile/update", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: category || null }),
        }),
      ]);
      const tagsJson = await tagsRes.json();
      const profileJson = await profileRes.json();
      if (tagsJson.success && profileJson.success) {
        toast.success("Profile updated");
      } else {
        toast.error(tagsJson.error || profileJson.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (isLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
        <div className="animate-pulse space-y-6 py-8 mx-auto max-w-3xl">
          <div className="h-10 w-64 bg-surface-raised rounded" />
          <div className="h-48 bg-surface-raised rounded-2xl" />
          <div className="h-64 bg-surface-raised rounded-2xl" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
      <div className="pb-24" data-testid="creator-links-page">
        <StudioShell>
          <div className="mx-auto max-w-3xl">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <Link
                href="/creator/studio"
                className="p-2.5 hover:bg-surface-raised rounded-xl transition-colors active:scale-[0.98]"
              >
                <ArrowLeft size={24} />
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-1">
                  Public Profile & Links
                </h1>
                <p className="text-text-tertiary text-small">
                  Verified external links, category and tags shown on your public profile
                </p>
              </div>
            </div>

            {/* External Links */}
            <div className="card-block p-6 mb-6">
              <h2 className="text-lg font-bold text-text-primary mb-1">External Links</h2>
              <p className="text-small text-text-tertiary mb-4">
                Up to {MAX_LINKS_PER_CREATOR} links. Every link is reviewed by our team before it
                appears on your profile. Allowed:{" "}
                {EXTERNAL_LINK_ALLOWED_DOMAINS.slice(0, 6).join(", ")} and more.
              </p>

              {/* Existing links */}
              {links.length > 0 && (
                <div className="space-y-3 mb-6">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border-base bg-surface-raised"
                    >
                      <ExternalLink size={16} className="text-text-tertiary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-small text-text-primary">
                            {link.label}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-tiny ${STATUS_UI[link.status].className}`}
                          >
                            {STATUS_UI[link.status].label}
                          </Badge>
                          {link.status === "approved" && (
                            <span className="text-tiny text-text-tertiary">
                              {link.click_count} clicks
                            </span>
                          )}
                        </div>
                        <p className="text-tiny text-text-tertiary truncate">{link.url}</p>
                        {link.status === "rejected" && link.rejection_reason && (
                          <p className="text-tiny text-error mt-0.5">
                            Reason: {link.rejection_reason}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteLink(link.id)}
                        aria-label={`Remove link ${link.label}`}
                        className="text-text-tertiary hover:text-error shrink-0"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add link form */}
              {links.length < MAX_LINKS_PER_CREATOR && (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 items-end">
                  <div>
                    <Label htmlFor="link-url" className="text-tiny mb-1.5 block">
                      URL (https only)
                    </Label>
                    <Input
                      id="link-url"
                      placeholder="https://onlyfans.com/yourname"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      data-testid="link-url-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="link-label" className="text-tiny mb-1.5 block">
                      Label
                    </Label>
                    <Input
                      id="link-label"
                      placeholder="My OnlyFans"
                      maxLength={40}
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      data-testid="link-label-input"
                    />
                  </div>
                  <Button
                    onClick={handleAddLink}
                    disabled={isSubmitting}
                    data-testid="link-submit-button"
                    className="gap-1.5"
                  >
                    <Plus size={16} />
                    {isSubmitting ? "Submitting…" : "Submit for review"}
                  </Button>
                </div>
              )}

              <div className="mt-4 flex items-start gap-2 text-tiny text-text-tertiary">
                <Clock size={14} className="shrink-0 mt-0.5" />
                <p>
                  Reviews usually complete within 24 hours. Only links to your own profiles on
                  approved platforms are accepted.
                </p>
              </div>
            </div>

            {/* Category & Tags */}
            <div className="card-block p-6">
              <h2 className="text-lg font-bold text-text-primary mb-1">Category & Tags</h2>
              <p className="text-small text-text-tertiary mb-4">
                Helps fans discover you in the directory and search.
              </p>

              <div className="mb-5">
                <Label className="text-tiny mb-2 block">Primary category</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((option) => (
                    <button
                      key={option}
                      onClick={() => setCategory(category === option ? "" : option)}
                      className={`px-3 py-1.5 rounded-full text-tiny font-medium transition-colors ${
                        category === option
                          ? "bg-brand-primary text-white"
                          : "bg-surface-raised text-text-secondary hover:bg-surface-overlay"
                      }`}
                    >
                      {category === option ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle size={12} /> {option}
                        </span>
                      ) : (
                        option
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <Label className="text-tiny mb-2 block">Tags (up to 5)</Label>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => {
                    const selected = myTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`px-3 py-1.5 rounded-full text-tiny font-medium transition-colors ${
                          selected
                            ? "bg-[var(--wine)] text-white"
                            : "bg-surface-raised text-text-secondary hover:bg-surface-overlay"
                        }`}
                      >
                        {selected ? (
                          <span className="inline-flex items-center gap-1">
                            #{tag.name} <X size={11} />
                          </span>
                        ) : (
                          `#${tag.name}`
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                {isSavingProfile ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </StudioShell>
      </div>
    </PageShell>
  );
}
