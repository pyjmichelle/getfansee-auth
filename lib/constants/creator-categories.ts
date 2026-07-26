/**
 * Creator primary categories (Pre-Payment Alpha).
 *
 * Single source of truth shared by:
 * - Creator Studio "Profile & Links" category picker
 * - /creators public directory filter chips
 * - /api/creators/directory category validation
 */
export const CREATOR_CATEGORIES = [
  "Photography",
  "Fitness",
  "Fashion",
  "Gaming",
  "Music",
  "Art",
  "Lifestyle",
  "Adult",
] as const;

export type CreatorCategory = (typeof CREATOR_CATEGORIES)[number];

export function isCreatorCategory(value: string): value is CreatorCategory {
  return (CREATOR_CATEGORIES as readonly string[]).includes(value);
}
