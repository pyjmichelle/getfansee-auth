/**
 * P0: Server ready gate — /api/health + /api/test/ping 必须 200，否则整轮 E2E fail fast.
 * 不依赖业务逻辑，仅校验测试环境就绪。
 */
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

test.describe("Server ready gate", () => {
  test("health + test/ping return 200 before any E2E", async ({ request }) => {
    const healthRes = await request.get(`${BASE_URL}/api/health`);
    expect(healthRes.ok(), `/api/health must be 200, got ${healthRes.status()}`).toBe(true);

    const pingRes = await request.get(`${BASE_URL}/api/test/ping`);
    expect(pingRes.ok(), `/api/test/ping must be 200 (test-mode on), got ${pingRes.status()}`).toBe(
      true
    );
  });
});
