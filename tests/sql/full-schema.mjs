import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTestDatabase, nativeSql } from "./sql-runtime.mjs";
import { buildEmptySchemaBootstrap } from "../../scripts/ops/build-empty-schema-bootstrap.mjs";

const db = await createTestDatabase();
// Emulate only Supabase-managed auth/storage primitives. All application
// tables, functions, views and policies come from the repository migration plan.
await db.exec(`
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='supabase_admin') THEN CREATE ROLE supabase_admin; END IF;
END; $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text,owner uuid,metadata jsonb);
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
`);
// Reproduce why059's schema-only revoke cannot remove global PUBLIC EXECUTE.
await db.exec(
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC; CREATE FUNCTION public.qa_legacy_default_probe() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'"
);
assert.equal(
  (
    await db.query(
      "SELECT has_function_privilege('anon','public.qa_legacy_default_probe()','EXECUTE') AS allowed"
    )
  ).rows[0].allowed,
  true
);
await db.exec("DROP FUNCTION public.qa_legacy_default_probe()");
const plan = buildEmptySchemaBootstrap();
const query = nativeSql
  ? plan.sql
  : plan.sql.replace(/CREATE EXTENSION IF NOT EXISTS ("?[\w-]+"?);/g, "");
await db.exec(query);
assert.equal(plan.entries.length, 69);
assert.equal(
  (await db.query("SELECT COUNT(*) AS n FROM pg_tables WHERE schemaname='public'")).rows[0].n,
  47
);
assert.equal(
  (
    await db.query(
      "SELECT COUNT(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity"
    )
  ).rows[0].n,
  0
);
const fan = "11111111-1111-4111-8111-111111111111",
  creator = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333";
await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${fan}','e2e+fan@example.test'),('${creator}','e2e+creator@example.test'),('${admin}','e2e+admin@example.test');
INSERT INTO profiles(id,email,display_name,username,role) VALUES ('${fan}','e2e+fan@example.test','QA Fan','qa_fan','fan'),('${creator}','e2e+creator@example.test','QA Creator','qa_creator','creator'),('${admin}','e2e+admin@example.test','QA Admin','qa_admin','admin');`);
assert.equal(
  (await db.query(`SELECT subscription_price_cents FROM profiles WHERE id='${creator}'`)).rows[0]
    .subscription_price_cents,
  0
);
await db.exec(`UPDATE profiles SET subscription_price_cents=1200 WHERE id='${creator}'`);
await assert.rejects(
  db.exec(`UPDATE profiles SET subscription_price_cents=-1 WHERE id='${creator}'`)
);
await assert.rejects(
  db.exec(`UPDATE profiles SET subscription_price_cents=NULL WHERE id='${creator}'`)
);
await db.exec(
  `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${fan}',true);`
);
await assert.rejects(db.exec(`UPDATE profiles SET role='admin' WHERE id='${fan}'`));
await db.exec("ROLLBACK");
await db.exec("SET ROLE anon");
await assert.rejects(db.query("SELECT email FROM public.profiles"));
const publicCreator = await db.query(
  "SELECT id,display_name,username FROM public_creator_profiles WHERE username='qa_creator'"
);
assert.equal(publicCreator.rows[0].id, creator);
await assert.rejects(db.query("SELECT email FROM public_creator_profiles"));
await db.exec("RESET ROLE");
const newcomer = "44444444-4444-4444-8444-444444444444";
await db.exec(`INSERT INTO auth.users(id,email) VALUES('${newcomer}','e2e+new@example.test')`);
await db.exec(
  `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${newcomer}',true); INSERT INTO profiles(id,email,username) VALUES('${newcomer}','e2e+new@example.test','qa_new');`
);
assert.equal(
  (await db.query(`SELECT email FROM profiles WHERE id='${newcomer}'`)).rows[0].email,
  "e2e+new@example.test"
);
assert.equal((await db.query(`SELECT email FROM profiles WHERE id='${creator}'`)).rows.length, 0);
await db.exec("ROLLBACK");
// Verify the paid path against the full app schema, not only a hand-built fixture.
assert.equal(
  (
    await db.query(
      `SELECT (recharge_wallet('${fan}',5000,'full-schema-funding')->>'success')::boolean AS ok`
    )
  ).rows[0].ok,
  true
);
const purchase = (
  await db.query(
    `SELECT spend_wallet_on_subscription('${fan}','${creator}',1,0,'full-schema-subscription',30,NULL,NULL,now()) AS result`
  )
).rows[0].result;
assert.equal(purchase.success, true, JSON.stringify(purchase));
assert.equal(purchase.gross_amount_cents, 1200);
assert.equal(
  (await db.query(`SELECT available_balance_cents FROM wallet_accounts WHERE user_id='${fan}'`))
    .rows[0].available_balance_cents,
  3800
);
await db.exec(
  "CREATE FUNCTION public.qa_future_function_probe() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'"
);
assert.equal(
  (
    await db.query(
      "SELECT has_function_privilege('anon','public.qa_future_function_probe()','EXECUTE') AS allowed"
    )
  ).rows[0].allowed,
  false
);
assert.equal(
  (
    await db.query(
      "SELECT has_function_privilege('authenticated','public.qa_future_function_probe()','EXECUTE') AS allowed"
    )
  ).rows[0].allowed,
  false
);
assert.equal(
  (
    await db.query(
      "SELECT has_function_privilege('service_role','public.qa_future_function_probe()','EXECUTE') AS allowed"
    )
  ).rows[0].allowed,
  true
);
await db.exec("DROP FUNCTION public.qa_future_function_probe()");
assert.equal(
  (
    await db.query(
      "SELECT has_function_privilege('anon','public.cleanup_old_webhook_events(integer)','EXECUTE') AS allowed"
    )
  ).rows[0].allowed,
  false
);
assert.equal(
  (
    await db.query(
      "SELECT has_function_privilege('authenticated','public.cleanup_old_webhook_events(integer)','EXECUTE') AS allowed"
    )
  ).rows[0].allowed,
  false
);
const posture = readFileSync("scripts/ops/verify-financial-security.sql", "utf8").replace(
  /^\\set .*$/gm,
  ""
);
await db.exec(posture);
// Supabase-managed owners' default grants must not be mistaken for this app's.
await db.exec(
  "ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon"
);
await db.exec(posture);
for (const scope of ["", "IN SCHEMA public"]) {
  await db.exec(
    `BEGIN; ALTER DEFAULT PRIVILEGES ${scope} GRANT EXECUTE ON FUNCTIONS TO authenticated;`
  );
  await assert.rejects(db.exec(posture), /future public-schema/);
  await db.exec("ROLLBACK");
}

assert.equal(
  (await db.query("SELECT COUNT(*) AS n FROM reconciliation_report() WHERE difference<>0")).rows[0]
    .n,
  0
);
await assert.rejects(db.exec(query), /empty isolated/);
await db.exec("ROLLBACK");
assert.equal(
  (await db.query(`SELECT available_balance_cents FROM wallet_accounts WHERE user_id='${fan}'`))
    .rows[0].available_balance_cents,
  3800
);
const paidPost = "55555555-5555-4555-8555-555555555555";
await db.exec(
  `INSERT INTO profiles(id,email,username) VALUES('${newcomer}','e2e+new@example.test','qa_new'); INSERT INTO posts(id,creator_id,title,content,visibility,review_status) VALUES('${paidPost}','${creator}','Paid','Protected','subscribers','approved'); INSERT INTO post_comments(post_id,user_id,content) VALUES('${paidPost}','${fan}','Paid comment'); SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${newcomer}',false);`
);
assert.equal(
  (await db.query(`SELECT * FROM post_comments WHERE post_id='${paidPost}'`)).rows.length,
  0
);
await assert.rejects(
  db.exec(
    `INSERT INTO post_comments(post_id,user_id,content) VALUES('${paidPost}','${newcomer}','No access')`
  )
);
await db.exec(`SELECT set_config('request.jwt.claim.sub','${fan}',false)`);
assert.equal(
  (await db.query(`SELECT * FROM post_comments WHERE post_id='${paidPost}'`)).rows.length,
  1
);
await assert.rejects(
  db.exec(
    `INSERT INTO post_comments(post_id,user_id,content) VALUES('${paidPost}','${creator}','Forged author')`
  )
);
await db.exec(
  `INSERT INTO post_comments(post_id,user_id,content) VALUES('${paidPost}','${fan}','Own authorized comment'); SELECT set_config('request.jwt.claim.sub','${creator}',false);`
);
assert.equal((await db.query(`SELECT email FROM profiles WHERE id='${fan}'`)).rows.length, 0);
assert.equal(
  (await db.query(`SELECT display_name FROM public_profile_labels WHERE id='${fan}'`)).rows[0]
    .display_name,
  "QA Fan"
);
await db.exec("RESET ROLE");
await db.close();
console.log(
  `PASS full-schema bootstrap: 69 migrations, 47 RLS tables, subscription pricing, admin anti-escalation, public search projection, paid purchase and posture. Engine=${nativeSql ? "PostgreSQL" : "PGlite"}.`
);
