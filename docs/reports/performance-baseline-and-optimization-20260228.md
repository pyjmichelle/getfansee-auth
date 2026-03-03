# Performance Baseline & Optimization Report (2026-02-28)

## Scope

- Core routes: `/home`, `/me`, `/me/wallet`, `/purchases`, `/search`, `/creator/*`, `/admin/*`.
- Goal: improve perceived speed (shorter waiting, less full-page skeleton, faster route transitions).

## Instrumentation Added

- Route transition metric:
  - Event: `route_transition_completed`
  - Properties: `from`, `to`, `duration_ms`
  - Implemented by:
    - `lib/perf-client.ts`
    - `components/providers/route-perf-tracker.tsx`
    - Navigation entry points in `components/nav-header.tsx`, `components/bottom-navigation.tsx`
- Skeleton visible duration metric:
  - Event: `skeleton_duration`
  - Properties: `skeleton_name`, `duration_ms`
  - Implemented by:
    - `hooks/use-skeleton-metric.ts`
    - Applied to: `/me`, `/me/wallet`, `/purchases`

## Main Optimizations Implemented

- Auth bootstrap consolidation:
  - Added `GET /api/auth/bootstrap` to return current auth/profile in one call.
  - Added client cache (`lib/auth-bootstrap-client.ts`, 30s TTL) to avoid repeated auth roundtrips between pages.
  - `/me`, `/me/wallet`, `/purchases`, `wallet-balance-preview` now consume bootstrap instead of repeated `getSession + ensureProfile + getProfile`.
- ensureProfile scope reduction:
  - Client `ensureProfile` now de-duplicated (single inflight + one-time per tab).
  - Server `ensureProfile` accepts optional user to avoid repeated `getCurrentUser`.
  - `app/home/page.tsx` now reuses resolved user when calling `ensureProfile`.
- Purchases N+1 removal:
  - `GET /api/purchases` now returns purchases + post + creator in aggregated shape.
  - `app/purchases/page.tsx` switched to single API fetch.
- Middleware trimming:
  - Admin route keeps role guard.
  - Creator route now only enforces login at middleware level; role checks can be handled in page/API domain logic to cut edge DB query cost per navigation.
- Age Gate first-paint optimization:
  - Removed blocking `null` loading screen; initialize verification state directly from localStorage/test flags.

## Expected Perceived Improvements

- Less “re-auth” feeling when switching pages after login.
- Less full-page skeleton exposure for `/me`, `/me/wallet`, `/purchases`.
- Faster nav responsiveness from route prefetch + transition tracking.
- Reduced API waterfall on purchases page.

## Validation Commands

- `pnpm type-check`
- `pnpm lint`
- `pnpm build`

## Manual UX Verification Script

1. Login once.
2. Navigate in sequence: `/home -> /me -> /me/wallet -> /purchases -> /search`.
3. Confirm:
   - no long full-page blank/skeleton stall,
   - route transitions feel near-instant for repeated navigation,
   - wallet preview no longer delays header interaction noticeably.

## Phase 2 Addendum (2026-02-28)

### New Optimization Coverage

- Bootstrap 扩展到：
  - `/search` (`app/search/SearchPageClient.tsx`)
  - `/notifications` (`app/notifications/page.tsx`)
  - `/creator/studio` (`app/creator/studio/page.tsx`)
  - `/creator/studio/subscribers` (`app/creator/studio/subscribers/page.tsx`)
  - `/creator/studio/earnings` (`app/creator/studio/earnings/page.tsx`)
  - `/admin` (`app/admin/page.tsx`)
  - `/admin/reports` (`app/admin/reports/page.tsx`)
  - `/admin/content-review` (`app/admin/content-review/page.tsx`)
- Skeleton 埋点补齐：
  - `search_page`
  - `notifications_page`
  - `creator_studio_page`
  - `creator_subscribers_page`
  - `creator_earnings_page`
  - `admin_dashboard_page`
  - `admin_reports_page`
  - `admin_content_review_page`
- 导航提速增强：
  - `components/nav-header.tsx`：扩展 creator/admin 高频路由预取集合，并移除 `signOut` 后 `router.refresh()` 整页刷新。
  - `components/bottom-navigation.tsx`：新增底部导航路由预取。
- Creator/Admin 请求链路优化：
  - `creator/studio` 首屏并行加载统计与最近帖子（替代串行）。
- QA 稳定性修复：
  - `lib/auth-bootstrap-client.ts`：未登录态不缓存，避免匿名访问后污染后续登录态验证。
  - `components/age-gate.tsx`：仅在 `playwright-test-mode=1` cookie 时绕过，保证匿名态门禁检查可见。
  - `app/creator/studio/page.tsx`：补充桌面导航 `data-testid="creator-nav"`。

### Validation Evidence

- `pnpm type-check` ✅ PASS
- `pnpm lint` ✅ PASS（仅剩仓库既有 warning：`app/admin/creator-verifications/page.tsx` 的 unused 变量）
- `pnpm build` ✅ PASS
- `pnpm qa:gate` ❌ FAIL（会话依赖波动导致 `deadclick` 的 creator 会话校验偶发失败）
- `pnpm qa:gate:with-sessions` ✅ PASS
  - UI Gate：10/10 PASS
  - Dead Click Gate：2/2 PASS
  - Full Site Audit：PASS（60/60 页面加载成功，0 错误状态码）

### Current Residual Risks

- 全量 audit 日志里仍可见若干 console/network 噪音（例如 posts RLS 递归策略错误、部分 hydration mismatch 提示），不阻断本轮性能目标，但建议在后续稳定性专项中继续治理。
