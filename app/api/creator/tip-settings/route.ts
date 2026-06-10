import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { DEFAULT_TIP_SETTINGS, validateTipSettingsInput, looksLikeQuidProQuo } from "@/lib/tips";

/**
 * GET /api/creator/tip-settings
 * Returns the authenticated creator's own tip settings (defaults if none saved yet).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdminClient();
    const { data } = await admin
      .from("creator_tip_settings")
      .select(
        "enabled, unit_label, unit_emoji, preset_amounts_cents, thank_you_message, goal_enabled, goal_title, goal_target_cents, goal_started_at, show_supporters"
      )
      .eq("creator_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      settings: data ?? DEFAULT_TIP_SETTINGS,
      isDefault: !data,
    });
  } catch (err: unknown) {
    console.error("[tip-settings] GET error", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/creator/tip-settings
 * Upserts the authenticated creator's tip settings.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const result = validateTipSettingsInput(body);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    const value = result.value;

    // Soft compliance guardrail: warn (do not block) on quid-pro-quo phrasing.
    const warning = looksLikeQuidProQuo(value.thank_you_message)
      ? "Your thank-you note may imply something is owed in exchange for a tip. Tips must remain voluntary gratuities."
      : null;

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("creator_tip_settings")
      .upsert(
        {
          creator_id: user.id,
          ...value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "creator_id" }
      )
      .select(
        "enabled, unit_label, unit_emoji, preset_amounts_cents, thank_you_message, goal_enabled, goal_title, goal_target_cents, goal_started_at, show_supporters"
      )
      .single();

    if (error) {
      console.error("[tip-settings] upsert error", error);
      return NextResponse.json(
        { success: false, error: "Failed to save settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, settings: data, warning });
  } catch (err: unknown) {
    console.error("[tip-settings] PUT error", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
