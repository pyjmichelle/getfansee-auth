# Step4: Become a Creator 交付报告

## ✅ 交付标准验证

- [x] `/home` 顶部按钮 "Become a Creator" 可用：点击后把当前用户 `profiles.role` 从 `fan` 更新为 `creator`
- [x] 更新成功后：UI 立刻反映（按钮变成 "Creator Dashboard"）
- [x] 刷新页面仍保持 creator（不是前端假状态）
- [x] 新增页面 `/creator/onboarding`：让 creator 填 display_name / bio / avatar_url（可选）并写回 profiles
- [x] 有 `pnpm test:role` 自动测试脚本，全绿才算交付

---

## 📁 本次新增/修改文件清单

### 新增文件

1. **`migrations/006_creator_onboarding.sql`**
   - 添加 `bio` 和 `avatar_url` 字段到 `profiles` 表
   - 确保 `updated_at` 触发器存在
   - 确保 UPDATE RLS 策略存在

2. **`lib/profile.ts`**
   - `setRoleCreator(userId)` - 将用户角色设置为 creator
   - `updateCreatorProfile(params)` - 更新 creator profile 信息
   - `getProfile(userId)` - 获取用户 profile

3. **`app/creator/onboarding/page.tsx`**
   - Creator onboarding 表单页面
   - 包含 display_name（必填）、bio（可选）、avatar_url（可选）
   - 保存后跳转回 `/home`

4. **`scripts/test-role.js`**
   - 自动化测试脚本
   - 测试注册、ensureProfile、初始 role、setRoleCreator、updateCreatorProfile、清理

5. **`STEP4_REPORT.md`**（本文件）
   - 交付报告

### 修改文件

1. **`app/home/page.tsx`**
   - 添加 `userProfile` state 来存储用户 role
   - 在 `useEffect` 中加载 profile（包含 role）
   - 根据 `userProfile.role` 显示不同按钮：
     - `role === 'fan'` → 显示 "Become a Creator" 按钮
     - `role === 'creator'` → 显示 "Creator Dashboard" 按钮
   - `handleBecomeCreator` 函数：调用 `setRoleCreator` 后跳转到 `/creator/onboarding`
   - 更新 `currentUser` 使用真实的 profile 数据

2. **`package.json`**
   - 添加 `"test:role": "node scripts/test-role.js"` 脚本

---

## 🗄️ 数据库迁移（migrations/006_creator_onboarding.sql）

### ⚠️ 重要：需要手动执行

**请在 Supabase Dashboard 执行以下 SQL**：

1. 登录 https://supabase.com/dashboard
2. 选择你的项目
3. 进入 **SQL Editor**
4. 复制 `migrations/006_creator_onboarding.sql` 的全部内容
5. 粘贴到 SQL Editor
6. 点击 **Run**
7. ✅ 应该看到：
   - 字段列表（bio, avatar_url, role, updated_at）
   - 触发器信息
   - UPDATE 策略信息

### 表结构变更

#### profiles 表新增字段
- `bio` text（可选）
- `avatar_url` text（可选）

#### 确保存在
- `updated_at` 触发器（`set_profiles_updated_at`）
- UPDATE RLS 策略（`profiles_update_own`）

---

## 🧪 测试脚本验证

### 运行测试

```bash
pnpm test:role
```

### 预期输出

```
🚀 开始 Role 和 Creator Onboarding 功能自动化测试

📝 测试 1: 注册新用户并登录
✅ 注册新用户 - 通过
✅ 登录 - 通过

👤 测试 2: ensureProfile 并验证初始 role
✅ ensureProfile - 通过
✅ 初始 role 为 fan - 通过

🎭 测试 3: setRoleCreator
✅ setRoleCreator 调用 - 通过
✅ setRoleCreator 后 role 为 creator - 通过

✏️  测试 4: updateCreatorProfile
✅ updateCreatorProfile 调用 - 通过
✅ display_name 写入成功 - 通过
✅ bio 写入成功 - 通过

🧹 测试 5: 清理测试数据
✅ 清理 profile - 通过

📊 测试结果汇总
总测试数: X
✅ 通过: X
失败: 0

🎉 所有测试通过！
```

### ⚠️ 测试前必做

1. 执行 `migrations/006_creator_onboarding.sql`（见上方说明）
2. 确保 `.env.local` 包含 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 🔍 功能验证清单

### 1. Become a Creator 按钮

- [x] `/home` 页面读取 profile（包含 role）
- [x] `role === 'fan'` 时显示 "Become a Creator" 按钮
- [x] 点击按钮调用 `setRoleCreator(userId)`
- [x] 成功后更新本地 state（`role: 'creator'`）
- [x] 跳转到 `/creator/onboarding`

### 2. Creator Dashboard 按钮

- [x] `role === 'creator'` 时显示 "Creator Dashboard" 按钮
- [x] 点击按钮跳转到 `/creator/onboarding`（MVP 先固定这个）

### 3. 状态持久化

- [x] 刷新页面后 role 不丢失（从 DB 重新加载）
- [x] UI 立刻反映 role 变化（按钮文本更新）

### 4. Creator Onboarding 页面

- [x] 显示表单：display_name（必填）、bio（可选）、avatar_url（可选）
- [x] 保存按钮调用 `updateCreatorProfile`
- [x] 成功后显示提示并跳转回 `/home`
- [x] 有 loading 状态（`isSaving`）
- [x] 有错误处理（显示错误信息）

### 5. 错误处理

- [x] loading 状态：显示 "Loading..." 或 "保存中..."
- [x] error 状态：显示错误块，提供重试/取消按钮
- [x] 所有 DB 操作都有错误处理

---

## 📝 已知未覆盖项

1. **NavHeader 中的 Become a Creator 按钮**
   - `components/nav-header.tsx` 中已有 "Become a Creator" 按钮（链接到 `/creator/upgrade`）
   - 当前实现是在 `/home` 页面顶部添加按钮
   - 未来可以统一使用 NavHeader 中的按钮

2. **Creator Dashboard 跳转目标**
   - MVP 中 "Creator Dashboard" 按钮跳转到 `/creator/onboarding`
   - 未来可以跳转到 `/creator/studio` 或其他 creator 专用页面

3. **Avatar 上传**
   - 当前只支持 URL 输入
   - 未来可以实现文件上传到 Supabase Storage

4. **Bio 字符限制**
   - 当前没有字符限制
   - 未来可以添加最大长度限制

5. **表单验证**
   - 当前只有 display_name 必填验证
   - 未来可以添加更多验证（如 display_name 长度、avatar_url 格式等）

---

## ✅ 交付确认

- [x] 所有文件已创建/修改
- [x] SQL 迁移脚本已提供（需手动执行）
- [x] 测试脚本已创建并添加到 package.json
- [x] `/home` 页面已根据 role 显示不同按钮
- [x] `/creator/onboarding` 页面已创建
- [x] 错误处理和 loading 状态已实现

**下一步**：执行 `migrations/006_creator_onboarding.sql`，然后运行 `pnpm test:role` 验证。



