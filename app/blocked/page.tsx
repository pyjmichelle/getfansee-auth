import type { Metadata } from "next";
import Link from "next/link";
import { Globe } from "@/lib/icons";
import { SUPPORT_CONTACT_EMAIL } from "@/lib/constants/legal";

export const metadata: Metadata = {
  title: "Not available in your region - GetFanSee",
  description: "GetFanSee is not available from your current location.",
  robots: { index: false, follow: false },
};

const REASON_COPY: Record<string, { heading: string; body: string }> = {
  sanctions: {
    heading: "Not available in your region",
    body: "GetFanSee cannot be accessed from jurisdictions subject to comprehensive economic sanctions. This restriction applies to everyone connecting from this location and cannot be lifted by our support team.",
  },
  adult_content_illegal: {
    heading: "Not available in your region",
    body: "Adult content is unlawful or restricted at the network level in your country, so GetFanSee does not operate there.",
  },
  state_excluded: {
    heading: "Not available in your state",
    body: "GetFanSee does not currently serve visitors in Tennessee. State law there imposes obligations we are not able to meet at our present size, so we have chosen not to operate in the state rather than comply partially.",
  },
};

const FALLBACK = {
  heading: "Not available in your region",
  body: "GetFanSee is not available from your current location.",
};

export default async function BlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const copy = (reason && REASON_COPY[reason]) || FALLBACK;

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] flex items-center justify-center p-4">
      <div
        className="max-w-md w-full text-center card-block p-8 space-y-4"
        data-testid="geo-blocked-message"
      >
        <div className="size-14 mx-auto rounded-full bg-[var(--bg-raised)] flex items-center justify-center">
          <Globe className="size-6 text-text-muted" aria-hidden="true" />
        </div>
        <h1 className="text-h2 font-semibold text-text-primary">{copy.heading}</h1>
        <p className="text-body text-text-secondary">{copy.body}</p>
        <p className="text-small text-text-muted">
          If you believe this is a mistake — for example you are travelling, or your network reports
          the wrong country — contact{" "}
          <a
            href={`mailto:${SUPPORT_CONTACT_EMAIL}`}
            className="text-wine-text underline hover:no-underline"
          >
            {SUPPORT_CONTACT_EMAIL}
          </a>
          .
        </p>
        <p className="text-tiny text-text-disabled">
          Copyright holders can still file a takedown notice via our{" "}
          <Link href="/dmca" className="underline hover:text-text-muted transition-colors">
            DMCA page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
