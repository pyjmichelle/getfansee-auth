# UI 修复覆盖度审计与 Demo 回归验收报告

**日期**: 2026-04-21  
**执行环境**: `demo.getfansee.com` (Chromium via cursor-ide-browser)  
**测试身份**: test-fan@example.com (Fan 角色)  
**基准版本**: Vercel 部署 commit `a3fb522`

---

## 一、核心发现：代码修复未部署

**所有上一轮的 P0/P1 代码修复（9 个文件）均为未提交的本地工作区修改，从未推送到 Vercel。**

```
git status 显示 9 个 modified 文件:
 M app/api/auth/session/route.ts
 M app/api/kyc/session/route.ts
 M app/api/kyc/status/route.ts
 M app/api/posts/[id]/route.ts
 M app/creator/new-post/page.tsx
 M app/creator/upgrade/apply/page.tsx
 M app/home/components/HomeFeedClient.tsx
 M components/bottom-navigation.tsx
 M components/page-shell.tsx
```

这直接导致 demo 上所有修复均不生效。

---

## 二、Phase 1 — P0 根因验证结果

| 路径                           | F-ID  | 预期                      | 实际                                         | 结论             |
| ------------------------------ | ----- | ------------------------- | -------------------------------------------- | ---------------- |
| 登录 → 控制台 401              | F-001 | 无 syncSession 401        | `[syncSessionCookies] failed: 401` 仍存在    | **FAIL**         |
| `/me` SSR 闪现                 | F-004 | 直接显示已登录态          | 初始显示 "Sign In" / "Join"，3s 后恢复       | **FAIL**         |
| `/me/wallet` logged-out chrome | F-006 | 直接显示余额              | 同 F-004 模式，最终恢复显示 $30.00           | **FAIL**         |
| `/posts/mock-post-1`           | F-013 | 帖子加载成功              | "Failed to load post" — mock fallback 未生效 | **FAIL**         |
| `/creator/upgrade/kyc`         | F-016 | "Start Verification" 可见 | SSR 初始闪现后，按钮出现                     | **PARTIAL PASS** |
| Creator 发帖反馈               | F-020 | toast.error 反馈          | 未测试（需 creator 登录）                    | **UNTESTED**     |

**结论**: 6 条关键路径中 4 条 FAIL、1 条 PARTIAL PASS、1 条 UNTESTED。

---

## 三、Phase 2 — P1 修复验证结果

| 检查项                                 | F-ID  | 预期                | 实际                                    | 结论         |
| -------------------------------------- | ----- | ------------------- | --------------------------------------- | ------------ |
| `/home` tab 与首条 feed 间距           | F-002 | 间距足够            | "For You" tab 仍与首条帖子头像重叠      | **FAIL**     |
| `/creator/upgrade/apply` Submit 可点击 | F-015 | 底部 nav 隐藏       | 底部 nav 仍覆盖分类标签，Submit 不可达  | **FAIL**     |
| `/creator/studio` stat tiles 完整可见  | F-022 | stat tiles 不被遮挡 | 未测试（需 creator 登录）               | **UNTESTED** |
| Comment 按钮 loading 反馈              | F-014 | 点击有 spinner      | 点击被底部 nav 拦截 (click intercepted) | **FAIL**     |

**结论**: 4 条中 3 条 FAIL、1 条 UNTESTED。

---

## 四、Phase 3 — 未修复项状态确认

| F-ID  | 严重级别 | 问题                                   | 本轮状态 | 对比上轮 |
| ----- | -------- | -------------------------------------- | -------- | -------- |
| F-009 | P2       | `/purchases` 创作者名显示 "Creator"    | 仍存在   | 无变化   |
| F-012 | P2       | `/creator/[id]` 重复 Subscribe CTA     | 仍存在   | 无变化   |
| F-018 | P2       | Logout 无 loading，~6s 等待            | 仍存在   | 无变化   |
| F-010 | P1       | `/notifications` skeleton 4 卡 vs 空态 | 仍存在   | 无变化   |

---

## 五、Phase 4 — 新问题扫描

### 控制台异常

| 级别  | 来源             | 详情                                                                   |
| ----- | ---------------- | ---------------------------------------------------------------------- |
| ERROR | React hydration  | AuthSyncProvider 下多处 hydration mismatch                             |
| ERROR | 环境变量         | "Attempted to access a server-side environment variable on the client" |
| WARN  | Vercel Analytics | va.vercel-scripts.com 加载失败（可能被 ad-blocker 拦截）               |
| ERROR | Session sync     | `[syncSessionCookies] failed: 401` （重复出现在每次导航）              |

### 网络请求

- 所有 XHR/资源请求均返回 200（包括 RSC 预取）
- 无 4xx/5xx 网络错误
- `/api/subscriptions` 正常返回

### 视觉回归

- **底部导航遮挡问题普遍存在**: `/me`、`/me/wallet`、`/purchases`、`/creator/upgrade/kyc`、`/creator/upgrade/apply`、`/creator/mock-creator-1` 等多个页面的底部内容被导航栏覆盖
- **无新引入的视觉回归**（与上一轮相同问题集）

---

## 六、本轮新增代码修复

在本轮回归测试过程中，对以下 3 个问题进行了代码级修复：

| F-ID  | 修复文件                     | 修改内容                                                                                  |
| ----- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| F-010 | `app/notifications/page.tsx` | Skeleton 从 4 个假列表项改为匹配实际空态布局（单卡居中）                                  |
| F-018 | `app/me/page.tsx`            | 添加 `isLoggingOut` 状态，sidebar 和 mobile logout 按钮均显示 spinner + "Logging out..."  |
| F-012 | `app/creator/[id]/page.tsx`  | 移除 mobile inline Subscribe 按钮（保留 sticky bottom 一个即可），inline 区域仅保留 Share |

**验证**:

- `pnpm type-check` ✅ 通过
- `pnpm lint` ✅ 通过
- `pnpm build` ✅ 通过

---

## 七、完整修复文件清单（含之前未推送的 + 本轮新增）

共 **12 个文件**修改：

| 文件                                     | 修复的 F-IDs                      | 状态           |
| ---------------------------------------- | --------------------------------- | -------------- |
| `app/api/auth/session/route.ts`          | F-001, F-004, F-006, F-017, F-021 | 已修改，未推送 |
| `app/api/posts/[id]/route.ts`            | F-013                             | 已修改，未推送 |
| `app/api/kyc/status/route.ts`            | F-016                             | 已修改，未推送 |
| `app/api/kyc/session/route.ts`           | F-016                             | 已修改，未推送 |
| `app/creator/new-post/page.tsx`          | F-020                             | 已修改，未推送 |
| `app/creator/upgrade/apply/page.tsx`     | F-015                             | 已修改，未推送 |
| `app/home/components/HomeFeedClient.tsx` | F-002, F-014, F-023               | 已修改，未推送 |
| `components/bottom-navigation.tsx`       | F-005, F-007, F-022               | 已修改，未推送 |
| `components/page-shell.tsx`              | F-005, F-007                      | 已修改，未推送 |
| `app/notifications/page.tsx`             | F-010                             | **本轮新增**   |
| `app/me/page.tsx`                        | F-018                             | **本轮新增**   |
| `app/creator/[id]/page.tsx`              | F-012                             | **本轮新增**   |

---

## 八、Release Decision Gate

### 判定：**CONDITIONAL NO**

> 代码修复已存在于本地工作区，但 **从未部署到 demo 环境**。
> 所有 7 个 P0 和 8 个 P1 的修复代码已就绪，需要提交 + 推送才能验证。

### 推送前必须完成

1. **提交代码**: 12 个修改文件需要 `git add` + `git commit`
2. **推送到远程**: `git push` 触发 Vercel 部署
3. **Vercel 环境变量确认**:
   - `NEXT_PUBLIC_SUPABASE_URL` — 确认无尾部 `/`
   - `SUPABASE_JWT_SECRET` — 确认来自 Supabase Dashboard
   - `SUPABASE_SERVICE_ROLE_KEY` — 确认已设置（F-013/F-016 依赖此变量）
4. **DB 迁移确认**: `040_didit_kyc_integration.sql` 和 `041_relax_creator_verifications_not_null.sql`

### 推送后需要回归验证的核心路径

1. 登录 → 控制台无 401 session sync error
2. `/me` → 首屏即为已登录态（无 Sign In/Join 闪现）
3. `/posts/mock-post-1` → 帖子正常加载
4. `/home` → tab 与首条帖子无重叠，comment 按钮可点击
5. `/creator/upgrade/apply` → Submit 按钮可达
6. `/creator/mock-creator-1` → 仅一个 Subscribe CTA
7. `/me` → Logout 有 spinner 反馈

### 仍需后续迭代的问题

| F-ID                 | 严重级别 | 问题                                           | 原因                              |
| -------------------- | -------- | ---------------------------------------------- | --------------------------------- |
| F-009                | P2       | `/purchases` 创作者名 "Creator"                | 需修改 purchases API 的 JOIN 逻辑 |
| F-003                | P2       | EXCLUSIVE chip 与 nav 视觉混淆                 | 视觉层级设计问题                  |
| F-008                | P3       | `/me/wallet` 余额卡空白子卡                    | 占位/废弃按钮                     |
| F-011                | P2       | `/notifications` Summary/Categories 标题不可见 | 桌面端 sidebar 布局               |
| F-024                | P2       | 底部 nav Create 图标偏移                       | 微调布局                          |
| F-025                | P3       | 重复 Toaster 挂载                              | a11y 问题                         |
| Hydration mismatch   | P2       | AuthSyncProvider hydration 不匹配              | SSR/CSR 状态同步                  |
| Server env on client | P1       | 客户端访问服务端环境变量                       | 环境变量泄漏                      |

---

_报告生成时间: 2026-04-21_  
_执行者: AI Release Review Agent_
