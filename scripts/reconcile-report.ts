/**
 * Reconciliation report.
 *
 *   pnpm reconcile            # identities only
 *   pnpm reconcile --full     # + revenue and nexus breakdown for the period
 *   pnpm reconcile --days=30
 *
 * Exits non-zero when any identity fails. That is intentional: this is the gate
 * that decides whether the payment loop may be opened past Soft Beta, so it has
 * to be usable directly in CI without a human reading the output.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(url, key);

const args = process.argv.slice(2);
const full = args.includes("--full");
const daysArg = args.find((a) => a.startsWith("--days="));
const days = daysArg ? Number(daysArg.split("=")[1]) : 30;

const usd = (cents: number) => `$${(Number(cents) / 100).toFixed(2)}`;

async function main() {
  const { data: rows, error } = await supabase.rpc("reconciliation_report");
  if (error) {
    console.error("reconciliation_report failed:", error.message);
    process.exit(1);
  }

  const identities = (rows ?? []) as Array<{
    identity: string;
    left_cents: number;
    right_cents: number;
    difference: number;
  }>;

  console.log("\nReconciliation identities");
  console.log("─".repeat(78));

  let failed = 0;
  for (const r of identities) {
    const diff = Number(r.difference);
    const ok = diff === 0;
    if (!ok) failed += 1;
    console.log(
      `${ok ? "OK  " : "FAIL"}  ${r.identity.padEnd(34)} ` +
        `${usd(r.left_cents).padStart(14)} vs ${usd(r.right_cents).padStart(14)}` +
        (ok ? "" : `   diff ${usd(diff)}`)
    );
  }

  if (full) {
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    const { data: revenue } = await supabase.rpc("revenue_report", {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });

    console.log(`\nRevenue, last ${days} days (recognised at consumption, not at top-up)`);
    console.log("─".repeat(78));
    let grossTotal = 0;
    let feeTotal = 0;
    for (const r of (revenue ?? []) as Array<{
      kind: string;
      order_count: number;
      gross_cents: number;
      platform_fee_cents: number;
      creator_net_cents: number;
    }>) {
      grossTotal += Number(r.gross_cents);
      feeTotal += Number(r.platform_fee_cents);
      console.log(
        `  ${r.kind.padEnd(14)} ${String(r.order_count).padStart(6)} orders  ` +
          `gross ${usd(r.gross_cents).padStart(12)}  fee ${usd(r.platform_fee_cents).padStart(12)}  ` +
          `creator ${usd(r.creator_net_cents).padStart(12)}`
      );
    }
    if (grossTotal > 0) {
      console.log(
        `  ${"TOTAL".padEnd(14)} ${"".padStart(6)}         ` +
          `gross ${usd(grossTotal).padStart(12)}  fee ${usd(feeTotal).padStart(12)}  ` +
          `(${((feeTotal / grossTotal) * 100).toFixed(1)}% take rate)`
      );
    }

    const { data: nexus } = await supabase.rpc("nexus_report", {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });

    console.log(`\nSales by jurisdiction, last ${days} days (economic nexus watch)`);
    console.log("─".repeat(78));
    for (const r of (nexus ?? []) as Array<{
      country: string;
      region: string;
      order_count: number;
      gross_cents: number;
    }>) {
      // US state economic-nexus thresholds are commonly $100k or 200
      // transactions. Flag well before either so registration can happen in
      // advance rather than retroactively.
      const near = Number(r.gross_cents) > 8_000_000 || Number(r.order_count) > 160;
      console.log(
        `  ${near ? "!" : " "} ${r.country}/${r.region}`.padEnd(20) +
          `${String(r.order_count).padStart(7)} orders  ${usd(r.gross_cents).padStart(14)}`
      );
    }
  }

  console.log("");
  if (failed > 0) {
    console.error(`${failed} identity/identities do not balance. Every difference must be`);
    console.error("explained transaction by transaction before the payment loop opens.");
    process.exit(1);
  }
  console.log("All identities balance.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
