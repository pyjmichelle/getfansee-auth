import "server-only";

import { getSupabaseServerClient } from "./supabase-server";

export type AppUser = {
  id: string;
  email: string;
};

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("[auth-server] getSession error", error);
    return null;
  }

  if (!session?.user || !session.user.email) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, ban_until")
    .eq("id", session.user.id)
    .single();

  if (profile) {
    const now = new Date();
    const isBanned = profile.is_banned || (profile.ban_until && new Date(profile.ban_until) > now);

    if (isBanned) {
      await supabase.auth.signOut();
      return null;
    }
  }

  return { id: session.user.id, email: session.user.email };
}

export async function ensureProfile() {
  const supabase = await getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    console.warn("[auth-server] ensureProfile: No user found");
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, age_verified, referrer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[auth-server] ensureProfile select error", error);
    return;
  }

  if (data) {
    return;
  }

  const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    user.email.split("@")[0]
  )}&background=random&color=fff&size=128`;

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    email: user.email,
    display_name: user.email.split("@")[0],
    role: "fan",
    age_verified: false,
    avatar_url: defaultAvatarUrl,
  });

  if (insertError) {
    console.error("[auth-server] ensureProfile insert error", insertError);
  }
}
