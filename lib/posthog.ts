/**
 * PostHog 初始化配置
 * 用于客户端事件追踪、用户行为分析
 */

import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

const isTestMode =
  process.env.NEXT_PUBLIC_TEST_MODE === "true" ||
  process.env.PLAYWRIGHT_TEST_MODE === "true" ||
  process.env.NODE_ENV === "test";

/**
 * 初始化 PostHog（仅在客户端调用一次）
 * 在测试模式或未配置 Key 时跳过初始化
 */
export function initPostHog(): void {
  if (typeof window === "undefined") return;
  if (!POSTHOG_KEY || isTestMode) return;
  if (posthog.__loaded) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,

    // 减少对用户隐私的影响：不自动追踪所有点击
    autocapture: false,

    // 禁用页面离开时的会话录制
    disable_session_recording: false,

    // 持久化标识符
    persistence: "localStorage+cookie",

    // 启用页面浏览自动追踪
    capture_pageview: false, // 由 PostHogProvider 手动管理

    // 跨域请求不发送 cookie
    cross_subdomain_cookie: false,

    // 隐私：屏蔽所有输入框中的文本
    mask_all_text: false,
    mask_all_element_attributes: false,

    // 在开发环境打印调试日志
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") {
        ph.debug();
      }
    },
  });
}

export { posthog };
