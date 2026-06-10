"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  UserCheck,
  Copy,
  Check,
  Share2,
  CheckCircle,
  Clock,
  Star,
  DollarSign,
  Plus,
  BarChart3,
  FileText,
  Gift,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Sparkles,
  Flame,
  type LucideIcon,
} from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { ShareModal } from "@/components/share-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { ErrorState } from "@/components/error-state";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
import { useCountUp } from "@/hooks/use-count-up";
import { format } from "date-fns";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────

interface AmbassadorStats {
  clicks: number;
  signups: number;
  qualified: number;
  pending_estimated_cents: number;
  approved_estimated_cents: number;
}

interface AmbassadorData {
  enrolled: boolean;
  code?: string;
  link?: string;
  status?: "active" | "suspended";
  stats?: AmbassadorStats;
}

interface ReferredCreator {
  id: string;
  status: string;
  qualified_at: string | null;
  created_at: string;
  display_name: string;
  avatar_url: string | null;
}

// ─── Milestone system ─────────────────────────────────────

interface Milestone {
  label: string;
  minQualified: number;
  Icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  rewardHint: string;
}

const MILESTONES: Milestone[] = [
  {
    label: "Starter",
    minQualified: 0,
    Icon: Sparkles,
    color: "text-[var(--text-secondary)]",
    bgColor: "bg-[var(--bg-raised)]",
    borderColor: "border-[var(--border-subtle)]",
    rewardHint: "Enroll and get your referral link",
  },
  {
    label: "Rising Star",
    minQualified: 1,
    Icon: Star,
    color: "text-[var(--wine)]",
    bgColor: "bg-[var(--wine-tint)]",
    borderColor: "border-[var(--wine)]/30",
    rewardHint: "1+ qualified creator",
  },
  {
    label: "Champion",
    minQualified: 5,
    Icon: Flame,
    color: "text-[var(--premium)]",
    bgColor: "bg-[var(--premium-tint)]",
    borderColor: "border-[var(--premium)]/30",
    rewardHint: "5+ qualified creators",
  },
  {
    label: "Legend",
    minQualified: 10,
    Icon: Star,
    color: "text-[var(--premium)]",
    bgColor: "bg-[var(--premium-tint)]",
    borderColor: "border-[var(--premium)]/40",
    rewardHint: "10+ qualified creators",
  },
];

function getCurrentMilestoneIndex(qualified: number): number {
  let idx = 0;
  for (let i = 0; i < MILESTONES.length; i++) {
    if (qualified >= MILESTONES[i].minQualified) idx = i;
  }
  return idx;
}

function getProgressToNextMilestone(qualified: number): {
  current: number;
  next: number;
  pct: number;
} {
  const currentIdx = getCurrentMilestoneIndex(qualified);
  if (currentIdx >= MILESTONES.length - 1) return { current: qualified, next: qualified, pct: 100 };
  const currentMin = MILESTONES[currentIdx].minQualified;
  const nextMin = MILESTONES[currentIdx + 1].minQualified;
  const pct = Math.min(100, ((qualified - currentMin) / (nextMin - currentMin)) * 100);
  return { current: qualified, next: nextMin, pct };
}

// ─── Funnel step definitions ──────────────────────────────

const FUNNEL_STEPS: { key: string; label: string; description: string }[] = [
  { key: "signup_completed", label: "Signed Up", description: "Created their account" },
  { key: "kyc_verified", label: "Verified", description: "Completed identity verification" },
  { key: "qualified", label: "Qualified", description: "Completed creator setup" },
  { key: "revenue_eligible", label: "Earning", description: "Generated first eligible revenue" },
];

const FUNNEL_STEP_ORDER = [
  "signup_completed",
  "creator_role_selected",
  "kyc_verified",
  "qualified",
  "revenue_eligible",
];

function getFunnelStep(status: string): number {
  const idx = FUNNEL_STEP_ORDER.indexOf(status);
  return idx === -1 ? 0 : idx;
}

// ─── Status badge ─────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  signup_completed: "Signed Up",
  creator_role_selected: "Onboarding",
  kyc_verified: "Verified",
  qualified: "Qualified",
  revenue_eligible: "Earning",
  rejected: "Rejected",
  fraud: "Flagged",
};

const STATUS_CLASSES: Record<string, string> = {
  signup_completed: "bg-surface-raised text-text-secondary border-border-base",
  creator_role_selected: "bg-brand-secondary/10 text-brand-secondary border-transparent",
  kyc_verified: "bg-brand-primary/10 text-brand-primary border-transparent",
  qualified: "bg-success/10 text-success border-transparent",
  revenue_eligible: "bg-success/20 text-success border-transparent",
  rejected: "bg-error/10 text-error border-transparent",
  fraud: "bg-error/10 text-error border-transparent",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium ${STATUS_CLASSES[status] ?? "bg-surface-raised text-text-secondary"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ─── FAQ data ─────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "How does the Ambassador Program work?",
    a: "Share your unique referral link with fellow creators. When they sign up, get KYC verified, and generate their first eligible revenue on GetFanSee, the referral qualifies — and you start accumulating estimated referral rewards.",
  },
  {
    q: "When does a referral become qualified?",
    a: "A referral qualifies only after the invited creator: (1) signs up, (2) selects the creator role, (3) passes KYC verification, and (4) receives their first eligible payment. Simply signing up or passing KYC alone is not enough.",
  },
  {
    q: "How is the reward calculated?",
    a: "An estimated reward of 5% is calculated based on your referred creator's eligible transaction amounts (subscriptions and PPV) during the 12 months after they qualify. For example, if they earn $1,000 in eligible revenue in that window, your estimated referral reward accumulates as $50. This is an internal estimate, not a legally owed balance.",
  },
  {
    q: "When can I withdraw my rewards?",
    a: "Referral rewards are pending internal estimates under review. They are not withdrawable during this phase and do not represent a guaranteed payout. Withdrawal support will be added in a future update when the platform's payout system is ready.",
  },
  {
    q: "What can disqualify a referral or reward?",
    a: "Referral rewards may be reviewed, adjusted, rejected, delayed, or voided in cases of fraud, refunds, chargebacks, policy violations, account suspension, duplicate accounts, or other risk signals.",
  },
  {
    q: "Can I refer myself or use multiple accounts?",
    a: "Self-referrals and duplicate accounts are blocked by our anti-fraud system. Any attempt will void the referral and may affect your ambassador status.",
  },
  {
    q: "What happens to my rewards if an invited creator is banned?",
    a: "If an invited creator's account is suspended or banned, commission accrual halts for that attribution. Already-approved commissions are reviewed individually. Commissions that were pending may be voided depending on the circumstances.",
  },
  {
    q: "Does the program have a sunset date?",
    a: "There is no planned sunset date. If program terms change significantly, ambassadors will be notified in advance. Pending rewards that were already approved at the time of any program change will be honored in good faith when payout capability is available.",
  },
  {
    q: "Do I need to disclose my referral link when sharing?",
    a: 'Yes. When sharing your referral link on social media, in messages, or anywhere publicly, you must clearly tell people that it\'s a referral link and that you may earn a reward if they sign up. This is required by FTC guidelines (US) and similar rules in other regions. Example disclosure: "(Referral link — I earn a reward if you sign up through this link)". The share text we provide already includes this disclosure — please keep it when posting.',
  },
  {
    q: "Are referral rewards taxable?",
    a: "When referral rewards become payable, they may be considered taxable income under applicable laws in your jurisdiction. In the US, payments above applicable thresholds may require a tax form (e.g. 1099-NEC). GetFanSee will provide necessary tax documentation when payout capability is launched. We recommend consulting a qualified tax advisor for guidance specific to your situation. During the MVP phase, rewards are internal estimates only and no payment is made.",
  },
];

// ─── Page ─────────────────────────────────────────────────

export default function AmbassadorPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AmbassadorData | null>(null);
  const [referrals, setReferrals] = useState<ReferredCreator[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showFirstQualifiedCelebration, setShowFirstQualifiedCelebration] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load data ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

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
        username:
          bootstrap.profile?.display_name || bootstrap.user.email.split("@")[0] || "creator",
        role: "creator",
        avatar: bootstrap.profile?.avatar_url || undefined,
      });

      const res = await fetch("/api/referral/me");
      if (res.status === 404) {
        setData({ enrolled: false });
        return;
      }
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body.code === "KYC_REQUIRED") {
          router.push("/creator/upgrade/kyc");
          return;
        }
      }
      if (!res.ok) throw new Error("Failed to load ambassador profile");
      const json = await res.json();

      // Check for first-ever qualified creator (celebration trigger)
      const prevQualified = data?.stats?.qualified ?? 0;
      if (data?.enrolled && (json.stats?.qualified ?? 0) === 1 && prevQualified === 0) {
        setShowFirstQualifiedCelebration(true);
      }

      setData(json);

      if (json.enrolled) {
        loadReferrals();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const loadReferrals = useCallback(async () => {
    try {
      setReferralsLoading(true);
      const res = await fetch("/api/referral/me/referrals?page_size=20");
      if (res.ok) {
        const json = await res.json();
        setReferrals(json.items ?? []);
      }
    } catch {
      // non-fatal
    } finally {
      setReferralsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, [loadData]);

  // ── Enroll ────────────────────────────────────────────────
  const handleEnroll = async () => {
    try {
      setIsEnrolling(true);
      const res = await fetch("/api/referral/enroll", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to enroll");
      }
      await loadData();
      toast.success("Welcome to the Ambassador Program!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setIsEnrolling(false);
    }
  };

  // ── Copy link ─────────────────────────────────────────────
  const handleCopy = async () => {
    if (!data?.link) return;
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      toast.success("Referral link copied!");
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Copy failed — please copy manually");
    }
  };

  // ── Share text (FTC-compliant: includes material connection disclosure) ─────
  // Used by ShareModal for platforms that accept a text body (X, Telegram, WhatsApp).
  // FTC 2026 Endorsement Guide: affiliate/referral relationships are "material connections"
  // that must be clearly and conspicuously disclosed near the recommendation.
  const buildShareText = () => {
    if (!data?.link) return "";
    return (
      `Hey! I'm a creator on GetFanSee — it's a platform where you control your audience and earn from exclusive content.\n\n` +
      `Sign up with my referral link and get started:\n${data.link}\n\n` +
      `Looking forward to seeing you there!\n\n` +
      `(Referral link — I earn a reward if you sign up through this link)`
    );
  };

  // ── Count-up animations ───────────────────────────────────
  const stats = data?.stats;
  const animatedClicks = useCountUp(stats?.clicks ?? 0, { duration: 800 });
  const animatedSignups = useCountUp(stats?.signups ?? 0, { duration: 800 });
  const animatedQualified = useCountUp(stats?.qualified ?? 0, { duration: 800 });
  const animatedPending = useCountUp((stats?.pending_estimated_cents ?? 0) / 100, {
    duration: 900,
    decimals: 2,
  });
  const animatedApproved = useCountUp((stats?.approved_estimated_cents ?? 0) / 100, {
    duration: 900,
    decimals: 2,
  });

  // ── Milestone calculations ────────────────────────────────
  const qualifiedCount = stats?.qualified ?? 0;
  const currentMilestoneIdx = getCurrentMilestoneIndex(qualifiedCount);
  const currentMilestone = MILESTONES[currentMilestoneIdx];
  const progressInfo = getProgressToNextMilestone(qualifiedCount);
  const nextMilestone =
    currentMilestoneIdx < MILESTONES.length - 1 ? MILESTONES[currentMilestoneIdx + 1] : null;

  // ── Sidebar nav ───────────────────────────────────────────
  const navItems = [
    { href: "/creator/new-post", icon: Plus, label: "Create Post" },
    { href: "/creator/studio/earnings", icon: DollarSign, label: "Earnings" },
    { href: "/creator/studio/subscribers", icon: Users, label: "Subscribers" },
    { href: "/creator/studio/post/list", icon: FileText, label: "Post List" },
    { href: "/creator/studio/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/creator/studio/ambassador", icon: Gift, label: "Ambassador" },
  ];

  // ── Loading skeleton ──────────────────────────────────────
  if (isLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
        <div className="pb-24 animate-pulse space-y-6">
          <div className="h-10 w-56 bg-surface-raised rounded" />
          <div className="h-32 bg-surface-raised rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-surface-raised rounded-2xl" />
            ))}
          </div>
          <div className="h-64 bg-surface-raised rounded-2xl" />
        </div>
      </PageShell>
    );
  }

  // ── Error state ───────────────────────────────────────────
  if (error) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
        <ErrorState
          title="Failed to load Ambassador"
          message={error}
          retry={loadData}
          variant="centered"
        />
      </PageShell>
    );
  }

  // ── Not enrolled ──────────────────────────────────────────
  if (!data?.enrolled) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
        <div className="pb-24 flex flex-col lg:flex-row gap-8">
          <main className="flex-1 min-w-0">
            <div className="mb-8">
              <Link
                href="/creator/studio"
                className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-6"
              >
                <ArrowLeft size={18} />
                <span className="text-sm">Back to Studio</span>
              </Link>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-3 text-text-primary">
                Creator Ambassador
              </h1>
              <p className="text-text-tertiary text-sm md:text-lg">
                Invite trusted creators and earn referral rewards when they grow on GetFanSee.
              </p>
            </div>

            {/* Enrollment card — redesigned with value prop + calculator */}
            <div className="card-block p-8 max-w-lg mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center">
                  <Gift size={28} className="text-brand-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Join the Program</h2>
                  <p className="text-xs text-text-tertiary">
                    Earn referral rewards by inviting creators
                  </p>
                </div>
              </div>

              {/* Value bullets — 3 concise lines */}
              <div className="space-y-2 mb-5">
                {[
                  "5% estimated rewards on referred creators' eligible revenue",
                  "Track every invite from signup to first earning",
                  "Unlock Ambassador milestones as your network grows",
                ].map((text) => (
                  <div key={text} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                      <Check size={10} className="text-success" />
                    </div>
                    <p className="text-sm text-text-secondary">{text}</p>
                  </div>
                ))}
              </div>

              {/* Example calculator */}
              <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-3 mb-5">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-text-tertiary text-xs uppercase tracking-wide font-semibold">
                    Example
                  </span>
                  <span className="text-brand-primary font-semibold">$1,000 × 5% = $50</span>
                </div>
                <p className="text-[10px] text-text-tertiary">
                  Estimated only · not a guarantee of income · subject to admin review
                </p>
              </div>

              {/* Milestone preview */}
              <div className="flex items-center justify-between gap-1 mb-5">
                {MILESTONES.map((m, i) => (
                  <div key={m.label} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center ${i === 0 ? "bg-[var(--wine-tint)] border border-[var(--wine)]/30" : "bg-[var(--bg-raised)] border border-[var(--border-subtle)]"}`}
                    >
                      <m.Icon size={14} className={m.color} aria-hidden />
                    </div>
                    <span className="text-[0.625rem] text-[var(--text-muted)] text-center leading-tight">
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-text-tertiary mb-5 text-center">
                Rewards are estimates under review · not withdrawable in this phase
              </p>

              <Button
                variant="default"
                size="lg"
                className="w-full"
                onClick={handleEnroll}
                disabled={isEnrolling}
              >
                {isEnrolling ? "Enrolling…" : "Get My Referral Link"}
              </Button>
            </div>
          </main>
          <Sidebar navItems={navItems} activePath="/creator/studio/ambassador" />
        </div>
      </PageShell>
    );
  }

  // ── Enrolled dashboard ────────────────────────────────────
  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
      <div className="pb-24 flex flex-col lg:flex-row gap-8">
        <main className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <div className="flex items-center gap-4 mb-1">
              <Link
                href="/creator/studio"
                className="p-2.5 hover:bg-surface-raised rounded-xl transition-colors active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <ArrowLeft size={24} />
              </Link>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-text-primary">
                  Creator Ambassador
                </h1>
                {data.status === "active" && (
                  <Badge className="bg-success/10 text-success border-transparent text-xs">
                    Active
                  </Badge>
                )}
                {data.status === "suspended" && (
                  <Badge className="bg-error/10 text-error border-transparent text-xs">
                    Suspended
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-text-tertiary text-sm md:text-base pl-1">
              Invite creators and earn estimated referral rewards when they grow
            </p>
          </div>

          {/* First qualified celebration */}
          {showFirstQualifiedCelebration && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--success)]/30 bg-[var(--success)]/5 p-5 mb-6">
              <div className="flex items-start gap-3">
                <Gift size={20} className="text-[var(--success)] shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="font-semibold text-success text-sm mb-1">
                    First Qualified Referral!
                  </p>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Your first invited creator has completed their creator setup and generated
                    eligible revenue. You&apos;ve reached Rising Star status — your referral rewards
                    are now accumulating.
                  </p>
                  <button
                    className="mt-2 text-xs text-success underline underline-offset-2"
                    onClick={() => setShowFirstQualifiedCelebration(false)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Milestone journey track ─────────────────────────── */}
          <div className="card-block p-5 mb-6" data-testid="milestone-track">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <currentMilestone.Icon size={18} className={currentMilestone.color} aria-hidden />
                  <span className={`text-base font-bold ${currentMilestone.color}`}>
                    {currentMilestone.label}
                  </span>
                </div>
                <p className="text-xs text-text-tertiary pl-0.5">
                  {qualifiedCount} qualified creator{qualifiedCount !== 1 ? "s" : ""}
                  {nextMilestone
                    ? ` · ${progressInfo.next - qualifiedCount} more to ${nextMilestone.label}`
                    : " · Max tier reached"}
                </p>
              </div>
              <div
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${currentMilestone.bgColor} ${currentMilestone.borderColor} ${currentMilestone.color}`}
              >
                {currentMilestone.label}
              </div>
            </div>

            {/* Progress bar */}
            {nextMilestone && (
              <div className="mb-4">
                <div className="h-2.5 bg-surface-raised rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--wine)] transition-all duration-700"
                    style={{ width: `${progressInfo.pct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-text-tertiary">
                    {progressInfo.current}/{progressInfo.next}
                  </span>
                  <span className="text-[10px] text-text-tertiary">
                    Next: {nextMilestone.label}
                  </span>
                </div>
              </div>
            )}

            {/* Milestone steps */}
            <div className="flex items-center gap-1">
              {MILESTONES.map((m, i) => {
                const reached = qualifiedCount >= m.minQualified;
                const isCurrent = i === currentMilestoneIdx;
                return (
                  <div key={m.label} className="flex items-center flex-1 gap-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center border transition-all ${
                          isCurrent
                            ? `${m.bgColor} ${m.borderColor} ring-2 ring-[var(--wine)]/30`
                            : reached
                              ? `${m.bgColor} ${m.borderColor}`
                              : "bg-[var(--bg-overlay)] border-[var(--border-subtle)] opacity-50"
                        }`}
                      >
                        <m.Icon
                          size={14}
                          className={reached ? m.color : "text-[var(--text-muted)]"}
                          aria-hidden
                        />
                      </div>
                      <span
                        className={`text-[10px] mt-1 font-medium text-center leading-tight ${
                          reached ? m.color : "text-text-tertiary"
                        }`}
                      >
                        {m.label}
                      </span>
                      <span className="text-[9px] text-text-tertiary text-center leading-tight">
                        {m.minQualified === 0 ? "Enrolled" : `${m.minQualified}+ creators`}
                      </span>
                    </div>
                    {i < MILESTONES.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 rounded-full transition-all ${
                          qualifiedCount >= MILESTONES[i + 1].minQualified
                            ? "bg-brand-primary"
                            : "bg-surface-raised"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Referral Link Card */}
          <div className="card-block p-6 mb-6" data-testid="referral-link-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <Share2 size={20} className="text-brand-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-text-primary">Your Referral Link</h2>
                <p className="text-xs text-text-tertiary">Share with creators you want to invite</p>
              </div>
            </div>

            <div className="flex gap-3 items-center mb-3">
              <input
                type="text"
                readOnly
                value={data.link ?? ""}
                className="flex-1 bg-surface-raised border border-border-base rounded-xl px-4 py-3 text-sm text-text-secondary font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary min-w-0"
                onFocus={(e) => e.target.select()}
                aria-label="Your referral link"
              />
              <Button
                variant="outline"
                className="shrink-0 min-h-[44px] px-4 bg-surface-raised border-border-base hover:bg-surface-overlay gap-2"
                onClick={handleCopy}
                aria-label={copied ? "Copied!" : "Copy referral link"}
              >
                {copied ? (
                  <>
                    <Check size={16} className="text-success" />
                    <span className="text-success text-sm">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span className="text-sm">Copy</span>
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-text-tertiary mb-3">
              Code: <span className="font-mono text-text-secondary font-medium">{data.code}</span>
            </p>

            {/* Share actions */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-border-subtle">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs bg-surface-raised border-border-base hover:bg-surface-overlay"
                onClick={() => setShareModalOpen(true)}
              >
                <Share2 size={14} />
                Share
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Link Clicks"
              value={String(animatedClicks)}
              description="Total link visits"
              icon={<TrendingUp className="w-5 h-5" />}
              className="border border-border-base"
            />
            <StatCard
              title="Signups"
              value={String(animatedSignups)}
              description="Creators who registered"
              icon={<UserCheck className="w-5 h-5" />}
              className="border border-border-base"
            />
            <StatCard
              title="Qualified"
              value={String(animatedQualified)}
              description="Earned first revenue"
              icon={<CheckCircle className="w-5 h-5" />}
              className="border border-border-base"
            />
            <StatCard
              title="Est. Pending"
              value={
                stats && stats.pending_estimated_cents === 0 && qualifiedCount === 0
                  ? "—"
                  : `$${animatedPending.toFixed(2)}`
              }
              description="Under review · Not withdrawable"
              icon={<Clock className="w-5 h-5" />}
              className="border border-border-base"
            />
          </div>

          {/* Commission Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <div className="card-block p-5">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-text-tertiary" />
                <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                  Estimated Pending
                </div>
              </div>
              <div className="text-3xl font-bold text-text-primary mb-1">
                ${animatedPending.toFixed(2)}
              </div>
              <div className="text-xs text-text-tertiary">Under review · Not withdrawable</div>
            </div>
            <div className="card-block p-5">
              <div className="flex items-center gap-2 mb-1">
                <Star size={14} className="text-text-tertiary" />
                <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                  Approved Credit
                </div>
              </div>
              <div className="text-3xl font-bold text-text-primary mb-1">
                ${animatedApproved.toFixed(2)}
              </div>
              <div className="text-xs text-text-tertiary">Reviewed · Not withdrawable in MVP</div>
            </div>
          </div>
          <p className="text-xs text-text-tertiary mb-6 px-1 leading-relaxed">
            Referral rewards are internal estimated records. They are not withdrawable and do not
            represent a guaranteed payout until the platform&apos;s payout system is ready.
          </p>

          {/* Invited Creators — Funnel Progress View */}
          <div className="card-block overflow-hidden mb-6" data-testid="invited-creators">
            <div className="p-6 border-b border-border-base">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Invited Creators</h3>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    Onboarding status only — no earnings or private data shown
                  </p>
                </div>
                {referrals.length > 0 && (
                  <div className="hidden md:flex items-center gap-1 text-xs text-text-tertiary">
                    {FUNNEL_STEPS.map((step, i) => (
                      <div key={step.key} className="flex items-center gap-1">
                        <span>{step.label}</span>
                        {i < FUNNEL_STEPS.length - 1 && <span className="opacity-40">→</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {referralsLoading ? (
              <div className="p-6 space-y-4 animate-pulse">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-surface-raised rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-surface-raised rounded w-32" />
                      <div className="h-3 bg-surface-raised rounded w-24" />
                    </div>
                    <div className="h-6 bg-surface-raised rounded w-20" />
                  </div>
                ))}
              </div>
            ) : referrals.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 bg-surface-raised rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles size={24} className="text-brand-primary/60" />
                </div>
                <p className="font-semibold text-text-primary text-sm mb-2">
                  Your network starts here
                </p>
                <p className="text-xs text-text-tertiary mb-5 max-w-xs mx-auto leading-relaxed">
                  Share your link with fellow creators. You&apos;ll track their progress from signup
                  to first earning right here.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-surface-raised border-border-base"
                  onClick={handleCopy}
                >
                  <Copy size={14} />
                  Copy My Referral Link
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {referrals.map((r) => {
                  const stepReached = getFunnelStep(r.status);
                  return (
                    <div
                      key={r.id}
                      className="p-4 md:p-6 hover:bg-surface-raised transition-colors"
                    >
                      {/* Creator identity */}
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="w-9 h-9 shrink-0">
                          <AvatarImage src={r.avatar_url ?? undefined} alt={r.display_name} />
                          <AvatarFallback className="bg-brand-primary/10 text-brand-primary text-xs font-semibold">
                            {r.display_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-text-primary text-sm truncate">
                            {r.display_name}
                          </div>
                          <div className="text-xs text-text-tertiary">
                            Joined {format(new Date(r.created_at), "MMM d, yyyy")}
                            {r.qualified_at && (
                              <span className="ml-2 text-success">
                                · Qualified {format(new Date(r.qualified_at), "MMM d, yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>

                      {/* 4-step funnel progress bar */}
                      {r.status !== "rejected" && r.status !== "fraud" && (
                        <div className="flex items-center gap-1 pl-12">
                          {FUNNEL_STEPS.map((step, i) => {
                            const stepOrder = FUNNEL_STEP_ORDER.indexOf(step.key);
                            const isReached = stepReached >= stepOrder;
                            const isCurrent =
                              stepReached === stepOrder ||
                              (step.key === "signup_completed" && stepReached <= stepOrder);
                            return (
                              <div key={step.key} className="flex items-center flex-1 gap-1">
                                <div className="flex flex-col items-center flex-1">
                                  <div
                                    className={`h-1.5 w-full rounded-full transition-all ${
                                      isReached ? "bg-brand-primary" : "bg-surface-raised"
                                    }`}
                                  />
                                  <span
                                    className={`text-[9px] mt-1 truncate w-full text-center ${
                                      isCurrent
                                        ? "text-brand-primary font-semibold"
                                        : isReached
                                          ? "text-text-secondary"
                                          : "text-text-tertiary"
                                    }`}
                                  >
                                    {step.label}
                                  </span>
                                </div>
                                {i < FUNNEL_STEPS.length - 1 && <div className="w-1 shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rules / FAQ */}
          <div className="card-block overflow-hidden" data-testid="ambassador-faq">
            <div className="p-6 border-b border-border-base">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-brand-primary" />
                <h3 className="text-lg font-bold text-text-primary">Program Rules &amp; FAQ</h3>
              </div>
              <p className="text-xs text-text-tertiary mt-1">
                How rewards are calculated, qualified, and reviewed
              </p>
            </div>
            <div className="divide-y divide-border-subtle">
              {FAQ_ITEMS.map((item, idx) => (
                <div key={idx}>
                  <button
                    className="w-full p-4 md:p-6 flex items-center justify-between gap-4 text-left hover:bg-surface-raised transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-inset"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    aria-expanded={openFaq === idx}
                  >
                    <span className="text-sm font-medium text-text-primary">{item.q}</span>
                    {openFaq === idx ? (
                      <ChevronUp size={16} className="text-text-tertiary shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-text-tertiary shrink-0" />
                    )}
                  </button>
                  {openFaq === idx && (
                    <div className="px-4 md:px-6 pb-4 md:pb-6 text-sm text-text-secondary leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <Sidebar navItems={navItems} activePath="/creator/studio/ambassador" />
      </div>

      {/* Social share modal — opened when creator clicks Share */}
      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        url={data?.link ?? ""}
        title="Join me on GetFanSee — create exclusive content and own your audience."
        shareText={buildShareText()}
        sheetTitle="Share your referral link"
      />
    </PageShell>
  );
}

// ─── Sidebar component ────────────────────────────────────

interface NavItem {
  href: string;
  icon: React.FC<{ size?: number }>;
  label: string;
}

function Sidebar({ navItems, activePath }: { navItems: NavItem[]; activePath: string }) {
  return (
    <aside className="w-full lg:w-72 shrink-0">
      <div className="sticky top-24 space-y-4">
        <div className="card-block p-4">
          <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
            Studio
          </h2>
          <nav className="space-y-1" aria-label="Studio navigation">
            {navItems.map(({ href, icon: Icon, label }) => {
              const isActive = href === activePath;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary ${
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
      </div>
    </aside>
  );
}
