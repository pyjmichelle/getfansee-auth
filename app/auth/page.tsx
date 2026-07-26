import AuthPageClient from "./AuthPageClient";

type AuthPageProps = {
  searchParams: Promise<{
    mode?: string | string[];
    invited?: string | string[];
    ref_name?: string | string[];
    // Set by middleware.ts when an unauthenticated user is bounced off a
    // protected route (?redirect=<pathname>) so login/signup can send them
    // back to where they actually wanted to go instead of always /home.
    redirect?: string | string[];
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
  const redirectTo =
    typeof resolvedParams?.redirect === "string" ? resolvedParams.redirect : undefined;

  return (
    <AuthPageClient
      initialMode={normalizedMode}
      isInvited={isInvited}
      refName={refName}
      redirectTo={redirectTo}
    />
  );
}
