const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const repo = process.cwd();
const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users(id), role text NOT NULL, subscription_price_cents bigint);
CREATE TABLE posts(id uuid PRIMARY KEY, creator_id uuid REFERENCES auth.users(id), visibility text, price_cents bigint, review_status text, deleted_at timestamptz);
CREATE TABLE wallet_accounts(user_id uuid PRIMARY KEY REFERENCES auth.users(id), available_balance_cents bigint NOT NULL DEFAULT 0, pending_balance_cents bigint NOT NULL DEFAULT 0, updated_at timestamptz DEFAULT now());
CREATE TABLE transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id), type text, amount_cents bigint, status text, available_on timestamptz, metadata jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fan_id uuid REFERENCES auth.users(id), post_id uuid REFERENCES posts(id), paid_amount_cents bigint, idempotency_key text UNIQUE, UNIQUE(fan_id,post_id));
CREATE TABLE tips(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fan_id uuid REFERENCES auth.users(id), creator_id uuid REFERENCES auth.users(id), post_id uuid REFERENCES posts(id), amount_cents bigint, message text, platform_fee_cents bigint, creator_net_cents bigint, idempotency_key text UNIQUE);
CREATE TABLE creator_tip_settings(creator_id uuid PRIMARY KEY REFERENCES auth.users(id), enabled boolean DEFAULT true);
CREATE TABLE subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscriber_id uuid REFERENCES auth.users(id), creator_id uuid REFERENCES auth.users(id), plan text, status text, current_period_end timestamptz, cancelled_at timestamptz, UNIQUE(subscriber_id,creator_id));
`);
for (const file of [
  "051_payment_ledger.sql",
  "052_settlement_and_reconciliation.sql",
  "053_spend_wallet_on_subscription.sql",
  "056_creator_payouts.sql",
  "058_payout_rpc_hardening.sql",
  "061_payment_intent_integrity.sql",
  "064_withdrawal_earned_balance.sql",
])
  await db.exec(readFileSync(`${repo}/migrations/${file}`, "utf8"));
const fan = "11111111-1111-4111-8111-111111111111",
  creator = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  post = "44444444-4444-4444-8444-444444444444",
  post2 = "55555555-5555-4555-8555-555555555555";
await db.exec(
  `INSERT INTO auth.users VALUES ('${fan}'),('${creator}'),('${other}'); INSERT INTO profiles(id,role,subscription_price_cents) VALUES ('${fan}','fan',0),('${creator}','creator',1200),('${other}','fan',0); INSERT INTO wallet_accounts(user_id,available_balance_cents) VALUES ('${fan}',10000),('${other}',10000); INSERT INTO posts VALUES ('${post}','${creator}','ppv',500,'approved',NULL),('${post2}','${creator}','ppv',800,'approved',NULL);`
);
const sql = (name, args) => `SELECT public.${name}(${args}) AS result`;
const call = async (name, args) => (await db.query(sql(name, args))).rows[0].result;
const ppv = (p, key, f = fan) =>
  call("spend_wallet_on_ppv", `'${f}','${p}','${creator}',1,0,'${key}',NULL,NULL,now()`);
const tip = (c, key, p = null, a = 100) =>
  call(
    "spend_wallet_on_tip",
    `'${fan}','${c}',${p ? `'${p}'` : "NULL"},${a},NULL,0,'${key}',NULL,NULL,now()`
  );
const sub = (key) =>
  call("spend_wallet_on_subscription", `'${fan}','${creator}',1,0,'${key}',30,NULL,NULL,now()`);
const balance = async () =>
  Number(
    (
      await db.query(
        `SELECT available_balance_cents AS n FROM wallet_accounts WHERE user_id='${fan}'`
      )
    ).rows[0].n
  );
let checks = 0;
function check(result, expected) {
  assert.equal(result.success, expected, JSON.stringify(result));
  checks++;
}
// An attacker cannot use a successful $1 tip to unlock an $8 post for free.
check(await tip(creator, "tip-key"), true);
let before = await balance();
check(await ppv(post2, "tip-key"), false);
assert.equal(await balance(), before);
check(await ppv(post, "ppv-key"), true);
let after = await balance();
assert.equal(before - after, 500);
checks++;
// Two different click keys are one logical PPV purchase, not two charges.
check(await ppv(post, "second-click"), true);
assert.equal(await balance(), after);
// Exact amount/order identity cannot be stolen by another fan.
check(await ppv(post2, "ppv-key", other), false);
// Reverse via actual production RPC, then retry old key: no free regrant.
const order = (await db.query(`SELECT id FROM consumption_orders WHERE idempotency_key='ppv-key'`))
  .rows[0].id;
check(await call("reverse_consumption_order", `'${order}','regression'`), true);
before = await balance();
check(await ppv(post, "ppv-key"), false);
assert.equal(await balance(), before);
assert.equal(
  (await db.query(`SELECT count(*) AS n FROM purchases WHERE post_id='${post}'`)).rows[0].n,
  0
);
check(await ppv(post, "fresh-purchase"), true);
// Eligibility and post ownership are enforced in SQL, beyond API checks.
check(await tip(other, "fan-recipient"), false);
await db.exec(`UPDATE posts SET creator_id='${other}' WHERE id='${post2}'`);
check(await tip(creator, "wrong-post", post2), false);
await db.exec(
  `UPDATE posts SET creator_id='${creator}', review_status='rejected' WHERE id='${post2}'`
);
check(await ppv(post2, "rejected-post"), false);
await db.exec(`UPDATE posts SET review_status='approved', deleted_at=now() WHERE id='${post2}'`);
check(await ppv(post2, "deleted-post"), false);
check(await tip(creator, "tip-key", null, 200), false);
// Server-side authoritative price and commission ignore deliberately wrong quote.
before = await balance();
const subscription = await sub("subscription");
check(subscription, true);
assert.equal(before - (await balance()), 1200);
assert.equal(subscription.gross_amount_cents, 1200);
assert.equal(subscription.platform_fee_cents, 240);
checks++;
await db.exec(`UPDATE subscriptions SET status='canceled' WHERE subscriber_id='${fan}'`);
before = await balance();
const canceled = await sub("canceled-retry");
check(canceled, true);
assert.equal(canceled.already_subscribed, true);
assert.equal(await balance(), before);
// Insufficient funds leave no partial debit, credit, order or access row.
await db.exec(
  `UPDATE subscriptions SET current_period_end=now()-interval '1 day'; UPDATE wallet_accounts SET available_balance_cents=0 WHERE user_id='${fan}'`
);
check(await sub("insufficient"), false);
assert.equal(
  (
    await db.query(
      "SELECT count(*) AS n FROM consumption_orders WHERE idempotency_key='insufficient'"
    )
  ).rows[0].n,
  0
);
const permissions = await db.query(
  `SELECT has_function_privilege('authenticated','public.spend_wallet(uuid,uuid,text,bigint,integer,text,text,uuid,text,text,timestamptz)','EXECUTE') AS allowed`
);
assert.equal(permissions.rows[0].allowed, false);
checks++;
// Mixed-wallet containment: funded credit is spendable but never cash-outable.
await db.exec(
  `UPDATE wallet_accounts SET available_balance_cents=10000 WHERE user_id='${creator}'; INSERT INTO creator_payout_methods(id,creator_id,rail,destination) VALUES ('66666666-6666-4666-8666-666666666666','${creator}','paxum','creator@example.test'),('77777777-7777-4777-8777-777777777777','${creator}','paxum','second@example.test');`
);
const method = "66666666-6666-4666-8666-666666666666",
  method2 = "77777777-7777-4777-8777-777777777777";
const withdraw = (amount, key, c = creator, m = method) =>
  call("request_withdrawal", `'${c}','${m}',${amount},'${key}'`);
check(await withdraw(2000, "funded-only"), false);
assert.equal((await call("creator_earned_balances", `'${creator}'`)).available_cents, 0);
checks++;
await db.exec(
  `INSERT INTO creator_ledger(creator_id,entry_type,amount_cents,state,idempotency_key) VALUES ('${creator}','earning',3000,'available','earned-test');`
);
check(await withdraw(4000, "over-earned-cap"), false);
const earned = await call("creator_earned_balances", `'${creator}'`);
assert.equal(earned.available_cents, 3000);
checks++;
const w = await withdraw(2000, "earned-withdrawal");
check(w, true);
assert.equal(w.balance_cents, 1000);
check(await withdraw(2000, "earned-withdrawal"), true);
check(await withdraw(3000, "earned-withdrawal"), false);
check(await withdraw(2000, "earned-withdrawal", creator, method2), false);
check(await withdraw(2000, "earned-withdrawal", other), false);
await db.exec(
  `INSERT INTO creator_ledger(creator_id,entry_type,amount_cents,state,idempotency_key) VALUES ('${creator}','adjustment',-800,'available','refund-debt');`
);
assert.equal((await call("creator_earned_balances", `'${creator}'`)).available_cents, 200);
checks++;
check(await withdraw(2000, "negative-adjustment-cap"), false);
assert.equal((await db.query("SELECT count(*) AS n FROM withdrawal_requests")).rows[0].n, 1);
checks++;
// Actual spendable wallet below earned liability provides the other cap.
await db.exec(`UPDATE wallet_accounts SET available_balance_cents=50 WHERE user_id='${creator}'`);
assert.equal((await call("creator_earned_balances", `'${creator}'`)).available_cents, 50);
checks++;
// Deposits cannot restore earnings already consumed as personal purchases.
const spender = "88888888-8888-4888-8888-888888888888";
const spenderMethod = "99999999-9999-4999-8999-999999999999";
await db.exec(
  `INSERT INTO auth.users VALUES ('${spender}'); INSERT INTO profiles(id,role,subscription_price_cents) VALUES ('${spender}','creator',1000); INSERT INTO wallet_accounts(user_id,available_balance_cents) VALUES ('${spender}',3000); INSERT INTO creator_ledger(creator_id,entry_type,amount_cents,state,idempotency_key) VALUES ('${spender}','earning',3000,'available','spender-earned'); INSERT INTO creator_payout_methods(id,creator_id,rail,destination) VALUES ('${spenderMethod}','${spender}','paxum','spender@example.test'); UPDATE posts SET review_status='approved', deleted_at=NULL, price_cents=2000 WHERE id='${post2}';`
);
check(await ppv(post2, "spender-purchase", spender), true);
assert.equal((await call("creator_earned_balances", `'${spender}'`)).available_cents, 1000);
checks++;
// Use actual funding and credit functions, not a fabricated balance update.
check(
  await call(
    "open_payment_order",
    `'${spender}','payram','spender-topup',2000,'USDC','BASE','US',NULL,'{}'::jsonb`
  ),
  true
);
check(await call("credit_payram_deposit", `'spender-topup',2000,'FILLED','USDC','BASE'`), true);
assert.equal(
  (
    await db.query(
      `SELECT available_balance_cents AS n FROM wallet_accounts WHERE user_id='${spender}'`
    )
  ).rows[0].n,
  3000
);
assert.equal((await call("creator_earned_balances", `'${spender}'`)).available_cents, 1000);
checks++;
check(await withdraw(2000, "restored-funded-withdrawal", spender, spenderMethod), false);
// Returning the personal purchase restores both the wallet and eligible cap.
const spentOrder = (
  await db.query("SELECT id FROM consumption_orders WHERE idempotency_key='spender-purchase'")
).rows[0].id;
check(await call("reverse_consumption_order", `'${spentOrder}','personal-purchase-refund'`), true);
assert.equal((await call("creator_earned_balances", `'${spender}'`)).available_cents, 3000);
checks++;
check(await withdraw(2000, "refunded-personal-withdrawal", spender, spenderMethod), true);
console.log(
  `PASS ${checks} payment integrity checks in isolated Postgres (PGlite). Actual 051/052/053/056/058/061/064 functions executed; upstream schema fixture is minimal. No remote database.`
);
await db.close();
