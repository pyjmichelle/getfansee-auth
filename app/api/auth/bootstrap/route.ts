import { NextResponse } from "next/server";
import { getCurrentUser, ensureProfile } from "@/lib/auth-server";
import { getProfile } from "@/lib/profile-server";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    await ensureProfile(user);
    const profile = await getProfile(user.id);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profile
        ? {
            role: (profile.role || "fan") as "fan" | "creator" | "admin",
            display_name: profile.display_name || "",
            avatar_url: profile.avatar_url || null,
          }
        : null,
    });
  } catch (err: unknown) {
    console.error("[api/auth/bootstrap] error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
