/**
 * Creator Ambassador Program — Commission accrual logic (Phase 5)
 *
 * Server-only. Uses admin (service-role) client.
 *
 * IMPORTANT — money-safety rules:
 *   - Commission amounts are INTERNAL ESTIMATED RECORDS only.
 *   - They do NOT touch wallet_accounts (no balance changes).
 *   - They are NOT withdrawable in MVP.
 *   - All math uses integer cents; no floats.
 *   - Accrual is idempotent via UNIQUE (attribution_id, period_start, period_end).
 *
 * Eligible revenue:
 *   - transactions.type IN ('ppv_revenue', 'subscription')
 *   - transactions.status = 'completed'  (excludes pending/failed/refunded)
 *   - user_id = referred_user_id
 *   - created_at within [max(qualified_at, last_watermark), now()]
 *   - attribution is not fraud/rejected
 *
 *   Known limitations (transactions table lacks these fields):
 *   - Chargeback, void, reversal, test/internal, risk-flag, payout-dispute
 *     exclusions are not enforceable in MVP.
 */

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────

export interface AccrualResult {
  processed: number;
  skipped: number;
  created: number;
  errors: number;
  wallet_balance_unchanged: true; // safety assertion — always true
}

// ─── Re-qualification sweep ───────────────────────────────

/**
 * Scan attributions that are stuck at `kyc_verified` and check whether the
 * referred creator has since earned their first eligible revenue.  If they
 * have, advance the attribution to `qualified` so the main accrual loop picks
 * it up in the same cron run.
 *
 * Called at the start of runAccrual() so that a single cron invocation can
 * both re-qualify AND immediately accrue commissions for newly qualified rows.
 *
 * This closes the gap where evaluateQualification() is only fired once at KYC
 * approval time: if the creator had no revenue then, they would be stuck at
 * kyc_verified forever without this sweep.
 *
 * Returns the number of attributions newly advanced to `qualified`.
 */
export async function requalifyKycVerifiedAttributions(): Promise<number> {
  const supabase = getSupabaseAdminClient();

  // Check program is enabled before doing any work
  const { data: settings } = await supabase
    .from("creator_referral_settings")
    .select("program_enabled, duration_months")
    .eq("id", 1)
    .single();

  if (!settings?.program_enabled) return 0;

  const durationMonths = Number(settings.duration_months ?? 12);

  // Fetch all kyc_verified, non-fraud attributions
  const { data: pending, error } = await supabase
    .from("creator_referral_attributions")
    .select("id, referred_user_id, referral_code")
    .eq("status", "kyc_verified")
    .eq("is_fraud", false);

  if (error) {
    logger.error("[accrual] requalify: failed to fetch kyc_verified attributions", error);
    return 0;
  }

  if (!pending?.length) return 0;

  let qualifiedCount = 0;
  const now = new Date();

  for (const attr of pending) {
    try {
      // Check if referred creator has at least one completed eligible transaction
      const { count } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", attr.referred_user_id)
        .in("type", ["ppv_revenue", "subscription"])
        .eq("status", "completed");

      if ((count ?? 0) === 0) continue;

      // Advance to qualified
      const qualifiedAt = now.toISOString();
      const windowEndsAt = new Date(
        now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const { error: updateError } = await supabase
        .from("creator_referral_attributions")
        .update({ status: "qualified", qualified_at: qualifiedAt, window_ends_at: windowEndsAt })
        .eq("id", attr.id);

      if (updateError) {
        logger.error("[accrual] requalify: failed to update attribution", updateError, {
          attributionId: attr.id,
        });
        continue;
      }

      // Emit qualification event for audit trail
      await supabase.from("creator_referral_events").insert({
        attribution_id: attr.id,
        referral_code: attr.referral_code,
        event_type: "qualified",
        actor_user_id: null,
        metadata: { triggered_by: "requalify_cron", qualified_at: qualifiedAt },
      });

      logger.info("[accrual] requalify: attribution advanced to qualified", {
        attributionId: attr.id,
        referredUserId: attr.referred_user_id,
      });

      qualifiedCount++;
    } catch (err) {
      logger.error("[accrual] requalify: per-attribution error", err, {
        attributionId: attr.id,
      });
    }
  }

  if (qualifiedCount > 0) {
    logger.info("[accrual] requalify: newly qualified attributions", { qualifiedCount });
  }

  return qualifiedCount;
}

// ─── Main accrual job ─────────────────────────────────────

/**
 * Run the commission accrual job.
 *
 * For each attribution in qualified/revenue_eligible status:
 *   - Read eligible revenue since last accrual watermark.
 *   - Compute estimated_commission_amount_cents = floor(revenue * percent / 100).
 *   - Upsert one creator_referral_commissions row per (attribution, period).
 *   - Advance attribution status to revenue_eligible if not already.
 *
 * Returns an AccrualResult summary.
 * Never throws: per-attribution errors are logged and counted.
 */
export async function runAccrual(): Promise<AccrualResult> {
  const supabase = getSupabaseAdminClient();
  const result: AccrualResult = {
    processed: 0,
    skipped: 0,
    created: 0,
    errors: 0,
    wallet_balance_unchanged: true,
  };

  // Step 0: re-qualify any kyc_verified attributions that now have eligible revenue.
  // This fixes the gap where a creator who had no revenue at KYC time would be stuck
  // at kyc_verified and never receive commissions for their referrer.
  const requalified = await requalifyKycVerifiedAttributions();
  if (requalified > 0) {
    logger.info("[accrual] Re-qualified attributions before main accrual run", { requalified });
  }

  // 1. Load settings
  const { data: settings } = await supabase
    .from("creator_referral_settings")
    .select("program_enabled, commission_percent, commission_cap_cents, duration_months")
    .eq("id", 1)
    .single();

  if (!settings?.program_enabled) {
    logger.info("[accrual] Program disabled, skipping");
    return result;
  }

  const commissionPercent = Number(settings.commission_percent);
  const capCents = settings.commission_cap_cents ? Number(settings.commission_cap_cents) : null;

  // 2. Fetch all eligible attributions
  const now = new Date().toISOString();
  const { data: attributions, error: attrError } = await supabase
    .from("creator_referral_attributions")
    .select(
      "id, referred_user_id, referrer_user_id, referral_code, qualified_at, window_ends_at, status"
    )
    .in("status", ["qualified", "revenue_eligible"])
    .eq("is_fraud", false)
    .lte("qualified_at", now);

  if (attrError) {
    logger.error("[accrual] Failed to fetch attributions", attrError);
    result.errors++;
    return result;
  }

  if (!attributions || attributions.length === 0) {
    logger.info("[accrual] No eligible attributions");
    return result;
  }

  for (const attr of attributions) {
    result.processed++;

    try {
      // Skip if outside window
      if (attr.window_ends_at && new Date(attr.window_ends_at) < new Date(now)) {
        result.skipped++;
        continue;
      }

      if (!attr.qualified_at) {
        result.skipped++;
        continue;
      }

      // 3. Find last accrual watermark for this attribution
      const { data: lastComm } = await supabase
        .from("creator_referral_commissions")
        .select("period_end")
        .eq("attribution_id", attr.id)
        .order("period_end", { ascending: false })
        .limit(1)
        .single();

      const periodStart = lastComm?.period_end ?? attr.qualified_at;
      const periodEnd = now;

      // Skip if period is too small (< 1 minute)
      if (new Date(periodEnd).getTime() - new Date(periodStart).getTime() < 60_000) {
        result.skipped++;
        continue;
      }

      // 4. Sum eligible revenue in period
      const windowEnd = attr.window_ends_at ?? now;
      const effectivePeriodEnd = periodEnd < windowEnd ? periodEnd : windowEnd;

      const { data: txns } = await supabase
        .from("transactions")
        .select("amount_cents")
        .eq("user_id", attr.referred_user_id)
        .in("type", ["ppv_revenue", "subscription"])
        .eq("status", "completed")
        .gte("created_at", periodStart)
        .lt("created_at", effectivePeriodEnd);

      const basisRevenueCents = (txns ?? []).reduce((s, t) => s + (t.amount_cents ?? 0), 0);

      if (basisRevenueCents <= 0) {
        result.skipped++;
        continue;
      }

      // 5. Apply cap check
      let estimatedCents = Math.floor((basisRevenueCents * commissionPercent) / 100);

      if (capCents !== null) {
        // Sum existing approved+pending for this attribution
        const { data: existing } = await supabase
          .from("creator_referral_commissions")
          .select("estimated_commission_amount_cents, status")
          .eq("attribution_id", attr.id)
          .not("status", "in", '("rejected")');

        const totalSoFar = (existing ?? []).reduce(
          (s, r) => s + (r.estimated_commission_amount_cents ?? 0),
          0
        );
        const remaining = capCents - totalSoFar;
        if (remaining <= 0) {
          result.skipped++;
          continue;
        }
        estimatedCents = Math.min(estimatedCents, remaining);
      }

      if (estimatedCents <= 0) {
        result.skipped++;
        continue;
      }

      // 6. Upsert commission row (idempotent via unique key)
      const { error: insertError } = await supabase.from("creator_referral_commissions").upsert(
        {
          attribution_id: attr.id,
          referrer_user_id: attr.referrer_user_id,
          referred_user_id: attr.referred_user_id,
          period_start: periodStart,
          period_end: effectivePeriodEnd,
          basis_revenue_cents: basisRevenueCents,
          commission_percent: commissionPercent,
          estimated_commission_amount_cents: estimatedCents,
          status: "pending",
          admin_action_source: "cron_recompute",
        },
        { onConflict: "attribution_id,period_start,period_end", ignoreDuplicates: true }
      );

      if (insertError) {
        logger.error("[accrual] Failed to upsert commission", insertError, {
          attributionId: attr.id,
        });
        result.errors++;
        continue;
      }

      result.created++;

      // 7. Advance status to revenue_eligible
      if (attr.status === "qualified") {
        await supabase
          .from("creator_referral_attributions")
          .update({ status: "revenue_eligible" })
          .eq("id", attr.id);
      }

      // 8. Emit event
      await supabase.from("creator_referral_events").insert({
        attribution_id: attr.id,
        referral_code: attr.referral_code,
        event_type: "commission_accrued",
        actor_user_id: null,
        metadata: {
          period_start: periodStart,
          period_end: effectivePeriodEnd,
          basis_revenue_cents: basisRevenueCents,
          estimated_commission_amount_cents: estimatedCents,
        },
      });

      logger.info("[accrual] Commission accrued", {
        attributionId: attr.id,
        referrerUserId: attr.referrer_user_id,
        estimatedCents,
        basisRevenueCents,
      });
    } catch (err) {
      logger.error("[accrual] Per-attribution error", err, { attributionId: attr.id });
      result.errors++;
    }
  }

  logger.info("[accrual] Accrual job complete", result as unknown as Record<string, unknown>);
  return result;
}
