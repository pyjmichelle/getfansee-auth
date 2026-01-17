# 测试账号和链接

## 🌐 测试链接

**生产环境（Vercel）**：

```
https://getfansee-auth.vercel.app/auth
```

## 🔑 测试账号

### 方式 1：使用预创建测试账号

**Fan 测试账号**：

- 邮箱：`test-fan@example.com`
- 密码：`TestPassword123!`

**Creator 测试账号**：

- 邮箱：`test-creator@example.com`
- 密码：`TestPassword123!`

**创建测试账号**（如果账号不存在）：

```bash
pnpm create-test-users
```

### 方式 2：自行注册

1. 访问：`https://getfansee-auth.vercel.app/auth`
2. 切换到 "Sign up"
3. 输入邮箱和密码（≥8字符）
4. 勾选 18+ 确认
5. 点击注册

**注意**：

- 如果 Supabase 配置为需要邮箱验证，需要点击邮件中的验证链接
- 如果不需要验证，注册后立即可以登录

## ✅ 可测试功能

### 1. 用户认证

- ✅ 注册新账号
- ✅ 登录
- ✅ 邮箱验证（如果启用）
- ✅ Google OAuth（如果配置）

### 2. 浏览和订阅

- ✅ 访问 `/home` 查看 Creators 列表
- ✅ 点击 Creator 查看详情
- ✅ 订阅 Creator（解锁 subscriber-only 内容）
- ✅ 查看 `/subscriptions` 订阅列表

### 3. PPV 解锁

- ✅ 解锁 PPV 内容（按次付费）
- ✅ 查看 `/purchases` 购买记录
- ⚠️ **重要**：订阅不会自动解锁 PPV，需要单独购买

### 4. Creator 功能

- ✅ 访问 `/me` 转换为 Creator
- ✅ 填写 Creator 资料（`/creator/onboarding`）
- ✅ 创建帖子（`/creator/new-post`）
  - 免费帖子
  - 订阅者专享（price_cents=0）
  - PPV 帖子（price_cents > 0）

### 5. 数据持久化

- ✅ 刷新页面保持登录状态
- ✅ 订阅/购买状态持久化
- ✅ 多账号数据隔离

## 📋 快速测试流程

1. **登录** → 使用测试账号或注册新账号
2. **浏览** → 访问 `/home` 查看 Creators
3. **订阅** → 在 Creator 页面点击 "Subscribe"
4. **解锁 PPV** → 点击 "Unlock for $X.XX"
5. **查看记录** → 访问 `/subscriptions` 和 `/purchases`
6. **成为 Creator** → 访问 `/me` → "Become a Creator" → 创建内容

## ⚠️ 已知限制（MVP）

- ❌ 没有真实支付（所有支付都是模拟的）
- ❌ 没有 KYC/提现功能
- ❌ 没有内容审核
- ❌ 没有推荐引擎
- ❌ 没有聊天功能
