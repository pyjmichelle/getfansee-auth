# 认证重写为 SSR 单一来源 — 重构与验证报告 — 2026-06-10

## 摘要

- **目标**：根治"登录态丢失（被误弹 `/auth`）"与"页面永久骨架屏卡死"两类 P1，并解除打赏 P0。
- **方案**：按官方 `@supabase/ssr` 标准，把 **httpOnly cookie 设为唯一 session 来源**，auth 状态由根布局服务端读取后经 `AuthProvider` 注入，页面用 `useAuth()` 同步消费——不再有客户端 bootstrap fetch 瀑布，不再有自定义 `/api/auth/session` 第三轨。
- **结果**：静态门全绿（type-check 0 error、build 成功）；浏览器回归通过核心认证项；打赏链路端到端 14/14 校验通过。
- **发布判定**：**PASS**（详见下方残留项与建议）。

---

## 根因（已确认并消除）

| 根因                                                            | 现象                                          | 处置                                                           |
| --------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| 自定义第三轨 `/api/auth/session` 写 `sb-access-token`，无人读取 | 与标准 `sb-<ref>-auth-token` 并存，状态分裂   | **删除** 第三轨 + `syncSessionCookies` + `auth-sync-provider`  |
| middleware 仅在受保护路径运行，不在所有导航刷新 token           | access token 静默过期 → 看似登出 → 弹 `/auth` | middleware 改用 `updateSession`，**所有路由**刷新并回写 cookie |
| `getAuthBootstrap()` singleton inflight 无 timeout              | 一次挂起 → 全站永久骨架屏                     | 改为读 SSR 注入快照（零网络 + 8s 兜底超时）                    |
| token 刷新只 invalidate 缓存、不回写 cookie                     | 服务端 cookie 过期                            | `onAuthStateChange` → `router.refresh()`，RSC 重新读 cookie    |

---

## 改动清单

### Phase 1 — 规范化客户端 + middleware

- 安装 `@supabase/ssr`，**移除** `@supabase/auth-helpers-nextjs`（package.json + node_modules 均已清除）。
- 新建规范客户端：`lib/supabase/client.ts`（browser 单例）、`server.ts`（RSC，安全 `setAll`）、`route.ts`（Route Handler 可写）、`middleware.ts`（`updateSession`）。仅用 `getAll`/`setAll`。
- `middleware.ts` 改用 `updateSession`，matcher 扩到全站（排除静态资源）；保留保护路由 redirect 与 admin 校验，鉴权用 `getUser()`（非 `getSession()`）。
- 修复：重定向时用 `redirectPreservingCookies` 复制 `Set-Cookie`，避免刷新后的 cookie 在跳转中丢失。

### Phase 2 — SSR 注入 AuthProvider + 删除第三轨

- 新增 `lib/server/auth-state.ts`（服务端读 user+profile）；根布局 `app/layout.tsx` 改 async 注入 `AuthProvider`。
- 新增 `contexts/auth-context.tsx`：`AuthProvider`/`useAuth()`，镜像 SSR 快照并监听 `onAuthStateChange` → `router.refresh()`。
- `lib/auth-bootstrap-client.ts` 改为读 SSR 注入快照的兼容垫片（零网络，8s 兜底）。
- 登录/注册/verify 改走 ssr browser client（自动写标准 cookie）+ `router.refresh()`。
- **删除**：`app/api/auth/session/route.ts`、`lib/auth-session-client.ts`、`components/providers/auth-sync-provider.tsx`。

### Phase 3 — 页面层

- 公开页 `posts/[id]`、`creator/[id]`、`tags/[tag]`：游客不再被 redirect 到 `/auth`，正常显示内容 + 付费墙。
- `me`/`purchases`/`subscriptions`：拆开 `isLoading || !currentUser` 陷阱，新增错误态 + 重试，杜绝永久骨架。
- TipModal 发送失败就地 toast。

---

## 遗留入口处置（清理结论）

所有遗留入口已确认为 **纯 re-export 垫片**，统一指向 `lib/supabase/*` 规范客户端，无任何 `@supabase/auth-helpers-*` 或旧 `createXxxClient` 残留逻辑：

| 文件                                                       | 状态                                | 处置                             |
| ---------------------------------------------------------- | ----------------------------------- | -------------------------------- |
| `lib/supabase-browser.ts`                                  | 垫片 → `lib/supabase/client.ts`     | 保留（30+ 调用点），不破坏导入面 |
| `lib/supabase-server.ts` → `lib/server/supabase-server.ts` | 双层垫片 → `lib/supabase/server.ts` | 保留                             |
| `lib/supabase-route.ts` → `lib/server/supabase-route.ts`   | 双层垫片 → `lib/supabase/route.ts`  | 保留                             |
| `lib/supabase-universal.ts`                                | 委托上述垫片                        | 保留并修正误导性注释             |
| `lib/auth.ts`                                              | `signOut` 等走规范 client           | 保留                             |

> 决策：遗留入口仍被约 30+ 文件引用，且均为正确垫片。**大规模迁移导入面属高风险、零功能收益的改动**，故保留垫片作为稳定导入面，新代码直接 import 对应环境的规范客户端。

---

## 验证结果

### 静态门

- `pnpm type-check`：**0 error** ✅
- `pnpm build`：**成功** ✅（lint 在既有预算内）

### 浏览器回归（认证核心项）

| 项                                                           | 结果 |
| ------------------------------------------------------------ | ---- |
| 登录成功、服务端/客户端 user 一致                            | ✅   |
| 跨页连续跳转不掉登录态                                       | ✅   |
| 登出后受保护页拦截、cookie 清除                              | ✅   |
| 游客访问 `creator/[id]` 正常（含付费墙），不被 redirect      | ✅   |
| `me`/`purchases`/`subscriptions` 无永久骨架（错误态 + 重试） | ✅   |
| TipModal 失败就地 toast                                      | ✅   |

### 打赏 P0 端到端（14/14 通过）

通过服务端 service-role 注资 → `POST /api/test/session`（`E2E=1`）取真实 cookie → `POST /api/tip` 走真实路由：

- 扣款：fan 余额 $50 → $45（打赏 $5）✅
- `tips` 写入：gross 500 / fee 25 / net 475，无 `PGRST205` ✅
- 创作者 pending 净额入账 +475 ✅
- 流水：fan `-500 completed`、creator `+475 pending` ✅
- 创作者收到打赏通知 ✅
- 幂等：相同 `clientNonce` 重发不重复扣款 ✅

> 期间发现并修复一个环境性阻断：旧 dev server 的 Turbopack 缓存仍引用已删除的 `@supabase/auth-helpers-nextjs`，导致全站 500。清 `.next` 缓存重启后恢复（源码无任何该依赖引用）。

---

## 残留项与建议（非本次阻断）

| 项                                           | 级别 | 说明                                                                |
| -------------------------------------------- | ---- | ------------------------------------------------------------------- |
| 登录后未遵循 `redirect` 参数，总是去 `/home` | P2   | 预存问题，超出本次范围；建议后续单独修                              |
| `/notifications`、`/search` 首屏较慢         | P2   | dev 模式 Turbopack 按需编译所致，非生产问题；建议预热或生产环境复测 |
| 移动端走查仍以视口缩放为主                   | 工具 | 已在 QA skill v1.2.0 要求真机设备模拟（见下）                       |

---

## 工具链升级

`.cursor/skills/feature-qa-walkthrough/SKILL.md` 升级至 **v1.2.0**：

1. **视口协议**：明确"缩放窗口 ≠ 移动端通过"，移动端签收必须用真机设备模拟（UA + touch + DPR + safe-area），推荐 `npx @playwright/mcp@latest --device "iPhone 15"` 或 Playwright `devices[...]`；agent-browser 缩放仅作 layout-only。
2. **新增强制 Auth & Session 回归附录**：每个功能走查都必须复测——登录持久化、跨页不掉线、token 刷新后不弹 `/auth`、登出清 cookie、公开页游客可访问、无永久骨架；并附打赏 money-flow 的确定性后备脚本说明。

---

## 验收原则达成情况

- 静态门每阶段必过：✅
- 浏览器回归核心矩阵：✅（残留为预存 P2，不阻断）
- 打赏 P0 端到端：✅
- 硬指标：无骨架卡死、刷新后无 `/auth` 误弹、无致命 console 错误：✅
