import { NextRequest, NextResponse } from "next/server";
import { setRoleCreator } from "@/lib/profile-server";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type CreatorPayload = {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
};

/**
 * POST /api/creator/create
 *
 * Upgrades the current user to a creator. Requires KYC approval.
 * If KYC is not yet approved, returns 403 with guidance to complete KYC first.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Gate: require KYC approved before granting creator role
    const adminSupabase = getSupabaseAdminClient();
    const { data: verification } = await adminSupabase
      .from("creator_verifications")
      .select("status")
      .eq("user_id", user.id)
      .single();

    if (verification?.status !== "approved") {
      return NextResponse.json(
        {
          error: "KYC_REQUIRED",
          message: "Complete identity verification before becoming a creator",
          kycStatus: verification?.status ?? "not_started",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as CreatorPayload;
    const { display_name, bio, avatar_url } = body;

    const success = await setRoleCreator(user.id);
    if (!success) {
      return NextResponse.json({ error: "Failed to set creator role" }, { status: 500 });
    }

    const supabase = await getSupabaseServerClient();
    const { error: creatorError } = await supabase.from("creators").upsert(
      {
        id: user.id,
        display_name: display_name || user.email?.split("@")[0] || "creator",
        bio: bio || null,
        avatar_url: avatar_url || null,
      },
      { onConflict: "id" }
    );

    if (creatorError) {
      console.error("[api] create creator error:", creatorError);
      return NextResponse.json({ error: "Failed to create creator record" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api] creator create error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
