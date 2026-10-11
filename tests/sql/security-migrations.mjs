// Offline PostgreSQL test. Install @electric-sql/pglite outside the application,
// then set PGLITE_MODULE to its dist/index.js absolute path.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
CREATE TABLE profiles (id uuid PRIMARY KEY, email text, role text DEFAULT 'fan', age_verified boolean DEFAULT false, is_banned boolean DEFAULT false, ban_until timestamptz, is_verified boolean DEFAULT false, commission_free_until timestamptz, kyc_provider text, kyc_session_id text, kyc_verification_url text, kyc_external_status text, kyc_started_at timestamptz, kyc_submitted_at timestamptz, kyc_decided_at timestamptz, kyc_last_error text, kyc_country text, kyc_age_verified boolean DEFAULT false, kyc_raw_payload jsonb);
CREATE TABLE creator_verifications (user_id uuid, status text);
CREATE TABLE posts (id uuid PRIMARY KEY, creator_id uuid, visibility text, review_status text DEFAULT 'pending', reviewed_by uuid, reviewed_at timestamptz, rejection_reason text, deleted_at timestamptz);
CREATE TABLE subscriptions (subscriber_id uuid, creator_id uuid, status text, current_period_end timestamptz);
CREATE TABLE purchases (fan_id uuid, post_id uuid);
CREATE TABLE wallet_accounts (user_id uuid PRIMARY KEY, available_balance_cents bigint DEFAULT 0, pending_balance_cents bigint DEFAULT 0, updated_at timestamptz);
CREATE TABLE transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text, amount_cents bigint, status text, metadata jsonb, created_at timestamptz DEFAULT now());
GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY posts_insert_owner ON posts FOR INSERT WITH CHECK (creator_id=auth.uid());
CREATE POLICY posts_update_owner ON posts FOR UPDATE USING (creator_id=auth.uid()) WITH CHECK (creator_id=auth.uid());
`);
for (const name of ["062_kyc_and_profile_authorization.sql", "063_atomic_mock_recharge.sql"]) {
  await db.exec(await readFile(new URL(`../../migrations/${name}`, import.meta.url), "utf8"));
}
const fan = "00000000-0000-4000-8000-000000000001";
const creator = "00000000-0000-4000-8000-000000000002";
await db.exec(
  `INSERT INTO profiles(id,ban_until) VALUES ('${fan}',now()+interval '1 day'); INSERT INTO posts(id,creator_id,visibility,review_status) VALUES ('${creator}','${creator}','subscribers','approved'); INSERT INTO subscriptions VALUES ('${fan}','${creator}','canceled',now()+interval '1 day');`
);
async function denied(sql) {
  await assert.rejects(db.exec(sql));
}
await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${fan}';`);
await denied(`INSERT INTO creator_verifications VALUES ('${fan}','approved')`);
await denied(`UPDATE profiles SET ban_until=NULL WHERE id='${fan}'`);
await db.exec(`INSERT INTO posts(id,creator_id,visibility) VALUES ('${fan}','${fan}','free')`);
await denied(`UPDATE posts SET review_status='approved' WHERE id='${fan}'`);
await denied(
  `INSERT INTO posts(id,creator_id,visibility,review_status) VALUES ('${fan}','${fan}','free','approved')`
);
const visible = await db.query(`SELECT id FROM posts WHERE id='${creator}'`);
assert.equal(visible.rows.length, 1, "Canceled future period must retain access");
await denied(`SELECT recharge_wallet('${fan}',1000,'key')`);
await db.exec("RESET ROLE");
await db.exec(
  `UPDATE subscriptions SET current_period_end=now()-interval '1 second'; SET ROLE authenticated;`
);
assert.equal(
  (await db.query(`SELECT id FROM posts WHERE id='${creator}'`)).rows.length,
  0,
  "Expired paid period must not grant access"
);
await db.exec("RESET ROLE; SET ROLE service_role");
const recharge = async (amount, key) =>
  (await db.query(`SELECT recharge_wallet('${fan}',${amount},'${key}') AS result`)).rows[0].result;
assert.equal((await recharge(1000, "key")).success, true);
assert.equal((await recharge(1000, "key")).idempotent, true);
assert.equal((await recharge(2000, "key")).success, false);
assert.equal(
  (await db.query(`SELECT available_balance_cents FROM wallet_accounts WHERE user_id='${fan}'`))
    .rows[0].available_balance_cents,
  1000
);
// Force the audit-row insert to fail: the preceding wallet increment must roll back.
await db.exec(
  "RESET ROLE; ALTER TABLE transactions ADD CONSTRAINT reject_test CHECK (metadata->>'idempotency_key' <> 'fail'); SET ROLE service_role"
);
await denied(`SELECT recharge_wallet('${fan}',1000,'fail')`);
assert.equal(
  (await db.query(`SELECT available_balance_cents FROM wallet_accounts WHERE user_id='${fan}'`))
    .rows[0].available_balance_cents,
  1000
);
await db.close();
console.log(
  "Offline SQL: KYC/profile restrictions, cancellation RLS, recharge replay/conflict/rollback passed."
);
