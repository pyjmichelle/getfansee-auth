import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "fan", email: "fan@example.com" } as { id: string; email: string } | null,
  rows: [] as Record<string, unknown>[],
  subscriptions: new Map<string, boolean>(),
  purchases: new Map<string, boolean>(),
  filters: [] as [string, unknown][],
  country: null as string | null,
  blocked: false,
  creatorError: false,
}));

function query(table: string) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((key: string, value: unknown) => {
      state.filters.push([key, value]);
      return builder;
    }),
    is: vi.fn((key: string, value: unknown) => {
      state.filters.push([key, value]);
      return builder;
    }),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn(() =>
      Promise.resolve({
        data: table === "public_creator_profiles" ? { blocked_countries: ["JP"] } : state.rows[0],
        error:
          table === "public_creator_profiles" && state.creatorError
            ? { message: "unavailable" }
            : null,
      })
    ),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: table === "posts" ? state.rows : [],
        error: null,
      }).then(resolve),
  };
  return builder;
}
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => ({ from: query }) }));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseServerClient: () => ({ from: query }) }));
vi.mock("@/lib/auth-server", () => ({ getCurrentUser: () => Promise.resolve(state.user) }));
vi.mock("@/lib/profile-server", () => ({ getProfile: vi.fn() }));
vi.mock("@/lib/geo-utils", () => ({
  getVisitorCountry: () => state.country,
  isCountryBlocked: () => state.blocked,
}));
vi.mock("@/lib/paywall", () => ({
  batchCheckSubscriptions: () => Promise.resolve(state.subscriptions),
  batchCheckPurchases: () => Promise.resolve(state.purchases),
}));
vi.mock("@/lib/post-media", () => ({
  getPostsMedia: (ids: string[]) =>
    Promise.resolve(
      new Map(
        ids.map((id) => [
          id,
          [
            {
              id: "video",
              media_url: "https://private/full-video",
              preview_url: "https://private/full-preview",
              watermarked_path: "https://private/watermark",
              media_type: "video",
              file_name: "video.mp4",
              file_size: 100,
              sort_order: 0,
            },
          ],
        ])
      )
    ),
}));

import { getPostAccessMap, listCreatorPosts, listFeed, sanitizePostForViewer } from "@/lib/posts";
import { GET } from "@/app/api/posts/[id]/route";
import { NextRequest } from "next/server";

const paidPost = (visibility = "ppv") => ({
  id: "paid",
  creator_id: "creator",
  title: "Public title",
  content: "paid secret body",
  media_url: "https://private/original",
  visibility,
  price_cents: 100,
  preview_enabled: true,
  review_status: "approved",
  created_at: "2026-01-01",
});

beforeEach(() => {
  state.user = { id: "fan", email: "fan@example.com" };
  state.rows = [paidPost()];
  state.subscriptions.clear();
  state.purchases.clear();
  state.filters = [];
  state.country = null;
  state.blocked = false;
  state.creatorError = false;
});

function expectLocked(post: unknown) {
  const json = JSON.stringify(post);
  expect(json).not.toContain("paid secret body");
  expect(json).not.toContain("https://private/");
  expect(post).toMatchObject({
    id: "paid",
    title: "Public title",
    is_locked: true,
    content: "",
    media_url: null,
  });
}

describe("server-enforced content boundaries", () => {
  it("strips every original media source including video and watermark paths", () => {
    expectLocked(
      sanitizePostForViewer(
        {
          ...paidPost(),
          media: [
            {
              media_url: "https://private/video",
              preview_url: "https://private/preview",
              watermarked_path: "https://private/watermark",
            },
          ],
        },
        false
      )
    );
  });
  it("feed never serializes gated content even when preview_enabled=true", async () => {
    const posts = await listFeed(20, 0, null);
    expect(posts).toHaveLength(1);
    expectLocked(posts[0]);
    expect(state.filters).toContainEqual(["deleted_at", null]);
    expect(state.filters).toContainEqual(["review_status", "approved"]);
  });
  it("creator listings redact legacy and nested URLs for unpaid visitors", async () => {
    const posts = await listCreatorPosts("creator", null);
    expectLocked(posts[0]);
    expect(state.filters).toContainEqual(["review_status", "approved"]);
  });
  it.each(["free", "purchased", "owner", "subscriber"])(
    "preserves authorized %s feed content",
    async (access) => {
      if (access === "free") state.rows = [paidPost("free")];
      if (access === "purchased") state.purchases.set("paid", true);
      if (access === "owner") state.user = { id: "creator", email: "creator@example.com" };
      if (access === "subscriber") {
        state.rows = [paidPost("subscribers")];
        state.subscriptions.set("creator", true);
      }
      const posts = await listFeed(20, 0, null);
      expect(posts[0]).toMatchObject({
        content: "paid secret body",
        media_url: "https://private/original",
        is_locked: false,
      });
      expect(posts[0].media?.[0].media_url).toBe("https://private/full-video");
    }
  );
  it("does not treat an invalid zero-price PPV as subscription content", async () => {
    state.subscriptions.set("creator", true);
    expect(
      (
        await getPostAccessMap([{ id: "paid", creator_id: "creator", visibility: "ppv" }], "fan")
      ).get("paid")
    ).toBe(false);
  });
  it("owner can see pending own creator posts", async () => {
    state.user = { id: "creator", email: "creator@example.com" };
    state.rows = [{ ...paidPost(), review_status: "pending" }];
    const posts = await listCreatorPosts("creator", null);
    expect(posts[0].content).toBe("paid secret body");
    expect(state.filters).not.toContainEqual(["review_status", "approved"]);
  });
  it("detail redacts unpaid content and requires a nondeleted row", async () => {
    const response = await GET(new NextRequest("http://localhost/api/posts/paid"), {
      params: Promise.resolve({ id: "paid" }),
    });
    expect(response.status).toBe(200);
    expectLocked((await response.json()).post);
    expect(state.filters).toContainEqual(["deleted_at", null]);
  });
  it.each(["pending", "rejected"])(
    "detail refuses %s content to a non-owner even with purchase",
    async (review_status) => {
      state.rows = [{ ...paidPost(), review_status }];
      state.purchases.set("paid", true);
      const response = await GET(new NextRequest("http://localhost/api/posts/paid"), {
        params: Promise.resolve({ id: "paid" }),
      });
      expect(response.status).toBe(404);
    }
  );
  it("detail respects subscription helper denial for an expired subscriber", async () => {
    state.rows = [paidPost("subscribers")];
    const response = await GET(new NextRequest("http://localhost/api/posts/paid"), {
      params: Promise.resolve({ id: "paid" }),
    });
    expectLocked((await response.json()).post);
  });
  it("detail refuses access from a creator-blocked country", async () => {
    state.country = "JP";
    state.blocked = true;
    state.purchases.set("paid", true);
    const response = await GET(new NextRequest("http://localhost/api/posts/paid"), {
      params: Promise.resolve({ id: "paid" }),
    });
    expect(response.status).toBe(404);
  });
  it("detail fails closed when geographic restriction lookup fails", async () => {
    state.country = "JP";
    state.creatorError = true;
    const response = await GET(new NextRequest("http://localhost/api/posts/paid"), {
      params: Promise.resolve({ id: "paid" }),
    });
    expect(response.status).toBe(503);
  });
});
