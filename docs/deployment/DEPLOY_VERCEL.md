# 方案一：Vercel 部署 + getfansee.com 自定义域名

本指南带你完成：**从 GitHub 导入项目到 Vercel → 配置环境变量 → 绑定 getfansee.com → 配置 DNS**。  
完成后，每次推送到 GitHub 会自动触发 Vercel 部署。

---

## 前置条件

- 项目已推送到 **GitHub**（你已有）
- 拥有 **Vercel** 账号（可用 GitHub 登录）
- 拥有 **getfansee.com** 的 DNS 管理权限（在域名服务商处）

---

## 第一步：在 Vercel 导入 GitHub 项目

1. 打开 [https://vercel.com](https://vercel.com) 并登录（建议用 **Continue with GitHub**）。
2. 点击 **Add New…** → **Project**。
3. 在 **Import Git Repository** 里找到你的仓库（例如 `authentication-flow-design` 或你的实际仓库名），点击 **Import**。
4. **Configure Project** 页面一般无需改：
   - **Framework Preset**: Next.js（自动识别）
   - **Build Command**: `pnpm build`（与 `vercel.json` 一致）
   - **Output Directory**: 留空（Next.js 默认）
   - **Install Command**: `pnpm install`
5. **先不要点 Deploy**，下一步先配环境变量。

---

## 第二步：配置环境变量

在 **Configure Project** 页面找到 **Environment Variables**，添加以下变量。

### 必需（不填构建会报错）

| 变量名                          | 说明                      | 示例/来源                           |
| ------------------------------- | ------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 项目 URL         | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 key（公开） | 同上                                |

### 强烈建议（生产功能需要）

| 变量名                      | 说明                                                                    |
| --------------------------- | ----------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端用 Supabase 高权限 key（仅服务端，勿泄露）                        |
| `NEXT_PUBLIC_BASE_URL`      | 站点根 URL，用于链接生成。绑定域名后填：`https://getfansee.com`         |
| `NEXT_PUBLIC_APP_URL`       | 同站或子域名时可与 `NEXT_PUBLIC_BASE_URL` 一致：`https://getfansee.com` |

### 可选（按需添加）

| 变量名                                                                        | 说明                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `CRON_SECRET`                                                                 | 保护 `/api/cron/financial-audit`，建议生成：`openssl rand -hex 32` |
| `NEXT_PUBLIC_POSTHOG_KEY`                                                     | PostHog 分析                                                       |
| `NEXT_PUBLIC_SENTRY_DSN`、`SENTRY_AUTH_TOKEN`、`SENTRY_ORG`、`SENTRY_PROJECT` | Sentry 错误监控                                                    |
| `DIDIT_WEBHOOK_SECRET`                                                        | Didit KYC Webhook 验证                                             |
| `ALERT_SLACK_WEBHOOK`                                                         | 金融审计告警 Slack                                                 |

- 每个变量可勾选 **Production / Preview / Development**，生产环境至少勾选 **Production**。
- 若本地已有 `.env.local`，可直接从里面复制同名变量到 Vercel。

---

## 第三步：首次部署

1. 点击 **Deploy**。
2. 等待构建结束（约 2–5 分钟）。若失败，在 Vercel 的 **Build Logs** 里查看报错（多为缺少上述必需环境变量）。
3. 部署成功后，会得到一个地址，例如：`https://你的项目名.vercel.app`。先在该地址验证页面、登录等是否正常。

---

## 第四步：绑定自定义域名 getfansee.com

1. 在 Vercel 项目里进入 **Settings** → **Domains**。
2. 在 **Add** 输入：
   - `getfansee.com`
   - `www.getfansee.com`
3. 添加后，Vercel 会提示需要配置 DNS（见下一步）。

---

## 第五步：在域名服务商配置 DNS

到购买 **getfansee.com** 的平台（如 Cloudflare、阿里云、GoDaddy、Namecheap 等）的 **DNS 管理** 里添加记录。

### 方式 A：根域名 getfansee.com + www（推荐）

- **根域名** `getfansee.com`：
  - 类型 **A**，主机记录 `@`，值 **`76.76.21.21`**
  - 或按 Vercel 当前文档：类型 **A**，值 **`76.76.21.21`**（部分面板写「目标」或「指向」）
- **www** `www.getfansee.com`：
  - 类型 **CNAME**，主机记录 `www`，值 **`cname.vercel-dns.com`**

### 方式 B：仅子域名（例如 app.getfansee.com）

若你希望主站仍用当前服务器，只把 Next 应用放在子域名：

- 在 Vercel Domains 里只添加 **`app.getfansee.com`**（或你想要的子域名）。
- DNS 添加一条 **CNAME**：主机 `app`，值 `cname.vercel-dns.com`。

保存 DNS 后，生效可能需要几分钟到几十分钟。

---

## 第六步：再次确认环境变量里的站点 URL

若你在第二步时还没绑定域名，这里补上：

1. 项目 **Settings** → **Environment Variables**。
2. 编辑或新增：
   - `NEXT_PUBLIC_BASE_URL` = `https://getfansee.com`（或你的子域名，如 `https://app.getfansee.com`）
   - `NEXT_PUBLIC_APP_URL` = 同上
3. 修改后需 **Redeploy** 一次：**Deployments** → 最新一次部署右侧 **⋯** → **Redeploy**。

---

## 第七步：验证

- 浏览器访问 **https://getfansee.com**（或你绑定的子域名）。
- 检查：首页、登录/注册、跳转链接是否为 `https://getfansee.com/...`。
- 若启用了定时任务，在 Vercel 项目 **Settings** → **Crons** 中确认 `/api/cron/financial-audit` 已配置（本项目已在 `vercel.json` 中声明）。

---

## 之后：自动部署

- 以后在本地执行 **git push** 到 GitHub 对应分支（一般为 `main` 或你在 Vercel 里选的 **Production Branch**），Vercel 会自动重新构建并部署。
- 可在 Vercel 项目的 **Deployments** 里查看每次部署状态和日志。

---

## 常见问题

| 现象                                             | 处理                                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 构建失败：`NEXT_PUBLIC_SUPABASE_URL is required` | 在 Vercel 环境变量中补全上述两个必需变量，并 Redeploy。                                                                             |
| 访问 getfansee.com 打不开                        | 检查 DNS 是否生效（可用 `dig getfansee.com` 或在线 DNS 查询），确认 A/CNAME 与上面一致。                                            |
| 登录或接口报错                                   | 检查 `NEXT_PUBLIC_BASE_URL` / `NEXT_PUBLIC_APP_URL` 是否为 `https://getfansee.com`，且 Supabase 里该域名已加入允许的 Redirect URL。 |
| Cron 不执行                                      | 在 Vercel 中设置 `CRON_SECRET`，且 `/api/cron/financial-audit` 内校验该 secret（本项目已按此设计）。                                |

---

**相关文件**：项目根目录 `vercel.json`（构建命令、区域、Cron 路径）；环境变量定义见 `lib/env.ts` 与 `.env.example`。
