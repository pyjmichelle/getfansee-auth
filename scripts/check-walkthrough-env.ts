#!/usr/bin/env tsx
/**
 * 走查必备环境检查：.env.local 中的 key 是否存在、Supabase Service Role 是否可用
 */
import * as fs from "fs";
import * as path from "path";

const envLocalPath = path.join(process.cwd(), ".env.local");
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "E2E",
  "NEXT_PUBLIC_TEST_MODE",
] as const;

function loadEnvLocal() {
  if (!fs.existsSync(envLocalPath)) {
    console.error("❌ .env.local 不存在");
    process.exit(1);
  }
  const content = fs.readFileSync(envLocalPath, "utf-8");
  content.split("\n").forEach((line) => {
    const t = line.trim();
    if (t && !t.startsWith("#") && t.includes("=")) {
      const eq = t.indexOf("=");
      const key = t.slice(0, eq).trim();
      const value = t.slice(eq + 1).trim();
      if (key && !process.env[key]) process.env[key] = value;
    }
  });
}

async function main() {
  console.log("🔐 检查走查必备 key 与权限\n");
  loadEnvLocal();

  const missing = required.filter((k) => !process.env[k] || process.env[k]!.trim() === "");
  if (missing.length) {
    console.error("❌ 以下 key 缺失或为空:", missing.join(", "));
    process.exit(1);
  }
  console.log("✅ 必备 key 均已存在:", required.join(", "));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url.startsWith("https://") || key.length < 50) {
    console.error("❌ Supabase URL 或 SERVICE_ROLE_KEY 格式异常");
    process.exit(1);
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) {
      console.error("❌ Service Role 权限不足或网络异常:", error.message);
      process.exit(1);
    }
    console.log("✅ Supabase Service Role 可用 (listUsers 成功)\n");
  } catch (e: any) {
    console.error("❌ Supabase 检查失败:", e?.message || e);
    process.exit(1);
  }
}

main();
