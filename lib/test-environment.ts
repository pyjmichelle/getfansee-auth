/** Production deployment identity overrides every mock/test flag at runtime. */
export function isHostedProduction(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production";
}

export function isExplicitTestEnvironment(): boolean {
  return (
    !isHostedProduction() &&
    (process.env.E2E === "1" || process.env.PLAYWRIGHT_TEST_MODE === "true")
  );
}

export function isLocalDevelopmentOrTest(): boolean {
  return (
    !isHostedProduction() && (isExplicitTestEnvironment() || process.env.NODE_ENV === "development")
  );
}
