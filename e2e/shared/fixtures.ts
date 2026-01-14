/**
 * E2E 测试数据工厂
 * 通过 Supabase Admin API 创建测试数据，绕过 UI 流程
 */

import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const adminClient =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

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
    throw new Error(
      "Admin client not available. Ensure SUPABASE_SERVICE_ROLE_KEY is set."
    );
  }

  const timestamp = Date.now();

  // 1. 创建 Creator
  const creatorEmail = `e2e-creator-${timestamp}@example.com`;
  const creatorPassword = "TestPassword123!";
  const creatorDisplayName = `Test Creator ${timestamp}`;

  const { data: creatorAuth, error: creatorError } =
    await adminClient.auth.admin.createUser({
      email: creatorEmail,
      password: creatorPassword,
      email_confirm: true,
      user_metadata: { role: "creator" },
    });

  if (creatorError && !creatorError.message?.includes("already registered")) {
    throw new Error(`Failed to create creator: ${creatorError.message}`);
  }

  const creatorUserId = creatorAuth?.user?.id;
  if (!creatorUserId) {
    throw new Error("Failed to get creator user ID");
  }

  // 创建 creator profile
  await adminClient.from("profiles").upsert(
    {
      id: creatorUserId,
      email: creatorEmail,
      display_name: creatorDisplayName,
      role: "creator",
      age_verified: true,
      bio: "E2E Test Creator",
    },
    { onConflict: "id" }
  );

  // 创建 creators 记录
  await adminClient.from("creators").upsert(
    {
      id: creatorUserId,
      display_name: creatorDisplayName,
      bio: "E2E Test Creator",
    },
    { onConflict: "id" }
  );

  // 2. 创建 Fan（带钱包余额）
  const fanEmail = `e2e-fan-${timestamp}@example.com`;
  const fanPassword = "TestPassword123!";

  const { data: fanAuth, error: fanError } = await adminClient.auth.admin.createUser({
    email: fanEmail,
    password: fanPassword,
    email_confirm: true,
    user_metadata: { role: "fan" },
  });

  if (fanError && !fanError.message?.includes("already registered")) {
    throw new Error(`Failed to create fan: ${fanError.message}`);
  }

  const fanUserId = fanAuth?.user?.id;
  if (!fanUserId) {
    throw new Error("Failed to get fan user ID");
  }

  // 创建 fan profile
  await adminClient.from("profiles").upsert(
    {
      id: fanUserId,
      email: fanEmail,
      display_name: `Test Fan ${timestamp}`,
      role: "fan",
      age_verified: true,
    },
    { onConflict: "id" }
  );

  // 创建钱包并充值 $50
  const walletBalance = 5000; // 50.00 USD in cents
  await adminClient.from("user_wallets").upsert(
    {
      id: fanUserId,
      balance_cents: walletBalance,
    },
    { onConflict: "id" }
  );

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

/**
 * 创建单个测试帖子
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

  const postData: any = {
    creator_id: creatorId,
    title,
    content,
    visibility,
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

  const { data, error } = await adminClient
    .from("posts")
    .insert(postData)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create ${visibility} post: ${error.message}`);
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
export async function teardownTestFixtures(fixtures: TestFixtures): Promise<void> {
  if (!adminClient) {
    return;
  }

  try {
    // 删除帖子
    const postIds = [fixtures.posts.free.id, fixtures.posts.subscribers.id, fixtures.posts.ppv.id];
    await adminClient.from("posts").delete().in("id", postIds);

    // 删除用户相关数据
    for (const userId of [fixtures.creator.userId, fixtures.fan.userId]) {
      await adminClient.from("subscriptions").delete().eq("fan_id", userId);
      await adminClient.from("subscriptions").delete().eq("creator_id", userId);
      await adminClient.from("purchases").delete().eq("fan_id", userId);
      await adminClient.from("wallet_transactions").delete().eq("user_id", userId);
      await adminClient.from("user_wallets").delete().eq("id", userId);
      await adminClient.from("creators").delete().eq("id", userId);
      await adminClient.from("profiles").delete().eq("id", userId);
      await adminClient.auth.admin.deleteUser(userId);
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
      domain: "localhost",
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

  // 更新钱包余额
  const { data: wallet } = await adminClient
    .from("user_wallets")
    .select("balance_cents")
    .eq("id", userId)
    .single();

  const currentBalance = wallet?.balance_cents || 0;
  const newBalance = currentBalance + amountCents;

  await adminClient.from("user_wallets").upsert(
    {
      id: userId,
      balance_cents: newBalance,
    },
    { onConflict: "id" }
  );

  // 记录交易
  await adminClient.from("wallet_transactions").insert({
    user_id: userId,
    amount_cents: amountCents,
    type: "deposit",
    status: "completed",
    description: "E2E Test Top-up",
  });
}

/**
 * 创建订阅关系（用于测试订阅功能）
 */
export async function createTestSubscription(
  fanId: string,
  creatorId: string
): Promise<string> {
  });
}

/**
 * 创建订阅关系（用于测试订阅功能）
 */
export async function createTestSubscription(
  fanId: string,
  creatorId: string
): Promise<string> {
  if (!adminClient) {
    throw new Error("Admin client not available");
  }

  const { data, error } = await adminClient
    .from("subscriptions")
    .insert({
      fan_id: fanId,
      creator_id: creatorId,
      plan: "monthly",
      status: "active",
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 天后
    })
    .select("id")
    .single();

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

  const { data, error } = await adminClient
    .from("purchases")
    .insert({
      fan_id: fanId,
      post_id: postId,
      price_cents: priceCents,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create purchase: ${error.message}`);
  }

  return data.id;
}
