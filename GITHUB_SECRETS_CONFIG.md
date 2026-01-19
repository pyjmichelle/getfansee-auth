# 🔐 GitHub Secrets 快速配置

## 📋 你的 Supabase 配置信息

以下是从你的 `.env.local` 文件中提取的配置:

### 1. NEXT_PUBLIC_SUPABASE_URL

```
https://ordomkygjpujxyivwviq.supabase.co
```

### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZG9ta3lnanB1anh5aXZ3dmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0ODg0NjcsImV4cCI6MjA4MDA2NDQ2N30.iEWC-l8_s4Vx3wk5Eycp_u1OI36FNvSTKDTL37ReNxo
```

### 3. SUPABASE_SERVICE_ROLE_KEY

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZG9ta3lnanB1anh5aXZ3dmlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQ4ODQ2NywiZXhwIjoyMDgwMDY0NDY3fQ.aDk8dVJfxCxxoGjejRje7-O-keDq59Bvw9oL7IsPIH4
```

---

## 🚀 快速配置步骤 (2 分钟)

### Step 1: 打开 GitHub Secrets 页面

点击以下链接直接访问:

**👉 https://github.com/pyjmichelle/getfansee-auth/settings/secrets/actions**

### Step 2: 添加 3 个 Secrets

#### Secret 1: NEXT_PUBLIC_SUPABASE_URL

1. 点击 **"New repository secret"**
2. Name: `NEXT_PUBLIC_SUPABASE_URL`
3. Value: 复制粘贴以下内容
   ```
   https://ordomkygjpujxyivwviq.supabase.co
   ```
4. 点击 **"Add secret"**

---

#### Secret 2: NEXT_PUBLIC_SUPABASE_ANON_KEY

1. 点击 **"New repository secret"**
2. Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Value: 复制粘贴以下内容
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZG9ta3lnanB1anh5aXZ3dmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0ODg0NjcsImV4cCI6MjA4MDA2NDQ2N30.iEWC-l8_s4Vx3wk5Eycp_u1OI36FNvSTKDTL37ReNxo
   ```
4. 点击 **"Add secret"**

---

#### Secret 3: SUPABASE_SERVICE_ROLE_KEY

1. 点击 **"New repository secret"**
2. Name: `SUPABASE_SERVICE_ROLE_KEY`
3. Value: 复制粘贴以下内容
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZG9ta3lnanB1anh5aXZ3dmlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQ4ODQ2NywiZXhwIjoyMDgwMDY0NDY3fQ.aDk8dVJfxCxxoGjejRje7-O-keDq59Bvw9oL7IsPIH4
   ```
4. 点击 **"Add secret"**

---

### Step 3: 配置工作流权限

1. 访问: **https://github.com/pyjmichelle/getfansee-auth/settings/actions**

2. 滚动到 **"Workflow permissions"** 部分

3. 选择:
   - ✅ **Read and write permissions**

4. 勾选:
   - ✅ **Allow GitHub Actions to create and approve pull requests**

5. 点击 **"Save"**

---

## ✅ 验证配置

### 检查 Secrets 是否添加成功

访问: https://github.com/pyjmichelle/getfansee-auth/settings/secrets/actions

你应该看到 3 个 Secrets:

```
✅ NEXT_PUBLIC_SUPABASE_URL
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
✅ SUPABASE_SERVICE_ROLE_KEY
```

### 检查 CI 是否运行成功

1. 访问: https://github.com/pyjmichelle/getfansee-auth/actions

2. 查看最新的 workflow 运行

3. 应该看到:
   - ✅ `ci.yml` - 主 CI 流水线
   - ✅ `code-quality.yml` - 代码质量检查
   - ✅ `pr-auto-review.yml` - PR 自动审查

---

## 🎉 配置完成!

现在你的 CI/CD 系统已经完全配置好了!

### 测试 CI 系统

创建一个测试 PR:

```bash
# 1. 创建新分支
git checkout -b test/ci-system

# 2. 做一个小改动
echo "# CI Test" >> TEST_CI.md

# 3. 提交并推送
git add TEST_CI.md
git commit -m "test: 验证 CI 系统"
git push origin test/ci-system

# 4. 在 GitHub 创建 PR
```

你会看到:

- 🏷️ 自动添加标签 (size/type/area)
- 💬 Reviewdog 自动评论 (如果有问题)
- 📊 完整的质量报告
- 🔒 安全扫描结果

---

## 📚 相关文档

- **完整配置指南**: `SETUP_COMPLETE.md`
- **CI 审查系统**: `CI_REVIEW_SETUP.md`
- **部署指南**: `DEPLOYMENT_GUIDE.md`
- **提交前检查**: `.github/PRE_COMMIT_CHECKLIST.md`

---

## 🔒 安全提醒

⚠️ **重要**:

- 这些密钥信息只在 GitHub 中可见,不要分享给其他人
- `SUPABASE_SERVICE_ROLE_KEY` 拥有最高权限,请妥善保管
- 如果怀疑密钥泄露,立即在 Supabase Dashboard 中重置

---

**配置完成后,你的项目将拥有企业级的 CI/CD 质量保障!** 🚀
