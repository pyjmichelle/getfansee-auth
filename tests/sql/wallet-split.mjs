import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTestDatabase, nativeSql } from "./sql-runtime.mjs";
const schema = `
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF; END; $$;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users(id), role text NOT NULL, subscription_price_cents bigint);
CREATE TABLE posts(id uuid PRIMARY KEY, creator_id uuid REFERENCES auth.users(id), visibility text, price_cents bigint, review_status text, deleted_at timestamptz);
CREATE TABLE wallet_accounts(user_id uuid PRIMARY KEY REFERENCES auth.users(id), available_balance_cents bigint NOT NULL DEFAULT 0, pending_balance_cents bigint NOT NULL DEFAULT 0, updated_at timestamptz DEFAULT now());
CREATE TABLE transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id), type text, amount_cents bigint, status text, available_on timestamptz, metadata jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fan_id uuid REFERENCES auth.users(id), post_id uuid REFERENCES posts(id), paid_amount_cents bigint, idempotency_key text UNIQUE, UNIQUE(fan_id,post_id));
CREATE TABLE tips(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fan_id uuid REFERENCES auth.users(id), creator_id uuid REFERENCES auth.users(id), post_id uuid REFERENCES posts(id), amount_cents bigint, message text, platform_fee_cents bigint, creator_net_cents bigint, idempotency_key text UNIQUE);
CREATE TABLE creator_tip_settings(creator_id uuid PRIMARY KEY REFERENCES auth.users(id), enabled boolean DEFAULT true);
CREATE TABLE subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscriber_id uuid REFERENCES auth.users(id), creator_id uuid REFERENCES auth.users(id), plan text, status text, current_period_end timestamptz, cancelled_at timestamptz, UNIQUE(subscriber_id,creator_id));
`;
const legacy = `CREATE FUNCTION public.unlock_ppv() RETURNS json LANGUAGE sql SECURITY DEFINER AS $$ SELECT '{}'::json $$; GRANT EXECUTE ON FUNCTION public.unlock_ppv() TO service_role; GRANT USAGE ON SCHEMA auth TO authenticated,service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role; GRANT SELECT ON wallet_accounts TO authenticated,service_role;`;
const files = [
  "048_nowpayments_atomic_credit.sql",
  "051_payment_ledger.sql",
  "052_settlement_and_reconciliation.sql",
  "053_spend_wallet_on_subscription.sql",
  "056_creator_payouts.sql",
  "058_payout_rpc_hardening.sql",
  "061_payment_intent_integrity.sql",
  "063_atomic_mock_recharge.sql",
  "064_withdrawal_earned_balance.sql",
];
const migration = readFileSync("migrations/065_separate_funded_and_earned_balances.sql", "utf8");
const fan = "11111111-1111-4111-8111-111111111111",
  creator = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  method = "44444444-4444-4444-8444-444444444444";
async function fresh() {
  const db = await createTestDatabase();
  await db.exec(schema);
  await db.exec(legacy);
  for (const file of files) await db.exec(readFileSync(`migrations/${file}`, "utf8"));
  await db.exec(
    `INSERT INTO auth.users VALUES ('${fan}'),('${creator}'),('${other}'); INSERT INTO profiles(id,role,subscription_price_cents) VALUES ('${fan}','fan',0),('${creator}','creator',1200),('${other}','creator',1000);`
  );
  await rpc(db, "recharge_wallet", `'${fan}',20000,'fan-deposit'`);
  await rpc(db, "recharge_wallet", `'${creator}',2000,'creator-deposit'`);
  await rpc(
    db,
    "spend_wallet_on_tip",
    `'${fan}','${creator}',NULL,5000,NULL,0,'opening-sale',NULL,NULL,now()`
  );
  await db.exec(
    `UPDATE creator_ledger SET available_on=now()-interval '1 day'; INSERT INTO creator_payout_methods(id,creator_id,rail,destination) VALUES ('${method}','${creator}','paxum','creator@example.test');`
  );
  return db;
}
const rpc = async (db, name, args = "") =>
  (await db.query(`SELECT public.${name}(${args}) AS result`)).rows[0].result;
const funded = async (db, id) =>
  (await db.query(`SELECT available_balance_cents FROM wallet_accounts WHERE user_id='${id}'`))
    .rows[0]?.available_balance_cents ?? 0;
const earned = (db, id = creator) => rpc(db, "creator_earned_balances", `'${id}'`);
const tip = (db, f, c, amount, key) =>
  rpc(db, "spend_wallet_on_tip", `'${f}','${c}',NULL,${amount},NULL,0,'${key}',NULL,NULL,now()`);
const withdraw = (db, amount, key) =>
  rpc(db, "request_withdrawal", `'${creator}','${method}',${amount},'${key}'`);
let checks = 0;
function equal(actual, expected) {
  assert.deepEqual(actual, expected);
  checks++;
}
function ok(result) {
  equal(result.success, true);
  return result;
}
function denied(result) {
  equal(result.success, false);
}
async function balanced(db) {
  const rows = await db.query("SELECT * FROM reconciliation_report()");
  equal(
    rows.rows.map((r) => [r.identity, r.difference]),
    [
      ["credited_deposits_match_orders", 0],
      ["consumption_splits_balance", 0],
      ["creator_earned_liability", 0],
      ["funded_liability_matches_balances", 0],
      ["payouts_match_ledger", 0],
    ]
  );
}
const db = await fresh();
await db.exec(migration);
equal(await funded(db, creator), 2000);
equal(await earned(db), { available_cents: 0, pending_cents: 4000, debt_cents: 0 });
equal((await db.query("SELECT COUNT(*) AS n FROM wallet_account_split_audit")).rows[0].n, 2);
await balanced(db);
ok(await rpc(db, "settle_matured_earnings", "1"));
equal(await funded(db, creator), 2000);
equal((await earned(db)).available_cents, 4000);
// Earned money cannot fund purchases, and funded purchases never reduce earnings.
denied(await tip(db, creator, other, 3000, "cannot-spend-earnings"));
const personal = ok(await tip(db, creator, other, 1000, "funded-personal-sale"));
equal(await funded(db, creator), 1000);
equal((await earned(db)).available_cents, 4000);
const request = ok(await withdraw(db, 3000, "rejected-request"));
equal(await funded(db, creator), 1000);
equal((await earned(db)).available_cents, 1000);
ok(await rpc(db, "decide_withdrawal", `'${request.request_id}','rejected',NULL,'test','${fan}'`));
ok(await rpc(db, "decide_withdrawal", `'${request.request_id}','rejected',NULL,'test','${fan}'`));
denied(
  await rpc(db, "decide_withdrawal", `'${request.request_id}','paid','wrong','test','${fan}'`)
);
equal(await funded(db, creator), 1000);
equal((await earned(db)).available_cents, 4000);
const paid = ok(await withdraw(db, 3000, "paid-request"));
ok(await rpc(db, "decide_withdrawal", `'${paid.request_id}','paid','transfer-1','test','${fan}'`));
ok(await rpc(db, "decide_withdrawal", `'${paid.request_id}','paid','transfer-1','test','${fan}'`));
denied(
  await rpc(db, "decide_withdrawal", `'${paid.request_id}','paid','different','test','${fan}'`)
);
const opening = (
  await db.query("SELECT id FROM consumption_orders WHERE idempotency_key='opening-sale'")
).rows[0].id;
ok(await rpc(db, "reverse_consumption_order", `'${opening}','refund after payout'`));
ok(await rpc(db, "reverse_consumption_order", `'${opening}','retry'`));
equal(await funded(db, creator), 1000);
equal(await earned(db), { available_cents: 0, pending_cents: 0, debt_cents: 3000 });
equal(await funded(db, fan), 20000);
ok(await rpc(db, "recharge_wallet", `'${creator}',5000,'creator-extra-deposit'`));
equal((await earned(db)).debt_cents, 3000);
denied(await withdraw(db, 2000, "deposit-not-earnings"));
const debtSpend = ok(await tip(db, creator, other, 500, "funded-despite-earned-debt"));
equal(await funded(db, creator), 5500);
// Batch settlement must not complete every mature revenue transaction at once.
ok(await tip(db, fan, creator, 6000, "new-earnings-1"));
ok(await tip(db, fan, creator, 1000, "new-earnings-2"));
await db.exec(
  "UPDATE creator_ledger SET available_on=now()-interval '1 day' WHERE state='pending'; UPDATE transactions SET available_on=now()-interval '1 day' WHERE status='pending';"
);
const settled = ok(await rpc(db, "settle_matured_earnings", "1"));
equal(settled.entries_settled, 1);
equal(
  (
    await db.query(
      "SELECT COUNT(*) AS n FROM transactions t JOIN creator_ledger cl ON t.metadata->>'consumption_order_id'=cl.consumption_order_id::text AND t.user_id=cl.creator_id WHERE t.amount_cents>0 AND cl.state='pending' AND t.status='completed'"
    )
  ).rows[0].n,
  0
);
ok(await rpc(db, "settle_matured_earnings", "5000"));
equal((await earned(db)).available_cents, 2600);
equal(await funded(db, creator), 5500);
equal(ok(await rpc(db, "settle_matured_earnings", "5000")).entries_settled, 0);
const final = ok(await withdraw(db, 2000, "new-earned-withdrawal"));
equal((await earned(db)).available_cents, 600);
equal(await funded(db, creator), 5500);
ok(
  await rpc(
    db,
    "reverse_consumption_order",
    `'${debtSpend.consumption_order_id}','refund own funded sale'`
  )
);
equal(await funded(db, creator), 6000);
equal((await earned(db)).available_cents, 600);
const pending = ok(await tip(db, fan, creator, 100, "pending-to-refund"));
ok(
  await rpc(db, "reverse_consumption_order", `'${pending.consumption_order_id}','pending refund'`)
);
await db.exec(
  "UPDATE creator_ledger SET available_on=now()-interval '1 day' WHERE state='pending';"
);
ok(await rpc(db, "settle_matured_earnings", "5000"));
equal(
  (
    await db.query(
      `SELECT status FROM transactions WHERE user_id='${creator}' AND amount_cents>0 AND metadata->>'consumption_order_id'='${pending.consumption_order_id}'`
    )
  ).rows[0].status,
  "failed"
);
ok(await rpc(db, "refund_unspent_balance", `'${creator}',1000,'close','external-refund-1'`));
ok(await rpc(db, "refund_unspent_balance", `'${creator}',1000,'retry','external-refund-1'`));
denied(await rpc(db, "refund_unspent_balance", `'${creator}',2000,'wrong','external-refund-1'`));
denied(await rpc(db, "refund_unspent_balance", `'${fan}',1000,'wrong-user','external-refund-1'`));
equal(await funded(db, creator), 5000);
equal((await earned(db)).available_cents, 600);
denied(await rpc(db, "increment_wallet_available", `'${creator}',1000`));
equal(await funded(db, creator), 5000);
ok(await rpc(db, "credit_nowpayments_deposit", `'${creator}',500,'now-id','usdt','finished'`));
ok(await rpc(db, "credit_nowpayments_deposit", `'${creator}',500,'now-id','usdt','confirmed'`));
denied(await rpc(db, "credit_nowpayments_deposit", `'${fan}',500,'now-id','usdt','finished'`));
denied(await rpc(db, "credit_nowpayments_deposit", `'${creator}',600,'now-id','usdt','finished'`));
equal(await funded(db, creator), 5500);
await balanced(db);
equal(
  (
    await db.query(
      "SELECT has_table_privilege('authenticated','wallet_account_split_audit','SELECT') AS allowed"
    )
  ).rows[0].allowed,
  false
);
equal(
  (
    await db.query(
      "SELECT has_function_privilege('authenticated','request_withdrawal(uuid,uuid,bigint,text)','EXECUTE') AS allowed"
    )
  ).rows[0].allowed,
  false
);
await assert.rejects(
  db.exec(`UPDATE wallet_accounts SET available_balance_cents=-1 WHERE user_id='${creator}'`)
);
checks++;
equal(
  (
    await db.query(
      "SELECT has_function_privilege('service_role','unlock_ppv()','EXECUTE') AS allowed"
    )
  ).rows[0].allowed,
  false
);
await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${fan}',false);`);
ok(await rpc(db, "rpc_get_wallet_balance", `'${fan}'`));
denied(await rpc(db, "rpc_get_wallet_balance", `'${creator}'`));
await db.exec("RESET ROLE");
equal(
  (await db.query("SELECT prosecdef FROM pg_proc WHERE proname='rpc_get_wallet_balance'")).rows[0]
    .prosecdef,
  false
);
await db.close();
// Migration failures must roll back without changing old balances or partial audit state.
for (const [name, mutation] of [
  [
    "mixed-history",
    `SELECT spend_wallet_on_tip('${creator}','${other}',NULL,100,NULL,0,'old-mixed',NULL,NULL,now());`,
  ],
  [
    "unprovenanced-funds",
    `UPDATE wallet_accounts SET available_balance_cents=available_balance_cents+1 WHERE user_id='${fan}';`,
  ],
  [
    "pending-mismatch",
    `UPDATE wallet_accounts SET pending_balance_cents=1 WHERE user_id='${fan}';`,
  ],
  ["orphan-ledger", `DELETE FROM wallet_accounts WHERE user_id='${creator}';`],
  ["legacy-paid", `UPDATE creator_ledger SET state='paid';`],
  [
    "earned-mismatch",
    `UPDATE creator_ledger SET amount_cents=amount_cents+1; UPDATE wallet_accounts SET pending_balance_cents=pending_balance_cents+1 WHERE user_id='${creator}';`,
  ],
]) {
  const candidate = await fresh();
  await candidate.exec(mutation);
  const before = (await candidate.query("SELECT * FROM wallet_accounts ORDER BY user_id")).rows;
  await assert.rejects(candidate.exec(migration), undefined, name);
  checks++;
  await candidate.exec("ROLLBACK");
  equal((await candidate.query("SELECT * FROM wallet_accounts ORDER BY user_id")).rows, before);
  equal(
    (await candidate.query("SELECT to_regclass('public.wallet_account_split_audit') AS name"))
      .rows[0].name,
    null
  );
  await candidate.close();
}
if (nativeSql) {
  const concurrent = await fresh();
  await concurrent.exec(migration);
  ok(await rpc(concurrent, "settle_matured_earnings", "5000"));
  const a = await concurrent.connectSibling(),
    b = await concurrent.connectSibling();
  try {
    const competing = await Promise.all([
      withdraw(a, 3000, "concurrent-a"),
      withdraw(b, 3000, "concurrent-b"),
    ]);
    equal(competing.filter((r) => r.success).length, 1);
    equal((await earned(concurrent)).available_cents, 1000);
    equal(await funded(concurrent, creator), 2000);
    const winner = competing.find((r) => r.success);
    ok(
      await rpc(
        concurrent,
        "decide_withdrawal",
        `'${winner.request_id}','rejected',NULL,'reset','${fan}'`
      )
    );
    const replay = await Promise.all([
      withdraw(a, 2000, "concurrent-same"),
      withdraw(b, 2000, "concurrent-same"),
    ]);
    equal(
      replay.every((r) => r.success),
      true
    );
    equal(replay.filter((r) => r.idempotent).length, 1);
    equal(replay[0].request_id, replay[1].request_id);
    equal((await earned(concurrent)).available_cents, 2000);
    const credits = await Promise.all([
      rpc(
        a,
        "credit_nowpayments_deposit",
        `'${creator}',400,'concurrent-deposit','usdt','finished'`
      ),
      rpc(
        b,
        "credit_nowpayments_deposit",
        `'${creator}',400,'concurrent-deposit','usdt','finished'`
      ),
    ]);
    equal(
      credits.every((r) => r.success),
      true
    );
    equal(credits.filter((r) => r.idempotent).length, 1);
    equal(await funded(concurrent, creator), 2400);
    const openingId = (
      await concurrent.query(
        "SELECT id FROM consumption_orders WHERE idempotency_key='opening-sale'"
      )
    ).rows[0].id;
    const race = await Promise.all([
      withdraw(a, 2000, "withdraw-refund-race"),
      rpc(b, "reverse_consumption_order", `'${openingId}','concurrent reversal'`),
    ]);
    ok(race[1]);
    equal((await earned(concurrent)).debt_cents, race[0].success ? 4000 : 2000);
    equal(await funded(concurrent, creator), 2400);
    equal(await funded(concurrent, fan), 20000);
    const debtBefore = (await earned(concurrent)).debt_cents;
    const sale = ok(await tip(concurrent, fan, creator, 5000, "settlement-refund-race"));
    await concurrent.exec(
      "UPDATE creator_ledger SET available_on=now()-interval '1 day' WHERE state='pending';"
    );
    const settlementRace = await Promise.all([
      rpc(a, "settle_matured_earnings", "1"),
      rpc(b, "reverse_consumption_order", `'${sale.consumption_order_id}','settlement race'`),
    ]);
    settlementRace.forEach(ok);
    equal((await earned(concurrent)).debt_cents, debtBefore);
    equal(await funded(concurrent, creator), 2400);
    equal(await funded(concurrent, fan), 20000);
    await balanced(concurrent);
  } finally {
    await a.close();
    await b.close();
    await concurrent.close();
  }
}
console.log(
  `PASS ${checks} split-account checks: funded/earned isolation, debt/refund/payout/settlement, replay, backfill rollback. Engine=${nativeSql ? "native PostgreSQL with concurrent connections" : "offline PGlite"}; hosted full-schema QA still required.`
);
