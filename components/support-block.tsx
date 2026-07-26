"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SupporterBadge } from "@/components/supporter-badge";
import { Heart } from "@/lib/icons";
import type { PublicTipData } from "@/lib/tips";

interface SupportBlockProps {
  creatorId: string;
  creatorName?: string;
  /** Called when the fan taps the support button — parent opens the TipModal. */
  onTip: () => void;
  /** Hide for the creator viewing their own profile. */
  hidden?: boolean;
  /** Bump this value after a successful tip to refresh goal/supporters. */
  refreshKey?: number;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function SupportBlock({
  creatorId,
  creatorName,
  onTip,
  hidden,
  refreshKey = 0,
}: SupportBlockProps) {
  const [data, setData] = useState<PublicTipData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/creator/${creatorId}/tip-settings`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json?.success) {
          setData({ settings: json.settings, goal: json.goal, supporters: json.supporters ?? [] });
        }
      } catch {
        // silent — block simply won't render
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creatorId, hidden, refreshKey]);

  if (hidden) return null;

  if (loading) {
    return <Skeleton className="h-40 rounded-[var(--radius-md)] w-full" />;
  }

  if (!data || !data.settings.enabled) return null;

  const { settings, goal, supporters } = data;
  const emoji = settings.unit_emoji || "☕";
  const label = settings.unit_label || "coffee";
  const goalPct =
    goal && goal.target_cents > 0
      ? Math.min(100, Math.round((goal.raised_cents / goal.target_cents) * 100))
      : 0;

  return (
    <div
      className="glass-card rounded-[var(--radius-md)] p-5 space-y-4"
      data-testid="support-block"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-white flex items-center gap-2">
            <span aria-hidden className="text-lg leading-none">
              {emoji}
            </span>
            Buy {creatorName ?? "this creator"} a {label}
          </h3>
          <p className="text-tiny text-text-muted mt-1">
            A voluntary thank-you. Not a purchase — final and non-refundable.
          </p>
        </div>
        <Button
          variant="gold"
          size="sm"
          className="rounded-full px-4 gap-1.5 shrink-0 active:scale-[0.98]"
          onClick={onTip}
          aria-label="Support this creator with a tip"
        >
          <Heart size={13} />
          Support
        </Button>
      </div>

      {/* Goal progress */}
      {goal && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-tiny">
            <span className="text-text-secondary font-medium">{goal.title || "Support goal"}</span>
            <span className="text-text-muted">
              ${(goal.raised_cents / 100).toFixed(0)} / ${(goal.target_cents / 100).toFixed(0)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full bg-[var(--premium)] transition-all duration-500"
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <p className="text-tiny text-text-muted text-right">{goalPct}% funded</p>
        </div>
      )}

      {/* Recent supporters */}
      {settings.show_supporters && supporters.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-tiny font-medium text-text-secondary">Recent supporters</p>
          <ul className="space-y-2">
            {supporters.slice(0, 6).map((s, i) => (
              <li key={`${s.created_at}-${i}`} className="flex items-center gap-2.5">
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarImage src={s.avatar_url ?? undefined} alt={s.display_name} />
                  <AvatarFallback className="text-[10px] bg-[var(--premium)]/20 text-[var(--premium)]">
                    {s.display_name[0]?.toUpperCase() ?? "S"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-tiny text-white truncate">{s.display_name}</span>
                    <SupporterBadge iconOnly size={11} />
                  </div>
                  {s.message && <p className="text-tiny text-text-muted truncate">{s.message}</p>}
                </div>
                <span className="text-tiny text-text-muted shrink-0">
                  {formatRelative(s.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
