# GitHub Copilot Enterprise CI 故障分析指南

## 概述

GitHub Copilot Enterprise 是 GitHub 的内置 AI 功能，提供强大的 CI/CD 故障分析和修复建议。它可以帮助你：

- 自动分析失败的 CI 工作流
- 理解错误原因和上下文
- 获得修复建议和步骤
- 对话式故障排查

## 功能特性

### ✅ 内置 CI 故障分析

GitHub Copilot Enterprise 内置在 GitHub 平台中，无需额外安装或配置。当 CI 工作流失败时，你可以：

1. **点击 "Explain error"** - 在失败的检查上直接获取错误解释
2. **访问工作流运行摘要** - 查看 AI 生成的故障分析
3. **对话式排查** - 通过 Copilot Chat 询问问题

### ✅ 智能错误理解

Copilot Enterprise 可以理解：

- 构建失败原因
- 测试失败上下文
- 配置错误
- 依赖问题
- 环境差异

### ✅ 修复建议

提供：

- 具体的修复步骤
- 代码修改建议
- 配置调整方案
- 相关文档链接

## 使用方式

### 方法 1: 在失败的检查上使用

1. **打开失败的 CI 检查**
   - 在 PR 页面，点击失败的检查（红色 ❌）
   - 或在 Actions 标签页，打开失败的 workflow run

2. **点击 "Explain error" 按钮**
   - GitHub 会自动分析错误日志
   - 显示错误原因和修复建议

3. **查看修复建议**
   - 阅读 AI 生成的解释
   - 按照建议的步骤修复

### 方法 2: 在工作流运行摘要中使用

1. **打开工作流运行**
   - 进入 Actions 标签页
   - 点击失败的 workflow run

2. **查看摘要页面**
   - GitHub 会自动生成故障摘要
   - 显示关键错误和修复建议

3. **使用 Copilot Chat**
   - 在摘要页面打开 Copilot Chat
   - 询问具体问题，例如：
     - "为什么这个测试失败了？"
     - "如何修复这个构建错误？"
     - "这个配置问题怎么解决？"

### 方法 3: 在 PR 中使用

1. **打开 Pull Request**
   - 查看失败的 CI 检查

2. **使用 Copilot Chat**
   - 在 PR 页面打开 Copilot Chat
   - 询问 CI 相关问题

## 示例场景

### 场景 1: 构建失败

**错误**: `Failed to fetch 'Inter' from Google Fonts`

**使用 Copilot Enterprise**:

1. 点击失败的构建检查
2. 点击 "Explain error"
3. Copilot 会解释：
   - 错误原因：网络请求失败
   - 影响范围：阻塞所有构建
   - 修复建议：添加字体 fallback 或使用本地字体

**修复步骤**:

```typescript
// Copilot 建议的修复
const inter = Inter({
  subsets: ["latin"],
  fallback: ["system-ui", "-apple-system", "sans-serif"],
  display: "swap",
});
```

### 场景 2: 测试失败

**错误**: `Test timeout: exceeded 120000ms`

**使用 Copilot Enterprise**:

1. 打开失败的测试检查
2. 询问："为什么这个测试超时了？"
3. Copilot 会分析：
   - 测试执行时间过长
   - 可能的原因：网络请求、资源加载、异步操作
   - 修复建议：增加超时时间或优化测试

### 场景 3: 类型错误

**错误**: `Type 'string' is not assignable to type 'number'`

**使用 Copilot Enterprise**:

1. 点击类型检查失败
2. 询问："如何修复这个类型错误？"
3. Copilot 会提供：
   - 具体的类型修复代码
   - 相关文件的修改建议
   - 类型定义的最佳实践

## 最佳实践

### 1. 及时使用

在 CI 失败后立即使用 Copilot Enterprise：

- 错误上下文更清晰
- 修复建议更准确
- 减少排查时间

### 2. 具体提问

使用具体的问题描述：

- ❌ "为什么失败了？"
- ✅ "为什么 Google Fonts 下载失败？"
- ✅ "如何修复 TypeScript 类型错误？"

### 3. 验证建议

Copilot 的建议需要验证：

- 在本地测试修复
- 确保不引入新问题
- 检查相关文档

### 4. 结合其他工具

Copilot Enterprise 可以与其他工具结合：

- Reviewdog - 代码质量检查
- Self-Healing CI - 自动修复
- 本地测试 - 验证修复

## 权限要求

### 需要的权限

- **GitHub Copilot Enterprise 订阅**
  - 需要组织或企业订阅
  - 个人账户可能需要升级

- **仓库访问权限**
  - 读取工作流运行
  - 查看错误日志
  - 访问 Copilot Chat

### 检查是否可用

1. 打开任意 PR 或 Issue
2. 查看是否有 Copilot Chat 图标
3. 或在失败的 CI 检查上查看是否有 "Explain error" 按钮

## 限制和注意事项

### ⚠️ 需要订阅

GitHub Copilot Enterprise 是付费功能：

- 需要 GitHub Enterprise 或 Copilot Business 订阅
- 个人开发者可能需要升级账户

### ⚠️ 建议需要验证

Copilot 的建议是 AI 生成的：

- 需要人工验证和测试
- 可能不完全准确
- 需要结合实际情况调整

### ⚠️ 隐私考虑

Copilot 会分析代码和错误日志：

- 确保符合组织的隐私政策
- 敏感信息不会泄露（GitHub 有隐私保护）

## 与其他工具集成

### Reviewdog

Copilot Enterprise 可以补充 Reviewdog：

- Reviewdog: 自动代码审查
- Copilot: 故障分析和修复建议

### Self-Healing CI

可以结合使用：

- Self-Healing CI: 自动修复已知问题
- Copilot: 分析和理解新问题

### 本地开发

在本地开发时也可以使用：

- GitHub CLI 集成 Copilot
- VS Code Copilot 扩展
- 本地故障排查

## 相关资源

- [GitHub Copilot Enterprise 文档](https://docs.github.com/en/copilot)
- [CI/CD 故障排查指南](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows)
- [使用 Copilot 排查工作流](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows/using-copilot-to-troubleshoot-workflows)
- [Reviewdog 集成指南](./reviewdog-setup.md)

## 更新日志

- **2026-01-27**: 创建 GitHub Copilot Enterprise 使用指南
  - 添加使用方式说明
  - 添加示例场景
  - 添加最佳实践

## 常见问题

### Q: 我没有看到 "Explain error" 按钮？

**A**: 可能的原因：

1. 没有 GitHub Copilot Enterprise 订阅
2. 功能尚未在你的区域启用
3. 需要刷新页面

### Q: Copilot 的建议不准确怎么办？

**A**:

1. 提供更多上下文信息
2. 询问更具体的问题
3. 结合其他工具和文档验证

### Q: 可以在本地使用吗？

**A**:

- GitHub CLI 支持 Copilot 功能
- VS Code Copilot 扩展可以用于本地开发
- 但 CI 故障分析主要在 GitHub 平台上使用

### Q: 如何启用 Copilot Enterprise？

**A**:

1. 联系 GitHub 销售团队
2. 升级到 GitHub Enterprise 或 Copilot Business
3. 在组织设置中启用 Copilot 功能
