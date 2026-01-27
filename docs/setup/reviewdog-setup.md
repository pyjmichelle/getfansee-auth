# Reviewdog 集成指南

## 概述

Reviewdog 是一个自动化代码审查工具，可以在 GitHub Pull Requests 上自动评论代码质量问题。本项目已集成 Reviewdog 用于：

- ESLint 代码规范检查
- TypeScript 类型检查
- Prettier 格式检查

## 功能特性

### ✅ 自动 PR 评论

当创建或更新 Pull Request 时，Reviewdog 会自动：

- 扫描新增/修改的代码
- 在 PR 上评论发现的问题
- 提供修复建议

### ✅ 智能过滤

- 只评论新增/修改的代码（`filter_mode: added`）
- 不会对已有代码产生噪音
- 支持不同严重级别（error/warning/info）

### ✅ 零配置

- 使用 GitHub Actions 内置的 `GITHUB_TOKEN`
- 无需额外的 bot 账号或 token
- 自动集成到现有 CI 流程

## 工作流配置

Reviewdog 已集成到 `.github/workflows/code-quality.yml`：

```yaml
# ESLint 检查
- name: Run Reviewdog (ESLint)
  if: github.event_name == 'pull_request'
  uses: reviewdog/action-eslint@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    reporter: github-pr-review
    eslint_flags: "."
    fail_on_error: false
    filter_mode: added

# TypeScript 类型检查
- name: Run Reviewdog (TypeScript)
  if: github.event_name == 'pull_request'
  uses: reviewdog/action-tsc@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    reporter: github-pr-review
    tsc_flags: "--noEmit"
    fail_on_error: false
    filter_mode: added

# Prettier 格式检查
- name: Run Reviewdog (Prettier)
  if: github.event_name == 'pull_request'
  uses: reviewdog/action-prettier@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    reporter: github-pr-review
    prettier_flags: "--check"
    fail_on_error: false
    filter_mode: added
```

## 使用方式

### 1. 创建 Pull Request

正常创建 PR，Reviewdog 会自动运行：

```bash
git checkout -b feature/my-feature
# ... 编写代码 ...
git push origin feature/my-feature
# 在 GitHub 创建 PR
```

### 2. 查看 Reviewdog 评论

Reviewdog 会在以下情况自动评论：

- PR 创建时
- PR 更新（新 commit）时
- 手动触发 workflow 时

评论会显示在 PR 的 "Files changed" 标签页，每个问题都会：

- 标注文件路径和行号
- 显示错误/警告信息
- 提供修复建议

### 3. 修复问题

根据 Reviewdog 的评论修复问题：

```bash
# 自动修复 ESLint 问题
pnpm lint:fix

# 自动修复 Prettier 格式
pnpm format

# 修复 TypeScript 类型错误
# 需要手动修复类型问题
```

### 4. 推送修复

修复后推送，Reviewdog 会重新检查：

```bash
git add .
git commit -m "fix: resolve reviewdog issues"
git push
```

## 配置说明

### Reporter 类型

当前使用 `github-pr-review`，会在 PR 上直接评论。

其他可选类型：

- `github-pr-check` - 作为 GitHub Check 显示
- `github-check` - 仅显示在 Checks 标签页

### Filter Mode

`filter_mode: added` - 只检查新增/修改的代码

其他选项：

- `nofilter` - 检查所有代码
- `diff_context` - 检查 diff 上下文

### 严重级别

- `error` - 必须修复的问题（TypeScript 类型错误）
- `warning` - 建议修复的问题（ESLint/Prettier）
- `info` - 信息性提示

### Fail on Error

`fail_on_error: false` - Reviewdog 不会导致 workflow 失败

即使有代码质量问题，CI 仍会继续运行，但会在 PR 上显示评论。

## 本地测试

在本地运行 Reviewdog（需要安装 reviewdog CLI）：

```bash
# 安装 reviewdog
brew install reviewdog/tap/reviewdog

# 运行 ESLint 检查
pnpm lint | reviewdog -f=eslint -reporter=github-pr-review

# 运行 TypeScript 检查
pnpm type-check 2>&1 | reviewdog -f=tsc -reporter=github-pr-review
```

## 常见问题

### Q: Reviewdog 没有在 PR 上评论？

**A**: 检查以下几点：

1. 确保 workflow 已运行（查看 Actions 标签页）
2. 确保有代码质量问题（Reviewdog 只在发现问题时评论）
3. 检查 workflow 日志是否有错误

### Q: 如何禁用某个文件的检查？

**A**: 在 ESLint/Prettier 配置中添加忽略规则：

```javascript
// eslint.config.js
export default [
  {
    ignores: ["**/generated/**", "**/dist/**"],
  },
];
```

### Q: 如何只检查特定文件类型？

**A**: 修改 `eslint_flags` 或 `prettier_flags`：

```yaml
eslint_flags: "--ext .ts,.tsx src/"
prettier_flags: '--check "**/*.{ts,tsx}"'
```

### Q: Reviewdog 评论太多怎么办？

**A**:

1. 使用 `filter_mode: added` 只检查新代码
2. 调整 ESLint/Prettier 规则，减少警告
3. 使用 `level: error` 只显示错误级别问题

## 相关资源

- [Reviewdog 官方文档](https://github.com/reviewdog/reviewdog)
- [Reviewdog GitHub Actions](https://github.com/reviewdog/action-eslint)
- [ESLint 配置](./eslint.config.js)
- [TypeScript 配置](./tsconfig.json)

## 更新日志

- **2026-01-27**: 初始集成 Reviewdog
  - 添加 ESLint 检查
  - 添加 TypeScript 检查
  - 添加 Prettier 检查
