"use client";

/**
 * 统一事件追踪 API 层
 *
 * 所有埋点调用都通过此模块统一封装，底层使用 PostHog 实现。
 * 这样设计的好处：
 * 1. 未来切换底层工具无需修改业务代码
 * 2. 事件名称和属性结构有统一约束，避免拼写错误
 * 3. 在未配置 PostHog 时自动静默（不会报错）
 */

import { posthog } from "./posthog";

const isEnabled = () =>
  typeof window !== "undefined" &&
  !!process.env.NEXT_PUBLIC_POSTHOG_KEY &&
  process.env.NEXT_PUBLIC_TEST_MODE !== "true" &&
  process.env.PLAYWRIGHT_TEST_MODE !== "true";

// ============================================================
// 事件名称常量（防止拼写错误）
// ============================================================
export const AnalyticsEvents = {
  // 用户生命周期
  USER_REGISTERED: "user_registered",
  USER_LOGGED_IN: "user_logged_in",
  USER_LOGGED_OUT: "user_logged_out",

  // 内容消费
  CONTENT_VIEWED: "content_viewed",
  CONTENT_LIKED: "content_liked",
  CONTENT_COMMENTED: "content_commented",
  CONTENT_SHARED: "content_shared",

  // 付费转化漏斗
  PAYWALL_SHOWN: "paywall_shown",
  CONTENT_UNLOCK_ATTEMPTED: "content_unlock_attempted",
  CONTENT_UNLOCKED: "content_unlocked",
  SUBSCRIPTION_STARTED: "subscription_started",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",

  // 钱包
  WALLET_TOPUP_INITIATED: "wallet_topup_initiated",
  WALLET_TOPUP_COMPLETED: "wallet_topup_completed",

  // 创作者
  CREATOR_PROFILE_VIEWED: "creator_profile_viewed",
  CREATOR_UPGRADE_STARTED: "creator_upgrade_started",
  CREATOR_UPGRADE_COMPLETED: "creator_upgrade_completed",
  KYC_SUBMITTED: "kyc_submitted",
  POST_CREATED: "post_created",

  // 发现
  SEARCH_PERFORMED: "search_performed",
  FEED_SCROLLED: "feed_scrolled",
  TAG_CLICKED: "tag_clicked",

  // 管理员操作（审计日志）
  ADMIN_KYC_REVIEWED: "admin_kyc_reviewed",
  ADMIN_CONTENT_REMOVED: "admin_content_removed",
  ADMIN_REPORT_RESOLVED: "admin_report_resolved",
  ADMIN_USER_BANNED: "admin_user_banned",
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

// ============================================================
// 核心 Analytics 对象
// ============================================================
export const Analytics = {
  /**
   * 绑定用户身份
   * 在登录/注册成功后调用，将后续事件与用户关联
   */
  identify(userId: string, traits?: { role?: string; email?: string }) {
    if (!isEnabled()) return;
    posthog.identify(userId, traits);
  },

  /**
   * 重置用户身份（登出时调用）
   */
  reset() {
    if (!isEnabled()) return;
    posthog.reset();
  },

  /**
   * 通用事件追踪
   */
  track(event: AnalyticsEventName | string, properties?: Record<string, unknown>) {
    if (!isEnabled()) return;
    posthog.capture(event, properties);
  },

  // ============================================================
  // 用户生命周期
  // ============================================================

  userRegistered(method: "email" | "google" = "email") {
    Analytics.track(AnalyticsEvents.USER_REGISTERED, { method });
  },

  userLoggedIn(method: "email" | "google" = "email") {
    Analytics.track(AnalyticsEvents.USER_LOGGED_IN, { method });
  },

  userLoggedOut() {
    Analytics.track(AnalyticsEvents.USER_LOGGED_OUT);
    Analytics.reset();
  },

  // ============================================================
  // 内容消费
  // ============================================================

  /**
   * 内容页面被浏览
   * @param postId 帖子 ID
   * @param creatorId 创作者 ID
   * @param visibility 内容可见性：free | subscribers | ppv
   * @param isLocked 是否需要付费解锁
   */
  contentViewed(postId: string, creatorId: string, visibility: string, isLocked: boolean) {
    Analytics.track(AnalyticsEvents.CONTENT_VIEWED, {
      post_id: postId,
      creator_id: creatorId,
      visibility,
      is_locked: isLocked,
    });
  },

  contentLiked(postId: string, creatorId: string) {
    Analytics.track(AnalyticsEvents.CONTENT_LIKED, {
      post_id: postId,
      creator_id: creatorId,
    });
  },

  contentCommented(postId: string, creatorId: string) {
    Analytics.track(AnalyticsEvents.CONTENT_COMMENTED, {
      post_id: postId,
      creator_id: creatorId,
    });
  },

  contentShared(postId: string, method: "copy_link" | "native" = "copy_link") {
    Analytics.track(AnalyticsEvents.CONTENT_SHARED, {
      post_id: postId,
      method,
    });
  },

  // ============================================================
  // 付费转化漏斗
  // ============================================================

  /**
   * Paywall 弹窗显示（用户触碰付费内容）
   */
  paywallShown(postId: string, type: "subscription" | "ppv", priceCents?: number) {
    Analytics.track(AnalyticsEvents.PAYWALL_SHOWN, {
      post_id: postId,
      type,
      price_cents: priceCents,
    });
  },

  /**
   * 用户点击解锁按钮（付费意图）
   */
  contentUnlockAttempted(postId: string, method: "subscription" | "ppv", priceCents: number) {
    Analytics.track(AnalyticsEvents.CONTENT_UNLOCK_ATTEMPTED, {
      post_id: postId,
      method,
      price_cents: priceCents,
    });
  },

  /**
   * 内容解锁成功（付费成功）
   */
  contentUnlocked(postId: string, method: "subscription" | "ppv", priceCents: number) {
    Analytics.track(AnalyticsEvents.CONTENT_UNLOCKED, {
      post_id: postId,
      method,
      price_cents: priceCents,
    });
  },

  subscriptionStarted(creatorId: string, priceCents: number) {
    Analytics.track(AnalyticsEvents.SUBSCRIPTION_STARTED, {
      creator_id: creatorId,
      price_cents: priceCents,
    });
  },

  subscriptionCancelled(creatorId: string) {
    Analytics.track(AnalyticsEvents.SUBSCRIPTION_CANCELLED, {
      creator_id: creatorId,
    });
  },

  // ============================================================
  // 钱包
  // ============================================================

  walletTopUpInitiated(amountCents: number) {
    Analytics.track(AnalyticsEvents.WALLET_TOPUP_INITIATED, {
      amount_cents: amountCents,
    });
  },

  walletTopUpCompleted(amountCents: number) {
    Analytics.track(AnalyticsEvents.WALLET_TOPUP_COMPLETED, {
      amount_cents: amountCents,
    });
  },

  // ============================================================
  // 创作者
  // ============================================================

  creatorProfileViewed(creatorId: string) {
    Analytics.track(AnalyticsEvents.CREATOR_PROFILE_VIEWED, {
      creator_id: creatorId,
    });
  },

  creatorUpgradeStarted() {
    Analytics.track(AnalyticsEvents.CREATOR_UPGRADE_STARTED);
  },

  creatorUpgradeCompleted() {
    Analytics.track(AnalyticsEvents.CREATOR_UPGRADE_COMPLETED);
  },

  kycSubmitted() {
    Analytics.track(AnalyticsEvents.KYC_SUBMITTED);
  },

  /**
   * 创作者发布帖子
   */
  postCreated(visibility: string, hasMedia: boolean) {
    Analytics.track(AnalyticsEvents.POST_CREATED, {
      visibility,
      has_media: hasMedia,
    });
  },

  // ============================================================
  // 发现
  // ============================================================

  searchPerformed(query: string, resultCount: number) {
    Analytics.track(AnalyticsEvents.SEARCH_PERFORMED, {
      query,
      result_count: resultCount,
    });
  },

  /**
   * Feed 滚动深度（每滚动 N 条触发一次）
   */
  feedScrolled(depth: number, loadedCount: number) {
    Analytics.track(AnalyticsEvents.FEED_SCROLLED, {
      scroll_depth: depth,
      loaded_count: loadedCount,
    });
  },

  tagClicked(tag: string) {
    Analytics.track(AnalyticsEvents.TAG_CLICKED, { tag });
  },

  // ============================================================
  // 管理员操作审计日志
  // ============================================================

  adminKycReviewed(verificationId: string, action: "approved" | "rejected") {
    Analytics.track(AnalyticsEvents.ADMIN_KYC_REVIEWED, {
      verification_id: verificationId,
      action,
    });
  },

  adminContentRemoved(postId: string, reason?: string) {
    Analytics.track(AnalyticsEvents.ADMIN_CONTENT_REMOVED, {
      post_id: postId,
      reason,
    });
  },

  adminReportResolved(
    reportId: string,
    action: "delete" | "ban" | "no_violation",
    reportedType: string
  ) {
    Analytics.track(AnalyticsEvents.ADMIN_REPORT_RESOLVED, {
      report_id: reportId,
      action,
      reported_type: reportedType,
    });
  },

  adminUserBanned(userId: string) {
    Analytics.track(AnalyticsEvents.ADMIN_USER_BANNED, {
      banned_user_id: userId,
    });
  },
};
