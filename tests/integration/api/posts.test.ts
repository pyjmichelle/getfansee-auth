/**
 * Posts API Integration Tests
 * 测试 /api/posts/* 端点
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let testCreatorId: string;
let testCreatorEmail: string;
let testCreatorPassword: string;
let testPostId: string;

describe("Posts API Integration", () => {
  beforeAll(async () => {
    // 创建测试 Creator
    const timestamp = Date.now();
    testCreatorEmail = `int-test-creator-${timestamp}@example.com`;
    testCreatorPassword = "TestPassword123!";

    const { data: authData } = await adminClient.auth.admin.createUser({
      email: testCreatorEmail,
      password: testCreatorPassword,
      email_confirm: true,
      user_metadata: { role: "creator" },
    });

    testCreatorId = authData?.user?.id!;

    // 创建 profile 和 creator 记录
    await adminClient.from("profiles").upsert({
      id: testCreatorId,
      email: testCreatorEmail,
      display_name: `Test Creator ${timestamp}`,
      role: "creator",
      age_verified: true,
    });

    await adminClient.from("creators").upsert({
      id: testCreatorId,
      display_name: `Test Creator ${timestamp}`,
    });
  });

  afterAll(async () => {
    // 清理测试数据
    if (testPostId) {
      await adminClient.from("posts").delete().eq("id", testPostId);
    }
    if (testCreatorId) {
      await adminClient.from("creators").delete().eq("id", testCreatorId);
      await adminClient.from("profiles").delete().eq("id", testCreatorId);
      await adminClient.auth.admin.deleteUser(testCreatorId);
    }
  });

  describe("POST /api/posts", () => {
    it("应该创建免费帖子", async () => {
      // 登录获取 session
      const { data: sessionData } = await adminClient.auth.signInWithPassword({
        email: testCreatorEmail,
        password: testCreatorPassword,
      });

      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`${BASE_URL}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: "Integration Test Free Post",
          content: "This is a test post",
          visibility: "free",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.post).toBeDefined();
      testPostId = data.post.id;
    });

    it("应该验证 PPV 价格 >= $1.00", async () => {
      const { data: sessionData } = await adminClient.auth.signInWithPassword({
        email: testCreatorEmail,
        password: testCreatorPassword,
      });

      const accessToken = sessionData?.session?.access_token;

      // 尝试创建价格 < $1.00 的 PPV 帖子
      const response = await fetch(`${BASE_URL}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: "Invalid PPV Post",
          content: "This should fail",
          visibility: "ppv",
          priceCents: 50, // $0.50
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("at least $1.00");
    });

    it("应该创建有效的 PPV 帖子", async () => {
      const { data: sessionData } = await adminClient.auth.signInWithPassword({
        email: testCreatorEmail,
        password: testCreatorPassword,
      });

      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`${BASE_URL}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: "Valid PPV Post",
          content: "This is a PPV post",
          visibility: "ppv",
          priceCents: 500, // $5.00
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.post.price_cents).toBe(500);
    });
  });

  describe("GET /api/posts/[id]", () => {
    it("应该获取帖子详情", async () => {
      if (!testPostId) {
        // 先创建一个帖子
        const { data: sessionData } = await adminClient.auth.signInWithPassword({
          email: testCreatorEmail,
          password: testCreatorPassword,
        });

        const accessToken = sessionData?.session?.access_token;

        const createResponse = await fetch(`${BASE_URL}/api/posts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            title: "Test Post for GET",
            content: "Content",
            visibility: "free",
          }),
        });

        const createData = await createResponse.json();
        testPostId = createData.post.id;
      }

      const response = await fetch(`${BASE_URL}/api/posts/${testPostId}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.post).toBeDefined();
      expect(data.post.id).toBe(testPostId);
    });

    it("应该返回 404 对于不存在的帖子", async () => {
      const response = await fetch(`${BASE_URL}/api/posts/non-existent-id`);

      expect(response.status).toBe(404);
    });
  });
});
