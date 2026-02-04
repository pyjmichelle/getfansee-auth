# GetFanSee 端到端测试文档

## Test-mode 环境变量（唯一来源）

CI 与本地跑 E2E / qa-gate 时，**必须**开启 test-mode，否则 `/api/test/*` 会返回 404。

| 环境变量                     | 用途                                    | CI/本地 E2E | Staging/生产 |
| ---------------------------- | --------------------------------------- | ----------- | ------------ |
| `PLAYWRIGHT_TEST_MODE=true`  | 服务端 `/api/test/*` **唯一**门控       | ✅ 必须     | ❌ 禁止      |
| `E2E=1`                      | 同上，与 PLAYWRIGHT_TEST_MODE 二选一    | ✅ 必须     | ❌ 禁止      |
| `NEXT_PUBLIC_TEST_MODE=true` | 仅前端 UI（如隐藏分析），**不**门控路由 | ✅ 可选     | ❌ 禁止      |

- **唯一来源**：CI 在 `qa-gate` 与 `e2e-tests` 的 job env 中设置 `PLAYWRIGHT_TEST_MODE=true` 与 `E2E=1`；本地复现时起服需带相同变量（见下方「本地复刻 CI」）。
- **Staging 安全**：staging 环境**禁止**设置上述任一变量。部署前可执行 `bash scripts/ci/assert-no-test-mode-on-staging.sh` 校验；若检测到 test-mode 已开启则 exit 1，防止 service_role + `/api/test/*` 暴露。

### `/api/test/*` 路由与 env 依赖

| 路由                               | 方法 | 依赖的 env（**仅** E2E/PLAYWRIGHT_TEST_MODE） | 说明                                                          |
| ---------------------------------- | ---- | --------------------------------------------- | ------------------------------------------------------------- |
| `/api/test/ping`                   | GET  | E2E=1 \| PLAYWRIGHT_TEST_MODE=true            | CI sanity check 用，返回 200 表示 test-mode 已开              |
| `/api/test/session`                | POST | 同上                                          | E2E 登录：服务端 signIn 并写 cookie                           |
| `/api/test/create-post-with-media` | POST | 同上                                          | 创建带媒体 Post，host 需 127.0.0.1 或 E2E_ALLOW_ANY_HOST=true |

CI 已统一设置 `PLAYWRIGHT_TEST_MODE` 与 `E2E`，上述路由在 CI 中均可访问（非 404）。

## 会话策略（Session）

- **QA Gate（gate-ui / gate-deadclick）**：使用 **文件会话**。步骤「Create test sessions」运行 `pnpm test:session:auto:all`，通过浏览器打开 `/auth` 登录并导出 storageState 到 `artifacts/agent-browser-full/sessions/fan.json` 与 `creator.json`。gate-ui / gate-deadclick 读取这些文件做已登录态检查。账号与下方「固定测试账号」一致。
- **E2E**：使用 **服务端会话**。测试中调用 `POST /api/test/session` 传入 `{ email, password }`，服务端用 `getSupabaseRouteHandlerClient()` 执行 `signInWithPassword` 并写 cookie，不再注入 cookie/localStorage。可用固定测试账号或 `getTestCredentials()` 等动态账号。
- **固定测试账号（与 create-test-users 一致）**：`test-fan@example.com` / `test-creator@example.com`，密码 `TestPassword123!`。CI 先执行「Create test users (if needed)」再「Create test sessions」，保证 QA gate 的 sessions 与 E2E 使用的账号一致。

## 测试结构

### 测试文件

1. **`fan-journey.spec.ts`** - Fan 端完整流程测试
   - 用户注册与登录
   - Feed 内容浏览
   - 订阅 Creator
   - 解锁 PPV 内容
   - 个人中心功能
   - 成为 Creator 流程

2. **`creator-journey.spec.ts`** - Creator 端完整流程测试
   - Creator Onboarding 完成
   - 创建内容（Post）
   - 编辑和删除 Post
   - 管理订阅者
   - 查看收益
   - Creator Analytics

3. **`complete-journey.spec.ts`** - 完整端到端测试
   - 从注册到订阅到解锁的完整用户旅程

4. **`edge-cases.spec.ts`** - 边界情况和错误处理测试
   - 认证相关边界情况
   - 支付相关边界情况
   - 内容相关边界情况
   - 数据一致性测试

5. **`shared/helpers.ts`** - 共享测试工具函数
   - 用户注册/登录辅助函数
   - 页面导航辅助函数
   - 元素等待和验证函数

### E2E 登录与 “Auth session missing” 说明

- **方案 A（当前）**：E2E 不再注入 cookie/localStorage。测试专用接口 `POST /api/test/session`（仅在 test-mode 开启时启用，见上文「Test-mode 环境变量」）接受 `{ email, password }`，由服务端用与线上相同的 `getSupabaseRouteHandlerClient()` 调用 `signInWithPassword` 并写 cookie，保证 cookie 名字/格式/chunking 与 auth-helpers 一致。Playwright 只负责 `page.request.post('/api/test/session', { data: { email, password } })` 后 `page.goto('/')`，由浏览器接收 Set-Cookie。
- 若仍出现 “Auth session missing”，可查看 E2E 日志中 `[E2E] missing sb cookie on <url>`，确认后续 `/api` 或 `/auth` 请求是否带上 `sb-` 前缀的 cookie。
- **ensureProfile: No user found 根因定位**：
  - 调用点：`lib/auth-server.ts` 的 `ensureProfile()`、`getCurrentUser()`；RSC/Server Action 通过 `getSupabaseServerClient()`（`lib/supabase-server.ts` 的 `createClient()`）读 cookie。
  - 写 cookie 点：`/api/test/session` 使用 `getSupabaseRouteHandlerClient()`（`lib/supabase-route.ts`），同一套 `cookies()` from next/headers，适配均为 getAll/setAll（chunked sb-\*.0/.1 一致）。
  - 若 cookie 存在仍 No user found：检查 RSC 请求是否与 route 同域/同 path，以及服务端是否读到 sb-\*。
  - E2E 下已加 debug：在 `lib/auth-server.ts` 的 `getCurrentUser()` 内，当 `E2E=1` 或 `PLAYWRIGHT_TEST_MODE=true` 且 user 为空时，打印 `[E2E auth] cookie names seen by server (getCurrentUser): ...`（仅 cookie 名，不打印 token 值，每个进程最多一次），用于确认 server 端是否读到 sb-\*。

## 运行测试

### 全量运行时长（避免“卡住”误判）

- **chromium 全量**：约 97 个用例，配置为 **2 workers**，通常 **15–25 分钟** 跑完；单 worker 约 25–40 分钟。
- 若整条命令被设了很短超时（如 10 分钟），进程会被提前杀掉、看起来像“卡住”；可交给 CI 跑完（e2e-tests job 约 35 分钟）。
- **先起服再跑**：若用 webServer 自动起服，首轮 build+start 会多花 1–3 分钟；可先 `pnpm build && pnpm start`，再 `PLAYWRIGHT_SKIP_SERVER=true pnpm exec playwright test --project=chromium` 避免重复起服。

### 本地必过命令（含端口/复用）

playwright.config 已设置 `reuseExistingServer: true`，若 3000 端口已有服务会直接复用，不会因“端口占用”导致未跑完。

```bash
pnpm exec playwright test --project=chromium
```

仅跑三个核心 spec（atomic-unlock / complete-journey / paywall-flow）：

```bash
pnpm exec playwright test --project=chromium tests/e2e/atomic-unlock.spec.ts tests/e2e/complete-journey.spec.ts tests/e2e/paywall-flow.spec.ts
```

确保 server 就绪后再跑（推荐，可复现）：

```bash
# 终端 1：起服（必须就绪后再在终端 2 跑测试）
pnpm build && pnpm start

# 终端 2：跑 chromium 或仅跑三个核心 spec
pnpm exec playwright test --project=chromium
# 或
pnpm exec playwright test --project=chromium tests/e2e/atomic-unlock.spec.ts tests/e2e/complete-journey.spec.ts tests/e2e/paywall-flow.spec.ts
```

CI 下若 create-post-with-media 因 host 校验失败，可设置 `E2E_ALLOW_ANY_HOST=true`（仅 CI 使用，生产不可达）。

若需先清 3000 端口再跑（可选）：

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; pnpm exec playwright test --project=chromium
```

### 运行所有测试

```bash
pnpm exec playwright test
```

### 运行特定测试文件

```bash
# Fan 端测试
pnpm exec playwright test fan-journey.spec.ts

# Creator 端测试
pnpm exec playwright test creator-journey.spec.ts

# 完整流程测试
pnpm exec playwright test complete-journey.spec.ts

# 边界情况测试
pnpm exec playwright test edge-cases.spec.ts
```

### 运行特定测试用例

```bash
# 运行特定测试
pnpm exec playwright test -g "邮箱注册新用户"
```

### 以 UI 模式运行（调试）

```bash
pnpm exec playwright test --headed
```

### 生成测试报告

```bash
pnpm exec playwright test --reporter=html
```

报告将生成在 `playwright-report/` 目录中。

## 测试环境要求

1. **开发服务器运行**: 确保 `pnpm run dev` 正在运行在 `http://localhost:3000`
2. **Supabase 配置**: 确保 `.env.local` 中配置了正确的 Supabase 凭据
3. **测试数据库**: 建议使用独立的测试数据库或确保测试数据清理

## 测试数据管理

- 测试使用时间戳和随机后缀生成唯一邮箱（`e2e-{prefix}-{timestamp}-{random}@example.com`）
- 测试密码统一为 `TestPassword123!`
- 每个测试前会自动清除 cookies 和 localStorage

## 注意事项

1. **文件上传测试**: 某些测试需要真实的测试文件，目前部分测试会跳过文件上传步骤
2. **KYC 验证**: KYC 验证需要上传证件照片，测试中可能会跳过此步骤
3. **支付流程**: 支付流程使用模拟数据，不会产生真实费用
4. **并发测试**: 某些测试可能需要在独立的环境中运行以避免数据冲突

## 测试覆盖范围

### ✅ 已实现

- [x] 用户注册与登录（邮箱）
- [x] Feed 内容浏览
- [x] 订阅 Creator 流程
- [x] PPV 解锁流程
- [x] 个人中心功能
- [x] Creator Onboarding
- [x] 创建 Post
- [x] 编辑和删除 Post
- [x] 订阅者管理
- [x] 收益查看
- [x] 边界情况测试

### ⏳ 待完善

- [ ] Google OAuth 登录测试
- [ ] 文件上传完整测试（需要测试文件）
- [ ] KYC 完整流程测试（需要文件上传）
- [ ] 钱包余额不足测试（需要设置测试数据）
- [ ] 地理屏蔽功能测试（需要模拟不同 IP）
- [ ] 性能测试
- [ ] 安全测试（RLS 策略验证）

## 调试技巧

1. **使用 `--headed` 模式**: 可以看到浏览器实际运行情况
2. **使用 `page.pause()`**: 在测试代码中添加 `await page.pause()` 可以暂停测试进行调试
3. **查看测试报告**: 运行 `pnpm exec playwright show-report` 查看详细的测试报告
4. **截图和视频**: 测试失败时会自动截图，可以在报告中查看

## 持续集成与本地复刻 CI

### 本地复刻 CI 的命令（起服 + qa-gate / E2E）

与 CI 一致地开启 test-mode 并跑 qa-gate 或 E2E：

```bash
# 1. 质量与构建
pnpm check-all
pnpm build

# 2. 起服（必须带 test-mode，与 CI 一致）
export PLAYWRIGHT_TEST_MODE=true E2E=1 NEXT_PUBLIC_TEST_MODE=true
PORT=3000 pnpm start &
# 等待就绪：curl -sf http://127.0.0.1:3000/api/health && curl -sf http://127.0.0.1:3000/api/test/ping

# 3a. 复刻 qa-gate（含 session 创建 + gate-ui + gate-deadclick）
pnpm test:session:auto:all   # 若需与 CI 一致的 session
pnpm qa:gate

# 3b. 复刻 E2E（另终端，服务器已起）
PLAYWRIGHT_SKIP_SERVER=true pnpm exec playwright test --project=chromium --reporter=html
```

单次一条龙（起服后在同一 shell 跑 E2E，不依赖 webServer）：

```bash
pnpm build && PORT=3000 pnpm start & \
  until curl -sf http://127.0.0.1:3000/api/test/ping >/dev/null; do sleep 2; done && \
  PLAYWRIGHT_SKIP_SERVER=true pnpm exec playwright test --project=chromium
```

### Staging 部署前检查

Staging 环境**禁止**开启 test-mode。部署流程或文档中应约定：staging 不设置 `NEXT_PUBLIC_TEST_MODE` / `PLAYWRIGHT_TEST_MODE` / `E2E`。可选在部署前执行：

```bash
bash scripts/ci/assert-no-test-mode-on-staging.sh
```

若任一 test-mode 变量被开启，脚本 exit 1 并拒绝部署。

### CI 中运行

CI 已在 `qa-gate` 与 `e2e-tests` 中设置 `PLAYWRIGHT_TEST_MODE`、`E2E`，并在起服后做 `/api/test/ping` sanity check（非 404 才继续）。确保 CI 环境配置了 Supabase 凭据与（若需要）`E2E_ALLOW_ANY_HOST=true`。
