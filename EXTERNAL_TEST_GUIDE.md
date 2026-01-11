# 外部测试指南

## 测试链接

**生产环境（Vercel）**：

- 主链接：`https://getfansee-auth.vercel.app/auth`
- 测试入口（如果启用了测试模式）：`https://getfansee-auth.vercel.app/test`

## 注册和登录

### 方式 1：自行注册（推荐）

1. 访问：`https://getfansee-auth.vercel.app/auth`
2. 切换到 "Sign up" 标签
3. 输入邮箱地址（任何有效邮箱）
4. 输入密码（至少 8 个字符）
5. ✅ 勾选 "I confirm that I am at least 18 years old..."
6. 点击 "Sign up with email"

**注意**：

- 如果 Supabase 配置为**需要邮箱验证**：注册后会收到验证邮件，需要点击邮件中的链接完成验证
- 如果 Supabase 配置为**不需要邮箱验证**：注册后立即可以登录并跳转到 `/home`

### 方式 2：使用测试账号

如果自行注册需要邮箱验证，或需要快速开始测试，可以使用以下测试账号：

**测试账号 1（Fan 用户）**：

- 邮箱：`test-fan@example.com`
- 密码：`TestPassword123!`
- 用途：测试订阅、PPV 解锁等 Fan 功能

**测试账号 2（Creator 用户）**：

- 邮箱：`test-creator@example.com`
- 密码：`TestPassword123!`
- 用途：测试创建内容、管理帖子等 Creator 功能

**创建测试账号**：
如果这些账号不存在，可以运行以下命令创建：

```bash
pnpm tsx scripts/create-test-users.ts
```

**注意**：这些测试账号的邮箱已自动确认，可以直接登录，无需邮箱验证。

## 可测试功能清单

### ✅ 1. 用户认证

- [ ] 注册新账号
- [ ] 登录现有账号
- [ ] 邮箱验证（如果启用）
- [ ] 忘记密码（Magic Link）
- [ ] Google OAuth 登录（如果配置）

### ✅ 2. 浏览 Creators

- [ ] 访问 `/home` 查看 Creators 列表
- [ ] 点击 Creator 卡片查看详情
- [ ] 查看 Creator 的个人资料（display_name, bio, avatar）

### ✅ 3. 订阅功能

- [ ] 在 Creator 页面点击 "Subscribe" 按钮
- [ ] 订阅后，subscriber-only 内容（price_cents=0）应该可见
- [ ] 访问 `/subscriptions` 查看订阅列表
- [ ] 取消订阅功能

### ✅ 4. PPV（按次付费）解锁

- [ ] 在 Creator 页面找到 PPV 内容（price_cents > 0）
- [ ] 点击 "Unlock for $X.XX" 按钮
- [ ] 解锁后，PPV 内容应该可见
- [ ] 访问 `/purchases` 查看购买记录
- [ ] **重要**：订阅不会自动解锁 PPV，需要单独购买

### ✅ 5. Creator 功能

- [ ] 访问 `/me` 页面
- [ ] 点击 "Become a Creator" 转换为 Creator
- [ ] 访问 `/creator/onboarding` 填写 Creator 资料
- [ ] 访问 `/creator/new-post` 创建新帖子
- [ ] 创建不同类型的帖子：
  - Free（免费）
  - Subscribers-only（订阅者专享，price_cents=0）
  - PPV（按次付费，price_cents > 0）
- [ ] 查看自己创建的帖子

### ✅ 6. 数据持久化验证

- [ ] 登录后刷新页面，保持登录状态
- [ ] 订阅后刷新页面，订阅状态保持
- [ ] 解锁 PPV 后刷新页面，解锁状态保持
- [ ] 切换账号后，订阅/购买状态正确隔离

## 测试流程建议

### 完整测试流程（作为 Fan）

1. **注册/登录**
   - 使用新邮箱注册，或使用测试账号登录

2. **浏览 Creators**
   - 访问 `/home`
   - 如果没有 Creators，先创建一个 Creator 账号并发布内容

3. **订阅 Creator**
   - 访问某个 Creator 的页面
   - 点击 "Subscribe" 按钮
   - 验证 subscriber-only 内容变为可见

4. **解锁 PPV**
   - 找到 PPV 内容（价格 > 0）
   - 点击 "Unlock for $X.XX"
   - 验证 PPV 内容变为可见
   - **注意**：即使已订阅，PPV 仍需要单独解锁

5. **查看记录**
   - 访问 `/subscriptions` 查看订阅
   - 访问 `/purchases` 查看购买记录

### 完整测试流程（作为 Creator）

1. **转换为 Creator**
   - 登录后访问 `/me`
   - 点击 "Become a Creator"
   - 填写 Creator 资料（`/creator/onboarding`）

2. **创建内容**
   - 访问 `/creator/new-post`
   - 创建不同类型的帖子：
     - 免费帖子
     - 订阅者专享帖子
     - PPV 帖子（设置价格）

3. **验证内容可见性**
   - 使用另一个账号（Fan）登录
   - 验证免费内容可见
   - 验证订阅者专享内容需要订阅
   - 验证 PPV 内容需要单独购买

## 已知限制（MVP）

- ❌ 没有真实的支付网关（所有支付都是模拟的）
- ❌ 没有 KYC（身份验证）
- ❌ 没有提现功能
- ❌ 没有内容审核
- ❌ 没有推荐引擎
- ❌ 没有聊天功能
- ❌ 没有分析仪表板

## 问题反馈

如果遇到问题，请提供：

1. 操作步骤
2. 预期结果
3. 实际结果
4. 浏览器控制台错误（F12 → Console）
5. 截图（如果可能）

## 技术信息

- **框架**：Next.js 16 (App Router)
- **后端**：Supabase (Auth + Database + Storage)
- **部署**：Vercel
- **数据库**：PostgreSQL (Supabase)
