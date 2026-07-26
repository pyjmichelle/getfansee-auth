import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Sitemap (Pre-Payment Alpha SEO asset).
 *
 * Static pages + dynamic creator profiles and tag pages. Dynamic entries use a
 * plain anon supabase-js client (no cookies — sitemap runs outside request
 * scope) and degrade to the static list if the query fails.
 */

const MAX_DYNAMIC_ENTRIES = 500;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/home`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/creators`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/search`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/beta-terms`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    {
      url: `${baseUrl}/creator-rules`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/refund`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/dmca`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/2257`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/support`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return staticEntries;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [creatorsResult, tagsResult] = await Promise.all([
      supabase.from("public_creator_profiles").select("id").limit(MAX_DYNAMIC_ENTRIES),
      supabase.from("tags").select("name").limit(MAX_DYNAMIC_ENTRIES),
    ]);

    const creatorEntries: MetadataRoute.Sitemap = (creatorsResult.data ?? []).map((row) => ({
      url: `${baseUrl}/creator/${row.id}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    }));

    const tagEntries: MetadataRoute.Sitemap = (tagsResult.data ?? []).map((row) => ({
      url: `${baseUrl}/tags/${encodeURIComponent(row.name)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    return [...staticEntries, ...creatorEntries, ...tagEntries];
  } catch {
    return staticEntries;
  }
}
