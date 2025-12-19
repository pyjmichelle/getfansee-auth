# Phase 1 交付清单

## ✅ 交付标准

- [x] Creator Profile + 发帖 + Feed 列表
- [x] 自动化测试脚本 `pnpm test:phase1` 全绿

---

## 📋 执行步骤

### 步骤 1: 执行 SQL 迁移（Supabase Dashboard）

**文件**: `migrations/007_phase1_posts.sql`

**操作步骤**：
1. 打开浏览器 → 访问 https://supabase.com/dashboard
2. 点击项目 → 选择你的项目
3. 点击左侧菜单 → 找到 "SQL Editor" 并点击
4. 点击 "New query" 按钮
5. 打开文件 → 在本地打开 `migrations/007_phase1_posts.sql`
6. 全选复制 → `Cmd+A` → `Cmd+C`（Mac）或 `Ctrl+A` → `Ctrl+C`（Windows）
7. 粘贴到编辑器 → `Cmd+V` 或 `Ctrl+V`
8. 点击 "Run" 按钮（右上角绿色按钮）
9. 等待执行完成 → 应该看到：
   - profiles 表字段列表（包含 bio, avatar_url）
   - posts 表状态：`✅ posts 表创建成功`
   - posts 表字段列表
   - RLS 策略列表

**✅ 完成标志**：看到所有字段列表和策略列表，没有红色错误

---

### 步骤 2: 配置环境变量（本地文件）

**必需的环境变量**：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_anon_key
SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key
```

**操作步骤**：
1. 打开终端 → 在项目目录下
2. 打开文件 → 运行 `open .env.local`（Mac）或 `notepad .env.local`（Windows）
3. 检查是否存在 → 查找上述三个环境变量
4. 如果不存在 → 在文件末尾添加
5. 保存文件 → `Cmd+S` 或 `Ctrl+S`

**⚠️ 重要**：在本地填写，不要粘贴到对话中

**✅ 完成标志**：文件包含所有三个环境变量

---

### 步骤 3: 运行测试验证（终端）

**操作步骤**：
1. 打开终端 → 确保在项目目录 `/Users/puyijun/Downloads/authentication-flow-design (1)`
2. 运行命令 → 输入 `pnpm test:phase1` 然后按 `Enter`
3. 等待执行 → 测试会自动运行（约 10-30 秒）
4. 查看结果 → 
   - ✅ **全绿**：看到 "🎉 所有测试通过！" → **Phase 1 完成**
   - ❌ **有失败**：查看错误信息，测试脚本会显示明确的修复建议

**✅ 完成标志**：终端显示 "🎉 所有测试通过！" 且 "失败: 0"

---

## 🌐 浏览器验证（测试通过后）

### 页面 1: `/home` - Feed 列表

**预期表现**：
- 显示所有 creator 发布的 posts
- 每条 post 卡片显示：
  - Creator 名（display_name）
  - Creator 头像（avatar_url，没有就显示首字母）
  - Post 内容（content）
  - Post 图片（media_url，如果有）
  - 发布时间（created_at）

**验证方法**：
1. 访问 `http://localhost:3000/home`
2. 应该看到 posts 列表（如果有 posts）
3. 如果没有 posts，显示 "No posts yet. Be the first to create one!"

---

### 页面 2: `/creator/[id]` - Creator 公开主页

**预期表现**：
- 显示 creator 的 profile：
  - 头像（avatar_url）
  - Display name（display_name）
  - Bio（bio，如果有）
- 下方显示该 creator 的所有 posts（按时间倒序）

**验证方法**：
1. 先创建一个 creator 并发布 post（见页面 3）
2. 访问 `http://localhost:3000/creator/[creator_id]`
3. 应该看到 creator profile 和 posts 列表

---

### 页面 3: `/creator/new-post` - 发帖页面

**预期表现**：
- 如果当前用户是 creator：
  - 显示表单：title（可选）、content（必填）、media_url（可选）、is_locked（开关）
  - 提交成功后跳转到 `/home`
- 如果当前用户不是 creator：
  - 显示 "Become a Creator" 提示
  - 提供返回首页按钮

**验证方法**：
1. 先成为 creator（在 `/home` 点击 "Become a Creator"）
2. 访问 `http://localhost:3000/creator/new-post`
3. 填写表单并提交
4. 应该跳转到 `/home` 并看到新发布的 post

---

## 🔍 如果测试失败

测试脚本会自动显示修复建议，例如：

- **"缺少字段: column X does not exist"** → 回到步骤 1，重新执行 SQL
- **"缺少环境变量"** → 回到步骤 2，检查 .env.local
- **"posts 表不存在"** → 执行 `migrations/007_phase1_posts.sql`
- **"创建 post 失败"** → 检查用户是否为 creator（需要先 setRoleCreator）

**只有测试全绿，才能进入下一步开发！**

---

## 📝 已知限制（Phase 1）

1. **is_locked 暂不生效**
   - Phase 1 所有 posts 都是公开的
   - Phase 2 将实现付费解锁逻辑

2. **没有支付功能**
   - Phase 1 只做发帖和展示
   - Phase 2 将接入支付

3. **没有点赞/收藏功能**
   - Phase 1 只做基础的发帖和展示
   - 未来可以添加互动功能

