# 工具集成设置指南

本目录包含项目中使用的各种工具和服务的设置指南。

## 📚 可用指南

### 1. Reviewdog 集成

**文件**: [reviewdog-setup.md](./reviewdog-setup.md)

**功能**: 自动化代码审查工具，在 GitHub Pull Requests 上自动评论代码质量问题。

**集成内容**:

- ESLint 代码规范检查
- TypeScript 类型检查
- Prettier 格式检查

**快速开始**:

1. Reviewdog 已集成到 `.github/workflows/code-quality.yml`
2. 创建 PR 时自动运行
3. 在 PR 上查看代码质量评论

---

### 2. GitHub Copilot Enterprise

**文件**: [github-copilot-enterprise-setup.md](./github-copilot-enterprise-setup.md)

**功能**: GitHub 内置 AI 功能，提供 CI/CD 故障分析和修复建议。

**使用方式**:

- 在失败的 CI 检查上点击 "Explain error"
- 在工作流运行摘要中使用 Copilot Chat
- 对话式故障排查

**要求**:

- GitHub Copilot Enterprise 订阅
- GitHub Enterprise 或 Copilot Business

---

## 🚀 快速设置

### Reviewdog（推荐，已集成）

Reviewdog 已自动集成，无需额外配置：

1. **创建 Pull Request**

   ```bash
   git checkout -b feature/my-feature
   git push origin feature/my-feature
   # 在 GitHub 创建 PR
   ```

2. **查看自动评论**
   - Reviewdog 会自动在 PR 上评论代码问题
   - 查看 "Files changed" 标签页

3. **修复问题**
   ```bash
   pnpm lint:fix      # 修复 ESLint 问题
   pnpm format        # 修复 Prettier 格式
   # 手动修复 TypeScript 类型错误
   ```

### GitHub Copilot Enterprise（如果可用）

1. **检查是否可用**
   - 打开任意 PR 或 Issue
   - 查看是否有 Copilot Chat 图标

2. **使用故障分析**
   - 打开失败的 CI 检查
   - 点击 "Explain error" 按钮
   - 查看 AI 生成的修复建议

3. **对话式排查**
   - 在 PR 页面打开 Copilot Chat
   - 询问 CI 相关问题

---

## 📖 详细文档

- [Reviewdog 完整指南](./reviewdog-setup.md)
- [GitHub Copilot Enterprise 完整指南](./github-copilot-enterprise-setup.md)

---

## 🔗 相关资源

- [CI 自动修复技能](../../.cursor/skills/ci-auto-fix.skill.md)
- [CI 审查报告](../../docs/reports/ci-push-readiness-review.md)
- [代码质量工作流](../../.github/workflows/code-quality.yml)

---

**最后更新**: 2026-01-27
