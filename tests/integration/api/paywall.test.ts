/**
 * Paywall API Integration Tests
 * 测试 /api/subscribe, /api/unlock 端点
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let testCreatorId: string;
let testFanId: string;
let testFanEmail: string;
let testFanPassword: string;
let testPPVPostId: string;

describe("Paywall API Integration", () => {
  beforeAll(async () => {
    const timestamp = Date.now();

    // 创建测试 Creator
    const creatorEmail = `int-test-creator-${timestamp}@example.com`;
    const { data: creatorAuth } = await adminClient.auth.admin.createUser({
      email: creatorEmail,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { role: "creator" },
    });

    testCreatorId = creatorAuth?.user?.id!;

    await adminClient.from("profiles").upsert({
      id: testCreatorId,
      email: creatorEmail,
      display_name: `Test Creator ${timestamp}`,
      role: "creator",
      age_verified: true,
    });

    await adminClient.from("creators").upsert({
      id: testCreatorId,
      display_name: `Test Creator ${timestamp}`,
    });

    // 创建测试 Fan（带钱包余额）
    testFanEmail = `int-test-fan-${timestamp}@example.com`;
    testFanPassword = "TestPassword123!";

    const { data: fanAuth } = await adminClient.auth.admin.createUser({
      email: testFanEmail,
      password: testFanPassword,
      email_confirm: true,
      user_metadata: { role: "fan" },
    });

    testFanId = fanAuth?.user?.id!;

    await adminClient.from("profiles").upsert({
      id: testFanId,
      email: testFanEmail,
      display_name: `Test Fan ${timestamp}`,
      role: "fan",
      age_verified: true,
    });

    // 创建钱包并充值 $50
    await adminClient.from("user_wallets").upsert({
      id: testFanId,
      balance_cents: 5000,
    });

    // 创建测试 PPV 帖子
    const { data: postData } = await adminClient
      .from("posts")
      .insert({
        creator_id: testCreatorId,
        title: "Test PPV Post",
        content: "PPV Content",
        visibility: "ppv",
        price_cents: 500, // $5.00
      })
      .select("id")
      .single();

    testPPVPostId = postData?.id!;
  });

  afterAll(async () => {
    // 清理测试数据
    if (testPPVPostId) {
      await adminClient.from("purchases").delete().eq("post_id", testPPVPostId);
      await adminClient.from("posts").delete().eq("id", testPPVPostId);
    }
    if (testFanId) {
      await adminClient.from("subscriptions").delete().eq("fan_id", testFanId);
      await adminClient.from("wallet_transactions").delete().eq("user_id", testFanId);
      await adminClient.from("user_wallets").delete().eq("id", testFanId);
      await adminClient.from("profiles").delete().eq("id", testFanId);
      await adminClient.auth.admin.deleteUser(testFanId);
    }
    if (testCreatorId) {
      await adminClient.from("subscriptions").delete().eq("creator_id", testCreatorId);
      await adminClient.from("creators").delete().eq("id", testCreatorId);
      await adminClient.from("profiles").delete().eq("id", testCreatorId);
      await adminClient.auth.admin.deleteUser(testCreatorId);
    }
  });

  describe("POST /api/subscribe", () => {
    it("应该成功订阅 Creator", async () => {
      const { data: sessionData } = await adminClient.auth.signInWithPassword({
        email: testFanEmail,
        password: testFanPassword,
      });

      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`${BASE_URL}/api/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          creatorId: testCreatorId,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("应该拒绝重复订阅", async () => {
      const { data: sessionData } = await adminClient.auth.signInWithPassword({
        email: testFanEmail,
        password: testFanPassword,
      });

      const accessToken = sessionData?.session?.access_token;

      // 第二次订阅应该失败
      const response = await fetch(`${BASE_URL}/api/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          creatorId: testCreatorId,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("already subscribed");
    });
  });

  describe("POST /api/unlock", () => {
    it("应该成功解锁 PPV 帖子", async () => {
      const { data: sessionData } = await adminClient.auth.signInWithPassword({
        email: testFanEmail,
        password: testFanPassword,
      });

      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`${BASE_URL}/api/unlock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          postId: testPPVPostId,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("应该拒绝重复购买", async () => {
      const { data: sessionData } = await adminClient.auth.signInWithPassword({
        email: testFanEmail,
        password: testFanPassword,
      });

      const accessToken = sessionData?.session?.access_token;

      // 第二次购买应该失败
      const response = await fetch(`${BASE_URL}/api/unlock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          postId: testPPVPostId,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("already purchased");
    });

    it("应该拒绝余额不足的购买", async () => {
      // 创建一个没有余额的新 Fan
      const timestamp = Date.now();
      const poorFanEmail = `poor-fan-${timestamp}@example.com`;
      const poorFanPassword = "TestPassword123!";

      const { data: poorFanAuth } = await adminClient.auth.admin.createUser({
        email: poorFanEmail,
        password: poorFanPassword,
        email_confirm: true,
      });

      const poorFanId = poorFanAuth?.user?.id!;

      await adminClient.from("profiles").upsert({
        id: poorFanId,
        email: poorFanEmail,
        display_name: `Poor Fan ${timestamp}`,
        role: "fan",
        age_verified: true,
      });

      // 钱包余额为 0
      await adminClient.from("user_wallets").upsert({
        id: poorFanId,
        balance_cents: 0,
      });

      const { data: sessionData } = await adminClient.auth.signInWithPassword({
        email: poorFanEmail,
        password: poorFanPassword,
      });

      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`${BASE_URL}/api/unlock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          postId: testPPVPostId,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Insufficient balance");

      // 清理
      await adminClient.from("user_wallets").delete().eq("id", poorFanId);
      await adminClient.from("profiles").delete().eq("id", poorFanId);
      await adminClient.auth.admin.deleteUser(poorFanId);
    });
  });
});
