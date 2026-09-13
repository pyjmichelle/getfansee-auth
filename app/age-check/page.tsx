import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AgeCheckForm } from "@/components/age-check-form";
import { resolveJurisdiction, requiresVerifiedAssurance } from "@/lib/compliance/jurisdictions";
import { getRequestGeo } from "@/lib/compliance/request-geo";

export const metadata: Metadata = {
  title: "Age verification - GetFanSee",
  description: "Confirm you are over 18 before continuing.",
  robots: { index: false, follow: false },
};

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/home";
  return value;
}

export default async function AgeCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; status?: string }>;
}) {
  const { next, status } = await searchParams;
  const jurisdiction = resolveJurisdiction(getRequestGeo(await headers()));

  if (jurisdiction.tier === "blocked") {
    redirect(`/blocked?reason=${jurisdiction.blockReason ?? ""}`);
  }

  // Nothing to do here for jurisdictions that only need self-attestation —
  // the client-side gate in the root layout already handles those.
  if (!requiresVerifiedAssurance(jurisdiction.tier)) {
    redirect(safeNext(next));
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] flex items-center justify-center p-4">
      <AgeCheckForm
        tier={jurisdiction.tier}
        allowAnonymousOption={jurisdiction.anonymousOptionRequired}
        next={safeNext(next)}
        initialStatus={status ?? null}
      />
    </div>
  );
}
