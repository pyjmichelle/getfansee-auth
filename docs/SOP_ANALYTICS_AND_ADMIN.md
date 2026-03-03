# GetFanSee 数据采集与后台管理 SOP

本文档为**标准操作手册（SOP）**，涵盖：自动采集配置、数据查看、埋点位置、埋点能力说明、Admin 后台入口与功能。

---

## 一、自动采集数据配置

### 1.1 前置条件

- 项目使用 **PostHog** 作为行为分析平台。
- 采集在**客户端**执行，需配置 `NEXT_PUBLIC_*` 环境变量。

### 1.2 配置步骤

**步骤 1：注册/登录 PostHog**

1. 打开 [PostHog 官网](https://posthog.com)，注册或登录。
2. 创建项目（或使用已有项目），进入 **Project Settings**。

**步骤 2：获取 Project API Key**

1. 在 PostHog 中：**Project** → **Settings** → **Project API Key**。
2. 复制形如 `phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 的 Key。

**步骤 3：配置本地/部署环境变量**

在项目根目录的 `.env.local`（本地）或 Vercel/部署平台的环境变量中增加：

```bash
# PostHog 行为分析（必填才会采集）
NEXT_PUBLIC_POSTHOG_KEY=phc_你的ProjectAPIKey
# 使用 PostHog 云时可不改；自托管时改为你的 PostHog 地址
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

**步骤 4：生效与校验**

- **本地**：保存后重启 dev server（`pnpm dev`），重新打开站点。
- **生产**：在 Vercel 等平台保存环境变量并重新部署。
- **校验**：打开站点并操作几步（如登录、浏览帖子），在 PostHog 的 **Activity** 或 **Events** 中应能看到事件。

### 1.3 不采集数据的情况（自动跳过）

以下情况**不会**向 PostHog 发送数据，也不会报错：

- 未配置 `NEXT_PUBLIC_POSTHOG_KEY` 或 Key 为空。
- `NEXT_PUBLIC_TEST_MODE=true`（测试模式）。
- `PLAYWRIGHT_TEST_MODE=true`（E2E 测试）。
- `NODE_ENV=test`。

---

## 二、如何查看数据

### 2.1 在 PostHog 控制台查看

1. **登录**  
   打开 [https://app.posthog.com](https://app.posthog.com) 并登录。

2. **选择项目**  
   左上角选择对应的 GetFanSee 项目。

3. **常用入口**

| 入口     | 路径                                        | 用途                                               |
| -------- | ------------------------------------------- | -------------------------------------------------- |
| 实时事件 | **Activity** 或 **Events**                  | 看最近上报的原始事件、属性、用户                   |
| 用户     | **People**                                  | 按用户看事件序列、属性（含 identify 后的 role 等） |
| 漏斗     | **Insights** → **New insight** → **Funnel** | 建转化漏斗（如：浏览→解锁→付费）                   |
| 留存     | **Insights** → **Retention**                | 看留存                                             |
| 趋势     | **Insights** → **Trends**                   | 按事件名/属性看趋势、分组                          |
| 会话录制 | **Session recording**                       | 回放用户操作（若开启录制）                         |

4. **常用事件名（本项目的核心事件）**

- `$pageview`：页面浏览（路由变化自动触发）。
- `user_registered` / `user_logged_in`：注册/登录。
- `content_viewed`：内容页浏览。
- `content_unlock_attempted` / `content_unlocked`：付费解锁漏斗。
- `subscription_started`：订阅成功。
- `wallet_topup_initiated` / `wallet_topup_completed`：充值。
- `content_liked` / `content_commented`：点赞、评论。
- `search_performed`：搜索。
- `creator_profile_viewed`：创作者主页浏览。
- `post_created` / `kyc_submitted`：发帖、KYC 提交。
- `admin_kyc_reviewed` / `admin_content_removed` / `admin_report_resolved`：管理员操作审计。

在 **Events** 或 **Insights** 中按上述事件名筛选即可查看。

### 2.2 导出与二次分析

- PostHog 支持 **Data pipeline**、**API**、**Warehouse** 等导出方式，可将事件同步到数仓或 BI，用于个性化推荐、趋势分析等（需在 PostHog 中另行配置）。

---

## 三、埋点位置一览

所有埋点均通过统一封装 `lib/analytics.ts` 的 `Analytics` 调用，底层由 PostHog 上报。

### 3.1 自动采集（无需业务代码）

| 触发时机 | 事件名      | 说明                                                                                                        |
| -------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| 路由变化 | `$pageview` | 由 `components/providers/posthog-provider.tsx` 在 pathname/searchParams 变化时自动发送，带 `$current_url`。 |

### 3.2 用户与认证

| 事件                           | 文件位置                      | 触发时机                                    |
| ------------------------------ | ----------------------------- | ------------------------------------------- |
| `identify` + `user_logged_in`  | `app/auth/AuthPageClient.tsx` | 邮箱登录成功                                |
| `identify` + `user_registered` | `app/auth/AuthPageClient.tsx` | 注册成功（含带 session 与自动登录两种路径） |

### 3.3 内容与付费

| 事件                       | 文件位置                       | 触发时机                                                          |
| -------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| `content_viewed`           | `app/posts/[id]/page.tsx`      | 帖子详情加载成功（带 post_id, creator_id, visibility, is_locked） |
| `paywall_shown`            | `components/paywall-modal.tsx` | Paywall 弹窗打开                                                  |
| `content_unlock_attempted` | `components/paywall-modal.tsx` | 点击解锁/订阅按钮                                                 |
| `content_unlocked`         | `components/paywall-modal.tsx` | PPV 或订阅支付成功                                                |
| `subscription_started`     | `components/paywall-modal.tsx` | 订阅成功                                                          |

### 3.4 钱包

| 事件                     | 文件位置                 | 触发时机                     |
| ------------------------ | ------------------------ | ---------------------------- |
| `wallet_topup_initiated` | `app/me/wallet/page.tsx` | 点击充值并选择金额后发起充值 |
| `wallet_topup_completed` | `app/me/wallet/page.tsx` | 充值接口返回成功             |

### 3.5 互动与发现

| 事件                     | 文件位置                               | 触发时机                               |
| ------------------------ | -------------------------------------- | -------------------------------------- |
| `content_liked`          | `components/post-like-button.tsx`      | 用户点击点赞（未点赞→点赞时）          |
| `content_commented`      | `components/comments/comment-form.tsx` | 评论提交成功                           |
| `search_performed`       | `app/search/SearchPageClient.tsx`      | 搜索请求成功（带 query、result_count） |
| `creator_profile_viewed` | `app/creator/[id]/page.tsx`            | 创作者主页加载成功                     |

### 3.6 创作者侧

| 事件            | 文件位置                          | 触发时机                                 |
| --------------- | --------------------------------- | ---------------------------------------- |
| `post_created`  | `app/creator/new-post/page.tsx`   | 帖子创建成功（带 visibility、has_media） |
| `kyc_submitted` | `app/creator/onboarding/page.tsx` | KYC 验证提交成功                         |

### 3.7 管理员审计（Admin）

| 事件                    | 文件位置                                   | 触发时机                                  |
| ----------------------- | ------------------------------------------ | ----------------------------------------- |
| `admin_kyc_reviewed`    | `app/admin/creator-verifications/page.tsx` | 管理员通过/拒绝 KYC                       |
| `admin_content_removed` | `app/admin/content-review/page.tsx`        | 管理员删除内容                            |
| `admin_report_resolved` | `app/admin/reports/page.tsx`               | 管理员处理举报（delete/ban/no_violation） |

---

## 四、当前埋点能做什么

### 4.1 可直接在 PostHog 做的分析

- **流量与路径**：各页面 PV（`$pageview`）、关键路径（如帖子详情→Paywall→解锁）。
- **转化漏斗**：注册/登录→浏览内容→解锁/订阅→充值；Paywall 展示→尝试解锁→解锁成功。
- **用户分层**：按 `identify` 的 role（若传入）、设备、来源等看行为差异。
- **内容与创作者**：哪些帖子/创作者被浏览、点赞、评论、解锁多；搜索词与结果数。
- **运营与安全**：管理员 KYC 审核、内容删除、举报处理的操作审计与频率。

### 4.2 为后续能力打基础的数据

- **个性化推荐**：`content_viewed` / `content_liked` / `content_unlocked` + `creator_id`、`post_id`、visibility，可导出后做协同或内容偏好模型。
- **趋势推荐**：`content_viewed`、`content_liked`、`search_performed` 等按时间聚合，可做热门内容/创作者/搜索词。
- **留存与生命周期**：`user_registered` / `user_logged_in` 配合 `$pageview`、付费事件，可做留存、LTV 分析。

### 4.3 尚未埋点但 API 已支持的事件

`lib/analytics.ts` 中已定义、业务尚未调用的方法（按需在对应页面调用即可）：

- `content_shared`、`feed_scrolled`、`tag_clicked`
- `creator_upgrade_started`、`creator_upgrade_completed`
- `subscription_cancelled`
- `user_logged_out`（需在登出逻辑处调用）
- `admin_user_banned`（若在 Admin 增加封禁操作时可调用）

---

## 五、Admin 后台入口与权限

### 5.1 如何进入 Admin 后台

1. **URL**  
   浏览器访问：`https://你的域名/admin`（本地为 `http://localhost:3000/admin`）。

2. **权限**
   - 必须**已登录**；未登录会跳转到 `/auth`。
   - 当前用户的 **profile.role 必须为 `admin`**；非 admin 会跳转到 `/home`。
   - 中间件会校验 `/admin/*` 路由，仅 role=admin 可访问。

3. **如何获得 admin 角色**  
   在 Supabase 的 `profiles` 表中，将对应用户的 `role` 字段改为 `admin`（当前无界面自助申请 admin）。

### 5.2 Admin 后台功能概览

侧边栏由 `components/admin/admin-sidebar.tsx` 渲染，包含以下入口：

| 菜单               | 路径                           | 功能说明                                                                                                                                                                                                           |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Dashboard**      | `/admin`                       | 首页：展示待处理 KYC 数量、待处理举报数量；快捷进入各子模块。                                                                                                                                                      |
| **KYC Reviews**    | `/admin/creator-verifications` | 创作者身份验证审核：列表待审核申请，支持通过/拒绝；拒绝可填原因。数据来自 API `GET/PATCH /api/admin/kyc`，服务端校验 admin。                                                                                       |
| **Content Review** | `/admin/content-review`        | 内容审核：展示近期帖子列表（来自 `/api/admin/posts`），可对单条内容执行软删除（设 deleted_at、removed_by_admin）。删除会触发 `admin_content_removed` 埋点。                                                        |
| **Reports**        | `/admin/reports`               | 举报处理：列表待处理举报，支持处理方式：删除内容（post）、封禁用户（user）、标记无违规（no_violation）。数据与操作通过 `GET/PATCH /api/admin/reports`，服务端校验 admin。处理会触发 `admin_report_resolved` 埋点。 |
| **Back to Site**   | 侧边栏底部                     | 链接回 `/home`。                                                                                                                                                                                                   |

### 5.3 Admin 相关 API（仅 admin 可调）

- `GET /api/admin/kyc`：获取待审核 KYC 列表。
- `PATCH /api/admin/kyc`：审核 KYC（body: `verificationId`, `approve`, `reason?`）。
- `GET /api/admin/reports`：获取待处理举报列表。
- `PATCH /api/admin/reports`：处理举报（body: `reportId`, `action`, `notes?`）。
- `GET /api/admin/posts?limit=50`：获取近期帖子（Content Review 用）。

以上接口均在服务端通过 `requireAdmin()` 校验，非 admin 返回 403。

---

## 六、快速检查清单

- [ ] `.env.local` 已配置 `NEXT_PUBLIC_POSTHOG_KEY`（及可选 `NEXT_PUBLIC_POSTHOG_HOST`）。
- [ ] 重启 dev / 重新部署后，在 PostHog 的 Activity/Events 能看到 `$pageview` 和业务事件。
- [ ] 需要看用户级行为时，确认登录/注册流程中有调用 `Analytics.identify`。
- [ ] Admin 仅 role=admin 可访问；新管理员需在 Supabase `profiles.role` 设为 `admin`。
- [ ] 埋点逻辑集中在 `lib/analytics.ts`，新增事件优先使用已有方法或在其中扩展后再在页面调用。

---

_文档版本：1.0 | 与当前代码状态一致（PostHog + 统一 Analytics + Admin 侧栏与 API 权限）_
