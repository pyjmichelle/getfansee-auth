# Phase 2: 付费墙最小闭环 - 验收清单

## 📋 前置条件

### 1. 执行 SQL 迁移

在 Supabase Dashboard 执行 `migrations/008_phase2_paywall.sql`：

1. 登录 https://supabase.com/dashboard
2. 选择你的项目
3. 进入 **SQL Editor**
4. 复制 `migrations/008_phase2_paywall.sql` 的全部内容
5. 粘贴并点击 **Run**
6. 确认看到：
   - ✅ `subscriptions` 表存在
   - ✅ `post_unlocks` 表存在
   - ✅ `posts.is_locked` 字段存在
   - ✅ RLS policies 已创建

### 2. 环境变量配置

确保 `.env.local` 包含：

```bash
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Anon Key
SUPABASE_SERVICE_ROLE_KEY=你的 Service Role Key（测试脚本需要）
```

---

## ✅ 自动化测试验证

运行测试脚本：

```bash
cd "/Users/puyijun/Downloads/authentication-flow-design (1)"
pnpm test:paywall
```

**预期结果**：
- ✅ 全部测试通过（失败: 0）
- ✅ 输出 "通过：全部测试通过"
- ✅ exit code = 0

**测试覆盖**：
1. ✅ 初始 fan 无订阅，locked 不可见
2. ✅ subscribe30d 后 locked 可见
3. ✅ cancel 后再次不可见
4. ✅ unlockPost 后（即使未订阅）该 post 可见

---

## 🌐 浏览器手动验证

### 1. Feed 页面 (`/home`)

**场景 A: Free Post**
- ✅ 创建一条 `is_locked=false` 的 post
- ✅ 在 `/home` feed 中直接显示完整内容（无遮罩）

**场景 B: Locked Post（未订阅）**
- ✅ 创建一条 `is_locked=true` 的 post
- ✅ 在 `/home` feed 中显示：
  - 内容区域：显示 "This content is locked" + Lock 图标
  - 图片区域：显示遮罩 + "Subscribe to unlock" 按钮
- ✅ 点击 "Subscribe to unlock" 按钮
- ✅ 订阅成功后，locked 内容变为可见

**场景 C: Locked Post（已订阅）**
- ✅ 订阅 Creator 后
- ✅ 在 `/home` feed 中直接显示 locked 内容（无遮罩）

### 2. Creator Profile 页面 (`/creator/[id]`)

**场景 A: 未订阅**
- ✅ 访问 Creator profile 页面
- ✅ 显示 "Subscribe" 按钮
- ✅ 点击 "Subscribe" 按钮
- ✅ 订阅成功后：
  - 按钮变为 "Cancel Subscription"
  - locked posts 变为可见

**场景 B: 已订阅**
- ✅ 访问已订阅的 Creator profile 页面
- ✅ 显示 "Cancel Subscription" 按钮
- ✅ 点击 "Cancel Subscription" 按钮
- ✅ 取消订阅后：
  - 按钮变为 "Subscribe"
  - locked posts 再次不可见

**场景 C: Creator 本人**
- ✅ Creator 访问自己的 profile 页面
- ✅ 不显示 Subscribe 按钮（本人无需订阅）
- ✅ 所有 posts（包括 locked）都可见

---

## 📁 新增/修改文件清单

### 数据库迁移
- ✅ `migrations/008_phase2_paywall.sql` - 新建 subscriptions/post_unlocks 表 + RLS

### 后端函数
- ✅ `lib/paywall.ts` - 更新/新增：
  - `subscribe30d(creatorId)`
  - `cancelSubscription(creatorId)`
  - `hasActiveSubscription(creatorId)`
  - `unlockPost(postId)`
  - `canViewPost(postId, creatorId?)`
  - `getMyPaywallState(userId)` (保留用于批量检查)

### UI 页面
- ✅ `app/home/page.tsx` - 更新：
  - 导入 paywall 函数
  - 显示 locked posts 遮罩
  - "Subscribe to unlock" 按钮
  - 根据订阅状态显示/隐藏内容

- ✅ `app/creator/[id]/page.tsx` - 更新：
  - 导入 paywall 函数
  - 显示 "Subscribe" / "Cancel Subscription" 按钮
  - 根据订阅状态显示/隐藏 locked posts

### 测试脚本
- ✅ `scripts/test-paywall.js` - 更新：
  - 匹配新的表结构（subscriber_id, creator_id, starts_at, ends_at）
  - 4 条核心断言测试

---

## 🔍 已知限制（Phase 2 范围外）

- ❌ 不包含 Stripe 支付集成（mock 订阅）
- ❌ 不包含订阅价格/套餐选择
- ❌ 不包含订阅历史记录页面
- ❌ 不包含 PPV（Pay Per View）支付流程（仅 unlockPost 功能）
- ❌ 不包含订阅到期自动续费逻辑

---

## 🚀 下一步（Phase 3 可选）

- 集成 Stripe 支付
- 订阅价格管理
- 订阅历史记录
- PPV 支付流程
- 订阅到期提醒

---

## ✅ 交付标准确认

- ✅ `pnpm test:paywall` 全绿（失败: 0）
- ✅ 浏览器手动验证通过（Feed + Creator Profile）
- ✅ 所有 locked posts 正确显示遮罩
- ✅ Subscribe 按钮功能正常
- ✅ Cancel Subscription 功能正常
- ✅ 订阅状态持久化（刷新页面保持）

---

**完成时间**: 请填写完成日期  
**测试人员**: 请填写测试人员姓名  
**备注**: 如有问题请在此记录



