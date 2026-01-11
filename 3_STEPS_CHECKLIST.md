# ✅ 人工只需做 3 步

## 步骤 1: 执行 SQL 迁移（Supabase Dashboard）

### 操作步骤：
1. **打开浏览器** → 访问 https://supabase.com/dashboard
2. **点击项目** → 选择你的项目（ordomkygjpujxyivwviq）
3. **点击左侧菜单** → 找到 "SQL Editor" 并点击
4. **点击 "New query" 按钮**（或直接使用编辑器）
5. **打开文件** → 在本地打开 `migrations/004_fix_profiles_final.sql`
6. **全选复制** → `Cmd+A` → `Cmd+C`（Mac）或 `Ctrl+A` → `Ctrl+C`（Windows）
7. **粘贴到编辑器** → `Cmd+V` 或 `Ctrl+V`
8. **点击 "Run" 按钮**（右上角绿色按钮）
9. **等待执行完成** → 应该看到字段列表和策略列表，没有红色错误

**✅ 完成标志**：看到字段列表（id, email, display_name, role, age_verified, created_at, updated_at）和策略列表

---

## 步骤 2: 配置环境变量（本地文件）

### 操作步骤：
1. **打开终端** → 在项目目录下
2. **打开文件** → 运行 `open .env.local`（Mac）或 `notepad .env.local`（Windows）
3. **检查是否存在** → 查找 `SUPABASE_SERVICE_ROLE_KEY=`
4. **如果不存在** → 在文件末尾添加一行：
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZG9ta3lnanB1anh5aXZ3dmlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQ4ODQ2NywiZXhwIjoyMDgwMDY0NDY3fQ.aDk8dVJfxCxxoGjejRje7-O-keDq59Bvw9oL7IsPIH4
   ```
5. **保存文件** → `Cmd+S` 或 `Ctrl+S`

**⚠️ 重要**：在本地填写，不要粘贴到对话中

**✅ 完成标志**：文件包含 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY` 三行

---

## 步骤 3: 运行测试（终端）

### 操作步骤：
1. **打开终端** → 确保在项目目录 `/Users/puyijun/Downloads/authentication-flow-design (1)`
2. **运行命令** → 输入 `pnpm test:auth` 然后按 `Enter`
3. **等待执行** → 测试会自动运行（约 10-30 秒）
4. **查看结果** → 
   - ✅ **全绿**：看到 "🎉 所有测试通过！" → **可以进入下一步开发**
   - ❌ **有失败**：查看错误信息，测试脚本会显示明确的修复建议

**✅ 完成标志**：终端显示 "🎉 所有测试通过！" 且 "失败: 0"

---

## 🔍 如果测试失败

测试脚本会自动显示修复建议，例如：

- **"缺少字段: column X does not exist"** → 回到步骤 1，重新执行 SQL
- **"缺少环境变量：SUPABASE_SERVICE_ROLE_KEY"** → 回到步骤 2，检查 .env.local
- **"JWT role 不对"** → 检查 SERVICE_ROLE_KEY 是否正确（步骤 2）
- **"URL/anon key 不对"** → 检查 .env.local 是否被正确加载（步骤 2）

**只有测试全绿，才能进入 Step2/Step3 功能开发！**



