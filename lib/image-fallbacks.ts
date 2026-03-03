/**
 * Centralized image fallback URLs for avatars and media.
 * Used across the app to avoid 404s and to keep asset paths maintainable.
 * See docs/IMAGE_ASSETS.md for asset list and licensing.
 */

/** Default avatar when fan/user has no avatar_url. */
export const DEFAULT_AVATAR_FAN = "/images/avatars/fan-default.jpg";

/** Default avatar when creator has no avatar_url. */
export const DEFAULT_AVATAR_CREATOR = "/images/avatars/creator-default.jpg";

/** Legacy root path for fan avatar (backward compat). Points to same asset as DEFAULT_AVATAR_FAN. */
export const FAN_USER_AVATAR_LEGACY = "/fan-user-avatar.jpg";

/** Legacy root path for creator avatar (e.g. PublishSuccess). Points to same asset as DEFAULT_AVATAR_CREATOR. */
export const CREATOR_AVATAR_LEGACY = "/creator-avatar.png";

/** Default image when post has no media. Used in MediaDisplay empty state. */
export const DEFAULT_POST_MEDIA = "/images/placeholders/post-media-1-pc.jpg";

/** Generic placeholder (e.g. SVG) for legacy or unknown contexts. */
export const PLACEHOLDER_GENERIC = "/placeholder.svg";
