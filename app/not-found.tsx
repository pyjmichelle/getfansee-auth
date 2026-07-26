import Link from "next/link";
import { ArrowLeft, Compass } from "@/lib/icons";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-[var(--bg-base)] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="size-16 rounded-2xl bg-[var(--bg-raised)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-6">
          <Compass size={28} className="text-[var(--text-muted)]" aria-hidden />
        </div>
        <h1 className="text-[1.5rem] font-semibold text-[var(--text-primary)] mb-2">
          Page not found
        </h1>
        <p className="text-[0.9375rem] text-[var(--text-muted)] mb-8 leading-relaxed">
          The page you're looking for has moved, or never existed. Let's get you back on track.
        </p>
        <Link
          href="/home"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--wine)] text-text-primary rounded-[var(--radius-md)] font-medium hover:bg-[var(--wine-hover)] transition-colors duration-150 active:scale-[0.98]"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to home
        </Link>
      </div>
    </div>
  );
}
