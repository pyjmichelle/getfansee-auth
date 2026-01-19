# 🛡️ 分支保护规则配置指南

## 为什么需要分支保护?

分支保护可以:

- ✅ 防止直接推送到 main 分支
- ✅ 强制要求 PR 审查
- ✅ 确保 CI 检查通过才能合并
- ✅ 保持代码质量

---

## 🚀 快速配置 (推荐)

### Step 1: 访问分支保护设置

**直接点击**: https://github.com/pyjmichelle/getfansee-auth/settings/branches

### Step 2: 添加保护规则

1. 点击 **"Add branch protection rule"**

2. 在 **"Branch name pattern"** 输入: `main`

3. 勾选以下选项:

#### ✅ 必须勾选的选项

**Require a pull request before merging**

- ✅ 勾选此项
- 设置 **"Required approvals"**: `0` (如果是个人项目)
- 或设置为 `1` (如果是团队项目)

**Require status checks to pass before merging**

- ✅ 勾选此项
- ✅ 勾选 **"Require branches to be up to date before merging"**
- 在搜索框中添加必须通过的检查:
  - `Lint & Type Check`
  - `Build`
  - `Code Quality & Review`

**Require conversation resolution before merging**

- ✅ 勾选此项 (确保所有评论都已解决)

**Do not allow bypassing the above settings**

- ✅ 勾选此项 (即使是管理员也不能绕过)

#### 🔧 可选配置

**Require linear history**

- ✅ 勾选 (保持提交历史整洁)

**Require deployments to succeed before merging**

- 如果有部署流程,可以勾选

**Lock branch**

- ❌ 不勾选 (会完全锁定分支)

**Do not allow force pushes**

- ✅ 勾选 (防止强制推送覆盖历史)

**Allow deletions**

- ❌ 不勾选 (防止误删 main 分支)

4. 点击 **"Create"** 保存规则

---

## 📋 完整配置截图说明

### 配置 1: 基础保护

```
Branch name pattern: main

✅ Require a pull request before merging
   └─ Required approvals: 0 (个人) 或 1 (团队)
   └─ ✅ Dismiss stale pull request approvals when new commits are pushed
   └─ ❌ Require review from Code Owners (如果没有 CODEOWNERS 文件)

✅ Require status checks to pass before merging
   └─ ✅ Require branches to be up to date before merging
   └─ Status checks that are required:
      • Lint & Type Check
      • Build
      • Code Quality & Review

✅ Require conversation resolution before merging

✅ Do not allow bypassing the above settings
```

### 配置 2: 高级保护 (可选)

```
✅ Require linear history
✅ Do not allow force pushes
❌ Allow deletions
```

---

## 🎯 配置后的效果

### 1. 直接推送到 main 会被拒绝

```bash
$ git push origin main
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: error: Changes must be made through a pull request.
To github.com:pyjmichelle/getfansee-auth.git
 ! [remote rejected] main -> main (protected branch hook declined)
error: failed to push some refs to 'github.com:pyjmichelle/getfansee-auth.git'
```

**这是好事!** ✅ 强制你使用 PR 流程

### 2. PR 必须通过 CI 才能合并

在 PR 页面,你会看到:

```
❌ Merge blocked
   Some checks haven't completed yet

Required checks:
⏳ Lint & Type Check — In progress
⏳ Build — Queued
⏳ Code Quality & Review — Queued
```

**只有所有检查通过后**:

```
✅ All checks have passed
   3 successful checks

✅ Merge pull request
```

### 3. 必须解决所有评论

如果有未解决的评论:

```
❌ Merge blocked
   1 unresolved conversation

💬 Resolve conversation before merging
```

---

## 🔄 配置后的工作流程

### 正常流程

```bash
# 1. 创建功能分支
git checkout -b feature/new-feature

# 2. 开发并提交
git add .
git commit -m "feat: 添加新功能"

# 3. 推送到功能分支 (不是 main!)
git push origin feature/new-feature

# 4. 在 GitHub 创建 PR
# 5. 等待 CI 通过
# 6. 合并 PR (通过 GitHub 界面)
```

### 如果尝试直接推送到 main

```bash
$ git push origin main
# ❌ 被拒绝!

# ✅ 正确做法:
git checkout -b feature/my-changes
git push origin feature/my-changes
# 然后创建 PR
```

---

## 🆘 紧急情况处理

### 场景 1: 需要紧急修复 main 分支

**不要禁用保护规则!**

正确做法:

```bash
# 1. 创建紧急修复分支
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# 2. 修复问题
# ... 修改代码 ...

# 3. 快速检查
pnpm check-all

# 4. 提交并推送
git add .
git commit -m "fix: 紧急修复 xxx 问题"
git push origin hotfix/critical-bug

# 5. 创建 PR 并标记为紧急
# 标题: [HOTFIX] 紧急修复 xxx 问题

# 6. 等待 CI 通过后立即合并
```

### 场景 2: CI 检查卡住了

```bash
# 1. 在 GitHub Actions 页面取消卡住的工作流
# 2. 在 PR 页面点击 "Re-run jobs"
# 3. 如果持续失败,检查 CI 配置
```

---

## 📊 验证配置

### 检查保护规则是否生效

1. 访问: https://github.com/pyjmichelle/getfansee-auth/settings/branches

2. 应该看到:

```
Branch protection rules

main
  • Require a pull request before merging
  • Require status checks to pass before merging
  • Require conversation resolution before merging
  • Do not allow bypassing the above settings
```

### 测试保护规则

```bash
# 尝试直接推送到 main (应该失败)
git checkout main
echo "test" >> test.txt
git add test.txt
git commit -m "test"
git push origin main
# ❌ 应该被拒绝

# 清理测试
git reset --hard HEAD~1
```

---

## 🎓 团队协作配置

如果是团队项目,额外配置:

### 1. 添加 CODEOWNERS 文件

创建 `.github/CODEOWNERS`:

```
# 全局代码所有者
* @pyjmichelle

# 特定目录的所有者
/app/api/ @backend-team
/components/ @frontend-team
/lib/auth*.ts @security-team
```

### 2. 要求代码审查

在分支保护规则中:

- 设置 **"Required approvals"**: `1` 或 `2`
- ✅ 勾选 **"Require review from Code Owners"**

### 3. 限制推送权限

在仓库设置中:

- **Settings** → **Collaborators and teams**
- 设置团队成员权限:
  - Write (可以推送到功能分支)
  - Maintain (可以管理 PR)
  - Admin (可以修改设置)

---

## ✅ 配置检查清单

完成以下所有步骤:

- [ ] 访问分支保护设置页面
- [ ] 为 main 分支添加保护规则
- [ ] 勾选 "Require a pull request before merging"
- [ ] 勾选 "Require status checks to pass before merging"
- [ ] 添加必须通过的 CI 检查
- [ ] 勾选 "Require conversation resolution before merging"
- [ ] 勾选 "Do not allow bypassing the above settings"
- [ ] 勾选 "Do not allow force pushes"
- [ ] 保存规则
- [ ] 测试验证 (尝试直接推送到 main)

---

## 📚 相关文档

- **开发工作流**: `DEVELOPMENT_WORKFLOW.md`
- **CI 工作流**: `.github/workflows/WORKFLOW_GUIDE.md`
- **提交检查清单**: `.github/PRE_COMMIT_CHECKLIST.md`

---

**配置分支保护后,你的代码库将更加安全和规范!** 🛡️
