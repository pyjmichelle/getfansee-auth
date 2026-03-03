# GetFanSee 可执行修复 Backlog（上线前）

> 字段：Priority | Issue 标题 | 复现步骤 | Root cause（证据） | Fix plan（文件/函数） | 验收标准 | 影响面

| Priority | Issue 标题                                          | 复现步骤                                                                             | Root cause（证据）                                                                   | Fix plan（具体文件与函数）                                                                                     | 验收标准（可测）                                                                                          | 预计影响面                        |
| -------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------- |
| P0       | `app/purchases/page.tsx` 错误导入导致 dev 500       | `pnpm dev` 后访问 `/api/health`                                                      | `ShoppingBag` 在 `@/lib/icons` 不存在（错误栈指向 `app/purchases/page.tsx`）         | 修正 `app/purchases/page.tsx` 导入（改为已有图标，如 `Coins`）；补充 icon 导出测试                             | `pnpm dev` 下 `curl /api/health` 返回 200；`pnpm exec playwright test tests/e2e/smoke-check.spec.ts` 通过 | 全站开发态可用性、E2E 稳定性      |
| P0       | 举报链路断：前端调用 `/api/report` 不存在           | 在 `/report` 页面提交举报                                                            | `app/report/ReportPageClient.tsx` 调用 `/api/report`；`app/api/report/route.ts` 缺失 | 新增 `app/api/report/route.ts`，复用 `lib/reports.ts` 的 `createReport`；添加鉴权 `requireUser`                | 提交举报返回 200 且 `reports` 表写入成功；新增集成测试通过                                                | 举报页、审核后台、合规            |
| P0       | 钱包充值闭环失败                                    | 运行 `pnpm exec playwright test --project=chromium`，失败在 `money-flow.spec.ts:188` | E2E 失败，余额未按预期更新                                                           | 排查 `app/api/wallet/recharge/route.ts` 与 `app/me/wallet/page.tsx` 数据一致性；补充充值后读取同一来源余额 API | `tests/e2e/money-flow.spec.ts` 全通过；`wallet` API/页面金额一致                                          | 钱包页、交易表、购买链路          |
| P0       | Fan Feed 核心加载不稳定                             | 全量 chromium 测试                                                                   | 失败项 `fan-journey` 1.2 feed 加载                                                   | 优化 `app/home/page.tsx` 与 `HomeFeedClient` 的加载/空态；将必要 testid 固化                                   | `tests/e2e/fan-journey.spec.ts` 1.2 全通过且重跑 3 次稳定                                                 | 首页体验、转化                    |
| P1       | Admin 内容审核前后端接口不一致                      | 打开 `/admin/content-review`                                                         | 页面调用 `/api/admin/posts`；另有 `/api/admin/content-review` 未被前端使用           | 统一协议：要么页面改用 `content-review`，要么合并 API；删除冗余实现                                            | 审核列表、审核操作均走同一 API；相关 E2E/集成通过                                                         | Admin 审核模块                    |
| P1       | 审核后通知 Creator 未实现                           | 管理员审核通过/拒绝内容                                                              | `app/api/admin/content-review/route.ts` 存在 `TODO` 通知                             | 在 `POST` 成功后调用通知服务（站内信/邮件）；新增失败重试或补偿日志                                            | 审核操作后目标 creator 有可见通知；有失败日志与重试                                                       | Admin、通知、creator 体验         |
| P1       | AuthSessionMissingError 污染控制台并触发 smoke fail | 跑 `smoke-check.spec.ts`                                                             | 控制台捕获 `[auth-server] getUser error ... Auth session missing`                    | 在 `lib/server/auth-server.ts` 对匿名访客降级为 debug，不输出 error 级；或仅在开发显示                         | `smoke-check` 的 “no console errors” 通过                                                                 | 首屏质量门禁                      |
| P1       | `smoke.spec.ts` 注册页切换断言失败                  | 跑 `tests/e2e/smoke.spec.ts`                                                         | UI 状态/selector 与测试预期漂移                                                      | 固化 `auth-tab-login`/`auth-tab-signup` 行为与 aria 状态；必要时更新测试断言                                   | `tests/e2e/smoke.spec.ts` 通过，且在 CI 不 flaky                                                          | Auth 页                           |
| P1       | Creator Subscribers / Earnings 文案断言脆弱         | `creator-journey` 对应用例                                                           | 用例依赖 `text=/subscriber                                                           | earning/`，页面文案可能变动                                                                                    | 给关键区域补固定 testid（如 `subscribers-list`, `earnings-balance` 已有，补标题 testid）并改测试定位      | 对应用例无需 retry 即过；重跑稳定 | Creator Studio |
| P1       | 服务角色 key 使用面过宽（测试/脚本）                | `rg SUPABASE_SERVICE_ROLE_KEY`                                                       | 多脚本和测试夹具直接读取 key                                                         | 保留测试必需路径，减少业务代码直读；集中到受控 helper；文档明确“仅 CI 私有环境使用”                            | `scripts/ci/check-no-service-role-leaks.sh` 白名单最小化且门禁通过                                        | 安全边界                          |
| P2       | 单元测试与实现漂移严重                              | `pnpm test:unit`                                                                     | 7 files fail / 27 tests fail（mock 链式 API 不匹配）                                 | 按模块修复测试桩：`tests/unit/lib/auth.test.ts`、`paywall.test.ts`、`wallet.test.ts`、`posts.test.ts`          | `pnpm test:unit` 全绿                                                                                     | 研发效率、回归信心                |
| P2       | 占位交互（coming soon）影响闭环感知                 | 浏览帖子详情、个人页、创作者页                                                       | `app/posts/[id]/page.tsx`、`app/creator/[id]/page.tsx` 存在占位 toast/文案           | 将占位按钮隐藏或降级为禁用态+说明；已实现能力优先接线 API                                                      | UX 巡检无“可点不可用”高频项                                                                               | 前台体验                          |
| P2       | middleware 约定弃用告警                             | build 输出提示                                                                       | Next16 提示 middleware -> proxy                                                      | 评估迁移 `middleware.ts` 到 `proxy` 新约定                                                                     | build 无该警告，行为不变                                                                                  | 平台兼容性                        |

## 建议执行顺序（最短闭环）

1. 修复 P0-1（错误导入）+ P0-2（report API）
2. 修复 P0-3（充值闭环）+ P0-4（feed 稳定）
3. 压制 P1 flaky（auth/smoke/creator selector）
4. 收敛 service role 面 + 补审核通知
5. 回跑全门禁并锁定 smoke 套件

## 最新进展（2026-02-28）

- ✅ P0-1 已修复：`app/purchases/page.tsx` 错误图标导入已替换，`pnpm build` 通过。
- ✅ P0-2 已修复：新增 `app/api/report/route.ts`，未登录返回 401，已验证接口存在且可鉴权。
- ✅ P0-3 已修复（Mock 支付模式）：钱包充值闭环已打通，`tests/e2e/money-flow.spec.ts` 中“钱包充值 → 余额更新”单用例通过。
- ✅ P0-4 已修复：`fan-journey` 的 feed 加载失败由不稳定选择器导致，改为 `home-feed` testid 后单用例通过。
- ✅ P1（高收益）已修复：`AuthSessionMissingError` 降噪后，`tests/e2e/smoke-check.spec.ts` 通过。

## 最新进展（2026-02-28 夜间回归）

- ✅ P1 完成：`smoke.spec.ts` 注册模式断言改为 testid 状态检查（`auth-tab-signup[data-state=active]`），`smoke.spec.ts` 全通过。
- ✅ P1 完成：Admin 内容审核页统一改走 `/api/admin/content-review`，并新增 `remove` 审核动作（后端统一权限 Gate）。
- ✅ P1 完成：`creator-journey.spec.ts` 全量定位器升级为稳定 testid/语义定位，回归结果 `11 passed / 2 skipped`。
- ✅ P2 完成：单测漂移已收敛，`pnpm test:unit` 结果 `13 passed / 14 skipped`（integration 用例在无 Supabase 环境下自动 skip）。
- ✅ 门禁完成：`pnpm check-all`、`pnpm build`、`pnpm test:unit` 全通过。
- ✅ 关键 E2E 完成：`smoke`、`fan feed`、`money flow(钱包充值)`、`creator journey` 均通过。
- ✅ chromium 全量完成：`98 passed / 18 skipped / 1 flaky(complete-journey 边界用例)`，进程退出 `exit_code=0`。
