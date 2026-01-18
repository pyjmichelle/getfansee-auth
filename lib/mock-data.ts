/**
 * Mock Data for Demo/Testing
 *
 * This file provides static mock data for when the database is empty
 * or when NEXT_PUBLIC_USE_MOCK_DATA=true is set.
 *
 * Uses stable online image services:
 * - ui-avatars.com for avatars (100% reliable, generates from name)
 * - picsum.photos with seed for consistent content images
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
  creator?: MockCreator;
}

export interface MockTag {
  id: string;
  name: string;
  category: string;
  count: number;
}

// Mock Creators - using ui-avatars.com for stable avatars
export const MOCK_CREATORS: MockCreator[] = [
  {
    id: "mock-creator-1",
    display_name: "Sophia Creative",
    username: "sophia_creative",
    avatar_url:
      "https://ui-avatars.com/api/?name=Sophia+Creative&background=6366f1&color=fff&size=150&bold=true",
    bio: "Digital artist and content creator. Sharing exclusive artwork and behind-the-scenes content.",
    role: "creator",
    subscriber_count: 1250,
    post_count: 48,
  },
  {
    id: "mock-creator-2",
    display_name: "Alex Photography",
    username: "alex_photo",
    avatar_url:
      "https://ui-avatars.com/api/?name=Alex+Photo&background=10b981&color=fff&size=150&bold=true",
    bio: "Professional photographer specializing in portraits and landscapes. Premium content weekly.",
    role: "creator",
    subscriber_count: 890,
    post_count: 72,
  },
  {
    id: "mock-creator-3",
    display_name: "Emma Lifestyle",
    username: "emma_lifestyle",
    avatar_url:
      "https://ui-avatars.com/api/?name=Emma+Life&background=f59e0b&color=fff&size=150&bold=true",
    bio: "Lifestyle and wellness creator. Daily tips, exclusive content, and personal updates.",
    role: "creator",
    subscriber_count: 2100,
    post_count: 156,
  },
  {
    id: "mock-creator-4",
    display_name: "Marcus Fitness",
    username: "marcus_fit",
    avatar_url:
      "https://ui-avatars.com/api/?name=Marcus+Fit&background=ef4444&color=fff&size=150&bold=true",
    bio: "Fitness coach and content creator. Workout routines, nutrition tips, and motivation.",
    role: "creator",
    subscriber_count: 3400,
    post_count: 89,
  },
  {
    id: "mock-creator-5",
    display_name: "Luna Art",
    username: "luna_art",
    avatar_url:
      "https://ui-avatars.com/api/?name=Luna+Art&background=8b5cf6&color=fff&size=150&bold=true",
    bio: "Digital illustrator and animator. Exclusive art drops and process videos.",
    role: "creator",
    subscriber_count: 1780,
    post_count: 64,
  },
];

// Mock Posts - using picsum.photos with seed for consistent images
export const MOCK_POSTS: MockPost[] = [
  {
    id: "mock-post-1",
    creator_id: "mock-creator-1",
    title: "Exclusive Digital Artwork",
    content:
      "Just finished this piece! Took me about 20 hours. Subscribers get access to the full resolution version and process video.",
    media_url: "https://picsum.photos/seed/art1/800/600",
    media_type: "image",
    visibility: "subscribers",
    price_cents: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    likes_count: 234,
    comments_count: 18,
  },
  {
    id: "mock-post-2",
    creator_id: "mock-creator-2",
    title: "Behind the Scenes - Photo Shoot",
    content:
      "Here's a sneak peek from yesterday's shoot. The full gallery with 50+ photos is available for subscribers!",
    media_url: "https://picsum.photos/seed/photo2/800/600",
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    likes_count: 456,
    comments_count: 32,
  },
  {
    id: "mock-post-3",
    creator_id: "mock-creator-3",
    title: "Morning Routine Secrets",
    content:
      "My complete morning routine that helped me transform my life. Includes workout, skincare, and mindset tips.",
    media_url: "https://picsum.photos/seed/lifestyle3/800/600",
    media_type: "image",
    visibility: "ppv",
    price_cents: 499,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
    likes_count: 789,
    comments_count: 67,
  },
  {
    id: "mock-post-4",
    creator_id: "mock-creator-4",
    title: "Full Body Workout - No Equipment",
    content:
      "30-minute workout you can do anywhere. Perfect for beginners and advanced alike. Let's get moving!",
    media_url: "https://picsum.photos/seed/fitness4/800/600",
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    likes_count: 1234,
    comments_count: 89,
  },
  {
    id: "mock-post-5",
    creator_id: "mock-creator-5",
    title: "New Character Design",
    content:
      "Meet my latest character! This one took forever to get right. Full turnaround sheet available for subscribers.",
    media_url: "https://picsum.photos/seed/art5/800/600",
    media_type: "image",
    visibility: "subscribers",
    price_cents: null,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    likes_count: 567,
    comments_count: 45,
  },
  {
    id: "mock-post-6",
    creator_id: "mock-creator-1",
    title: "Premium Art Pack - 10 Exclusive Pieces",
    content:
      "Exclusive collection of 10 high-resolution artworks. Each piece is unique and won't be posted anywhere else.",
    media_url: "https://picsum.photos/seed/art6/800/600",
    media_type: "image",
    visibility: "ppv",
    price_cents: 999,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    likes_count: 345,
    comments_count: 28,
  },
  {
    id: "mock-post-7",
    creator_id: "mock-creator-2",
    title: "Golden Hour Photography Tips",
    content: "Learn how to capture the perfect golden hour shot. Free tutorial for everyone!",
    media_url: "https://picsum.photos/seed/photo7/800/600",
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    likes_count: 892,
    comments_count: 56,
  },
  {
    id: "mock-post-8",
    creator_id: "mock-creator-3",
    title: "Weekly Q&A - Ask Me Anything",
    content:
      "It's Q&A time! Drop your questions in the comments and I'll answer them in my next video.",
    media_url: "https://picsum.photos/seed/lifestyle8/800/600",
    media_type: "image",
    visibility: "free",
    price_cents: null,
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
    likes_count: 678,
    comments_count: 234,
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
  // For demo purposes, return posts based on creator specialty
  const tagCreatorMap: Record<string, string[]> = {
    art: ["mock-creator-1", "mock-creator-5"],
    photography: ["mock-creator-2"],
    lifestyle: ["mock-creator-3"],
    fitness: ["mock-creator-4"],
    exclusive: ["mock-creator-1", "mock-creator-5"],
    tutorial: ["mock-creator-2", "mock-creator-4"],
    behindthescenes: ["mock-creator-1", "mock-creator-2"],
    digital: ["mock-creator-1", "mock-creator-5"],
  };

  const creatorIds = tagCreatorMap[tagName.toLowerCase()] || [];
  return getMockPostsWithCreators().filter((post) => creatorIds.includes(post.creator_id));
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
