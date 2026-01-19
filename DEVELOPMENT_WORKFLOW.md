# 🚀 开发工作流程指南

## 📋 标准开发流程 (必须遵守)

### 1️⃣ 创建功能分支

**永远不要直接在 main 分支开发!**

```bash
# 1. 确保 main 分支是最新的
git checkout main
git pull origin main

# 2. 创建新的功能分支
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/bug-description
```

**分支命名规范**:

- `feature/xxx` - 新功能
- `fix/xxx` - Bug 修复
- `refactor/xxx` - 代码重构
- `docs/xxx` - 文档更新
- `test/xxx` - 测试相关

---

### 2️⃣ 开发代码

```bash
# 开发你的功能
# ... 编写代码 ...

# 随时提交 (可以多次提交)
git add .
git commit -m "feat: 添加 xxx 功能"
```

---

### 3️⃣ 推送前本地检查 (必须!)

```bash
# 运行完整检查
pnpm check-all
```

**如果检查失败,修复问题**:

```bash
# 自动修复 lint 问题
pnpm lint:fix

# 自动格式化代码
pnpm format

# 再次检查
pnpm check-all
```

**必须看到所有检查通过** ✅:

- ✅ TypeScript 类型检查
- ✅ ESLint 代码规范
- ✅ Prettier 格式检查
- ✅ 构建成功

---

### 4️⃣ 推送到远程分支

```bash
# 推送到远程 (会自动触发 pre-push hook)
git push origin feature/your-feature-name
```

**Pre-push hook 会自动运行 `pnpm check-all`**

如果失败,推送会被阻止 ⛔

---

### 5️⃣ 创建 Pull Request

1. 访问: https://github.com/pyjmichelle/getfansee-auth/pulls

2. 点击 **"New pull request"**

3. 选择:
   - base: `main`
   - compare: `feature/your-feature-name`

4. 填写 PR 信息:

   ```markdown
   ## 📝 变更说明

   简要描述你的改动

   ## ✅ 测试

   - [ ] 本地测试通过
   - [ ] pnpm check-all 通过

   ## 📸 截图 (如果有 UI 变更)
   ```

5. 点击 **"Create pull request"**

---

### 6️⃣ 等待 CI 检查

创建 PR 后,会自动运行:

- ✅ `ci.yml` - 主 CI 流水线
- ✅ `code-quality.yml` - 代码质量检查
- ✅ `pr-auto-review.yml` - PR 自动审查

**你会看到**:

- 🏷️ 自动添加标签 (size/type/area)
- 💬 Reviewdog 自动评论代码问题 (如果有)
- 📊 完整的质量报告
- 🔒 安全扫描结果

**等待所有检查通过** (约 5-10 分钟)

---

### 7️⃣ 解决 CI 反馈 (如果有问题)

如果 CI 失败或 Reviewdog 评论了问题:

```bash
# 1. 在本地修复问题
# ... 修改代码 ...

# 2. 再次检查
pnpm check-all

# 3. 提交修复
git add .
git commit -m "fix: 修复 CI 问题"

# 4. 推送更新
git push origin feature/your-feature-name
```

**PR 会自动更新,CI 会重新运行**

---

### 8️⃣ 合并 PR

**确保所有检查通过后**:

1. 点击 **"Merge pull request"**
2. 选择合并方式:
   - **Squash and merge** (推荐) - 合并为单个提交
   - **Merge commit** - 保留所有提交历史
3. 点击 **"Confirm merge"**

---

### 9️⃣ 清理本地分支

```bash
# 切回 main 分支
git checkout main

# 拉取最新代码
git pull origin main

# 删除本地功能分支
git branch -d feature/your-feature-name

# 删除远程分支 (可选,GitHub 会自动删除)
git push origin --delete feature/your-feature-name
```

---

## 🚫 禁止的操作

### ❌ 不要直接推送到 main

```bash
# ❌ 错误做法
git checkout main
git add .
git commit -m "changes"
git push origin main  # 这会触发多次 CI 运行!
```

### ✅ 正确做法

```bash
# ✅ 正确做法
git checkout -b feature/my-feature
git add .
git commit -m "feat: 添加功能"
git push origin feature/my-feature
# 然后在 GitHub 创建 PR
```

---

## 📊 完整示例

### 场景: 添加一个新功能

```bash
# 1. 创建分支
git checkout main
git pull origin main
git checkout -b feature/add-search-filter

# 2. 开发功能
# ... 编写代码 ...

# 3. 本地检查
pnpm check-all
# ✅ 所有检查通过

# 4. 提交代码
git add .
git commit -m "feat: 添加搜索过滤功能"

# 5. 推送到远程
git push origin feature/add-search-filter

# 6. 在 GitHub 创建 PR
# 访问: https://github.com/pyjmichelle/getfansee-auth/pulls
# 点击 "New pull request"
# 填写 PR 信息并创建

# 7. 等待 CI 通过 (约 5-10 分钟)
# 查看: https://github.com/pyjmichelle/getfansee-auth/actions

# 8. 所有检查通过后,合并 PR

# 9. 清理
git checkout main
git pull origin main
git branch -d feature/add-search-filter
```

---

## 🔧 常用命令速查

### 查看当前分支

```bash
git branch
```

### 查看远程分支

```bash
git branch -r
```

### 切换分支

```bash
git checkout branch-name
```

### 查看状态

```bash
git status
```

### 查看提交历史

```bash
git log --oneline -10
```

### 撤销本地修改

```bash
# 撤销所有未提交的修改
git reset --hard

# 撤销特定文件的修改
git checkout -- file.ts
```

### 修改最后一次提交

```bash
# 修改提交信息
git commit --amend -m "new message"

# 添加遗漏的文件到最后一次提交
git add forgotten-file.ts
git commit --amend --no-edit
```

---

## 🎯 最佳实践

### 1. 小而频繁的提交

```bash
# ✅ 好的做法
git commit -m "feat: 添加用户搜索 API"
git commit -m "feat: 添加搜索 UI 组件"
git commit -m "test: 添加搜索功能测试"

# ❌ 不好的做法
git commit -m "完成所有功能"  # 太大,难以审查
```

### 2. 清晰的提交信息

遵循 [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 代码格式调整
refactor: 代码重构
test: 添加测试
chore: 构建/工具链相关
```

### 3. 定期同步 main 分支

```bash
# 在功能分支上
git checkout feature/my-feature

# 拉取 main 的最新更改
git fetch origin
git merge origin/main

# 或使用 rebase (保持提交历史整洁)
git rebase origin/main
```

### 4. 使用 .gitignore

确保不提交:

- ❌ `.env.local` (本地环境变量)
- ❌ `node_modules/` (依赖)
- ❌ `.next/` (构建产物)
- ❌ 临时文件

---

## 🆘 常见问题

### Q1: 我不小心在 main 分支开发了,怎么办?

```bash
# 1. 创建新分支保存当前工作
git checkout -b feature/my-work

# 2. 提交更改
git add .
git commit -m "feat: 我的改动"

# 3. 推送新分支
git push origin feature/my-work

# 4. 重置 main 分支
git checkout main
git reset --hard origin/main

# 5. 创建 PR
```

### Q2: Pre-push hook 检查失败,但我确定代码没问题?

```bash
# 1. 先检查具体错误
pnpm check-all

# 2. 如果真的需要跳过 (不推荐)
git push --no-verify

# 3. 但要在 PR 中说明原因!
```

### Q3: 如何撤销已经推送的提交?

```bash
# ❌ 不要使用 force push 到 main!

# ✅ 正确做法: 创建一个新的提交来撤销
git revert HEAD
git push origin feature/my-branch
```

### Q4: 合并冲突怎么办?

```bash
# 1. 拉取最新的 main
git fetch origin
git merge origin/main

# 2. 解决冲突
# 编辑冲突文件,删除 <<<<<<<, =======, >>>>>>> 标记

# 3. 标记为已解决
git add .
git commit -m "fix: 解决合并冲突"

# 4. 推送
git push origin feature/my-branch
```

---

## 📚 相关文档

- **提交前检查**: `.github/PRE_COMMIT_CHECKLIST.md`
- **CI 工作流**: `.github/workflows/WORKFLOW_GUIDE.md`
- **部署指南**: `DEPLOYMENT_GUIDE.md`
- **配置指南**: `SETUP_COMPLETE.md`

---

## ✅ 工作流检查清单

每次开发新功能前,确认:

- [ ] 从最新的 main 分支创建功能分支
- [ ] 使用清晰的分支命名 (feature/xxx, fix/xxx)
- [ ] 开发完成后运行 `pnpm check-all`
- [ ] 所有本地检查通过
- [ ] 推送到功能分支 (不是 main!)
- [ ] 在 GitHub 创建 PR
- [ ] 等待所有 CI 检查通过
- [ ] 解决 Reviewdog 评论的问题
- [ ] 合并 PR
- [ ] 清理本地分支

---

**遵循这个流程,你的代码质量会大大提升,CI 也不会频繁失败!** 🎉
