import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getfansee.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/creator/", "/home", "/search", "/tags/"],
        disallow: [
          "/admin/",
          "/api/",
          "/auth/",
          "/me/",
          "/me/wallet",
          "/creator/studio/",
          "/creator/onboard",
          "/creator/upgrade/",
          "/purchases",
          "/subscriptions",
          "/notifications",
          "/report",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
