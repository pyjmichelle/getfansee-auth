/**
 * E2E 测试数据工厂
 * 通过 Supabase Admin API 创建测试数据，绕过 UI 流程
 */

import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const BASE_HOSTNAME = new URL(BASE_URL).hostname;

const adminClient =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

function isAlreadyRegisteredError(error: unknown): boolean {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);
  return message.toLowerCase().includes("already registered");
}

function isRetryableAdminError(error: unknown): boolean {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("fetch failed") ||
    normalized.includes("econnreset") ||
    normalized.includes("network") ||
    normalized.includes("timeout")
  );
}

async function withAdminRetries<T>(
  action: () => Promise<T>,
  label: string,
  retries: number = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isRetryableAdminError(error) || attempt === retries - 1) {
        throw error;
      }
      console.warn(`[fixtures] ${label} failed, retrying...`, error);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}

/** Supabase PostgREST 失败时返回 error 对象而不是 throw；必须显式检查，否则会误闯 FK 约束。 */
function assertDbOk(result: { error: { message?: string } | null }, label: string): void {
  if (result.error) {
    const msg = result.error.message ?? JSON.stringify(result.error);
    throw new Error(`${label}: ${msg}`);
  }
}

async function findUserByEmail(email: string) {
  if (!adminClient) {
    return null;
  }
  const normalizedEmail = email.toLowerCase();
  const { data, error } = await withAdminRetries(
    () =>
      adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      }),
    "listUsers"
  );
  if (error) {
    console.warn("[fixtures] listUsers error:", error);
    return null;
  }
  return data?.users?.find((user) => user.email?.toLowerCase() === normalizedEmail) ?? null;
}

export interface TestCreator {
  userId: string;
  email: string;
  password: string;
  displayName: string;
}

export interface TestFan {
  userId: string;
  email: string;
  password: string;
  walletBalance: number;
}

export interface TestPost {
  id: string;
  creatorId: string;
  title: string;
  content: string;
  visibility: "free" | "subscribers" | "ppv";
  priceCents?: number;
}

export interface TestFixtures {
  creator: TestCreator;
  fan: TestFan;
  posts: {
    free: TestPost;
    subscribers: TestPost;
    ppv: TestPost;
  };
}

/**
 * 创建完整的测试数据集
 * 包括：1 个 Creator、1 个 Fan（带钱包余额）、3 个不同类型的帖子
 */
export async function setupTestFixtures(): Promise<TestFixtures> {
  if (!adminClient) {
    throw new Error("Admin client not available. Ensure SUPABASE_SERVICE_ROLE_KEY is set.");
  }

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const uniqueSuffix = `${timestamp}-${random}`;

  // 1. 创建 Creator
  const creatorEmail = `e2e-creator-${uniqueSuffix}@example.com`;
  const creatorPassword = "TestPassword123!";
  const creatorDisplayName = `Test Creator ${uniqueSuffix}`;

  let creatorUserId: string | undefined;
  try {
    const { data: creatorAuth } = await withAdminRetries(
      () =>
        adminClient.auth.admin.createUser({
          email: creatorEmail,
          password: creatorPassword,
          email_confirm: true,
          user_metadata: { role: "creator" },
        }),
      "createUser:creator"
    );
    creatorUserId = creatorAuth?.user?.id;
  } catch (error) {
    if (!isAlreadyRegisteredError(error)) {
      throw new Error(`Failed to create creator: ${String(error)}`);
    }
  }

  if (!creatorUserId) {
    const existingCreator = await findUserByEmail(creatorEmail);
    creatorUserId = existingCreator?.id;
    if (creatorUserId) {
      try {
        await withAdminRetries(
          () =>
            adminClient.auth.admin.updateUserById(creatorUserId, {
              password: creatorPassword,
              user_metadata: { role: "creator" },
            }),
          "updateUserById:creator"
        );
      } catch (error) {
        console.warn("[fixtures] updateUserById failed for creator:", error);
      }
    }
  }

  if (!creatorUserId) {
    throw new Error("Failed to resolve creator user ID");
  }

  // 创建 creator profile
  const creatorUsername = creatorEmail
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const creatorAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorDisplayName)}&background=6366f1&color=fff&size=150&bold=true`;
  const profileCreatorRes = await withAdminRetries(
    () =>
      adminClient.from("profiles").upsert(
        {
          id: creatorUserId,
          email: creatorEmail,
          username: creatorUsername,
          display_name: creatorDisplayName,
          role: "creator",
          age_verified: true,
          bio: "E2E Test Creator — sharing exclusive content for subscribers.",
          avatar_url: creatorAvatarUrl,
          subscription_price_cents: 999,
        },
        { onConflict: "id" }
      ),
    "upsert:profiles:creator"
  );
  assertDbOk(profileCreatorRes, "upsert:profiles:creator");

  // 创建 creators 记录（posts.creator_id 在多数环境中引用 creators.id）
  const creatorsRes = await withAdminRetries(
    () =>
      adminClient.from("creators").upsert(
        {
          id: creatorUserId,
          display_name: creatorDisplayName,
          bio: "E2E Test Creator — sharing exclusive content for subscribers.",
          avatar_url: creatorAvatarUrl,
        },
        { onConflict: "id" }
      ),
    "upsert:creators:creator"
  );
  assertDbOk(creatorsRes, "upsert:creators:creator");

  const { data: creatorRow, error: creatorVerifyErr } = await adminClient
    .from("creators")
    .select("id")
    .eq("id", creatorUserId)
    .maybeSingle();
  assertDbOk({ error: creatorVerifyErr }, "select:creators:verify");
  if (!creatorRow) {
    throw new Error(
      `E2E fixtures: creators row still missing for ${creatorUserId} after profile upsert — cannot insert posts (FK)`
    );
  }

  // 2. 创建 Fan（带钱包余额）
  const fanEmail = `e2e-fan-${uniqueSuffix}@example.com`;
  const fanPassword = "TestPassword123!";

  let fanUserId: string | undefined;
  try {
    const { data: fanAuth } = await withAdminRetries(
      () =>
        adminClient.auth.admin.createUser({
          email: fanEmail,
          password: fanPassword,
          email_confirm: true,
          user_metadata: { role: "fan" },
        }),
      "createUser:fan"
    );
    fanUserId = fanAuth?.user?.id;
  } catch (error) {
    if (!isAlreadyRegisteredError(error)) {
      throw new Error(`Failed to create fan: ${String(error)}`);
    }
  }

  if (!fanUserId) {
    const existingFan = await findUserByEmail(fanEmail);
    fanUserId = existingFan?.id;
    if (fanUserId) {
      try {
        await withAdminRetries(
          () =>
            adminClient.auth.admin.updateUserById(fanUserId, {
              password: fanPassword,
              user_metadata: { role: "fan" },
            }),
          "updateUserById:fan"
        );
      } catch (error) {
        console.warn("[fixtures] updateUserById failed for fan:", error);
      }
    }
  }

  if (!fanUserId) {
    throw new Error("Failed to resolve fan user ID");
  }

  // 创建 fan profile
  const fanUsername = fanEmail
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const profileFanRes = await withAdminRetries(
    () =>
      adminClient.from("profiles").upsert(
        {
          id: fanUserId,
          email: fanEmail,
          username: fanUsername,
          display_name: `Test Fan ${timestamp}`,
          role: "fan",
          age_verified: true,
        },
        { onConflict: "id" }
      ),
    "upsert:profiles:fan"
  );
  assertDbOk(profileFanRes, "upsert:profiles:fan");

  // 创建钱包并充值 $50（应用使用 wallet_accounts，非 user_wallets）
  const walletBalance = 5000; // 50.00 USD in cents
  const walletRes = await withAdminRetries(
    () =>
      adminClient.from("wallet_accounts").upsert(
        {
          user_id: fanUserId,
          available_balance_cents: walletBalance,
          pending_balance_cents: 0,
        },
        { onConflict: "user_id" }
      ),
    "upsert:wallet_accounts:fan"
  );
  assertDbOk(walletRes, "upsert:wallet_accounts:fan");

  // 3. 创建测试帖子
  const posts: TestFixtures["posts"] = {
    free: await createTestPost(creatorUserId, "free", timestamp),
    subscribers: await createTestPost(creatorUserId, "subscribers", timestamp),
    ppv: await createTestPost(creatorUserId, "ppv", timestamp, 500), // $5.00
  };

  return {
    creator: {
      userId: creatorUserId,
      email: creatorEmail,
      password: creatorPassword,
      displayName: creatorDisplayName,
    },
    fan: {
      userId: fanUserId,
      email: fanEmail,
      password: fanPassword,
      walletBalance,
    },
    posts,
  };
}

// Stable picsum seed images for test posts (avoid 404)
const TEST_POST_IMAGES: Record<string, string> = {
  free: "https://picsum.photos/seed/e2e-free/800/600",
  subscribers: "https://picsum.photos/seed/e2e-sub/800/600",
  ppv: "https://picsum.photos/seed/e2e-ppv/800/600",
};

/**
 * 创建单个测试帖子（含 post_media 记录，确保 profile 内容网格不为空）
 */
async function createTestPost(
  creatorId: string,
  visibility: "free" | "subscribers" | "ppv",
  timestamp: number,
  priceCents?: number
): Promise<TestPost> {
  if (!adminClient) {
    throw new Error("Admin client not available");
  }

  const title = `Test ${visibility} post ${timestamp}`;
  const content = `This is a test ${visibility} post created by fixtures`;
  const mediaUrl = TEST_POST_IMAGES[visibility];

  const postData: Record<string, unknown> = {
    creator_id: creatorId,
    title,
    content,
    visibility,
    media_url: mediaUrl,
    preview_enabled: visibility === "ppv",
    watermark_enabled: visibility === "ppv",
  };

  // 只在 PPV 时添加 price_cents
  if (visibility === "ppv" && priceCents) {
    postData.price_cents = priceCents;
  } else {
    // 非 PPV 帖子，price_cents 设为 0
    postData.price_cents = 0;
  }

  const { data, error } = await withAdminRetries(
    () => adminClient.from("posts").insert(postData).select("id").single(),
    `insert:posts:${visibility}`
  );

  if (error) {
    throw new Error(`Failed to create ${visibility} post: ${error.message}`);
  }

  // Insert post_media record so the post grid shows actual content
  try {
    const mediaRes = await withAdminRetries(
      () =>
        adminClient.from("post_media").insert({
          post_id: data.id,
          media_url: mediaUrl,
          media_type: "image",
          sort_order: 0,
        }),
      `insert:post_media:${visibility}`
    );
    assertDbOk(mediaRes, `insert:post_media:${visibility}`);
  } catch (mediaErr) {
    // Non-fatal: post_media table may not exist in all environments
    console.warn("[fixtures] post_media insert failed (non-fatal):", mediaErr);
  }

  return {
    id: data.id,
    creatorId,
    title,
    content,
    visibility,
    priceCents,
  };
}

/**
 * 清理测试数据
 */
export async function teardownTestFixtures(fixtures?: TestFixtures | null): Promise<void> {
  if (!adminClient || !fixtures) {
    return;
  }

  try {
    // 删除帖子关联媒体
    const postIds = [
      fixtures.posts?.free?.id,
      fixtures.posts?.subscribers?.id,
      fixtures.posts?.ppv?.id,
    ].filter(Boolean) as string[];
    if (postIds.length > 0) {
      try {
        await withAdminRetries(
          () => adminClient.from("post_media").delete().in("post_id", postIds),
          "delete:post_media"
        );
      } catch {
        // post_media may not exist in all environments
      }
      await withAdminRetries(
        () => adminClient.from("posts").delete().in("id", postIds),
        "delete:posts"
      );
    }

    // 删除用户相关数据
    for (const userId of [fixtures.creator.userId, fixtures.fan.userId]) {
      await withAdminRetries(
        () => adminClient.from("subscriptions").delete().eq("subscriber_id", userId),
        "delete:subscriptions:subscriber"
      );
      await withAdminRetries(
        () => adminClient.from("subscriptions").delete().eq("creator_id", userId),
        "delete:subscriptions:creator"
      );
      await withAdminRetries(
        () => adminClient.from("purchases").delete().eq("fan_id", userId),
        "delete:purchases"
      );
      await withAdminRetries(
        () => adminClient.from("transactions").delete().eq("user_id", userId),
        "delete:transactions"
      );
      await withAdminRetries(
        () => adminClient.from("wallet_transactions").delete().eq("user_id", userId),
        "delete:wallet_transactions"
      );
      await withAdminRetries(
        () => adminClient.from("wallet_accounts").delete().eq("user_id", userId),
        "delete:wallet_accounts"
      );
      // P1 修复：已统一到 wallet_accounts，保留旧表清理以兼容未迁移的数据
      try {
        await adminClient.from("user_wallets").delete().eq("id", userId);
      } catch {
        // 忽略错误 - 表可能不存在
      }
      await withAdminRetries(
        () => adminClient.from("creators").delete().eq("id", userId),
        "delete:creators"
      );
      await withAdminRetries(
        () => adminClient.from("profiles").delete().eq("id", userId),
        "delete:profiles"
      );
      await withAdminRetries(() => adminClient.auth.admin.deleteUser(userId), "deleteUser");
    }
  } catch (err) {
    console.warn("[fixtures] Cleanup error:", err);
  }
}

/**
 * 注入测试模式 cookie 到 Playwright page
 * 让 middleware 跳过认证检查
 */
export async function injectTestCookie(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: "playwright-test-mode",
      value: "1",
      domain: BASE_HOSTNAME,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

/**
 * 为测试用户充值钱包
 */
export async function topUpWallet(userId: string, amountCents: number): Promise<void> {
  if (!adminClient) {
    throw new Error("Admin client not available");
  }

  // 应用使用 wallet_accounts (user_id, available_balance_cents)
  const walletSelect = await withAdminRetries(
    () =>
      adminClient
        .from("wallet_accounts")
        .select("available_balance_cents")
        .eq("user_id", userId)
        .maybeSingle(),
    "select:wallet_accounts"
  );
  assertDbOk(walletSelect, "select:wallet_accounts");

  const currentBalance = walletSelect.data?.available_balance_cents ?? 0;
  const newBalance = currentBalance + amountCents;

  const walletUpsert = await withAdminRetries(
    () =>
      adminClient.from("wallet_accounts").upsert(
        {
          user_id: userId,
          available_balance_cents: newBalance,
          pending_balance_cents: 0,
        },
        { onConflict: "user_id" }
      ),
    "upsert:wallet_accounts"
  );
  assertDbOk(walletUpsert, "upsert:wallet_accounts");

  // 记录交易（应用使用 transactions 表）
  const txInsert = await withAdminRetries(
    () =>
      adminClient.from("transactions").insert({
        user_id: userId,
        amount_cents: amountCents,
        type: "deposit",
        status: "completed",
        metadata: { source: "e2e-topup" },
      }),
    "insert:transactions"
  );
  assertDbOk(txInsert, "insert:transactions");
}

/**
 * 创建订阅关系（用于测试订阅功能）
 */
export async function createTestSubscription(fanId: string, creatorId: string): Promise<string> {
  if (!adminClient) {
    throw new Error("Admin client not available");
  }

  const { data, error } = await withAdminRetries(
    () =>
      adminClient
        .from("subscriptions")
        .insert({
          subscriber_id: fanId,
          creator_id: creatorId,
          plan: "monthly",
          status: "active",
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 天后
        })
        .select("id")
        .single(),
    "insert:subscriptions"
  );

  if (error) {
    throw new Error(`Failed to create subscription: ${error.message}`);
  }

  return data.id;
}

/**
 * 创建购买记录（用于测试 PPV 功能）
 */
export async function createTestPurchase(
  fanId: string,
  postId: string,
  priceCents: number
): Promise<string> {
  if (!adminClient) {
    throw new Error("Admin client not available");
  }

  const { data, error } = await withAdminRetries(
    () =>
      adminClient
        .from("purchases")
        .insert({
          fan_id: fanId,
          post_id: postId,
          price_cents: priceCents,
        })
        .select("id")
        .single(),
    "insert:purchases"
  );

  if (error) {
    throw new Error(`Failed to create purchase: ${error.message}`);
  }

  return data.id;
}
