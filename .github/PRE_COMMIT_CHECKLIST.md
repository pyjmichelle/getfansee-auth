# ✅ 代码提交前检查清单

## 🔍 每次提交/推送前必须执行

在提交代码或推送到远程仓库前,**必须**按顺序执行以下检查:

---

## 📋 检查命令

### 1️⃣ 类型检查

```bash
pnpm type-check
```

**预期**: 无类型错误
**如果失败**: 修复所有 TypeScript 类型错误

---

### 2️⃣ Lint 检查

```bash
pnpm lint
```

**预期**: 无 ESLint 错误 (警告可接受)
**如果失败**: 运行 `pnpm lint:fix` 自动修复

---

### 3️⃣ 格式检查

```bash
pnpm format:check
```

**预期**: 代码格式符合规范
**如果失败**: 运行 `pnpm format` 自动格式化

---

### 4️⃣ 单元测试

```bash
pnpm test:unit
```

**预期**: 所有测试通过
**如果失败**: 修复失败的测试

---

### 5️⃣ 构建验证

```bash
pnpm build
```

**预期**: 构建成功,无错误
**如果失败**: 修复构建错误

---

## 🚀 一键运行所有检查

```bash
# 方式 1: 使用现有命令
pnpm check-all

# 方式 2: 使用新增的 pre-push 脚本
pnpm pre-push
```

---

## 🤖 自动化检查 (推荐)

### Git Hook - 推送前自动检查

已配置 Husky Git Hook,每次 `git push` 前自动运行检查。

**如果检查失败,推送会被阻止** ⛔

要临时跳过检查 (不推荐):

```bash
git push --no-verify
```

---

## 📊 CI 流水线

推送到 GitHub 后,以下工作流会自动运行:

### 1. `ci.yml` - 主 CI 流水线

- ✅ Lint & Type Check
- ✅ Build
- ✅ QA Gate
- ✅ E2E Tests

### 2. `code-quality.yml` - 代码质量

- ✅ 所有本地检查
- 🤖 Reviewdog 自动评论问题

### 3. `pr-auto-review.yml` - PR 审查

- 📏 自动标签
- 🔒 安全扫描
- 💬 审查报告

---

## ⚠️ 常见错误处理

### 错误 1: TypeScript 类型错误

```bash
# 查看详细错误
pnpm type-check

# 常见修复:
# - 添加类型标注
# - 修复 any 类型
# - 更新接口定义
```

### 错误 2: ESLint 错误

```bash
# 自动修复
pnpm lint:fix

# 手动检查无法自动修复的问题
pnpm lint
```

### 错误 3: 格式问题

```bash
# 自动格式化
pnpm format
```

### 错误 4: 构建失败

```bash
# 检查环境变量
cp .env.example .env.local
# 填写正确的 Supabase 配置

# 清理缓存重新构建
rm -rf .next
pnpm build
```

---

## 🎯 最佳实践

### 提交代码的标准流程

```bash
# 1. 确保在正确的分支
git checkout -b feature/your-feature

# 2. 开发代码
# ... 编写代码 ...

# 3. 运行所有检查
pnpm check-all

# 4. 如果有问题,修复它们
pnpm lint:fix
pnpm format

# 5. 再次验证
pnpm check-all

# 6. 提交代码
git add .
git commit -m "feat: 你的功能描述"

# 7. 推送 (会自动触发 pre-push hook)
git push origin feature/your-feature

# 8. 在 GitHub 创建 PR
# 9. 等待 CI 检查通过
# 10. 合并 PR
```

---

## 🔧 配置说明

### Husky Git Hooks

位置: `.husky/`

**pre-commit**: 提交前运行 lint-staged
**pre-push**: 推送前运行完整检查

### Lint-staged

位置: `package.json` → `lint-staged`

只检查暂存区的文件,提高速度。

---

## 📞 需要帮助?

如果检查失败且不知道如何修复:

1. 查看错误信息
2. 阅读相关文档
3. 向团队成员求助
4. **切勿使用 `--no-verify` 跳过检查**

---

## ✅ 总结

**记住**:

- 🔴 本地检查失败 → 不要推送
- 🟡 CI 检查失败 → 不要合并 PR
- 🟢 所有检查通过 → 可以合并

**质量第一!** 💪
