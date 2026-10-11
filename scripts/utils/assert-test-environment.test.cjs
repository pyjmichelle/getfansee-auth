const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertDedicatedTestProject,
  requireTestPassword,
} = require("./assert-test-environment.cjs");

const env = { E2E_SUPABASE_PROJECT_REF: "isolated", PRODUCTION_SUPABASE_PROJECT_REF: "production" };
test("permits only the exact isolated HTTPS project", () => {
  assert.doesNotThrow(() => assertDedicatedTestProject("https://isolated.supabase.co", env));
  for (const url of [
    "https://production.supabase.co",
    "https://isolated.supabase.co.evil.test",
    "http://isolated.supabase.co",
    "https://user:password@isolated.supabase.co",
    "https://isolated.supabase.co/path",
    "https://isolated.supabase.co?x=1",
    "https://isolated.supabase.co#fragment",
    "https://isolated.supabase.co:444",
    "invalid",
  ])
    assert.throws(() => assertDedicatedTestProject(url, env));
});
test("requires a known production project distinct from the test project", () => {
  for (const invalid of [
    {},
    { E2E_SUPABASE_PROJECT_REF: "isolated" },
    { ...env, PRODUCTION_SUPABASE_PROJECT_REF: "isolated" },
  ]) {
    assert.throws(() => assertDedicatedTestProject("https://isolated.supabase.co", invalid));
  }
});
test("does not fall back to a committed test password", () => {
  const original = process.env.E2E_TEST_USER_PASSWORD;
  try {
    delete process.env.E2E_TEST_USER_PASSWORD;
    assert.throws(() => requireTestPassword());
  } finally {
    if (original !== undefined) process.env.E2E_TEST_USER_PASSWORD = original;
  }
});
