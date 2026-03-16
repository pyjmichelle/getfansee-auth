# Auth Sandbox Setup

## 目标

为认证自动化提供隔离环境，覆盖以下链路：

- Google OAuth（全自动）
- 邮箱注册 + 邮箱验证（Mailpit 抓信）
- X/Twitch（阶段 1 手动 smoke）

## 1. 创建 Supabase Sandbox 项目

1. 在 Supabase 新建独立项目（不要复用生产项目）。
2. 记录以下信息：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 2. Auth URL 配置

在 Supabase Dashboard -> Authentication -> URL Configuration 中配置：

- `Site URL`:
  - `http://127.0.0.1:3000`
- `Redirect URLs`:
  - `http://127.0.0.1:3000/auth/verify`
  - 如有 staging 域名，可追加 `https://<your-staging-domain>/auth/verify`

## 3. Provider 配置

在 Authentication -> Providers 中启用：

- Google（用于全自动）
- X / Twitter OAuth 2.0（阶段 1 手动 smoke）
- Twitch（阶段 1 手动 smoke）
- Email（必须启用）

注意：

- 为避免风控，测试账号请使用专用账号，不使用个人主账号。
- 自动化阶段仅强制要求 Google 可用。

## 4. 邮箱验证与 SMTP（Mailpit）

在 Authentication -> Providers -> Email 中：

- 打开 `Confirm email`

在 Authentication -> SMTP Settings 中设置自定义 SMTP 指向 Mailpit：

- Host: `127.0.0.1`
- Port: `1025`
- Username/Password: 留空（默认本地无鉴权）
- Sender name: `GetFanSee Sandbox`
- Sender email: `no-reply@getfansee.local`

Mailpit UI 默认地址：

- `http://127.0.0.1:8025`

Mailpit API 默认地址：

- `http://127.0.0.1:8025/api/v1`

## 5. 本地环境变量

1. 复制模板：

```bash
cp env.auth.e2e.template .env.local
```

2. 填充 Sandbox 与 OAuth 测试账号变量。

## 6. 启动顺序（本地）

1. 启动 Mailpit（Docker 示例）：

```bash
docker run --rm -p 1025:1025 -p 8025:8025 axllent/mailpit
```

2. 启动应用（项目根目录）：

```bash
pnpm dev
```

3. 运行认证测试：

```bash
pnpm test:auth:google:real
pnpm test:auth:email:confirm
pnpm test:auth:xtwitch:smoke
```

## 7. 快速验收

- Google 登录后可回到 `/auth/verify` 并最终进入 `/home`
- 邮箱注册后可在 Mailpit 收到验证邮件，点击链接后进入 `/home`
- X/Twitch 可完成手动 smoke 并产出截图证据
