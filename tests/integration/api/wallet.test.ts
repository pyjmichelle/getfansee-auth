/**
 * Wallet API Integration Tests
 * 测试钱包相关 API 端点
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let testUserId: string;
let testUserEmail: string;
let testUserPassword: string;

describe("Wallet API Integration", () => {
  beforeAll(async () => {
    const timestamp = Date.now();
    testUserEmail = `int-test-user-${timestamp}@example.com`;
    testUserPassword = "TestPassword123!";

    const { data: authData } = await adminClient.auth.admin.createUser({
      email: testUserEmail,
      password: testUserPassword,
      email_confirm: true,
    });

    testUserId = authData?.user?.id!;

    await adminClient.from("profiles").upsert({
      id: testUserId,
      email: testUserEmail,
      display_name: `Test User ${timestamp}`,
      role: "fan",
      age_verified: true,
    });

    // 创建钱包
    await adminClient.from("user_wallets").upsert({
      id: testUserId,
      balance_cents: 1000, // $10.00
    });
  });

  afterAll(async () => {
    if (testUserId) {
      await adminClient.from("wallet_transactions").delete().eq("user_id", testUserId);
      await adminClient.from("user_wallets").delete().eq("id", testUserId);
      await adminClient.from("profiles").delete().eq("id", testUserId);
      await adminClient.auth.admin.deleteUser(testUserId);
    }
  });

  describe("GET /api/wallet/balance", () => {
    it("应该返回用户钱包余额", async () => {
      const { data: sessionData } = await adminClient.auth.signInWithPassword({
        email: testUserEmail,
        password: testUserPassword,
      });

      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`${BASE_URL}/api/wallet/balance`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.balance).toBe(1000);
    });

    it("应该返回 0 对于没有钱包的用户", async () => {
      // 创建一个没有钱包的新用户
      const timestamp = Date.now();
      const newUserEmail = `no-wallet-${timestamp}@example.com`;
      const newUserPassword = "TestPassword123!";

      const { data: newUserAuth } = await adminClient.auth.admin.createUser({
        email: newUserEmail,
        password: newUserPassword,
        email_confirm: true,
      });

      const newUserId = newUserAuth?.user?.id!;

      await adminClient.from("profiles").upsert({
        id: newUserId,
        email: newUserEmail,
        display_name: `New User ${timestamp}`,
        role: "fan",
        age_verified: true,
      });

      const { data: sessionData } = await adminClient.auth.signInWithPassword({
        email: newUserEmail,
        password: newUserPassword,
      });

      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`${BASE_URL}/api/wallet/balance`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.balance).toBe(0);

      // 清理
      await adminClient.from("profiles").delete().eq("id", newUserId);
      await adminClient.auth.admin.deleteUser(newUserId);
    });
  });

  describe("GET /api/wallet/transactions", () => {
    it("应该返回用户交易历史", async () => {
      // 先创建一些交易记录
      await adminClient.from("wallet_transactions").insert([
        {
          user_id: testUserId,
          amount_cents: 1000,
          type: "deposit",
          status: "completed",
          description: "Test deposit",
        },
        {
          user_id: testUserId,
          amount_cents: -500,
          type: "purchase",
          status: "completed",
          description: "Test purchase",
        },
      ]);

      const { data: sessionData } = await adminClient.auth.signInWithPassword({
        email: testUserEmail,
        password: testUserPassword,
      });

      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`${BASE_URL}/api/wallet/transactions`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.transactions).toBeDefined();
      expect(data.transactions.length).toBeGreaterThan(0);
    });

    it("应该返回空数组对于没有交易的用户", async () => {
      // 创建一个新用户
      const timestamp = Date.now();
      const newUserEmail = `no-tx-${timestamp}@example.com`;
      const newUserPassword = "TestPassword123!";

      const { data: newUserAuth } = await adminClient.auth.admin.createUser({
        email: newUserEmail,
        password: newUserPassword,
        email_confirm: true,
      });

      const newUserId = newUserAuth?.user?.id!;

      await adminClient.from("profiles").upsert({
        id: newUserId,
        email: newUserEmail,
        display_name: `New User ${timestamp}`,
        role: "fan",
        age_verified: true,
      });

      const { data: sessionData } = await adminClient.auth.signInWithPassword({
        email: newUserEmail,
        password: newUserPassword,
      });

      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`${BASE_URL}/api/wallet/transactions`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.transactions).toEqual([]);

      // 清理
      await adminClient.from("profiles").delete().eq("id", newUserId);
      await adminClient.auth.admin.deleteUser(newUserId);
    });
  });
});
