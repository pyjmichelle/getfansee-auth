/** Fail before creating a privileged client or sending any test request. */
export function assertDedicatedTestProject(
  url: string | undefined,
  env: Record<string, string | undefined> = process.env
): void {
  const allowed = env.E2E_SUPABASE_PROJECT_REF;
  const production = env.PRODUCTION_SUPABASE_PROJECT_REF;
  let parsed: URL;
  try {
    parsed = new URL(url ?? "");
  } catch {
    throw new Error("A dedicated E2E Supabase URL is required.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    !allowed ||
    parsed.hostname !== `${allowed}.supabase.co`
  ) {
    throw new Error("Refusing test writes: URL must match E2E_SUPABASE_PROJECT_REF exactly.");
  }
  if (!production || production === allowed) {
    throw new Error("Refusing test writes: production ref must be known and different from E2E.");
  }
}

export function assertLocalTestTarget(url: string): void {
  const parsed = new URL(url);
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("Refusing test requests against a non-loopback API target.");
  }
}
