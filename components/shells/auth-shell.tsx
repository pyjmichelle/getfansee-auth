import Image from "next/image";
import { DollarSign, Lock, Globe, Sparkles } from "@/lib/icons";

const FEATURES = [
  {
    Icon: DollarSign,
    text: "Monetize your passion & earn more",
    color: "text-[var(--success)]",
  },
  {
    Icon: Lock,
    text: "Exclusive content for your subscribers",
    color: "text-wine-text",
  },
  { Icon: Globe, text: "Reach fans all around the world", color: "text-[var(--info)]" },
];

/** Shared PC hero (45% split) — extracted from the main /auth page so every
 * auth sub-page (forgot/reset/resend/error/verify) renders the same brand
 * identity instead of a disconnected centered card (T7 fix). */
function AuthHero() {
  return (
    <aside className="auth-hero relative overflow-hidden bg-[var(--bg-base)]">
      <Image
        src="/images/auth/hero-pc.jpg"
        alt="Creator showcasing content on GetFanSee"
        width={1600}
        height={1200}
        sizes="(min-width: 1024px) 45vw, 100vw"
        className="absolute inset-0 w-full h-full object-cover opacity-[0.12]"
        aria-hidden="true"
        priority
      />

      <svg
        className="absolute inset-0 w-full h-full opacity-[0.06]"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern id="auth-shell-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-shell-grid)" />
      </svg>
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.08]"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle cx="100%" cy="0" r="520" fill="none" stroke="white" strokeWidth="1" />
        <circle cx="100%" cy="0" r="360" fill="none" stroke="white" strokeWidth="0.5" />
        <circle cx="0" cy="100%" r="400" fill="none" stroke="white" strokeWidth="0.8" />
        <line x1="0" y1="0" x2="100%" y2="100%" stroke="white" strokeWidth="0.4" />
        <line x1="100%" y1="0" x2="0" y2="100%" stroke="white" strokeWidth="0.4" />
      </svg>

      <div className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full bg-[var(--wine)]/12 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[var(--premium)]/8 blur-3xl" />

      <div className="absolute inset-0 flex flex-col justify-between p-10">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-[var(--radius-sm)] bg-[var(--wine)]/15 border border-[var(--wine)]/30 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-wine-text" aria-hidden="true" />
          </div>
          <span className="font-bold text-[22px] text-text-primary tracking-tight">GetFanSee</span>
        </div>

        <div className="space-y-3">
          {FEATURES.map((f) => (
            <div
              key={f.text}
              className="flex items-center gap-3.5 px-4 py-3.5 rounded-[var(--radius-lg)] bg-white/4 border border-white/8"
            >
              <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-white/6 flex items-center justify-center shrink-0">
                <f.Icon className={`w-5 h-5 ${f.color}`} aria-hidden="true" />
              </div>
              <p className="text-body text-text-primary font-medium leading-snug">{f.text}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="font-display text-5xl font-bold text-text-primary leading-tight mb-3">
            Where Creators
            <br />
            <span className="text-wine-text">Get Paid.</span>
          </p>
          <p className="text-body-lg text-text-muted leading-relaxed">
            The premium content platform
            <br />
            built for independent creators.
          </p>
        </div>
      </div>
    </aside>
  );
}

interface AuthShellProps {
  children: React.ReactNode;
}

/**
 * Shared shell for the Auth page group (T7 in the site-wide refactor plan):
 * PC hero (45%) + form column (55%), matching the main /auth page. Applies
 * to forgot/reset/resend/error/verify — previously each rendered a fully
 * disconnected centered card with no brand hero and inconsistent spacing.
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <div
      className="auth-layout bg-bg-base"
      style={{ touchAction: "manipulation", overscrollBehaviorY: "contain" }}
    >
      <AuthHero />
      <section className="auth-form bg-bg-base">
        <div className="w-full max-w-sm">
          {/* Logo (mobile only — desktop logo is in hero) */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="size-8 rounded-[var(--radius-sm)] bg-[var(--wine)] flex items-center justify-center">
              <span className="text-text-primary font-bold text-tiny">G</span>
            </div>
            <span className="font-bold text-body text-text-primary">GetFanSee</span>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
