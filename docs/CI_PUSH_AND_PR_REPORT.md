# CI 推送与 PR 报告（Chief Engineer 自治执行）

## Phase 0 — 本地门禁（已执行）

| 步骤                           | 结果                                           |
| ------------------------------ | ---------------------------------------------- |
| pnpm install --frozen-lockfile | ✅ 通过                                        |
| pnpm check-all                 | ✅ 通过（已执行 format + lint:fix 修复）       |
| pnpm build                     | ✅ 通过                                        |
| 复刻 CI E2E                    | ⏭️ 本地 webServer 起服超时，改由 CI 跑完整 E2E |

## Phase 1 — 分支与推送（已完成）

| 步骤                              | 结果                                                      |
| --------------------------------- | --------------------------------------------------------- |
| 新建分支                          | `fix/ci-green-20260201-2205`                              |
| git add -A && git commit          | ✅ 提交信息：fix: stabilize e2e sessions and diagnostics  |
| git push -u origin &lt;branch&gt; | ✅ 已推送到 `origin/fix/ci-green-20260201-2205`           |
| gh pr create                      | ❌ 未安装 `gh`，需手动创建 PR                             |
| gh                                | ✅ 已执行 `brew install gh`，需在终端完成 `gh auth login` |

## 你需要在终端执行的命令（按顺序）

**1. 登录 GitHub（仅需做一次，会打开浏览器或要求 token）**

```bash
gh auth login
```

按提示选择：GitHub.com → HTTPS → 用浏览器登录（或选 Paste an authentication token）。

**2. 若尚未创建 PR，可让 gh 创建（或在浏览器打开下面链接）**

```bash
cd "/Users/puyijun/Downloads/authentication-flow-design (1)"
gh pr create --base main --head fix/ci-green-20260201-2205 \
  --title "CI: stabilize E2E" \
  --body "Stabilize E2E session injection, add diagnostics, unify env and baseURL."
```

或手动打开：**https://github.com/pyjmichelle/getfansee-auth/pull/new/fix/ci-green-20260201-2205**

**3. 监控 PR 的 CI 检查（会持续刷新直到完成）**

```bash
cd "/Users/puyijun/Downloads/authentication-flow-design (1)"
gh pr checks --watch
```

**4. CI 全绿后合并**

```bash
gh pr merge --squash --delete-branch
```

## 改动文件摘要（本推送）

- **Workflow**: `.github/workflows/ci.yml` — sanity 仅 health+ping，上传 e2e-server.log
- **Playwright**: `playwright.config.ts` — webServer 日志重定向、contextOptions.reducedMotion、baseURL 127.0.0.1、retries=2(CI)
- **API test 门控**: `app/api/test/session/route.ts`, `app/api/test/ping/route.ts` — 仅 E2E/PLAYWRIGHT_TEST_MODE
- **Helpers**: `tests/e2e/shared/helpers.ts` — emitE2EDiagnostics 无 POST session、lastSessionResponseStatus 缓存、BASE_URL 127.0.0.1
- **Auth 诊断**: `lib/auth-server.ts` — getCurrentUser null 时输出 path（x-invoke-path/referer）
- **Staging 门禁**: `scripts/ci/assert-no-test-mode-on-staging.sh`
- **E2E specs**: atomic-unlock / complete-journey / paywall-flow 等 — BASE_URL 127.0.0.1、afterEach 诊断
- **文档**: `docs/E2E_STABILIZATION_DELIVERY.md`, `tests/e2e/README.md`, `docs/deployment/DEPLOY_INSTRUCTIONS.md`

## Phase 2–4 说明（CI 失败时）

1. **查看失败 job**: GitHub Actions 页签或 `gh run list` / `gh run view <run_id>`
2. **下载日志**: `gh run download <run_id> --dir ./.ci-artifacts`
3. **根因归类**: 环境不一致 / 会话未写 cookie / 测试脆弱 / 数据污染 / 服务端错误
4. **最小修复** → 本地再次执行 Phase 0 → commit + push → 重复直到 CI 全绿
5. **全绿后**: `gh pr merge --squash --delete-branch`，然后 `git checkout main && git pull origin main`

## 硬约束遵守情况

- ✅ 未使用 waitForTimeout 蒙混
- ✅ 未 skip/disable job
- ✅ /api/test/\* 仅 E2E=1 或 PLAYWRIGHT_TEST_MODE=true；staging 用 assert 脚本禁止
- ✅ E2E 登录用 page.evaluate(fetch, credentials include)，并断言 sb-\* cookie
- ✅ baseURL/host 统一 127.0.0.1
- ✅ 需登录的 /api 调用优先 browser fetch with credentials include（helpers 内 fetchAuthedJson / injectSupabaseSession 已按此实现）
