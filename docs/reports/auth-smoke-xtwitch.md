# X/Twitch 手动 Smoke 记录模板

## 执行目标

- 阶段 1：在不阻断主 CI 的前提下，验证 X/Twitch OAuth 回站链路可用性。
- 产出可追踪证据（截图 + JSON 结果）。

## 执行命令

```bash
# X/Twitter
OAUTH_PROVIDER=twitter pnpm test:auth:xtwitch:smoke

# Twitch
OAUTH_PROVIDER=twitch pnpm test:auth:xtwitch:smoke
```

## 证据目录

- `artifacts/qa/auth-smoke/x-twitter/`
- `artifacts/qa/auth-smoke/twitch/`

每个目录包含：

- `01-auth-page-before-provider.png`
- `02-provider-page-opened.png`
- `03-after-manual-login.png`
- `smoke-result.json`

## 结果记录

| Provider  | 日期 | 执行人 | finalUrl | 结果 | 备注 |
| --------- | ---- | ------ | -------- | ---- | ---- |
| X/Twitter |      |        |          |      |      |
| Twitch    |      |        |          |      |      |

## 判定标准

- 通过：最终 URL 包含 `/auth/verify` 或 `/home`
- 失败：无法回站、停留在 provider 错误页、或回站后落入异常页
