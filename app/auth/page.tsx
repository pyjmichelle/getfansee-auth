import AuthPageClient from "./AuthPageClient";

type AuthPageProps = {
  searchParams: Promise<{
    mode?: string | string[];
    invited?: string | string[];
    ref_name?: string | string[];
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const resolvedParams = await searchParams;

  const modeParam = resolvedParams?.mode;
  const normalizedMode =
    typeof modeParam === "string" && (modeParam === "login" || modeParam === "signup")
      ? modeParam
      : undefined;

  const isInvited = resolvedParams?.invited === "1";
  const refName =
    typeof resolvedParams?.ref_name === "string" ? resolvedParams.ref_name : undefined;

  return <AuthPageClient initialMode={normalizedMode} isInvited={isInvited} refName={refName} />;
}
