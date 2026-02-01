# Sprint Plan – Current

## Sprint Goal

- Maintain green CI/CD gates
- Stabilize auth, build, and Playwright pipeline

## Active Tasks

### P0 – 审查代码并修复以确保 CI 全绿

- Scope:
  - 代码审查与关键缺陷修复
  - CI/质量门禁与测试稳定性
  - 不改变产品需求或范围
- Acceptance Criteria:
  - 识别并修复阻塞 CI 的问题
  - 本地关键门禁命令通过（见 Required Gates）
- Required Gates:
  - pnpm check-all
  - pnpm build
  - pnpm qa:gate
  - pnpm exec playwright test --project=chromium

### P0 – Fix Playwright chromium gate (next/font Google fetch)

- Scope:
  - Playwright webServer / test config only
  - No product or runtime behavior changes
- Acceptance Criteria:
  - `pnpm exec playwright test --project=chromium` passes in CI/offline
- Required Gates:
  - pnpm check-all
  - pnpm build
  - pnpm qa:gate
  - pnpm exec playwright test --project=chromium

### 已做（backfill）

- **lib/comments.ts**：post_comments 无直接 FK 到 profiles，改为两次查询（评论 + profiles）合并，避免 PostgREST 关系错误。
- **atomic-unlock E2E**：购买/交易校验改为轮询 15s + `credentials: "same-origin"`，缓解 CI 下时序与 cookie 问题。
- **E2E 方案 A**：`/api/test/session` 改为接受 email/password，由服务端 `getSupabaseRouteHandlerClient()` 调用 `signInWithPassword` 并写 cookie（与线上同一套 auth-helpers），E2E 不再注入 cookie/localStorage；helpers 中 `injectSupabaseSession` 改为 POST 该接口后 `goto('/')`，并增加临时请求监听以日志形式检查 `sb-` cookie。
- **E2E 稳定性（证据驱动）**：atomic-unlock E2E-2 取消 Promise.all 三连点，改为顺序 click + 等待成功/disabled 后再二次 click，并监听 POST /api/unlock 断言成功次数 ≤1；complete-journey 在 signUpUser/injectSupabaseSession 入口检查 page.isClosed()，clearStorage 改为同源 goto(BASE_URL) 再清 cookie/storage，避免 about:blank 导致 localStorage SecurityError；paywall-flow 上传等待改为「file(s) uploaded」或 img[src*="supabase"]」任一出现，超时则继续发布纯文本以保主流程；injectSupabaseSession 后增加 sb-\* cookie 存在断言。

---

### P1 – Kernel & Planning normalization

- Scope:
  - Replace hard-coded sprint file dependency
  - Enforce unblock-first planning rule
- Acceptance Criteria:
  - No task blocked by missing planning file

---

## Design QA Backlog（Top 5）

来源：`docs/design/design-qa-2026-01-29.md` 全站 Design QA 清单。以下为下一轮迭代候选（P0/P1），本次仅审计与计划，不在此 sprint 大规模改 UI。

| ID      | 问题                                                                                | 最小修复方案                                                                                                                                                                                                    | 验收标准                                                                                                                                            | 预计风险                                                        |
| ------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **#11** | 全站 Button 重复写 rounded-xl min-h-[44px] transition                               | 在 `components/ui/button.tsx` 的 default 或共用 variant 中纳入 rounded-xl、min-h-[44px]、transition；各页面删除与之重复的 className                                                                             | `pnpm lint` `pnpm type-check` 通过；抽 1 页（如 auth）做视觉回归或 Playwright 断言按钮可见且可点击                                                  | 可能影响现有依赖该默认样式的页面，需逐页回归                    |
| **#12** | PaywallModal 无 DialogTitle/DialogDescription，a11y 警告                            | 在 `components/paywall-modal.tsx` 内用 `DialogTitle`、`DialogDescription` 包裹现有标题与说明文案，保持视觉不变                                                                                                  | 打开 Paywall 弹窗后无 a11y 控制台警告；可选：`getByRole('dialog')` + `getByRole('heading')` 可见                                                    | 无                                                              |
| **#3**  | Creator Studio 时间范围（7d/30d/90d）为多个 Button 非 Tabs，与 auth tabs 体系不一致 | 方案 A：改用 `Tabs`+`TabsList`+`TabsTrigger`，className 使用与 auth 一致的 .auth-tabs-list/.auth-tab-trigger 或新建 .filter-tabs。方案 B：仅在 globals.css 为“筛选 tab”增加 token，保持 Button 但统一选中态样式 | 进入 /creator/studio 后 30d 为选中态、7d/90d 为非选中态；可选 Playwright：`getByRole('tab', { name: '30d' })` 有 aria-selected 或 data-state=active | 若改 Tabs 可能影响现有 state 与 URL 同步逻辑                    |
| **#7**  | Home Feed 卡片与按钮圆角/min-h 混用（rounded-xl vs rounded-lg，44 vs 40）           | 在 `app/home/components/HomeFeedClient.tsx` 统一：主 CTA 按钮 min-h 44、圆角与 Button 默认一致；次级按钮 min-h 40；Card 统一 rounded-xl。可选在 globals.css 定义 --card-radius、--btn-cta-min-h                 | Feed 内至少一张卡片可见；主 CTA（Subscribe/Unlock）可点击；可选 Playwright：`getByTestId('post-card')` 下按钮 toBeVisible                           | 仅 HomeFeedClient，影响范围可控                                 |
| **#8**  | Creator Studio 帖子列表 Badge 三套写法（green、subscribe 渐变、unlock 变量）        | 在 `components/ui/badge.tsx` 增加 variant：success（绿）、subscribe、ppv 或使用 globals.css 已有 semantic 变量；`app/creator/studio/post/list/page.tsx` 改用该 variant，删除内联 Badge className                | 帖子列表页 Free/Subscribe/PPV Badge 显示正确；可选 Playwright：Badge 含对应文案或 data-state                                                        | 若新增 variant 需与 earnings/subscribers Badge 统一，避免再漂移 |

**运行 Design QA 截图（生成证据）**：

```bash
# 先启动应用
pnpm build && pnpm start
# 或 pnpm dev

# 再执行截图（需 NEXT_PUBLIC_TEST_MODE=true、Supabase 测试账号）
pnpm exec playwright test tests/e2e/design-qa/screenshots.spec.ts --project=chromium
```

截图输出目录：`tests/design-qa/screenshots/2026-01-29/`。
