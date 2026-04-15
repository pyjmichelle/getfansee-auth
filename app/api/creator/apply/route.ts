import { NextRequest, NextResponse } from "next/server";
import { withAuth, badRequest, serverError } from "@/lib/route-handler";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type CreatorApplicationPayload = {
  displayName: string;
  bio: string;
  categories: string[];
  socialLinks?: string;
  reason: string;
};

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = (await request.json()) as CreatorApplicationPayload;
    const { displayName, bio, categories, socialLinks, reason } = body;

    if (!displayName?.trim()) return badRequest("Display name is required");
    if (!bio?.trim() || bio.trim().length < 50)
      return badRequest("Bio must be at least 50 characters");
    if (!categories || categories.length === 0)
      return badRequest("At least one content category is required");
    if (!reason?.trim()) return badRequest("Motivation is required");

    const adminSupabase = getSupabaseAdminClient();

    const { error } = await adminSupabase.from("creator_applications").insert({
      user_id: user.id,
      display_name: displayName.trim(),
      bio: bio.trim(),
      categories,
      social_links: socialLinks?.trim() || null,
      reason: reason.trim(),
      status: "pending",
    });

    if (error) {
      if (error.code === "42P01") {
        console.error(
          "[api/creator/apply] Table does not exist, falling back to profiles metadata"
        );
        const { error: profileError } = await adminSupabase
          .from("profiles")
          .update({
            creator_application: {
              display_name: displayName.trim(),
              bio: bio.trim(),
              categories,
              social_links: socialLinks?.trim() || null,
              reason: reason.trim(),
              status: "pending",
              applied_at: new Date().toISOString(),
            },
          })
          .eq("id", user.id);

        if (profileError) {
          console.error("[api/creator/apply] profile fallback error:", profileError);
          return serverError("Failed to submit application");
        }

        return NextResponse.json({ success: true });
      }

      console.error("[api/creator/apply] insert error:", error);
      return serverError("Failed to submit application");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/creator/apply] POST error:", err);
    return serverError();
  }
});
