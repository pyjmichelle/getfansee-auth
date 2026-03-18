/**
 * Mock Data for Demo/Testing
 *
 * This file provides static mock data for when the database is empty
 * or when NEXT_PUBLIC_USE_MOCK_DATA=true is set.
 *
 * Uses stable online image services and local placeholders:
 * - ui-avatars.com for avatars (100% reliable, generates from name)
 * - picsum.photos with seed for consistent post images
 */

export interface MockCreator {
  id: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  username?: string;
  role: "creator";
  subscriber_count?: number;
  post_count?: number;
  subscription_price_cents?: number;
  tags?: string[];
}

export interface MockPost {
  id: string;
  creator_id: string;
  title: string;
  content: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
  visibility: "free" | "subscribers" | "ppv";
  price_cents: number | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  tags?: string[];
  creator?: MockCreator;
}

export interface MockTag {
  id: string;
  name: string;
  category: string;
  count: number;
}

// Mock Creators — 10 creators covering different niches
export const MOCK_CREATORS: MockCreator[] = [
  {
    id: "mock-creator-1",
    display_name: "Sophia Creative",
    username: "sophia_creative",
    avatar_url:
      "https://ui-avatars.com/api/?name=Sophia+Creative&background=6366f1&color=fff&size=150&bold=true",
    bio: "Digital artist and content creator. Sharing exclusive artwork and behind-the-scenes content. Featured in Vogue, Adobe Blog & Behance.",
    role: "creator",
    subscriber_count: 1250,
    post_count: 48,
    subscription_price_cents: 999,
    tags: ["art", "digital", "exclusive"],
  },
  {
    id: "mock-creator-2",
    display_name: "Alex Photography",
    username: "alex_photo",
    avatar_url:
      "https://ui-avatars.com/api/?name=Alex+Photo&background=10b981&color=fff&size=150&bold=true",
    bio: "Professional photographer specializing in portraits and landscapes. Premium content weekly. 10+ years capturing the world.",
    role: "creator",
    subscriber_count: 890,
    post_count: 72,
    subscription_price_cents: 799,
    tags: ["photography", "behindthescenes", "tutorial"],
  },
  {
    id: "mock-creator-3",
    display_name: "Emma Lifestyle",
    username: "emma_lifestyle",
    avatar_url:
      "https://ui-avatars.com/api/?name=Emma+Life&background=f59e0b&color=fff&size=150&bold=true",
    bio: "Lifestyle and wellness creator. Daily tips, exclusive content, and personal updates. Building a healthy, beautiful life.",
    role: "creator",
    subscriber_count: 2100,
    post_count: 156,
    subscription_price_cents: 599,
    tags: ["lifestyle", "fitness", "tutorial"],
  },
  {
    id: "mock-creator-4",
    display_name: "Marcus Fitness",
    username: "marcus_fit",
    avatar_url:
      "https://ui-avatars.com/api/?name=Marcus+Fit&background=ef4444&color=fff&size=150&bold=true",
    bio: "Fitness coach and content creator. Workout routines, nutrition tips, and motivation. Transforming lives one rep at a time.",
    role: "creator",
    subscriber_count: 3400,
    post_count: 89,
    subscription_price_cents: 1299,
    tags: ["fitness", "tutorial", "exclusive"],
  },
  {
    id: "mock-creator-5",
    display_name: "Luna Art",
    username: "luna_art",
    avatar_url:
      "https://ui-avatars.com/api/?name=Luna+Art&background=8b5cf6&color=fff&size=150&bold=true",
    bio: "Digital illustrator and animator. Exclusive art drops and process videos. Creating worlds with pixels.",
    role: "creator",
    subscriber_count: 1780,
    post_count: 64,
    subscription_price_cents: 899,
    tags: ["art", "digital", "exclusive"],
  },
  {
    id: "mock-creator-6",
    display_name: "Tyler Music",
    username: "tyler_music",
    avatar_url:
      "https://ui-avatars.com/api/?name=Tyler+Music&background=0ea5e9&color=fff&size=150&bold=true",
    bio: "Indie musician and producer. Exclusive tracks, covers, and production tutorials. Turning feelings into sound.",
    role: "creator",
    subscriber_count: 2340,
    post_count: 93,
    subscription_price_cents: 699,
    tags: ["music", "tutorial", "exclusive"],
  },
  {
    id: "mock-creator-7",
    display_name: "Zoe Travel",
    username: "zoe_travel",
    avatar_url:
      "https://ui-avatars.com/api/?name=Zoe+Travel&background=14b8a6&color=fff&size=150&bold=true",
    bio: "Travel photographer & vlogger. 50+ countries, endless adventures. Exclusive destination guides and photography tips.",
    role: "creator",
    subscriber_count: 4200,
    post_count: 211,
    subscription_price_cents: 499,
    tags: ["travel", "photography", "lifestyle"],
  },
  {
    id: "mock-creator-8",
    display_name: "Kai Cooking",
    username: "kai_cooking",
    avatar_url:
      "https://ui-avatars.com/api/?name=Kai+Cooking&background=f97316&color=fff&size=150&bold=true",
    bio: "Chef & food stylist. Exclusive recipes, plating tutorials, and food photography secrets. Michelin-trained home cooking.",
    role: "creator",
    subscriber_count: 1560,
    post_count: 78,
    subscription_price_cents: 799,
    tags: ["lifestyle", "tutorial", "behindthescenes"],
  },
  {
    id: "mock-creator-9",
    display_name: "Nadia Fashion",
    username: "nadia_fashion",
    avatar_url:
      "https://ui-avatars.com/api/?name=Nadia+Fashion&background=ec4899&color=fff&size=150&bold=true",
    bio: "Fashion stylist and content creator. Exclusive lookbooks, styling tips, and brand partnerships. Making every outfit count.",
    role: "creator",
    subscriber_count: 5100,
    post_count: 164,
    subscription_price_cents: 999,
    tags: ["lifestyle", "photography", "exclusive"],
  },
  {
    id: "mock-creator-10",
    display_name: "Dev Insights",
    username: "dev_insights",
    avatar_url:
      "https://ui-avatars.com/api/?name=Dev+Insights&background=6b7280&color=fff&size=150&bold=true",
    bio: "Senior software engineer sharing coding tutorials, system design, and career advice. 15 years of tech experience.",
    role: "creator",
    subscriber_count: 3800,
    post_count: 127,
    subscription_price_cents: 1499,
    tags: ["tutorial", "exclusive", "digital"],
  },
];

// Stable picsum seeds per creator for consistency
const IMG = (seed: string, w = 800, h = 600) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

// Mock Posts — 3+ posts per creator, mixed visibility
export const MOCK_POSTS: MockPost[] = [
  // ── Sophia Creative (creator-1) ────────────────────────
  {
    id: "mock-post-1",
    creator_id: "mock-creator-1",
    title: "Exclusive Digital Artwork",
    content:
      "Just finished this piece! Took me about 20 hours. Subscribers get access to the full resolution version and process video.",
    media_url: IMG("sophia-art1", 800, 1000),
    media_type: "image",
    visibility: "subscribers",
    price_cents: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    likes_count: 234,
    comments_count: 18,
    tags: ["art", "digital", "exclusive"],
  },
  {
    id: "mock-post-2",
    creator_id: "mock-creator-1",
    title: "Free Sketch Tutorial",
    content:
      "Here's a quick free sketch showing my process. It's all about light and shadow — let me know what you think!",
    media_url: IMG("sophia-art2"),
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    likes_count: 511,
    comments_count: 42,
    tags: ["art", "tutorial"],
  },
  {
    id: "mock-post-3",
    creator_id: "mock-creator-1",
    title: "Premium Art Pack — 10 Exclusive Pieces",
    content:
      "Exclusive collection of 10 high-resolution artworks. Each piece is unique and won't be posted anywhere else.",
    media_url: IMG("sophia-art3"),
    media_type: "image",
    visibility: "ppv",
    price_cents: 999,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 345,
    comments_count: 28,
    tags: ["art", "exclusive"],
  },

  // ── Alex Photography (creator-2) ────────────────────────
  {
    id: "mock-post-4",
    creator_id: "mock-creator-2",
    title: "Behind the Scenes — Photo Shoot",
    content:
      "Here's a sneak peek from yesterday's shoot in the mountains. The full gallery with 50+ photos is available for subscribers!",
    media_url: IMG("alex-photo1"),
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    likes_count: 456,
    comments_count: 32,
    tags: ["photography", "behindthescenes"],
  },
  {
    id: "mock-post-5",
    creator_id: "mock-creator-2",
    title: "Golden Hour Photography Tips",
    content:
      "Learn how to capture the perfect golden hour shot. Free tutorial — subscribe for the full lighting guide!",
    media_url: IMG("alex-photo2", 800, 1000),
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 892,
    comments_count: 56,
    tags: ["photography", "tutorial"],
  },
  {
    id: "mock-post-6",
    creator_id: "mock-creator-2",
    title: "Exclusive Full Gallery — NYC Streets",
    content:
      "Full gallery from my latest NYC street photography session. 100+ raw edits, only for subscribers.",
    media_url: IMG("alex-photo3"),
    media_type: "image",
    visibility: "subscribers",
    price_cents: null,
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 678,
    comments_count: 45,
    tags: ["photography", "exclusive"],
  },

  // ── Emma Lifestyle (creator-3) ────────────────────────
  {
    id: "mock-post-7",
    creator_id: "mock-creator-3",
    title: "Morning Routine Secrets",
    content:
      "My complete morning routine that transformed my life. Includes workout, skincare, and mindset tips for subscribers.",
    media_url: IMG("emma-life1"),
    media_type: "image",
    visibility: "ppv",
    price_cents: 499,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    likes_count: 789,
    comments_count: 67,
    tags: ["lifestyle", "tutorial"],
  },
  {
    id: "mock-post-8",
    creator_id: "mock-creator-3",
    title: "Weekly Q&A — Ask Me Anything",
    content:
      "It's Q&A time! Drop your questions in the comments and I'll answer them in my next video.",
    media_url: IMG("emma-life2"),
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 678,
    comments_count: 234,
    tags: ["lifestyle"],
  },
  {
    id: "mock-post-9",
    creator_id: "mock-creator-3",
    title: "Exclusive Wellness Guide",
    content: "My 30-day wellness programme — meal plans, workout schedule, and mindset journal.",
    media_url: IMG("emma-life3"),
    media_type: "image",
    visibility: "subscribers",
    price_cents: null,
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 1023,
    comments_count: 88,
    tags: ["lifestyle", "fitness", "exclusive"],
  },

  // ── Marcus Fitness (creator-4) ────────────────────────
  {
    id: "mock-post-10",
    creator_id: "mock-creator-4",
    title: "Full Body Workout — No Equipment",
    content:
      "30-minute workout you can do anywhere. Perfect for beginners and advanced alike. Let's get moving!",
    media_url: IMG("marcus-fit1"),
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    likes_count: 1234,
    comments_count: 89,
    tags: ["fitness"],
  },
  {
    id: "mock-post-11",
    creator_id: "mock-creator-4",
    title: "12-Week Transformation Plan",
    content:
      "Exclusive 12-week body transformation plan with meal prep, workouts, and weekly check-ins.",
    media_url: IMG("marcus-fit2"),
    media_type: "image",
    visibility: "subscribers",
    price_cents: null,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 2100,
    comments_count: 156,
    tags: ["fitness", "exclusive", "tutorial"],
  },
  {
    id: "mock-post-12",
    creator_id: "mock-creator-4",
    title: "Advanced HIIT Session",
    content:
      "Intense 45-minute HIIT session — not for the faint-hearted! Available exclusively for subscribers.",
    media_url: IMG("marcus-fit3"),
    media_type: "image",
    visibility: "ppv",
    price_cents: 799,
    created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 987,
    comments_count: 73,
    tags: ["fitness", "exclusive"],
  },

  // ── Luna Art (creator-5) ────────────────────────
  {
    id: "mock-post-13",
    creator_id: "mock-creator-5",
    title: "New Character Design",
    content:
      "Meet my latest character! This one took forever to get right. Full turnaround sheet available for subscribers.",
    media_url: IMG("luna-art1", 800, 1000),
    media_type: "image",
    visibility: "subscribers",
    price_cents: null,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 567,
    comments_count: 45,
    tags: ["art", "exclusive"],
  },
  {
    id: "mock-post-14",
    creator_id: "mock-creator-5",
    title: "Speed Art — Fantasy Landscape",
    content:
      "A 1-hour speed art session creating a fantasy landscape from scratch. Brushes and settings linked in bio.",
    media_url: IMG("luna-art2"),
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    likes_count: 812,
    comments_count: 61,
    tags: ["art", "digital", "tutorial"],
  },
  {
    id: "mock-post-15",
    creator_id: "mock-creator-5",
    title: "Exclusive Brush Pack Vol.3",
    content: "30 custom brushes I've been refining for 2 years. Now available as a PPV pack.",
    media_url: IMG("luna-art3"),
    media_type: "image",
    visibility: "ppv",
    price_cents: 1299,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 444,
    comments_count: 37,
    tags: ["art", "digital", "exclusive"],
  },

  // ── Tyler Music (creator-6) ────────────────────────
  {
    id: "mock-post-16",
    creator_id: "mock-creator-6",
    title: "New Single — Behind the Track",
    content: "The story behind my new single. Subscribers get the stems and Ableton project file!",
    media_url: IMG("tyler-music1"),
    media_type: "image",
    visibility: "subscribers",
    price_cents: null,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    likes_count: 723,
    comments_count: 58,
    tags: ["music", "exclusive", "behindthescenes"],
  },
  {
    id: "mock-post-17",
    creator_id: "mock-creator-6",
    title: "Free Chord Progression Tutorial",
    content:
      "This one chord progression will make your songs sound 10x better. Free tutorial for everyone!",
    media_url: IMG("tyler-music2"),
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 1567,
    comments_count: 134,
    tags: ["music", "tutorial"],
  },

  // ── Zoe Travel (creator-7) ────────────────────────
  {
    id: "mock-post-18",
    creator_id: "mock-creator-7",
    title: "Bali Hidden Gems",
    content:
      "These 5 spots in Bali aren't on any travel blog. Exclusive guide with GPS coordinates for subscribers.",
    media_url: IMG("zoe-travel1"),
    media_type: "image",
    visibility: "subscribers",
    price_cents: null,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    likes_count: 2341,
    comments_count: 187,
    tags: ["travel", "exclusive"],
  },
  {
    id: "mock-post-19",
    creator_id: "mock-creator-7",
    title: "Tokyo Street Photography",
    content:
      "A full day shooting in Tokyo's Shimokitazawa neighbourhood. All free to view — enjoy!",
    media_url: IMG("zoe-travel2"),
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 3102,
    comments_count: 245,
    tags: ["travel", "photography"],
  },

  // ── Kai Cooking (creator-8) ────────────────────────
  {
    id: "mock-post-20",
    creator_id: "mock-creator-8",
    title: "Michelin-Style Plating at Home",
    content: "You don't need a 3-star kitchen to plate like a pro. Here's my free starter guide.",
    media_url: IMG("kai-cook1"),
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    likes_count: 1876,
    comments_count: 142,
    tags: ["lifestyle", "tutorial"],
  },
  {
    id: "mock-post-21",
    creator_id: "mock-creator-8",
    title: "Exclusive Recipe Book — Vol.2",
    content:
      "50 exclusive recipes including my signature ramen, wagyu steak, and miso caramel dessert. Subscribers only.",
    media_url: IMG("kai-cook2"),
    media_type: "image",
    visibility: "subscribers",
    price_cents: null,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 2203,
    comments_count: 179,
    tags: ["lifestyle", "exclusive", "behindthescenes"],
  },

  // ── Nadia Fashion (creator-9) ────────────────────────
  {
    id: "mock-post-22",
    creator_id: "mock-creator-9",
    title: "Summer Lookbook 2026",
    content: "My full summer lookbook — 20 outfit ideas for every occasion. Free preview here!",
    media_url: IMG("nadia-fashion1", 800, 1000),
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    likes_count: 3450,
    comments_count: 278,
    tags: ["lifestyle", "photography"],
  },
  {
    id: "mock-post-23",
    creator_id: "mock-creator-9",
    title: "Exclusive Styling Masterclass",
    content:
      "1-hour video masterclass on capsule wardrobes, colour theory, and personal style. Subscribers only.",
    media_url: IMG("nadia-fashion2"),
    media_type: "image",
    visibility: "subscribers",
    price_cents: null,
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 2890,
    comments_count: 213,
    tags: ["lifestyle", "exclusive", "tutorial"],
  },

  // ── Dev Insights (creator-10) ────────────────────────
  {
    id: "mock-post-24",
    creator_id: "mock-creator-10",
    title: "System Design for Senior Engineers",
    content: "Free intro to distributed system design patterns every senior engineer should know.",
    media_url: IMG("dev-insights1"),
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    likes_count: 4210,
    comments_count: 312,
    tags: ["tutorial", "digital"],
  },
  {
    id: "mock-post-25",
    creator_id: "mock-creator-10",
    title: "Complete Interview Prep Pack",
    content:
      "250 LeetCode-style problems with solutions, system design case studies, and salary negotiation scripts.",
    media_url: IMG("dev-insights2"),
    media_type: "image",
    visibility: "ppv",
    price_cents: 2999,
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 1987,
    comments_count: 156,
    tags: ["tutorial", "exclusive"],
  },
];

// Mock Tags
export const MOCK_TAGS: MockTag[] = [
  { id: "tag-1", name: "art", category: "content", count: 156 },
  { id: "tag-2", name: "photography", category: "content", count: 98 },
  { id: "tag-3", name: "lifestyle", category: "content", count: 234 },
  { id: "tag-4", name: "fitness", category: "content", count: 187 },
  { id: "tag-5", name: "exclusive", category: "content", count: 312 },
  { id: "tag-6", name: "tutorial", category: "content", count: 89 },
  { id: "tag-7", name: "behindthescenes", category: "content", count: 145 },
  { id: "tag-8", name: "digital", category: "content", count: 76 },
  { id: "tag-9", name: "music", category: "content", count: 63 },
  { id: "tag-10", name: "travel", category: "content", count: 201 },
];

// Helper function to get mock posts with creator info
export function getMockPostsWithCreators(): MockPost[] {
  return MOCK_POSTS.map((post) => ({
    ...post,
    creator: MOCK_CREATORS.find((c) => c.id === post.creator_id),
  }));
}

// Helper function to get mock posts by tag
export function getMockPostsByTag(tagName: string): MockPost[] {
  return getMockPostsWithCreators().filter((post) => post.tags?.includes(tagName.toLowerCase()));
}

// Helper function to search mock creators
export function searchMockCreators(query: string): MockCreator[] {
  const lowerQuery = query.toLowerCase();
  return MOCK_CREATORS.filter(
    (creator) =>
      creator.display_name.toLowerCase().includes(lowerQuery) ||
      creator.username?.toLowerCase().includes(lowerQuery) ||
      creator.bio.toLowerCase().includes(lowerQuery)
  );
}

// Helper function to search mock tags
export function searchMockTags(query: string): MockTag[] {
  const lowerQuery = query.toLowerCase().replace("#", "");
  return MOCK_TAGS.filter((tag) => tag.name.toLowerCase().includes(lowerQuery));
}

// Check if mock data should be used
export function shouldUseMockData(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
}
