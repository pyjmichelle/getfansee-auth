import { Page, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * 共享测试工具函数
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const BASE_HOSTNAME = new URL(BASE_URL).hostname;

/**
 * 生成唯一的测试邮箱
 */
export function generateTestEmail(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `e2e-${prefix}-${timestamp}-${random}@example.com`;
}

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
      console.warn(`[helpers] ${label} failed, retrying...`, error);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}

/**
 * 生成测试密码
 */
export const TEST_PASSWORD = "TestPassword123!";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_PROJECT_REF = SUPABASE_URL ? new URL(SUPABASE_URL).hostname.split(".")[0] : null;

const adminClient =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const publicClient =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

async function ensureTestMode(page: Page): Promise<void> {
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

  await page.addInitScript(() => {
    localStorage.setItem("getfansee_age_verified", "true");
  });
}

async function findUserByEmail(email: string, retries = 5) {
  if (!adminClient) {
    return null;
  }
  const normalizedEmail = email.toLowerCase();
  for (let attempt = 0; attempt < retries; attempt++) {
    const { data, error } = await withAdminRetries(
      () =>
        adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        }),
      "listUsers"
    );
    if (error) {
      console.warn("[helpers] listUsers error:", error);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    const user = data?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (user) {
      return user;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  return null;
}

async function ensureTestProfileRecord(userId: string, email: string, role: TestUserRole = "fan") {
  if (!adminClient) {
    return;
  }
  try {
    const username = email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const displayName = email.split("@")[0];

    await adminClient.from("profiles").upsert(
      {
        id: userId,
        email,
        username,
        display_name: displayName,
        role,
        age_verified: true,
      },
      { onConflict: "id" }
    );

    // 如果是 creator，同时创建 creators 记录
    if (role === "creator") {
      await adminClient.from("creators").upsert(
        {
          id: userId,
          display_name: displayName,
          bio: "Test creator",
        },
        { onConflict: "id" }
      );
    }
  } catch (err) {
    console.warn("[helpers] ensureTestProfileRecord error:", err);
  }
}

async function confirmAndInjectSession(
  page: Page,
  email: string,
  password: string,
  role: TestUserRole = "fan",
  retries: number = 3
): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true" || !adminClient) {
    return false;
  }

  const user = await findUserByEmail(email);
  if (!user) {
    console.warn("[helpers] Unable to locate user after signup:", email);
    return false;
  }

  if (!user.email_confirmed_at) {
    try {
      await adminClient.auth.admin.updateUserById(user.id, { email_confirm: true });
    } catch (err) {
      console.warn("[helpers] updateUserById error:", err);
    }
  }

  await ensureTestProfileRecord(
    user.id,
    email,
    (user.user_metadata?.role as TestUserRole | undefined) ?? role
  );

  // 注入测试模式 cookie
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

  // 重试机制：session 注入可能因网络或时序问题失败
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await injectSupabaseSession(page, email, password, BASE_URL);
      return true;
    } catch (err) {
      console.warn(
        `[helpers] injectSupabaseSession attempt ${attempt + 1}/${retries} failed:`,
        err
      );
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  console.error("[helpers] All session injection attempts failed");
  return false;
}

type TestUserRole = "fan" | "creator";

export async function createConfirmedTestUser(
  role: TestUserRole,
  options?: { displayName?: string; email?: string }
): Promise<{ email: string; password: string; userId: string }> {
  if (!adminClient) {
    throw new Error(
      "Missing admin client. Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set when running Playwright tests."
    );
  }

  const email = options?.email ?? generateTestEmail(role);
  const password = TEST_PASSWORD;
  const displayName = options?.displayName ?? `${role}-${Date.now()}`;

  let createdUserId: string | undefined;
  try {
    const { data } = await withAdminRetries(
      () =>
        adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        }),
      "createUser"
    );
    createdUserId = data?.user?.id;
  } catch (error) {
    if (!isAlreadyRegisteredError(error)) {
      throw error;
    }
  }

  const existingUser = createdUserId ? { id: createdUserId } : await findUserByEmail(email);
  const userId = existingUser?.id;

  if (!userId) {
    throw new Error(`Unable to resolve userId for ${email}`);
  }

  if (!createdUserId) {
    try {
      await adminClient.auth.admin.updateUserById(userId, { password });
    } catch (error) {
      console.warn("[helpers] updateUserById failed:", error);
    }
  }

  const username = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  await adminClient.from("profiles").upsert(
    {
      id: userId,
      email,
      username,
      display_name: displayName,
      role,
      age_verified: true,
    },
    { onConflict: "id" }
  );

  if (role === "creator") {
    await adminClient.from("creators").upsert(
      {
        id: userId,
        display_name: displayName,
        bio: "Playwright test creator",
      },
      { onConflict: "id" }
    );
  }

  return { email, password, userId };
}

export async function deleteTestUser(userId: string) {
  if (!adminClient) return;
  try {
    await adminClient.auth.admin.deleteUser(userId);
  } catch (err) {
    console.warn("[helpers] deleteUser failed:", err);
  }
  await adminClient.from("profiles").delete().eq("id", userId);
  await adminClient.from("creators").delete().eq("id", userId);
  await adminClient.from("wallet_accounts").delete().eq("user_id", userId);
  await adminClient.from("user_wallets").delete().eq("id", userId);
}

export async function injectSupabaseSession(
  page: Page,
  email: string,
  password: string,
  baseUrl: string
) {
  if (!publicClient || !SUPABASE_PROJECT_REF) {
    throw new Error(
      "Missing Supabase public client. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
    );
  }
  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true") {
    throw new Error("injectSupabaseSession requires NEXT_PUBLIC_TEST_MODE to be true.");
  }

  await ensureTestMode(page);
  const { data, error } = await publicClient.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.session.user) {
    throw error || new Error("Failed to obtain Supabase session.");
  }

  const storageKey = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
  const payload = {
    currentSession: data.session,
    currentUser: data.session.user,
  };

  await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded" });

  const sessionResult = await page.evaluate(
    async (sessionPayload) => {
      const response = await fetch("/api/test/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-mode": "1",
        },
        body: JSON.stringify(sessionPayload),
      });
      return { ok: response.ok, status: response.status, text: await response.text() };
    },
    {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
    }
  );

  if (!sessionResult.ok) {
    throw new Error(`Failed to set test session: ${sessionResult.status} ${sessionResult.text}`);
  }

  if (!SUPABASE_PROJECT_REF) {
    throw new Error("SUPABASE_PROJECT_REF is missing, cannot set auth cookie");
  }

  const sessionCookieName = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
  const sessionCookieValue = `base64-${Buffer.from(JSON.stringify(data.session)).toString(
    "base64"
  )}`;
  await page.context().addCookies([
    {
      name: sessionCookieName,
      value: sessionCookieValue,
      url: baseUrl,
    },
  ]);

  const sessionCookies = await page.context().cookies(baseUrl);
  const hasAccessCookie = sessionCookies.some((cookie) => cookie.name === "sb-access-token");
  if (!hasAccessCookie) {
    throw new Error(
      `Test session cookie missing after injection (url: ${baseUrl}). Cookies: ${sessionCookies
        .map((cookie) => cookie.name)
        .join(", ")}`
    );
  }

  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: payload }
  );

  await page.evaluate(
    ({ accessToken, refreshToken, maxAge }) => {
      document.cookie = `sb-access-token=${accessToken}; path=/; max-age=${maxAge}`;
      document.cookie = `sb-refresh-token=${refreshToken}; path=/; max-age=${maxAge * 4}`;
    },
    {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      maxAge: Math.max(1, Math.floor(data.session.expires_in || 3600)),
    }
  );

  for (let attempt = 0; attempt < 3; attempt++) {
    const navigated = await page
      .goto(`${baseUrl}/home`, { waitUntil: "domcontentloaded", timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (!navigated) {
      await page.waitForTimeout(1000 * (attempt + 1));
      continue;
    }
    const onHome = await page
      .getByTestId("home-feed")
      .isVisible()
      .then(() => true)
      .catch(() => false);
    if (onHome) {
      return;
    }
    await page.waitForTimeout(1000 * (attempt + 1));
  }
  try {
    await signInUser(page, email, password);
    return;
  } catch (error) {
    throw new Error(
      `Failed to navigate to /home after session injection (url: ${page.url()}). Fallback login failed: ${String(error)}`
    );
  }
}

/**
 * 等待页面加载完成
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("domcontentloaded");
}

/**
 * 等待 Auth 页面就绪
 */
async function waitForAuthReady(page: Page) {
  const ageGateModal = page.getByTestId("age-gate-modal");
  if (await ageGateModal.isVisible().catch(() => false)) {
    const confirmButton = page.getByTestId("age-gate-yes");
    await confirmButton.click();
  }
  await expect(page.getByTestId("auth-email")).toBeVisible({ timeout: 60000 });
}

/**
 * 注册新用户
 */
export async function signUpUser(
  page: Page,
  email: string,
  password: string = TEST_PASSWORD,
  role: TestUserRole = "fan"
): Promise<void> {
  await ensureTestMode(page);

  if (process.env.NEXT_PUBLIC_TEST_MODE === "true" && adminClient) {
    try {
      let createdUser = null;
      try {
        const { data } = await withAdminRetries(
          () =>
            adminClient.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { role },
            }),
          "createUser"
        );
        createdUser = data?.user ?? null;
      } catch (error) {
        if (!isAlreadyRegisteredError(error)) {
          throw error;
        }
      }

      const existingUser = createdUser ?? (await findUserByEmail(email));
      if (!existingUser?.id) {
        throw new Error("Failed to create or locate test user");
      }

      if (!createdUser) {
        try {
          await adminClient.auth.admin.updateUserById(existingUser.id, {
            password,
            user_metadata: { role },
          });
        } catch (error) {
          console.warn("[helpers] updateUserById failed:", error);
        }
      }

      await ensureTestProfileRecord(existingUser.id, email, role);
      await injectSupabaseSession(page, email, password, BASE_URL);
      const navigationResult = await page
        .waitForURL(/\/home/, { timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      if (!navigationResult) {
        await page.goto(`${BASE_URL}/home`, { waitUntil: "load" }).catch(() => {});
      }
      if (!page.url().includes("/home")) {
        await signInUser(page, email, password);
      }
      return;
    } catch (error) {
      console.warn("[helpers] admin signup failed, falling back to UI:", error);
    }
  }
  await page.goto(`${BASE_URL}/auth?mode=signup`, { waitUntil: "domcontentloaded" });
  await waitForAuthReady(page);

  // 确保在 signup tab
  const signupTab = page.getByTestId("auth-tab-signup");
  if (await signupTab.isVisible()) {
    await signupTab.click();
    await page.waitForTimeout(500); // 等待 tab 切换动画
  }

  // 填写邮箱和密码
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);

  // 确认年龄 checkbox（signup 页面的 auth-age-checkbox）
  const ageCheckbox = page.getByTestId("auth-age-checkbox");
  if (await ageCheckbox.isVisible().catch(() => false)) {
    await ageCheckbox.click();
  }

  // 点击注册按钮
  await page.getByTestId("auth-submit").click();

  // 等待导航或状态更新（window.location.href 可能需要一些时间）
  // 使用 Promise.race 同时等待导航和超时
  try {
    // 首先等待导航（如果发生）
    await page.waitForURL(`${BASE_URL}/home`, { timeout: 20000 });
    return; // 成功跳转到 /home
  } catch (navError) {
    // 导航超时，检查当前状态
    await page.waitForTimeout(2000); // 给一些时间让状态更新

    const currentUrl = page.url();

    // 如果已经跳转到 home，直接返回
    if (currentUrl.includes("/home")) {
      return;
    }

    // 如果还在 auth 页面，检查状态
    if (currentUrl.includes("/auth")) {
      // 检查是否有成功消息（邮箱验证提示）
      const successMessage = page.locator("text=/check your email|verification|验证/i");
      const hasSuccessMessage = await successMessage
        .first()
        .isVisible()
        .catch(() => false);

      if (hasSuccessMessage) {
        console.log("注册成功，需要邮箱验证，尝试通过 Admin API 确认并注入 session");
        // 使用 Admin API 确认邮箱并注入 session
        const injected = await confirmAndInjectSession(page, email, password, role);
        if (injected) {
          // session 注入成功，导航到 /home
          await page.goto(`${BASE_URL}/home`, { waitUntil: "load", timeout: 15000 });
          return;
        }

        // 如果无法注入 session，尝试直接登录（可能已自动确认邮箱）
        try {
          await signInUser(page, email, password);
          return;
        } catch (signInError) {
          throw new Error("无法通过 Admin API 确认邮箱，请确保 SUPABASE_SERVICE_ROLE_KEY 已配置");
        }
      } else {
        // 检查是否有错误消息
        const errorMessage = page.locator("text=/error|failed|失败/i");
        const hasError = await errorMessage
          .first()
          .isVisible()
          .catch(() => false);

        if (hasError) {
          // 注册失败，抛出错误
          const errorText = await errorMessage
            .first()
            .textContent()
            .catch(() => "注册失败");
          throw new Error(`注册失败: ${errorText}`);
        }

        // 如果既没有成功消息也没有错误消息，可能是注册成功但 window.location.href 没有触发导航
        // 尝试手动导航到 /home（因为 session 应该已经存在）
        console.log("注册后没有自动跳转，尝试手动导航到 /home");
        try {
          await page.goto(`${BASE_URL}/home`, { waitUntil: "load", timeout: 10000 });
          // 验证是否成功导航到 /home
          const finalUrl = page.url();
          if (finalUrl.includes("/home")) {
            return;
          }
        } catch (gotoError) {
          // 如果手动导航也失败，可能是 session 没有正确保存，尝试登录
          console.log("手动导航失败，尝试登录");
          // 不抛出错误，而是尝试登录
          try {
            await signInUser(page, email, password);
            return;
          } catch (signInError) {
            // 如果登录也失败，抛出原始导航错误
            throw navError;
          }
        }
      }
    } else {
      // 其他情况，抛出原始错误
      throw navError;
    }
  }

  if (!page.url().includes("/home")) {
    const injected = await confirmAndInjectSession(page, email, password, role);
    if (!injected) {
      throw new Error("注册成功但无法建立会话，请检查测试环境配置");
    }
  }
}

/**
 * 登录用户
 */
export async function signInUser(
  page: Page,
  email: string,
  password: string = TEST_PASSWORD
): Promise<void> {
  await ensureTestMode(page);
  await page.goto(`${BASE_URL}/auth?mode=login`, { waitUntil: "domcontentloaded" });
  await waitForAuthReady(page);

  // 确保在 login tab
  const loginTab = page.getByTestId("auth-tab-login");
  if (await loginTab.isVisible()) {
    await loginTab.click();
    await page.waitForTimeout(500); // 等待 tab 切换动画
  }

  // 填写邮箱和密码
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);

  // 点击登录按钮并等待响应
  const navigationPromise = page
    .waitForURL(`${BASE_URL}/home`, { timeout: 20000 })
    .catch(() => null);
  await page.getByTestId("auth-submit").click();

  // 等待一下让登录请求完成
  await page.waitForTimeout(2000);

  // 检查是否有错误消息（快速失败）
  const errorElement = page.locator("text=/error|invalid|incorrect/i");
  const hasError = await errorElement
    .first()
    .isVisible()
    .catch(() => false);
  if (hasError) {
    const errorText = await errorElement
      .first()
      .textContent()
      .catch(() => "登录失败");
    throw new Error(`登录失败: ${errorText}`);
  }

  // 检查是否已经导航到 /home
  const navigated = await navigationPromise;
  if (navigated) {
    return; // 成功导航到 /home
  }

  // 如果还没有导航，检查当前 URL
  const currentUrl = page.url();
  if (currentUrl.includes("/home")) {
    return; // 已经在 /home
  }

  // 等待跳转到 home（增加超时时间，因为可能需要处理验证）
  try {
    await page.waitForURL(`${BASE_URL}/home`, { timeout: 15000 });
    return; // 成功导航到 /home
  } catch (error) {
    // 如果超时，检查当前 URL
    const currentUrl = page.url();
    if (currentUrl.includes("/auth")) {
      // 可能还在登录页面，再次检查是否有错误
      const errorElement2 = page.locator("text=/error|invalid|incorrect/i");
      const hasError2 = await errorElement2
        .first()
        .isVisible()
        .catch(() => false);
      if (hasError2) {
        const errorText = await errorElement2
          .first()
          .textContent()
          .catch(() => "登录失败");
        throw new Error(`登录失败: ${errorText}`);
      }

      // 如果没有错误，可能是登录成功但导航失败，等待 session 保存后再尝试手动导航
      console.log("登录后没有自动跳转，等待 session 保存后尝试手动导航到 /home");

      // 等待 session 保存到 localStorage/cookies（Supabase 需要时间）
      await page.waitForTimeout(3000);

      // 验证 session 是否已保存（通过检查 localStorage）
      const hasSession = await page
        .evaluate(() => {
          try {
            const supabaseAuth = localStorage.getItem(
              "sb-" + window.location.hostname.split(".")[0] + "-auth-token"
            );
            return !!supabaseAuth;
          } catch {
            return false;
          }
        })
        .catch(() => false);

      if (!hasSession) {
        console.log("Session 未保存，等待更长时间...");
        await page.waitForTimeout(3000);
      }

      try {
        await page.goto(`${BASE_URL}/home`, { waitUntil: "load", timeout: 15000 });
        // 等待一下让页面完全加载
        await page.waitForTimeout(2000);
        // 验证是否成功导航到 /home
        const finalUrl = page.url();
        if (finalUrl.includes("/home")) {
          return;
        }
        // 如果被重定向到 /auth，说明 session 没有正确保存
        if (finalUrl.includes("/auth")) {
          // 再次等待并重试一次
          console.log("第一次导航被重定向到 /auth，等待后重试");
          await page.waitForTimeout(5000);
          await page.goto(`${BASE_URL}/home`, { waitUntil: "load", timeout: 15000 });
          const retryUrl = page.url();
          if (retryUrl.includes("/home")) {
            return;
          }
          throw new Error("登录后 session 未正确保存，无法访问 /home");
        }
        // 如果导航后仍然不在 /home，抛出错误
        throw new Error(`登录成功但无法导航到 /home，当前 URL: ${finalUrl}`);
      } catch (gotoError) {
        // 如果手动导航也失败，检查是否是重定向到 /auth
        const currentUrl2 = page.url();
        if (currentUrl2.includes("/auth")) {
          throw new Error("登录后 session 未正确保存，无法访问 /home");
        }
        // 其他错误，抛出原始错误
        throw new Error(
          `登录后导航失败: ${gotoError instanceof Error ? gotoError.message : String(gotoError)}`
        );
      }
    } else if (currentUrl.includes("/home")) {
      // 已经在 home 页面，直接返回
      return;
    } else {
      const injected = await confirmAndInjectSession(page, email, password, role);
      if (injected) {
        return;
      }
      throw error;
    }
  }
}

/**
 * 清除所有存储和 cookies
 */
export async function clearStorage(page: Page): Promise<void> {
  // 先导航到一个页面，确保有有效的上下文
  try {
    await page.goto("about:blank");
  } catch {
    // 如果 about:blank 失败，尝试导航到 baseURL
    await page.goto(BASE_URL);
  }

  await page.context().clearCookies();

  // 在页面上下文中清除存储
  try {
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // 忽略安全错误（某些页面可能不允许访问 storage）
        console.warn("无法清除存储:", e);
      }
    });
  } catch (e) {
    // 如果清除存储失败，继续执行（不是致命错误）
    console.warn("清除存储时出错:", e);
  }

  await ensureTestMode(page);
}

/**
 * 等待元素可见并可交互
 */
export async function waitForVisible(
  page: Page,
  selector: string,
  timeout: number = 15000
): Promise<void> {
  await page.waitForSelector(selector, { state: "visible", timeout });
}

/**
 * 等待 API 请求完成
 */
export async function waitForAPIResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = 10000
): Promise<void> {
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === "string") {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );
}

/**
 * 验证错误提示显示
 */
export async function expectError(page: Page, errorText: string): Promise<void> {
  const errorElement = page.locator(`text=${errorText}`);
  await expect(errorElement).toBeVisible({ timeout: 5000 });
}

/**
 * 验证成功提示显示
 */
export async function expectSuccess(page: Page, successText: string): Promise<void> {
  const successElement = page.locator(`text=${successText}`);
  await expect(successElement).toBeVisible({ timeout: 5000 });
}

/**
 * 上传文件
 */
export async function uploadFile(
  page: Page,
  fileInputSelector: string,
  filePath: string
): Promise<void> {
  const fileInput = page.locator(fileInputSelector);
  await fileInput.setInputFiles(filePath);
}

/**
 * 创建测试图片文件（临时）
 */
export async function createTestImageFile(): Promise<string> {
  // 创建一个简单的测试图片（1x1 像素的 PNG）
  // 在实际测试中，可以使用真实的测试图片文件
  return "";
}

/**
 * 等待导航完成
 */
export async function waitForNavigation(
  page: Page,
  url: string | RegExp,
  timeout: number = 10000
): Promise<void> {
  if (typeof url === "string") {
    await page.waitForURL(url, { timeout });
  } else {
    await page.waitForURL(url, { timeout });
  }
}

/**
 * 验证页面标题或文本
 */
export async function expectPageText(page: Page, text: string): Promise<void> {
  await expect(page.locator(`text=${text}`)).toBeVisible({ timeout: 5000 });
}

/**
 * 点击并等待导航
 */
export async function clickAndWaitForNavigation(
  page: Page,
  selector: string,
  expectedUrl: string | RegExp,
  timeout: number = 10000
): Promise<void> {
  await Promise.all([page.waitForURL(expectedUrl, { timeout }), page.click(selector)]);
}

/**
 * 填写表单字段
 */
export async function fillFormField(page: Page, selector: string, value: string): Promise<void> {
  const field = page.locator(selector);
  await field.fill(value);
}

/**
 * 选择下拉选项
 */
export async function selectOption(page: Page, selector: string, value: string): Promise<void> {
  const select = page.locator(selector);
  await select.selectOption(value);
}

/**
 * 验证元素存在
 */
export async function expectElementExists(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector)).toBeVisible({ timeout: 5000 });
}

/**
 * 验证元素不存在
 */
export async function expectElementNotExists(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector)).not.toBeVisible({ timeout: 5000 });
}
