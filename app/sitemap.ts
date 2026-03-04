import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";
  const now = new Date();

  return [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/home`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/search`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/dmca`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
