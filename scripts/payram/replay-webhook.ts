/**
 * Webhook replay and tamper harness.
 *
 *   pnpm payram:replay --reference=<payram_reference_id> [--amount=20] [--url=http://localhost:3000]
 *
 * Sends the same signed FILLED webhook three times and then two invalid
 * variants, and asserts the outcome of each:
 *
 *   1. first delivery      → credited
 *   2. second delivery     → accepted, idempotent, no second credit
 *   3. third delivery      → same
 *   4. tampered amount     → 401, signature no longer matches
 *   5. wrong signing key   → 401
 *
 * Redelivery is a normal thing for a payment provider to do, not an attack, so
 * "it worked when I sent it once" is not evidence of anything. This is the
 * check that the Soft Beta gate actually depends on.
 *
 * Run it against a real order opened by /api/payments/payram/create-payment —
 * the reference id must exist as an OPEN order or every delivery is rejected as
 * unknown, which would pass items 4 and 5 for the wrong reason.
 */

import { createHmac } from "crypto";

const args = process.argv.slice(2);
const arg = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const reference = arg("reference");
const amount = Number(arg("amount") ?? 20);
const baseUrl = arg("url") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const key = process.env.PAYRAM_WEBHOOK_SECRET || process.env.PAYRAM_API_KEY;

if (!reference) {
  console.error("--reference=<payram_reference_id> is required.");
  process.exit(1);
}
if (!key) {
  console.error("PAYRAM_WEBHOOK_SECRET or PAYRAM_API_KEY must be set.");
  process.exit(1);
}

const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/webhooks/payram`;

function sign(body: string, signingKey: string): string {
  return "sha256=" + createHmac("sha256", signingKey).update(body, "utf8").digest("hex");
}

async function deliver(body: string, signature: string) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-payram-signature": signature },
    body,
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON error body */
  }
  return { status: res.status, json: json as Record<string, unknown> | null };
}

let failures = 0;
function check(label: string, ok: boolean, detail: unknown) {
  console.log(`${ok ? "OK  " : "FAIL"}  ${label}`);
  if (!ok) {
    failures += 1;
    console.log(`        got: ${JSON.stringify(detail)}`);
  }
}

async function main() {
  // Shaped like a real delivery, not like something convenient to assert on:
  // the fill state arrives as `status`, monetary amounts arrive as JSON
  // strings, and there is no `network` field. A harness that sends a payload
  // production never sends proves nothing about production.
  const body = JSON.stringify({
    reference_id: reference,
    status: "FILLED",
    filled_amount_in_usd: String(amount),
    currency: "USDC",
  });
  const signature = sign(body, key!);

  console.log(`\nReplaying against ${endpoint}`);
  console.log(`reference=${reference} amount=$${amount}\n`);

  const first = await deliver(body, signature);
  check("1. first delivery credits", first.status === 200 && first.json?.credited === true, first);

  const second = await deliver(body, signature);
  check(
    "2. redelivery is idempotent, does not credit again",
    second.status === 200 && second.json?.idempotent === true && second.json?.credited !== true,
    second
  );

  const third = await deliver(body, signature);
  check(
    "3. third delivery still idempotent",
    third.status === 200 && third.json?.idempotent === true,
    third
  );

  const tamperedBody = body.replace(
    `"filled_amount_in_usd":"${amount}"`,
    `"filled_amount_in_usd":"${amount * 100}"`
  );
  const tampered = await deliver(tamperedBody, signature);
  check("4. tampered amount is rejected (401)", tampered.status === 401, tampered);

  const forged = await deliver(body, sign(body, "not-the-real-key"));
  check("5. wrong signing key is rejected (401)", forged.status === 401, forged);

  console.log("");
  if (failures > 0) {
    console.error(`${failures} check(s) failed. Do not open the payment loop.`);
    process.exit(1);
  }
  console.log("Replay behaviour is correct. Confirm the balance moved exactly once:");
  console.log("  pnpm reconcile");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
