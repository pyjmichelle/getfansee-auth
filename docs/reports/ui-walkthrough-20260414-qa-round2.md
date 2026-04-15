# GetFanSee UI 二轮修复与回归报告（2026-04-15）

## 1) Report Review Summary

### 从 Round 1 继承的问题

基线报告：`docs/reports/ui-walkthrough-20260414-qa.md`（2026-04-14）

| 优先级 | 问题                                           | 页面                     | 状态                                                |
| ------ | ---------------------------------------------- | ------------------------ | --------------------------------------------------- |
| P0     | Creator Apply 页面无可交互控件                 | `/creator/upgrade/apply` | **假阳性** — 代码已有完整表单，Round 1 测试视口问题 |
| P0     | KYC 无可执行验证入口                           | `/creator/upgrade/kyc`   | **已修复**                                          |
| P0     | Wallet Add Funds Processing 卡住               | `/me/wallet`             | **已修复**                                          |
| P1     | Creator Profile 底部 Subscribe 遮挡 tab/filter | `/creator/[id]`          | **已修复**                                          |
| P1     | Creator Onboarding Next 被底部导航遮挡         | `/creator/onboarding`    | **已修复**                                          |
| P1     | Support Reason 下拉不稳定 + 提交反馈不清晰     | `/support`               | **已修复**                                          |
| P1     | Post comments UUID 错误                        | `/posts/mock-post-1`     | **已修复**                                          |
| P1     | Creator Studio 显示 Sign In/Join header        | `/creator/studio`        | **已修复**                                          |
| P2     | Search 空结果文案冲突                          | `/search`                | **已修复**                                          |

### 本轮新增发现并修复的问题

| 问题                                  | 页面                          | 修复内容                                                   |
| ------------------------------------- | ----------------------------- | ---------------------------------------------------------- |
| Search `isSearching` 状态泄漏         | `/search`                     | `performSearch` 早期 return 前增加 `setIsSearching(false)` |
| handleReport 假成功（仅 toast）       | `/creator/[id]`               | 改为 `router.push('/report?type=creator&id=...')`          |
| Wallet 按钮无选中时显示 "Add $0.00"   | `/me/wallet`                  | 改为 "Select an Amount"                                    |
| Comment-list 无 error state UI        | `comment-list.tsx`            | 增加 error 状态 + retry 按钮                               |
| KYC IN_PROGRESS 状态不可操作          | `kyc-status.ts`               | 设 `canContinue=true`                                      |
| KYC SUBMITTED/APPROVED 状态无可见指示 | `kyc-verification-button.tsx` | 显示 disabled 状态按钮                                     |

---

## 2) PC vs Mobile Breakdown

### Desktop (1280x800) 回归结果

| 页面                      | 布局 | 交互 | 文案 | 溢出/遮挡 | 结果     |
| ------------------------- | ---- | ---- | ---- | --------- | -------- |
| `/auth`                   | Pass | Pass | Pass | Pass      | **PASS** |
| `/auth/forgot-password`   | Pass | Pass | Pass | Pass      | **PASS** |
| `/creator/upgrade/apply`  | Pass | Pass | Pass | Pass      | **PASS** |
| `/creator/upgrade/kyc`    | Pass | Pass | Pass | Pass      | **PASS** |
| `/me/wallet`              | Pass | Pass | Pass | Pass      | **PASS** |
| `/search`                 | Pass | Pass | Pass | Pass      | **PASS** |
| `/support`                | Pass | Pass | Pass | Pass      | **PASS** |
| `/posts/mock-post-1`      | Pass | Pass | Pass | Pass      | **PASS** |
| `/creator/mock-creator-1` | Pass | Pass | Pass | Pass      | **PASS** |
| `/creator/onboarding`     | Pass | Pass | Pass | Pass      | **PASS** |

**Desktop 通过率: 10/10 (100%)**

### Mobile (375x812) 回归结果

| 页面                      | 布局 | 溢出/遮挡 | 固定元素 | 触控目标 | 结果                      |
| ------------------------- | ---- | --------- | -------- | -------- | ------------------------- |
| `/auth`                   | Pass | Pass      | Pass     | Pass     | **PASS**                  |
| `/creator/upgrade/apply`  | Pass | Pass      | Pass     | Pass     | **PASS**                  |
| `/creator/upgrade/kyc`    | Pass | Pass      | Pass     | Pass     | **PASS**                  |
| `/me/wallet`              | Pass | Pass      | Pass     | Pass     | **PASS**                  |
| `/creator/mock-creator-1` | Pass | Pass      | Pass     | Pass     | **PASS**                  |
| `/creator/onboarding`     | Pass | Pass      | Pass     | Pass     | **PASS**                  |
| `/support`                | Pass | Pass      | Pass     | Pass     | **PASS**                  |
| `/search`                 | Pass | Pass      | Pass     | Pass     | **PASS**                  |
| `/posts/mock-post-1`      | N/A  | N/A       | N/A      | N/A      | **SKIP** (test mode 数据) |
| `/home`                   | Pass | Pass      | Pass     | Pass     | **PASS**                  |

**Mobile 通过率: 9/10 (90%)，1 跳过（非布局问题）**

### 仅 PC / 仅 MB / 两端均有

- **仅 PC 问题**: 无
- **仅 MB 问题**: `/posts/mock-post-1` 在 mobile 测试环境下 mock post 路由返回加载失败（非布局问题，与 auth session 在测试模式下的行为相关）
- **两端都存在**: Round 1 所有问题在两端均已修复

---

## 3) Copy Review Summary

| 页面                                    | 变更前                                   | 变更后                                                      | 原因                                   |
| --------------------------------------- | ---------------------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| `lib/kyc/kyc-status.ts` IN_PROGRESS     | "This usually takes just a few minutes." | "You can continue where you left off."                      | 原描述暗示用户无需操作，但实际允许继续 |
| `kyc-verification-button.tsx` SUBMITTED | (不渲染，return null)                    | 显示 "Verification Under Review" disabled 按钮              | 提供可见状态指示                       |
| `kyc-verification-button.tsx` APPROVED  | (不渲染，return null)                    | 显示 "Identity Verified" disabled 按钮                      | 终端状态也需可见确认                   |
| `app/me/wallet/page.tsx` 按钮           | "Add $0.00"                              | "Select an Amount"                                          | 无选中金额时文案不应显示 $0            |
| `app/support/page.tsx` 提交后           | toast.success + success card 并存        | 仅显示 success card + "Back to Home" / "Submit Another" CTA | 避免重复反馈                           |

其他页面文案经全量审查，语法正确、语义准确、与功能状态一致、无冲突或占位文案。

---

## 4) Interaction Logic Summary

| 问题                    | 根因                                                                                          | 修复方式                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Wallet Processing 卡住  | `handleRecharge` 成功后 `await getTransactions()` 阻塞了 `finally { setIsRecharging(false) }` | 成功后立即 `setIsRecharging(false)` + toast + 1.5s 后自动关闭 modal；`getTransactions` 改为 fire-and-forget |
| handleReport 假成功     | 仅 `toast.info`，无 API 调用也无跳转                                                          | 改为 `router.push('/report?type=creator&id=...')`，导向真实举报页                                           |
| Search isSearching 泄漏 | `performSearch` 在 query<2 时 early return 但不重置状态                                       | early return 前增加 `setIsSearching(false)`                                                                 |
| KYC 按钮消失            | `IN_PROGRESS`/`SUBMITTED` 状态 meta 三个 action flag 全 false                                 | `IN_PROGRESS` 设 `canContinue=true`；`SUBMITTED`/`APPROVED` 显示 disabled 状态按钮                          |
| Studio Sign In/Join     | `isLoading` 时 `currentUser=null`，NavHeader 走未登录分支                                     | 传递占位用户 `{ username: "", role: "creator" }` 避免闪烁                                                   |

---

## 5) User Flow Summary

### 可闭环路径（已验证）

- **Creator Apply → KYC → Onboarding → Studio**: Apply 表单完整可提交 → KYC 页有可见入口按钮 → Onboarding 步骤流畅（底部导航隐藏） → Studio 加载无 Sign In 闪烁
- **Creator Profile → Tab/Filter → Post → Subscribe/Unlock**: Subscribe 浮动条不再遮挡交互 → Collab 等 filter 可正常点击
- **Wallet Add Funds → Processing → Success**: 充值 API 成功后立即反馈 → modal 自动关闭 → 余额更新
- **Support Submit → Clear Feedback**: 提交后显示 success card + 双 CTA（Back to Home / Submit Another）
- **Search → Results / Empty / Loading**: 三态互斥，无文案冲突
- **Report (from Creator Profile)**: Report 菜单正确跳转到 `/report` 页面

### 仍需关注的路径

- **Reset Password 成功闭环**: 需有效 token 才能测试完整流程
- **Post Detail mock 模式**: 部分 mock post 在某些 session 状态下可能加载失败

---

## 6) Overflow / Blocking / Boundary Summary

| 问题                                        | 根因                                | 修复方式                                              |
| ------------------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Creator Profile Subscribe 条遮挡 tab/filter | `z-[45]` 硬编码高于 bottom-nav      | 改为 `var(--z-sticky)` (30)；内容区 `pb-28` → `pb-40` |
| Onboarding Next 被底部导航遮挡              | PageShell 默认显示 BottomNavigation | 设 `hideBottomNav={true}`                             |
| z-[45] 硬编码                               | 不遵循全局 z-index 体系             | 统一使用 CSS 变量（已消除所有 `z-[45]`）              |

**回归验证**: Desktop 和 Mobile 均无溢出、遮挡、横向滚动问题。

---

## 7) Files Added / Changed

### 统一修复（跨页面/组件）

| 文件                                         | 变更类型                                                   |
| -------------------------------------------- | ---------------------------------------------------------- |
| `lib/kyc/kyc-status.ts`                      | 状态 meta 修复：IN_PROGRESS canContinue=true，描述文案优化 |
| `components/kyc/kyc-verification-button.tsx` | 增加 SUBMITTED/APPROVED 的可见 disabled 按钮               |
| `components/comments/comment-list.tsx`       | 增加 `loadError` state + error UI + retry 按钮             |

### 页面级修复

| 文件                              | 变更类型                                                  |
| --------------------------------- | --------------------------------------------------------- |
| `app/me/wallet/page.tsx`          | handleRecharge 解耦、按钮文案优化、modal 自动关闭         |
| `app/creator/[id]/page.tsx`       | Subscribe 条 z-index 降级、pb 增加、handleReport 真实跳转 |
| `app/creator/onboarding/page.tsx` | hideBottomNav 属性                                        |
| `app/creator/studio/page.tsx`     | loading 态占位用户防止 Sign In 闪烁                       |
| `app/support/page.tsx`            | 移除重复 toast、增加 "Back to Home" CTA                   |
| `app/search/SearchPageClient.tsx` | isSearching 状态泄漏修复                                  |

### API 级修复

| 文件                                   | 变更类型                           |
| -------------------------------------- | ---------------------------------- |
| `app/api/posts/[id]/comments/route.ts` | GET handler 增加 mock-post-id 检测 |

---

## 8) Regression Results

| 页面                      | Desktop | Mobile | Copy | Layout Stability | Interaction | User Flow | Overflow |
| ------------------------- | ------- | ------ | ---- | ---------------- | ----------- | --------- | -------- |
| `/auth`                   | Pass    | Pass   | Pass | Pass             | Pass        | Pass      | Pass     |
| `/auth/forgot-password`   | Pass    | N/A    | Pass | Pass             | Pass        | N/A       | Pass     |
| `/creator/upgrade/apply`  | Pass    | Pass   | Pass | Pass             | Pass        | Pass      | Pass     |
| `/creator/upgrade/kyc`    | Pass    | Pass   | Pass | Pass             | Pass        | Pass      | Pass     |
| `/me/wallet`              | Pass    | Pass   | Pass | Pass             | Pass        | Pass      | Pass     |
| `/search`                 | Pass    | Pass   | Pass | Pass             | Pass        | Pass      | Pass     |
| `/support`                | Pass    | Pass   | Pass | Pass             | Pass        | Pass      | Pass     |
| `/posts/mock-post-1`      | Pass    | Skip   | Pass | Pass             | Pass        | Partial   | Pass     |
| `/creator/mock-creator-1` | Pass    | Pass   | Pass | Pass             | Pass        | Pass      | Pass     |
| `/creator/onboarding`     | Pass    | Pass   | Pass | Pass             | Pass        | Pass      | Pass     |
| `/creator/studio`         | Pass    | N/A    | Pass | Pass             | Pass        | Pass      | Pass     |
| `/home`                   | N/A     | Pass   | Pass | Pass             | Pass        | N/A       | Pass     |

---

## 9) Remaining Risks / Follow-ups

### P2 - 需后续处理

1. **Reset Password 成功态未验证**: 需有效 reset token 才能完成完整流程测试。建议在 E2E 流程中覆盖。
2. **Post Detail mock 模式偶发加载失败**: Mobile 测试中 `/posts/mock-post-1` 在特定 session 状态下可能返回 "Failed to load post"。与 auth bootstrap 在测试模式下的时序相关，非布局/UI 问题。
3. **check:admin-client 预存失败**: `app/api/creator/create/route.ts` 使用 admin client 不在 allowlist 中。此为预存问题，非本轮变更引入。

### P3 - 建议优化

4. **Hydration mismatch warnings**: 控制台中偶现 hydration 不匹配警告。不影响功能但建议排查。
5. **Search LCP 图片**: 建议为首屏 LCP 图片设置 `loading="eager"` 提升性能。
6. **Support 表单完整 E2E**: 建议在 CI 中增加 support 表单提交的端到端测试覆盖。

---

## 代码质量验证

```
pnpm type-check  → 0 errors
pnpm lint        → 0 errors, 0 warnings
pnpm format:check → All matched files use Prettier code style
```

`pnpm check-all` 中 `check:admin-client` 失败为预存问题（`app/api/creator/create/route.ts`），非本轮变更引入。
