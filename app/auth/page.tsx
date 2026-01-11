import AuthPageClient from "./AuthPageClient";

type AuthPageProps = {
  searchParams: Promise<{
    mode?: string | string[];
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const resolvedParams = await searchParams;
  const modeParam = resolvedParams?.mode;
  const normalizedMode =
    typeof modeParam === "string" && (modeParam === "login" || modeParam === "signup")
      ? modeParam
      : undefined;

  return <AuthPageClient initialMode={normalizedMode} />;
}
