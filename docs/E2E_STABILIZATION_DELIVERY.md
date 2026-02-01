# E2E Stabilization 交付（CI/E2E Stabilization Captain）

## 目标

让 GitHub Actions 的 **e2e-tests** job 在 10 次连续运行中稳定全绿；从「环境一致性 + 可诊断性 + 测试数据隔离」三方面收敛，禁止仅改 timeout/selector/waitForTimeout。

---

## 1. 修改文件列表

### Workflow

| 文件                       | 变更                                                                                                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml` | e2e-tests：Upload e2e-server.log（if: always）；Sanity **仅** `curl -sf api/health` + `curl -sf api/test/ping`（200 表示 test-mode 开），**禁止** POST /api/test/session（避免 signIn 副作用/rate limit/污染） |

### Playwright 配置

| 文件                   | 变更                                                                                                                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playwright.config.ts` | defaultBaseUrl `http://127.0.0.1:3000`；CI `retries: 2`、`workers: 1`；webServer.command 改为 `bash -lc 'PORT=... E2E=1 pnpm start > .next/e2e-server.log 2>&1'`（**禁止** pipe+tee，以免影响 server ready 判断）；`use.contextOptions: { reducedMotion: "reduce" }` 落地，降低动画 flaky |

### API 路由（test-mode 门控）

| 文件                            | 变更                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `app/api/test/session/route.ts` | isTestEnv **仅** `E2E=1` 或 `PLAYWRIGHT_TEST_MODE=true`（移除 NEXT_PUBLIC_TEST_MODE/NODE_ENV） |
| `app/api/test/ping/route.ts`    | 同上                                                                                           |

### 测试 helpers / 共享

| 文件                           | 变更                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/shared/helpers.ts`  | BASE_URL 默认 `http://127.0.0.1:3000`；`emitE2EDiagnostics` **不 POST /api/test/session**（无副作用），仅输出 page.url、cookie 名、has sb-\*、/api/test/ping status、可选 last session status（从 injectSupabaseSession 内缓存）；injectSupabaseSession 写入 `lastSessionResponseStatus` 供诊断用；addCookieCheckListener console.log → console.warn |
| `tests/e2e/shared/fixtures.ts` | BASE_URL 默认 `http://127.0.0.1:3000`                                                                                                                                                                                                                                                                                                                |

### Spec 文件（BASE_URL + 失败诊断）

| 文件                                      | 变更                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `tests/e2e/atomic-unlock.spec.ts`         | BASE_URL 默认 127.0.0.1；import emitE2EDiagnostics；test.afterEach 失败时调用 emitE2EDiagnostics |
| `tests/e2e/complete-journey.spec.ts`      | 同上                                                                                             |
| `tests/e2e/paywall-flow.spec.ts`          | 同上                                                                                             |
| `tests/e2e/design-qa/screenshots.spec.ts` | BASE_URL 默认 127.0.0.1                                                                          |
| `tests/e2e/auth-page.spec.ts`             | BASE_URL 默认 127.0.0.1                                                                          |
| `tests/e2e/sprint4-mvp.spec.ts`           | BASE_URL 默认 127.0.0.1                                                                          |
| `tests/e2e/fan-journey.spec.ts`           | BASE_URL 默认 127.0.0.1                                                                          |
| `tests/e2e/edge-cases.spec.ts`            | BASE_URL 默认 127.0.0.1                                                                          |
| `tests/e2e/money-flow.spec.ts`            | BASE_URL 默认 127.0.0.1                                                                          |
| `tests/e2e/creator-journey.spec.ts`       | BASE_URL 默认 127.0.0.1                                                                          |
| `tests/e2e/stable-tests.spec.ts`          | BASE_URL 默认 127.0.0.1                                                                          |
| `tests/e2e/smoke.spec.ts`                 | BASE_URL 默认 127.0.0.1                                                                          |

### 服务端（缺 session 时诊断）

| 文件                 | 变更                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/auth-server.ts` | getCurrentUser 返回 null 且 isE2E 时，打印 cookie 名 + **请求 path**（x-invoke-path / x-nextjs-matched-path / referer pathname），限频（E2E_COOKIE_LOG_WINDOW_MS） |

### 文档

| 文件                  | 变更                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| `tests/e2e/README.md` | Test-mode 表与 `/api/test/*` 表更新为「仅 E2E/PLAYWRIGHT_TEST_MODE」 |

---

## 2. 本地复刻 CI 的命令（Sanity 仅 health + ping）

**Sanity 不调用 POST /api/test/session，仅 health + ping，避免 signIn 副作用与 rate limit。**

```bash
# 质量与构建
pnpm check-all
pnpm build

# 起服（与 CI 一致）
export PLAYWRIGHT_TEST_MODE=true E2E=1
export PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
PORT=3000 pnpm start &
# Sanity：仅 health + ping（不 POST session）
until curl -sf http://127.0.0.1:3000/api/health >/dev/null && \
      curl -sf http://127.0.0.1:3000/api/test/ping >/dev/null; do sleep 2; done

# 复刻 e2e-tests
PLAYWRIGHT_SKIP_SERVER=true pnpm exec playwright test --project=chromium --reporter=html
```

单条龙：

```bash
pnpm build && \
  (PORT=3000 PLAYWRIGHT_TEST_MODE=true E2E=1 pnpm start > .next/e2e-server.log 2>&1 &) && \
  until curl -sf http://127.0.0.1:3000/api/health >/dev/null && curl -sf http://127.0.0.1:3000/api/test/ping >/dev/null; do sleep 2; done && \
  PLAYWRIGHT_SKIP_SERVER=true PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test --project=chromium
```

---

## 3. CI 运行 Evidence 说明

### e2e-server.log（关键片段）

- **位置**：e2e-tests job 结束后在 Artifacts 中下载 **e2e-server-log**（即 `.next/e2e-server.log`）。
- **用途**：查看 Next 服务 stdout/stderr，排查起服失败、未监听 3000、test-mode 未生效等。
- **典型片段**：启动完成时有 `Ready on http://0.0.0.0:3000` 或类似；若有 404 可结合路由与 env 判断。

### playwright-report

- **位置**：Artifacts 中 **playwright-report**，解压后打开 `index.html`。
- **用途**：失败用例的截图、trace、以及控制台里由 `emitE2EDiagnostics` 输出的诊断（page.url、cookie 名、has sb-\*、/api/test/ping status、可选 last session cached）。

### 失败根因归类（A/B/C）

- **A 可诊断性**：失败时若能看到 `[E2E diagnostics]` 输出，则属「可诊断」；若缺少 e2e-server.log，则需确认「Upload e2e server log」步骤已执行。
- **B 环境一致性**：若 diagnostics 中 `/api/test/ping => 404` 或非 200，或 Sanity 步骤报 ping 非 200，则为 **B**（env 未设 E2E/PLAYWRIGHT_TEST_MODE 或 baseURL 不一致）。
- **C 测试脆弱性**：若 ping 200、cookie 正常仍失败，多为 **C**（选择器/动画/数据污染）；结合 retries=2、contextOptions.reducedMotion、唯一邮箱/postId 与 test API 使用情况排查。

---

## 4. Final Hardening：为何这 5 点影响 CI 稳定性且已消除

| 问题                                                | 对 CI 的影响                                                                                                                                                                                                                  | 已做修改                                                                                                                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1) webServer 使用 pipe + tee**                    | `pnpm start 2>&1 \| tee .next/e2e-server.log` 使子进程 stdout 经 pipe 再 tee，Playwright 依赖对 health URL 的轮询判断 server ready；pipe 缓冲/进程关系可能导致「进程已起但 health 尚未稳定」或误判，造成偶发超时/误判 ready。 | 改为 `bash -lc 'PORT=... E2E=1 pnpm start > .next/e2e-server.log 2>&1'`，stdout 直接重定向到文件，不经过 pipe/tee，不改变进程就绪语义，日志仍落盘。               |
| **2) Sanity 里 POST /api/test/session -d '{}'**     | 每次 CI 都对 session 发 POST（即使 body 空），部分实现可能触发校验/记录；若与 Supabase 有交互或计入 rate limit，会造成偶发限流、状态污染或误判。                                                                              | Sanity 仅 `curl -sf api/health` 与 `curl -sf api/test/ping`（200=test-mode 开），不调用 session，不产生任何 signIn 副作用。                                       |
| **3) emitE2EDiagnostics 里 POST /api/test/session** | 失败时诊断再发一次 POST /api/test/session，会产生多余请求、可能触发 rate limit 或污染会话状态，且与「诊断应无副作用」原则冲突，导致误判或二次失败。                                                                           | 诊断仅输出 page.url、cookie 名、has sb-\*、/api/test/ping status、以及 injectSupabaseSession 内缓存的 lastSessionResponseStatus，不再发起任何 POST session 请求。 |
| **4) getCurrentUser 缺 path 信息**                  | 服务端缺 session 时只打 cookie 名，无法区分是哪个请求 path 缺 session（RSC/API/页面），排查偶发「某 path 下 cookie 未带上」困难，导致误判为环境问题。                                                                         | getCurrentUser 在 (error \|\| !user) 且 isE2E 时打印 path（x-invoke-path / x-nextjs-matched-path / referer pathname），限频，便于定位是哪个 path 缺 session。     |
| **5) reducedMotion 未落地**                         | 动画/过渡导致元素可见性或点击时机不稳定，引发偶发失败（特别是 CI 负载高时），仅改 timeout 无法根治。                                                                                                                          | 在 playwright.config.ts 的 use 中通过 `contextOptions: { reducedMotion: "reduce" }` 落地，TS 通过；降低动画导致的 flaky，不依赖加长 timeout。                     |

---

## 5. 验收

- CI：e2e-tests 通过；Sanity 仅 health + ping 通过；Artifacts 含 e2e-server-log、playwright-report、playwright-traces。
- 本地：按「2. 本地复刻 CI 的命令」跑一遍，E2E 全绿；失败时控制台出现 `[E2E diagnostics]`（含 ping status 与 last session cached）。
- 门控：/api/test/\* 仅依赖 E2E 与 PLAYWRIGHT_TEST_MODE；staging 不设二者即无 test 路由暴露。
- 无副作用：Sanity 与 emitE2EDiagnostics 均不调用 POST /api/test/session；webServer 日志重定向不依赖 pipe+tee。
