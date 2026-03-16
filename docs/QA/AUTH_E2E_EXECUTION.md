# Auth E2E Execution Strategy

## 目标

在保证主 CI 稳定的前提下，逐步提高认证链路覆盖率。

## 测试分层

- `auth-mock`（阻断）
  - 命令：`pnpm test:auth:mock`
  - 特点：不依赖第三方 OAuth，不依赖真实邮箱发送
- `google-real`（手动/定时）
  - 命令：`pnpm test:auth:google:real`
  - 特点：真实 Google OAuth 回站验证
- `email-confirm`（手动/定时）
  - 命令：`pnpm test:auth:email:confirm`
  - 特点：Mailpit 抓信 + 验证链接 + `/auth/verify`
- `x/twitch-smoke`（非阻断手动）
  - 命令：`pnpm test:auth:xtwitch:smoke`
  - 特点：阶段 1 手动 smoke，产出证据

## 建议 CI 策略

- Push / PR 默认：
  - 执行 `pnpm test:auth:mock`
- Nightly / 手动触发：
  - 执行 `pnpm test:auth:google:real`
  - 执行 `pnpm test:auth:email:confirm`
- 发布前人工检查：
  - 执行 X/Twitch smoke，并归档 `artifacts/qa/auth-smoke`

## 环境要求

- 真实认证链路必须设置：
  - `AUTH_E2E_REAL_OAUTH=1`
  - `NEXT_PUBLIC_TEST_MODE=false`
  - `MAILPIT_BASE_URL`
  - `E2E_GOOGLE_EMAIL`
  - `E2E_GOOGLE_PASSWORD`

详见：`docs/deployment/AUTH_SANDBOX_SETUP.md`
