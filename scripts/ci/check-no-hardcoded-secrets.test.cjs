const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const scanner = path.join(__dirname, "check-no-hardcoded-secrets.sh");
test("scans tracked environment files without leaking detected values", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "getfansee-secret-gate-"));
  try {
    assert.equal(spawnSync("git", ["init", "--quiet", dir]).status, 0);
    const fake = ["sbp", "a".repeat(30)].join("_");
    fs.writeFileSync(path.join(dir, ".env.production"), `SUPABASE_PERSONAL_ACCESS_TOKEN=${fake}\n`);
    assert.equal(spawnSync("git", ["-C", dir, "add", ".env.production"]).status, 0);
    const result = spawnSync("bash", [scanner], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /\.env\.production/);
    assert.equal(result.stdout.includes(fake), false);
    fs.writeFileSync(
      path.join(dir, ".env.production"),
      "SUPABASE_PERSONAL_ACCESS_TOKEN=<secret>\n"
    );
    const clean = spawnSync("bash", [scanner], { cwd: dir, encoding: "utf8" });
    assert.equal(clean.status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
