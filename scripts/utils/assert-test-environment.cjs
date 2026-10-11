"use strict";
function assertDedicatedTestProject(url, env = process.env) {
  const target = new URL(url);
  const match = target.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/);
  const testRef = env.E2E_SUPABASE_PROJECT_REF;
  const productionRef = env.PRODUCTION_SUPABASE_PROJECT_REF;
  if (
    target.protocol !== "https:" ||
    target.username ||
    target.password ||
    target.port ||
    (target.pathname !== "/" && target.pathname !== "") ||
    target.search ||
    target.hash ||
    !match ||
    !testRef ||
    !productionRef ||
    match[1] !== testRef ||
    testRef === productionRef
  ) {
    throw new Error(
      "Refusing test writes: configure a dedicated HTTPS Supabase project distinct from production."
    );
  }
}
function requireTestPassword() {
  const password = process.env.E2E_TEST_USER_PASSWORD;
  if (!password)
    throw new Error("E2E_TEST_USER_PASSWORD is required; no committed credential fallback.");
  return password;
}
module.exports = { assertDedicatedTestProject, requireTestPassword };
