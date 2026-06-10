"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  DollarSign,
  Users,
  Plus,
  BarChart3,
  FileText,
  Heart,
  AlertTriangle,
  Loader2,
} from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
import {
  DEFAULT_TIP_SETTINGS,
  looksLikeQuidProQuo,
  THANK_YOU_MAX,
  UNIT_LABEL_MAX,
  GOAL_TITLE_MAX,
  type CreatorTipSettings,
} from "@/lib/tips";
import { PLATFORM_TIP_FEE_BPS } from "@/lib/constants/fees";

const FEE_PERCENT = (PLATFORM_TIP_FEE_BPS / 100).toString();

const STUDIO_NAV = [
  { href: "/creator/new-post", icon: Plus, label: "Create Post" },
  { href: "/creator/studio/earnings", icon: DollarSign, label: "Earnings" },
  { href: "/creator/studio/subscribers", icon: Users, label: "Subscribers" },
  { href: "/creator/studio/tips", icon: Heart, label: "Tips" },
  { href: "/creator/studio/post/list", icon: FileText, label: "Post List" },
  { href: "/creator/studio/analytics", icon: BarChart3, label: "Analytics" },
];

function centsToDollarStr(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export default function CreatorTipSettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);

  // Form state
  const [enabled, setEnabled] = useState(DEFAULT_TIP_SETTINGS.enabled);
  const [unitLabel, setUnitLabel] = useState(DEFAULT_TIP_SETTINGS.unit_label);
  const [unitEmoji, setUnitEmoji] = useState(DEFAULT_TIP_SETTINGS.unit_emoji);
  const [presetStrs, setPresetStrs] = useState<string[]>(
    DEFAULT_TIP_SETTINGS.preset_amounts_cents.map(centsToDollarStr)
  );
  const [thankYou, setThankYou] = useState("");
  const [goalEnabled, setGoalEnabled] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTargetStr, setGoalTargetStr] = useState("");
  const [showSupporters, setShowSupporters] = useState(true);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const bootstrap = await getAuthBootstrap();
        if (!bootstrap.authenticated || !bootstrap.user) {
          router.push("/auth");
          return;
        }
        if (bootstrap.profile?.role !== "creator") {
          router.push("/home");
          return;
        }
        setCurrentUser({
          username: bootstrap.profile?.display_name || "creator",
          role: "creator",
          avatar: bootstrap.profile?.avatar_url || undefined,
        });

        const res = await fetch("/api/creator/tip-settings");
        if (res.ok) {
          const data = await res.json();
          const s: CreatorTipSettings = data.settings ?? DEFAULT_TIP_SETTINGS;
          setEnabled(s.enabled);
          setUnitLabel(s.unit_label);
          setUnitEmoji(s.unit_emoji);
          setPresetStrs(
            (s.preset_amounts_cents?.length
              ? s.preset_amounts_cents
              : DEFAULT_TIP_SETTINGS.preset_amounts_cents
            ).map(centsToDollarStr)
          );
          setThankYou(s.thank_you_message ?? "");
          setGoalEnabled(s.goal_enabled);
          setGoalTitle(s.goal_title ?? "");
          setGoalTargetStr(s.goal_target_cents ? centsToDollarStr(s.goal_target_cents) : "");
          setShowSupporters(s.show_supporters);
        }
      } catch (err) {
        console.error("[tip-settings page] load error", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [router]);

  const thankYouWarning = looksLikeQuidProQuo(thankYou);

  const handlePresetChange = (idx: number, val: string) => {
    setPresetStrs((prev) => prev.map((p, i) => (i === idx ? val : p)));
  };

  const handleSave = async () => {
    if (!agreed) {
      toast.error("Please confirm the tipping rules before saving.");
      return;
    }

    // Parse presets → cents
    const presetCents: number[] = [];
    for (const s of presetStrs) {
      const n = parseFloat(s);
      if (isNaN(n) || n <= 0) {
        toast.error("Each preset amount must be a positive number.");
        return;
      }
      const cents = Math.round(n * 100);
      if (cents < 100 || cents > 50_000) {
        toast.error("Preset amounts must be between $1 and $500.");
        return;
      }
      presetCents.push(cents);
    }
    if (presetCents.length === 0) {
      toast.error("Add at least one preset amount.");
      return;
    }

    let goalTargetCents: number | null = null;
    if (goalEnabled) {
      const g = parseFloat(goalTargetStr);
      if (isNaN(g) || g <= 0) {
        toast.error("Set a positive goal target amount.");
        return;
      }
      goalTargetCents = Math.round(g * 100);
    }

    setSaving(true);
    try {
      const res = await fetch("/api/creator/tip-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          unit_label: unitLabel,
          unit_emoji: unitEmoji,
          preset_amounts_cents: presetCents,
          thank_you_message: thankYou.trim() || null,
          goal_enabled: goalEnabled,
          goal_title: goalEnabled ? goalTitle.trim() || null : null,
          goal_target_cents: goalTargetCents,
          show_supporters: showSupporters,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.warning) {
          toast.warning(data.warning);
        } else {
          toast.success("Tip settings saved.");
        }
      } else {
        toast.error(data.error ?? "Failed to save settings.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="5xl">
        <div className="pb-24 animate-pulse space-y-6">
          <div className="h-10 w-48 bg-surface-raised rounded" />
          <div className="h-64 bg-surface-raised rounded-2xl" />
          <div className="h-48 bg-surface-raised rounded-2xl" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="5xl">
      <div className="pb-24 flex flex-col lg:flex-row gap-8">
        <main className="flex-1 min-w-0 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link
              href="/creator/studio"
              className="p-2.5 hover:bg-surface-raised rounded-xl transition-colors active:scale-95"
              aria-label="Back to studio"
            >
              <ArrowLeft size={22} />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-text-primary flex items-center gap-2">
                <Heart size={22} className="text-amber-400" />
                Tips / Buy me a coffee
              </h1>
              <p className="text-text-tertiary text-sm mt-1">
                Customize how fans send you one-off appreciation tips.
              </p>
            </div>
          </div>

          {/* Compliance notice */}
          <div className="card-block p-4 bg-amber-500/5 border border-amber-500/20 flex gap-3">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-text-secondary space-y-1">
              <p className="font-medium text-text-primary">Tips are voluntary gratuities</p>
              <p>
                A tip is a thank-you, not a sale. You may <strong>not</strong> promise content,
                services, DMs, or any reward in exchange for a tip. The platform retains a{" "}
                {FEE_PERCENT}% service fee; the rest is credited to your pending balance.
              </p>
            </div>
          </div>

          {/* Enable toggle */}
          <div className="card-block p-5 flex items-center justify-between">
            <div>
              <Label className="text-text-primary font-semibold">Accept tips</Label>
              <p className="text-sm text-text-tertiary mt-0.5">
                Show the tip / support panel on your profile and posts.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Accept tips" />
          </div>

          {/* Appearance */}
          <div className="card-block p-5 space-y-4">
            <h2 className="font-semibold text-text-primary">Panel appearance</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label htmlFor="unit-label" className="text-sm text-text-secondary">
                  Unit label
                </Label>
                <Input
                  id="unit-label"
                  value={unitLabel}
                  maxLength={UNIT_LABEL_MAX}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  placeholder="coffee"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="unit-emoji" className="text-sm text-text-secondary">
                  Emoji
                </Label>
                <Input
                  id="unit-emoji"
                  value={unitEmoji}
                  maxLength={8}
                  onChange={(e) => setUnitEmoji(e.target.value)}
                  placeholder="☕"
                  className="mt-1 text-center"
                />
              </div>
            </div>
            <p className="text-xs text-text-tertiary">
              Preview: Buy {currentUser?.username || "you"} a {unitLabel || "coffee"} {unitEmoji}
            </p>
          </div>

          {/* Preset amounts */}
          <div className="card-block p-5 space-y-4">
            <h2 className="font-semibold text-text-primary">Preset amounts (USD)</h2>
            <div className="grid grid-cols-4 gap-3">
              {presetStrs.map((val, idx) => (
                <div key={idx} className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                    $
                  </span>
                  <Input
                    type="number"
                    min="1"
                    max="500"
                    value={val}
                    onChange={(e) => handlePresetChange(idx, e.target.value)}
                    className="pl-7"
                    aria-label={`Preset amount ${idx + 1}`}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-text-tertiary">
              Fans can also enter a custom amount ($1–$500).
            </p>
          </div>

          {/* Thank-you message */}
          <div className="card-block p-5 space-y-3">
            <h2 className="font-semibold text-text-primary">Thank-you message</h2>
            <Textarea
              value={thankYou}
              maxLength={THANK_YOU_MAX}
              onChange={(e) => setThankYou(e.target.value)}
              rows={3}
              placeholder="Thanks so much for the support — it means the world!"
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-tertiary">
                Shown to fans after they tip. Keep it a genuine thank-you.
              </p>
              <span className="text-xs text-text-muted">
                {thankYou.length}/{THANK_YOU_MAX}
              </span>
            </div>
            {thankYouWarning && (
              <div className="flex gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg p-2.5">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  This message looks like it promises something in exchange for a tip. Tips must
                  stay voluntary — remove any quid-pro-quo wording or it may be removed.
                </span>
              </div>
            )}
          </div>

          {/* Goal */}
          <div className="card-block p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-text-primary font-semibold">Support goal</Label>
                <p className="text-sm text-text-tertiary mt-0.5">
                  Show a progress bar toward a funding goal.
                </p>
              </div>
              <Switch
                checked={goalEnabled}
                onCheckedChange={setGoalEnabled}
                aria-label="Enable support goal"
              />
            </div>
            {goalEnabled && (
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="goal-title" className="text-sm text-text-secondary">
                    Goal title
                  </Label>
                  <Input
                    id="goal-title"
                    value={goalTitle}
                    maxLength={GOAL_TITLE_MAX}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    placeholder="New camera fund"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="goal-target" className="text-sm text-text-secondary">
                    Target ($)
                  </Label>
                  <Input
                    id="goal-target"
                    type="number"
                    min="1"
                    value={goalTargetStr}
                    onChange={(e) => setGoalTargetStr(e.target.value)}
                    placeholder="500"
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Supporters visibility */}
          <div className="card-block p-5 flex items-center justify-between">
            <div>
              <Label className="text-text-primary font-semibold">Show recent supporters</Label>
              <p className="text-sm text-text-tertiary mt-0.5">
                Display a list of fans who recently tipped you.
              </p>
            </div>
            <Switch
              checked={showSupporters}
              onCheckedChange={setShowSupporters}
              aria-label="Show recent supporters"
            />
          </div>

          {/* Confirmation + save */}
          <div className="card-block p-5 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-text-secondary">
                I understand tips are voluntary gratuities. I will not promise any content, service,
                message, or reward in exchange for a tip, and I agree to the{" "}
                <Link
                  href="/acceptable-use"
                  className="text-brand-primary underline"
                  target="_blank"
                >
                  Acceptable Use Policy
                </Link>{" "}
                and{" "}
                <Link href="/terms" className="text-brand-primary underline" target="_blank">
                  Terms of Service
                </Link>
                .
              </span>
            </label>
            <Button
              variant="subscribe-gradient"
              className="w-full md:w-auto px-8"
              disabled={!agreed || saving}
              onClick={handleSave}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save settings"
              )}
            </Button>
          </div>
        </main>

        {/* Sidebar nav (PC) */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 card-block p-4">
            <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
              Studio
            </h2>
            <nav className="space-y-1" aria-label="Studio navigation">
              {STUDIO_NAV.map(({ href, icon: Icon, label }) => {
                const isActive = href === "/creator/studio/tips";
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                      isActive
                        ? "bg-brand-primary/10 text-brand-primary"
                        : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
