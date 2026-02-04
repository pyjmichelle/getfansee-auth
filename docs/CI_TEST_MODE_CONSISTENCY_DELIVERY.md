# CI / Test-mode 一致性修复交付

## 1. 修改摘要

### 1.1 统一测试开关（已落地）

- **规则**：在 qa-gate 与 e2e-tests 的 job env 中增加 `PLAYWRIGHT_TEST_MODE="true"` 与 `E2E="1"`。
- **原因**：`/api/test/session` 支持 `NEXT_PUBLIC_TEST_MODE`，但 `/api/test/create-post-with-media` 仅支持 `E2E` / `PLAYWRIGHT_TEST_MODE`。仅设 `NEXT_PUBLIC_TEST_MODE` 时 create-post-with-media 会 404。
- **结果**：CI 中所有 `/api/test/*` 路由均可访问（非 404）。

### 1.2 `/api/test/*` 路由与 env 依赖

| 路由                               | 方法 | 依赖的 env                                                                        |
| ---------------------------------- | ---- | --------------------------------------------------------------------------------- |
| `/api/test/ping`                   | GET  | NODE_ENV=test \| E2E=1 \| PLAYWRIGHT_TEST_MODE=true \| NEXT_PUBLIC_TEST_MODE=true |
| `/api/test/session`                | POST | 同上                                                                              |
| `/api/test/create-post-with-media` | POST | **仅** E2E=1 \| PLAYWRIGHT_TEST_MODE=true（不含 NEXT_PUBLIC_TEST_MODE）           |

### 1.3 会话机制（未改业务逻辑）

- **QA Gate**：仍使用 `artifacts/agent-browser-full/sessions/fan.json`、`creator.json`，由「Create test sessions」步骤运行 `pnpm test:session:auto:all`（UI 登录后导出 storageState）。gate-ui / gate-deadclick 依赖这些文件。
- **E2E**：仍使用 `POST /api/test/session` 服务端写 cookie。
- **账号一致**：create-test-users 创建 `test-fan@example.com`、`test-creator@example.com`（密码 `TestPassword123!`），与 auto-login 及 E2E 使用的固定/动态账号一致。README 已写清。

### 1.4 CI Sanity Check（已加）

- **qa-gate**：在「Wait for health endpoint」之后新增步骤「Test-mode sanity check (must not 404)」：`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/test/ping`，若为 404 则 fail 并输出 `PLAYWRIGHT_TEST_MODE` / `NEXT_PUBLIC_TEST_MODE` / `E2E`。
- **e2e-tests**：改为先起服、再「Wait for health and test-mode」（含 `/api/test/ping` 非 404 检查）、再 `PLAYWRIGHT_SKIP_SERVER=true pnpm exec playwright test`，避免「未开 test-mode 但测试在跑」的隐蔽失败。

### 1.5 Staging 安全门禁（已加）

- **脚本**：`scripts/ci/assert-no-test-mode-on-staging.sh`。检测 `NEXT_PUBLIC_TEST_MODE`、`PLAYWRIGHT_TEST_MODE`、`E2E`；若任一为“真值”则 exit 1。
- **文档**：`docs/deployment/DEPLOY_INSTRUCTIONS.md` 开头增加「Staging 安全：禁止 test-mode」说明；`tests/e2e/README.md` 中说明 staging 禁止设置上述变量，并给出本地复刻 CI 命令与 staging 部署前检查命令。

---

## 2. Workflow 变更 diff 要点

- **`.github/workflows/ci.yml`**
  - **qa-gate** `env`：新增 `PLAYWRIGHT_TEST_MODE: "true"`、`E2E: "1"`。
  - **qa-gate** steps：在「Wait for health endpoint」后新增「Test-mode sanity check (must not 404)」（curl `/api/test/ping`，404 则 fail）。
  - **e2e-tests** `env`：新增 `PLAYWRIGHT_TEST_MODE: "true"`、`E2E: "1"`。
  - **e2e-tests** steps：新增「Start app server (background)」「Wait for health and test-mode」（含 `/api/test/ping` 非 404）；「Run E2E」增加 `PLAYWRIGHT_SKIP_SERVER: "true"`；新增「Stop app server」if: always()。

- **`app/api/test/ping/route.ts`**（新建）  
  GET，与 session 相同的 test env 判断，通过则返回 200 `{ ok: true, testMode: true }`，否则 404。

- **`scripts/ci/assert-no-test-mode-on-staging.sh`**（新建）  
  检查三个 test-mode 变量，任一为真则 exit 1。

- **`tests/e2e/README.md`**  
  新增「Test-mode 环境变量（唯一来源）」「/api/test/\* 路由与 env 依赖」「会话策略」；更新「持续集成与本地复刻 CI」含本地复刻命令与 staging 部署前检查。

- **`docs/deployment/DEPLOY_INSTRUCTIONS.md`**  
  开头新增「Staging 安全：禁止 test-mode」及 `assert-no-test-mode-on-staging.sh` 用法。

---

## 3. 本地复刻 CI 的命令

```bash
# 质量与构建
pnpm check-all
pnpm build

# 起服（与 CI 一致：test-mode 开启）
export PLAYWRIGHT_TEST_MODE=true E2E=1 NEXT_PUBLIC_TEST_MODE=true
PORT=3000 pnpm start &
# 等待：curl -sf http://127.0.0.1:3000/api/health && curl -sf http://127.0.0.1:3000/api/test/ping

# 复刻 qa-gate（含 session 创建）
pnpm test:session:auto:all
pnpm qa:gate

# 复刻 E2E（另终端，服务器已起）
PLAYWRIGHT_SKIP_SERVER=true pnpm exec playwright test --project=chromium --reporter=html
```

单条龙（起服后同 shell 跑 E2E）：

```bash
pnpm build && PORT=3000 pnpm start & \
  until curl -sf http://127.0.0.1:3000/api/test/ping >/dev/null; do sleep 2; done && \
  PLAYWRIGHT_SKIP_SERVER=true pnpm exec playwright test --project=chromium
```

Staging 部署前检查：

```bash
bash scripts/ci/assert-no-test-mode-on-staging.sh
```

---

## 4. 验收

- 本地：`pnpm type-check` 通过；按上节命令起服并跑 qa-gate / E2E 可复现 CI 行为。
- CI：Push 后 qa-gate 与 e2e-tests 均应在「Test-mode sanity check」通过的前提下执行；若误关 test-mode，sanity 步骤会 404 并 fail。
- Staging：在 staging 环境不设置 test-mode 变量；部署前执行 `assert-no-test-mode-on-staging.sh` 可拦截误配。
