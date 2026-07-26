import { redirect } from "next/navigation";

/**
 * Legacy mock onboarding route (no real API wiring). Kept as a redirect so
 * any stale bookmarks/links land on the real onboarding flow instead of 404.
 */
export default function CreatorOnboardRedirect() {
  redirect("/creator/onboarding");
}
