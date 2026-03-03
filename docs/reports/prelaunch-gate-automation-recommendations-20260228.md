# GetFanSee 门禁与自动化建议（上线前）

## 1) 推荐 CI 命令顺序（从快到慢）

```bash
# 0. 依赖与环境自检
pnpm i --frozen-lockfile
pnpm check:env

# 1. 快速静态门禁（分钟级）
pnpm lint
pnpm type-check

# 2. 构建门禁
pnpm build

# 3. 单元与集成（可并行）
pnpm test:unit

# 4. 快速 smoke（10 分钟内）
pnpm exec playwright test tests/e2e/00-server-gate.spec.ts --project=chromium
pnpm exec playwright test tests/e2e/smoke-check.spec.ts --project=chromium
pnpm exec playwright test tests/e2e/auth-page.spec.ts --project=chromium

# 5. 关键业务闭环（发布前）
pnpm exec playwright test tests/e2e/money-flow.spec.ts --project=chromium
pnpm exec playwright test tests/e2e/creator-journey.spec.ts --project=chromium
pnpm exec playwright test tests/e2e/fan-journey.spec.ts --project=chromium
```

---

## 2) Playwright 易 flake 点与治理建议

| Flake 点           | 当前表现                                       | 治理建议                                                                                                                   |
| ------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 会话注入上下文关闭 | `page/context already closed`                  | `signUpUser` 禁止复用已关闭 page；`injectSupabaseSession` 前加 `expect(page.isClosed()).toBeFalsy()`；失败立即重建 context |
| 依赖文案匹配       | `subscriber/earning` 文案定位失败              | 改为稳定 `data-testid` 定位，不依赖自然语言文本                                                                            |
| 异步加载 race      | 首页/钱包偶发未加载完成                        | 增加 `page-ready` testid；统一 `waitForPageLoad + waitForVisible(page-ready)`                                              |
| 控制台噪音触发失败 | `AuthSessionMissingError` 被视为 console error | 业务日志降级或在测试过滤白名单错误码                                                                                       |
| 资金链路时序       | 充值后余额断言偶发失败                         | 后端返回余额后前端采用 server 回读一致性；测试使用 `expect.poll` 等待最终态                                                |

---

## 3) 最小 Smoke Test（10 分钟）

### 3.1 套件建议

1. `tests/e2e/00-server-gate.spec.ts`（服务可用）
2. `tests/e2e/auth-page.spec.ts`（登录/注册基础交互）
3. `tests/e2e/smoke-check.spec.ts`（首页 + console）
4. 轻量 API 探针（curl）：
   - `GET /api/health` 200
   - 未登录 `GET /api/feed` 401
   - 未登录 `GET /api/admin/reports` 401

### 3.2 通过标准

- 以上用例全部通过
- 无 retry 才通过（禁止“靠重试绿”）
- 关键接口状态码符合预期（200/401/403）

---

## 4) 提交前必须通过 Checklist

- [ ] `pnpm lint` 通过（0 error）
- [ ] `pnpm type-check` 通过
- [ ] `pnpm build` 通过
- [ ] `pnpm test:unit` 通过（至少变更模块相关用例全绿）
- [ ] `smoke` 套件通过（无 flaky）
- [ ] 关键业务链路（Auth + Feed + Wallet + Creator）至少各 1 条 e2e 通过
- [ ] 无“前端调用不存在 API”问题（如 `/api/report`）
- [ ] 无“可点击但无动作”的高频入口
- [ ] service role 仅在受控路径使用
- [ ] 报告中 P0 项均关闭

---

## 5) 自动化落地建议

1. 新增 CI Job：`contract-check`
   - 扫描 `fetch("/api/...")`，校验对应 `app/api/**/route.ts` 是否存在。
2. 新增 CI Job：`testid-check`
   - 对关键页强制 testid（home-feed、wallet-page、subscribers-list、earnings-balance）。
3. 将 `money-flow.spec.ts` 提升为必跑护城河，并移除长期 `test.skip`。
4. 将 `pnpm exec playwright test --project=chromium` 拆分为：
   - `smoke`（PR 必跑）
   - `full-regression`（主干/夜间跑）

---

## 6) 已执行验证快照（2026-02-28 夜间）

- `pnpm check-all` → PASS
- `pnpm build` → PASS
- `pnpm test:unit` → PASS（13 passed / 14 skipped）
- 关键 E2E：
  - `tests/e2e/smoke.spec.ts` → PASS
  - `tests/e2e/fan-journey.spec.ts -g "访问 Feed 页面并验证内容加载"` → PASS
  - `tests/e2e/money-flow.spec.ts -g "钱包充值 → 余额更新"` → PASS
  - `tests/e2e/creator-journey.spec.ts` → PASS（11 passed / 2 skipped）
- chromium 全量：
  - `pnpm exec playwright test --project=chromium`
  - 结果：`98 passed / 18 skipped / 1 flaky`
  - 退出码：`0`
