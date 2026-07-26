import type { Metadata } from "next";
import { getSupabaseServerClient } from "@/lib/server/supabase-server";

/**
 * SEO metadata for public creator profiles (Pre-Payment Alpha core asset).
 * The page itself is a client component; metadata is generated here from the
 * public-safe `public_creator_profiles` view.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const fallback: Metadata = {
    title: "Creator Profile — GetFanSee",
    description: "Discover verified creators on GetFanSee.",
  };

  // Only fetch for UUID-shaped ids to avoid pointless queries.
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return fallback;
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: creator } = await supabase
      .from("public_creator_profiles")
      .select("display_name, bio, avatar_url")
      .eq("id", id)
      .maybeSingle();

    if (!creator?.display_name) {
      return fallback;
    }

    const title = `${creator.display_name} — GetFanSee`;
    const description = creator.bio
      ? creator.bio.slice(0, 160)
      : `Follow ${creator.display_name} on GetFanSee — verified creator profiles, free to follow.`;

    return {
      title,
      description,
      alternates: {
        canonical: `/creator/${id}`,
      },
      openGraph: {
        title,
        description,
        url: `/creator/${id}`,
        type: "profile",
        ...(creator.avatar_url ? { images: [{ url: creator.avatar_url }] } : {}),
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch {
    return fallback;
  }
}

export default function CreatorProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
