#!/usr/bin/env tsx
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const providerInput = (process.env.OAUTH_PROVIDER || "x").toLowerCase();
const provider =
  providerInput === "twitter" ? "twitter" : providerInput === "twitch" ? "twitch" : "twitter";
const providerLabel = provider === "twitter" ? "x-twitter" : "twitch";
const outputDir = path.join(process.cwd(), "artifacts", "qa", "auth-smoke", providerLabel);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  ensureDir(outputDir);

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const rl = createInterface({ input, output });

  try {
    await page.goto(`${BASE_URL}/auth?mode=login`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.screenshot({
      path: path.join(outputDir, "01-auth-page-before-provider.png"),
      fullPage: true,
    });

    const redirectTo = `${BASE_URL}/auth/verify`;
    const oauthAuthorizeUrl = `${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(
      redirectTo
    )}`;

    await page.goto(oauthAuthorizeUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.screenshot({
      path: path.join(outputDir, "02-provider-page-opened.png"),
      fullPage: true,
    });

    console.log("\n手动 smoke 步骤：");
    console.log(`1) 在浏览器完成 ${providerLabel} 登录与授权`);
    console.log("2) 回到应用后，确认是否落到 /auth/verify 或 /home");
    console.log("3) 完成后回到终端按回车继续采集证据\n");
    await rl.question("完成手动操作后按回车继续...");

    await page.screenshot({
      path: path.join(outputDir, "03-after-manual-login.png"),
      fullPage: true,
    });

    const finalUrl = page.url();
    const isSuccess = finalUrl.includes("/home");
    const isVerify = finalUrl.includes("/auth/verify");

    const report = {
      provider: providerLabel,
      baseUrl: BASE_URL,
      finalUrl,
      success: isSuccess,
      reachedVerifyPage: isVerify,
      createdAt: new Date().toISOString(),
      screenshots: [
        "01-auth-page-before-provider.png",
        "02-provider-page-opened.png",
        "03-after-manual-login.png",
      ],
    };

    fs.writeFileSync(
      path.join(outputDir, "smoke-result.json"),
      JSON.stringify(report, null, 2),
      "utf-8"
    );

    if (!isSuccess && !isVerify) {
      throw new Error(`Smoke failed: unexpected final URL ${finalUrl}`);
    }

    console.log(`\n✅ ${providerLabel} 手动 smoke 完成`);
    console.log(`结果目录: ${outputDir}`);
  } finally {
    rl.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error("❌ xtwitch manual smoke failed:", error);
  process.exit(1);
});
