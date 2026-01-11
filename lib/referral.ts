/**
 * 推荐归因逻辑
 * 实现基础的 URL 参数 ?ref= 捕获并存入 30 天有效期 Cookie
 */

const REFERRAL_COOKIE_NAME = "referral_code";
const REFERRAL_COOKIE_EXPIRY_DAYS = 30;

/**
 * 从 URL 参数捕获推荐码并存入 Cookie
 * 应在页面加载时调用（客户端）
 */
export function captureReferralFromUrl(): void {
  if (typeof window === "undefined") return;

  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get("ref");

  if (refCode) {
    // 存入 Cookie，30 天有效期
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + REFERRAL_COOKIE_EXPIRY_DAYS);

    document.cookie = `${REFERRAL_COOKIE_NAME}=${refCode}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;

    // 移除 URL 参数（可选，保持 URL 清洁）
    urlParams.delete("ref");
    const newUrl =
      window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
    window.history.replaceState({}, "", newUrl);
  }
}

/**
 * 从 Cookie 获取推荐码
 * @returns 推荐码（用户 ID）或 null
 */
export function getReferralFromCookie(): string | null {
  if (typeof window === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === REFERRAL_COOKIE_NAME) {
      return value || null;
    }
  }

  return null;
}

/**
 * 清除推荐码 Cookie
 */
export function clearReferralCookie(): void {
  if (typeof window === "undefined") return;

  document.cookie = `${REFERRAL_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

/**
 * 在用户注册时绑定推荐关系
 * @param userId 新注册用户的 ID
 * @returns 是否成功绑定
 */
export async function bindReferralOnSignup(userId: string): Promise<boolean> {
  try {
    const referrerId = getReferralFromCookie();
    if (!referrerId) {
      return false; // 没有推荐码，不需要绑定
    }

    // 验证推荐人是否存在
    const { getSupabaseBrowserClient } = await import("./supabase-browser");
    const supabase = getSupabaseBrowserClient();
    const { data: referrerProfile, error: referrerError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", referrerId)
      .single();

    if (referrerError || !referrerProfile) {
      console.error("[referral] Referrer not found:", referrerError);
      return false;
    }

    // 防止自己推荐自己
    if (referrerId === userId) {
      return false;
    }

    // 更新用户的 referrer_id
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ referrer_id: referrerId })
      .eq("id", userId);

    if (updateError) {
      console.error("[referral] Failed to bind referral:", updateError);
      return false;
    }

    // 绑定成功后清除 Cookie
    clearReferralCookie();

    return true;
  } catch (err) {
    console.error("[referral] bindReferralOnSignup exception:", err);
    return false;
  }
}
