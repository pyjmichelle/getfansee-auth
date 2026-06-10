import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { DEFAULT_TIP_SETTINGS, type CreatorTipSettings, type TipSupporter } from "@/lib/tips";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUPPORTER_LIMIT = 12;

/**
 * GET /api/creator/[id]/tip-settings
 *
 * Public (fan-facing) read of a creator's tip panel: settings, goal progress,
 * and a recent supporters list (only if the creator opted in).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ success: false, error: "Invalid creator id" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();

    const { data: row } = await admin
      .from("creator_tip_settings")
      .select(
        "enabled, unit_label, unit_emoji, preset_amounts_cents, thank_you_message, goal_enabled, goal_title, goal_target_cents, goal_started_at, show_supporters"
      )
      .eq("creator_id", id)
      .maybeSingle();

    // No row → treat as default-enabled with defaults.
    const settings: CreatorTipSettings = row ? (row as CreatorTipSettings) : DEFAULT_TIP_SETTINGS;

    if (!settings.enabled) {
      return NextResponse.json({
        success: true,
        settings: { ...settings },
        goal: null,
        supporters: [],
      });
    }

    // Goal progress (gross tips since goal started)
    let goal: { title: string | null; target_cents: number; raised_cents: number } | null = null;
    if (settings.goal_enabled && settings.goal_target_cents && settings.goal_target_cents > 0) {
      let goalQuery = admin.from("tips").select("amount_cents").eq("creator_id", id);
      if (settings.goal_started_at) {
        goalQuery = goalQuery.gte("created_at", settings.goal_started_at);
      }
      const { data: goalTips } = await goalQuery;
      const raised = (goalTips ?? []).reduce((sum, t) => sum + (t.amount_cents as number), 0);
      goal = {
        title: settings.goal_title,
        target_cents: settings.goal_target_cents,
        raised_cents: raised,
      };
    }

    // Recent supporters (opt-in)
    let supporters: TipSupporter[] = [];
    if (settings.show_supporters) {
      const { data: recentTips } = await admin
        .from("tips")
        .select("fan_id, amount_cents, message, created_at")
        .eq("creator_id", id)
        .order("created_at", { ascending: false })
        .limit(SUPPORTER_LIMIT);

      if (recentTips && recentTips.length > 0) {
        const fanIds = Array.from(new Set(recentTips.map((t) => t.fan_id as string)));
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", fanIds);
        const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p]));

        supporters = recentTips.map((t) => {
          const p = profileMap.get(t.fan_id as string);
          return {
            display_name: (p?.display_name as string) || "Supporter",
            avatar_url: (p?.avatar_url as string) || null,
            amount_cents: t.amount_cents as number,
            message: (t.message as string) || null,
            created_at: t.created_at as string,
          };
        });
      }
    }

    return NextResponse.json({ success: true, settings, goal, supporters });
  } catch (err: unknown) {
    console.error("[creator tip-settings] GET error", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
