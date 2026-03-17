import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * POST /api/kyc/submit
 * Accepts multipart/form-data KYC submission from the KYC page.
 * Uploads documents to private "verification" storage bucket and
 * inserts a creator_verifications record with status "pending".
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();

    const realName = (formData.get("fullName") as string | null)?.trim();
    const dateOfBirth = formData.get("dateOfBirth") as string | null;
    const country = (formData.get("country") as string | null)?.trim() || "Not specified";
    const idType = (formData.get("idType") as string | null)?.trim();

    if (!realName || !dateOfBirth || !idType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate age (must be 18+)
    const dob = new Date(dateOfBirth);
    const ageMs = Date.now() - dob.getTime();
    const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 18) {
      return NextResponse.json({ error: "You must be at least 18 years old" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();

    // Upload each document file to the private "verification" bucket
    const docFiles = formData.getAll("documents") as File[];
    const idDocUrls: string[] = [];

    for (const file of docFiles) {
      if (!file || file.size === 0) continue;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filePath = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const { data: uploadData, error: uploadError } = await admin.storage
        .from("verification")
        .upload(filePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        console.error("[api/kyc/submit] upload error:", uploadError);
        return NextResponse.json(
          { error: `Failed to upload document: ${uploadError.message}` },
          { status: 500 }
        );
      }

      idDocUrls.push(uploadData.path);
    }

    // Upsert the creator_verifications record
    const { error: dbError } = await admin.from("creator_verifications").upsert(
      {
        user_id: user.id,
        real_name: realName,
        birth_date: dateOfBirth,
        country,
        id_doc_urls: idDocUrls,
        status: "pending",
      },
      { onConflict: "user_id" }
    );

    if (dbError) {
      console.error("[api/kyc/submit] db error:", dbError);
      return NextResponse.json({ error: "Failed to save verification record" }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: "pending" });
  } catch (err: unknown) {
    console.error("[api/kyc/submit] error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
