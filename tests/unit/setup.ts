/**
 * Vitest 全局设置文件
 * 用于配置测试环境、Mock 等
 */

import { beforeAll, afterAll, vi } from "vitest";

// Mock server-only 包（在 Node 环境中允许导入）
vi.mock("server-only", () => ({}));

// Mock 环境变量
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";
  process.env.NEXT_PUBLIC_TEST_MODE = "true";
});

// 清理
afterAll(() => {
  vi.clearAllMocks();
});

// Mock console 方法（减少测试输出噪音）
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  // 保留 error 以便调试
};
