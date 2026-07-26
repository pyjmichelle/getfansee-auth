import type { Metadata } from "next";

/**
 * SEO metadata for public tag pages (Pre-Payment Alpha discovery asset).
 * The page itself is a client component; metadata is generated here.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const tagName = decodeURIComponent(tag);

  const title = `#${tagName} — GetFanSee`;
  const description = `Browse posts and creators tagged #${tagName} on GetFanSee.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/tags/${encodeURIComponent(tagName)}`,
    },
    openGraph: {
      title,
      description,
      url: `/tags/${encodeURIComponent(tagName)}`,
      type: "website",
    },
  };
}

export default function TagLayout({ children }: { children: React.ReactNode }) {
  return children;
}
