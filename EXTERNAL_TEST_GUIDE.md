# 外部测试指南

## 测试链接

**生产环境（Vercel）**：
- 主页：`https://getfansee-auth.vercel.app`
- 登录/注册：`https://getfansee-auth.vercel.app/auth`
- 测试入口（如果启用了测试模式）：`https://getfansee-auth.vercel.app/test`

---

## 注册和登录

### 方式一：自行注册（推荐）

1. 访问：`https://getfansee-auth.vercel.app/auth`
2. 切换到 "Sign up" 标签
3. 输入邮箱和密码（密码至少 8 位）
4. ✅ 勾选 "I confirm that I am 18+..."
5. 点击 "Sign up with email"

**注意**：
- 如果 Supabase 配置了邮箱验证，注册后会收到验证邮件
- 点击邮件中的链接完成验证，然后可以登录
- 如果 Supabase 未启用邮箱验证，注册后立即可以登录

### 方式二：使用预创建测试账号（推荐用于快速测试）

如果自行注册遇到邮箱验证问题，或需要快速开始测试，可以使用以下预创建测试账号：

**测试账号 1（Fan 用户）**：
- 📧 邮箱：`test-fan@getfansee.test`
- 🔑 密码：`TestFan123!`
- 👤 角色：Fan（普通用户）

**测试账号 2（Creator 用户）**：
- 📧 邮箱：`test-creator@getfansee.test`
- 🔑 密码：`TestCreator123!`
- 👨‍🎨 角色：Creator（内容创作者）

**使用说明**：
1. 访问 https://getfansee-auth.vercel.app/auth
2. 切换到 "Log in" 标签
3. 输入上述邮箱和密码
4. 点击 "Continue" 登录

**注意**：如果这些测试账号不存在，请运行 `pnpm tsx scripts/create-test-users.ts` 创建它们。

---

## 可测试功能清单

### ✅ 1. 用户认证
- [x] 注册新账号
- [x] 登录/登出
- [x] 邮箱验证（如果启用）
- [x] Google OAuth 登录（如果配置）
- [x] Magic Link 登录

### ✅ 2. 用户资料管理
- [x] 查看个人资料 (`/me`)
- [x] 成为 Creator（从 Fan 转换为 Creator）
- [x] 更新 Creator 资料（display_name, bio, avatar）

### ✅ 3. Creator 内容发布
- [x] 创建新帖子 (`/creator/new-post`)
- [x] 设置帖子可见性（免费/订阅者/PPV）
- [x] 设置 PPV 价格
- [x] 上传图片/视频（如果已实现）
- [x] 启用/禁用水印（图片）
- [x] 删除自己的帖子

### ✅ 4. Fan 浏览和订阅
- [x] 浏览 Creators 列表 (`/home`)
- [x] 查看 Creator 个人资料 (`/creator/[id]`)
- [x] 查看 Creator 的帖子列表
- [x] 订阅 Creator（30 天订阅）
- [x] 取消订阅
- [x] 查看订阅列表 (`/subscriptions`)

### ✅ 5. 内容解锁（Paywall）
- [x] 免费内容：直接可见
- [x] 订阅者专属内容：订阅后可见
- [x] PPV 内容：需要单独购买解锁
- [x] 查看购买记录 (`/purchases`)

### ✅ 6. 权限验证
- [x] 未登录用户自动重定向到 `/auth`
- [x] 未订阅用户看不到订阅者专属内容
- [x] 未购买用户看不到 PPV 内容
- [x] Creator 可以查看自己的所有内容
- [x] 订阅/购买后内容立即可见

---

## 完整测试流程

### 流程 1：Fan 用户体验

1. **注册/登录**
   - 访问 `/auth`
   - 注册新账号或使用测试账号登录

2. **浏览 Creators**
   - 访问 `/home`
   - 查看 Creators 列表
   - 点击 Creator 卡片进入个人资料

3. **订阅 Creator**
   - 在 Creator 个人资料页面
   - 点击 "Subscribe" 按钮
   - 订阅者专属内容应该立即解锁

4. **解锁 PPV 内容**
   - 找到价格 > 0 的帖子
   - 点击 "Unlock for $X.XX" 按钮
   - PPV 内容应该立即解锁

5. **查看订阅和购买记录**
   - 访问 `/subscriptions` 查看订阅列表
   - 访问 `/purchases` 查看购买记录

### 流程 2：Creator 用户体验

1. **成为 Creator**
   - 登录后访问 `/me`
   - 点击 "Become a Creator" 按钮
   - 填写 Creator 资料（display_name, bio）

2. **发布内容**
   - 访问 `/creator/new-post`
   - 填写内容
   - 选择可见性（免费/订阅者/PPV）
   - 如果是 PPV，设置价格
   - 发布帖子

3. **查看自己的内容**
   - 访问 `/creator/[自己的id]`
   - 查看已发布的帖子
   - 确认所有内容都可见（Creator 权限）

---

## 已知限制（MVP）

- ❌ 真实支付网关（使用模拟支付）
- ❌ 视频预览（前 10 秒）
- ❌ 内容举报功能
- ❌ 推荐引擎
- ❌ 聊天功能
- ❌ 分析仪表板
- ❌ 提现功能

---

## 问题反馈

如果遇到问题，请提供：
1. 操作步骤
2. 预期结果
3. 实际结果
4. 浏览器控制台错误（F12 → Console）
5. 截图（如适用）

---

## 技术信息

- **框架**：Next.js 16 (App Router)
- **后端**：Supabase (Auth + Database + Storage)
- **部署**：Vercel
- **数据库**：PostgreSQL (Supabase)
