import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Build only. Applying to a target requires explicit project selection outside this script. */
export function buildEmptySchemaBootstrap(root = process.cwd()) {
  const manifest = JSON.parse(
    readFileSync(join(root, "scripts/ops/empty-schema-bootstrap.json"), "utf8")
  );
  const entries = manifest.order.map((file) => {
    const source = file === "001_profiles_base.sql" ? "001_init.sql" : file;
    let sql = readFileSync(join(root, "migrations", source), "utf8");
    if (file === "001_profiles_base.sql") {
      const marker = "-------------------------\n-- creators";
      if (!sql.includes(marker))
        throw new Error("001 bootstrap boundary changed; review the manifest");
      sql = sql
        .split(marker)[0]
        .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', "")
        .replaceAll("CREATE POLICY IF NOT EXISTS", "CREATE POLICY");
    }
    if (file === "034_add_performance_indexes.sql")
      sql = sql.replaceAll("ends_at", "current_period_end");
    // Historical files have their own transactions. Keep the assembled install atomic.
    sql = sql.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gm, "");
    return { source, file, sql, sha256: createHash("sha256").update(sql).digest("hex") };
  });
  const guard = `DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public')
       OR EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM storage.objects) THEN
      RAISE EXCEPTION 'Bootstrap requires an empty isolated application schema, auth and storage';
    END IF;
  END; $$;`;
  return {
    entries,
    sql:
      "BEGIN;\n" +
      guard +
      "\n" +
      entries.map((e) => `-- Source: ${e.file}; SHA256: ${e.sha256}\n${e.sql}`).join("\n") +
      "\nCOMMIT;",
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[2];
  if (!output)
    throw new Error("Usage: node scripts/ops/build-empty-schema-bootstrap.mjs OUTPUT.sql");
  const plan = buildEmptySchemaBootstrap();
  writeFileSync(output, plan.sql);
  console.log(
    `Built ${plan.entries.length} application migrations for an empty isolated schema. No database accessed.`
  );
}
