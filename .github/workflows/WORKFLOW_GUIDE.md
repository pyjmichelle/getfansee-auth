# GitHub Actions 工作流指南

## 📋 已配置的工作流

### 1. `ci.yml` - 主 CI 流水线 (已存在)

**触发条件**: Push 到 main/develop 或 PR

**包含阶段**:

1. ✅ Lint & Type Check
2. ✅ Build
3. ✅ QA Gate (UI + Dead Click)
4. ✅ E2E Tests
5. ✅ Legacy Tests
6. ✅ Quality Gate

**状态**: 已完善,保持不变

---

### 2. `code-quality.yml` - 代码质量检查 (新增)

**触发条件**: PR 或 Push 到 main/develop

**功能**:

- ✅ TypeScript 类型检查
- ✅ ESLint 代码规范
- ✅ Prettier 格式检查
- ✅ 单元测试
- ✅ Reviewdog 自动评论 (仅 PR)
- ✅ 构建验证
- ✅ 质量报告生成

**特点**:

- 在 PR 上自动评论发现的问题
- 只评论新增/修改的代码
- 不会阻塞 CI (continue-on-error)

---

### 3. `pr-auto-review.yml` - PR 自动审查 (新增)

**触发条件**: PR 打开/更新

**功能**:

- 📊 PR 大小标签 (xs/s/m/l/xl)
- 🏷️ 自动文件类型标签
- 📝 TODO/FIXME 统计
- 📦 大文件检查 (>500 行)
- 🔒 依赖安全审计
- 🔑 密钥泄露扫描
- 💬 自动评论汇总

**输出**: 在 PR 下自动添加审查报告评论

---

### 4. Claude Code Action（可选）

需在仓库或 Org 中配置 `ANTHROPIC_API_KEY` 后以下工作流才会生效；未配置时相关 job 会因缺少密钥而失败，不影响其他 CI。

#### 4.1 `claude-pr-review.yml` - Claude 语义级 PR 审查

**触发条件**: PR 打开/更新（与 pr-auto-review 并行）

**功能**:

- 使用 [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) 对 PR 做**语义级代码审查**
- 关注：代码质量、潜在 bug、安全（auth/Supabase RLS/API 输入）、性能、类型与 UI 规范
- 审查标准与本地 Cursor 规则对齐（见 `.cursor/rules/github-cursor-sync.mdc`）
- Claude 可发 PR 评论与行内评论（inline comments）

**所需**: `ANTHROPIC_API_KEY`（Settings → Secrets and variables → Actions）

#### 4.2 `claude-ci-helper.yml` - 评论触发 CI 失败分析

**触发条件**: 在 PR 或 Issue 的评论中出现 `@claude` 时（例如：「@claude 为什么 CI 失败了」）

**功能**:

- Claude 在 Actions 中可查看 workflow 状态与 job 日志（需 `actions: read`）
- 根据评论内容分析 CI 失败原因并回复评论

**所需**: `ANTHROPIC_API_KEY`；workflow 已配置 `permissions: actions: read` 与 `additional_permissions: actions: read`

#### 与 Cursor 的协同关系

- **线下（Cursor）**: 本地开发、`.cursor/rules` / `.cursor/agents` 约束风格与质量；通过 `git push` / PR 与 GitHub 同步。
- **线上（GitHub）**: 现有 CI + 代码质量 + PR 自动审查 +（可选）Claude PR 审查与 @claude CI 分析。
- **闭环**: 本地改 → push/PR → 线上跑 CI 与（若启用）Claude 审查/分析 → 根据 PR 评论与 CI 结果在 Cursor 中再改。Claude Code Action 不负责代码同步，只负责线上自动化，与现有 workflow 互补。

---

## 🎯 工作流协同关系

```
PR 创建
  ↓
  ├─→ ci.yml (主流水线)
  │     ├─ Lint & Type Check
  │     ├─ Build
  │     ├─ QA Gate
  │     ├─ E2E Tests
  │     └─ Quality Gate ✅
  │
  ├─→ code-quality.yml (代码质量)
  │     ├─ 各项检查
  │     └─ Reviewdog 评论 💬
  │
  └─→ pr-auto-review.yml (自动审查)
        ├─ 标签管理
        ├─ 安全检查
        └─ 汇总评论 💬
  └─→ claude-pr-review.yml (可选，需 ANTHROPIC_API_KEY)
        └─ Claude 语义级审查 💬
  └─→ @claude 评论 → claude-ci-helper.yml (可选)
        └─ CI 失败分析回复 💬
```

---

## 🔧 配置说明

### 必需的 GitHub Secrets

确保在仓库设置中配置以下 Secrets:

```
Settings → Secrets and variables → Actions → New repository secret
```

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 可选的 GitHub Secrets（Claude Code Action）

若启用 Claude PR 审查或 @claude CI 分析，需额外配置:

- `ANTHROPIC_API_KEY` — Anthropic API Key；配置后 `claude-pr-review.yml` 与 `claude-ci-helper.yml` 才会成功运行。详见 [GITHUB_SECRETS_SETUP.md](../GITHUB_SECRETS_SETUP.md)。

### 权限设置

工作流需要以下权限:

```yaml
permissions:
  contents: read
  pull-requests: write
  checks: write
  issues: write
```

在仓库设置中启用:

```
Settings → Actions → General → Workflow permissions
→ 选择 "Read and write permissions"
```

---

## 📊 查看报告

### 1. GitHub Actions Summary

每个工作流运行后,在 Summary 页面可以看到:

- 代码质量报告
- TODO/FIXME 统计
- 大文件警告
- 安全审计结果

### 2. PR 评论

在 PR 页面会自动收到:

- ESLint 问题的行内评论
- TypeScript 类型错误评论
- 自动审查汇总评论

### 3. 标签

PR 会自动添加标签:

- `size/xs` - `size/xl` (代码量)
- `type: feature` / `type: fix` 等 (类型)
- `area: auth` / `area: ui` 等 (模块)
- `needs: review` (需要审查)

---

## 🚀 使用建议

### 开发流程

1. **创建 PR**

   ```bash
   git checkout -b feature/xxx
   # ... 开发
   git push origin feature/xxx
   # 在 GitHub 创建 PR
   ```

2. **自动触发**
   - 所有工作流自动运行
   - 5-10 分钟后收到评论和标签

3. **查看反馈**
   - 检查 PR 评论中的问题
   - 查看 Actions 页面的详细报告
   - 根据建议修改代码

4. **修复问题**

   ```bash
   # 修复代码
   git commit -m "fix: 修复 lint 问题"
   git push
   # 工作流自动重新运行
   ```

5. **合并 PR**
   - 确保所有必需检查通过 (✅)
   - 点击 "Merge pull request"

---

## 🐛 故障排除

### 问题 1: Reviewdog 没有评论

**原因**: 权限不足

**解决**:

```
Settings → Actions → General → Workflow permissions
→ 选择 "Read and write permissions"
→ 勾选 "Allow GitHub Actions to create and approve pull requests"
```

### 问题 2: 构建失败 - 缺少环境变量

**原因**: Secrets 未配置

**解决**:

```
Settings → Secrets and variables → Actions
→ 添加所有必需的 Secrets
```

### 问题 3: 工作流跳过

**原因**: Concurrent 策略取消了旧的运行

**说明**: 这是正常的,新的 push 会取消旧的运行以节省资源

---

## 📝 自定义配置

### 调整 PR 大小阈值

编辑 `pr-auto-review.yml`:

```yaml
xs_max_size: 10 # 超小 (1-10 行)
s_max_size: 100 # 小 (11-100 行)
m_max_size: 500 # 中 (101-500 行)
l_max_size: 1000 # 大 (501-1000 行)
# > 1000 行 = xl (超大)
```

### 添加/修改标签规则

编辑 `.github/labeler.yml`:

```yaml
"your-label":
  - "path/to/**/*"
```

### 调整 Reviewdog 过滤模式

编辑 `code-quality.yml`:

```yaml
filter_mode: added      # 只评论新增的行
# 或
filter_mode: diff_context  # 评论修改上下文
# 或
filter_mode: file       # 评论整个文件
```

---

## ✅ 检查清单

部署这些工作流前,确认:

- [ ] GitHub Secrets 已配置
- [ ] Workflow permissions 已设置为 "Read and write"
- [ ] 允许 GitHub Actions 创建 PR 评论
- [ ] 所有工作流文件已提交到仓库
- [ ] `.github/labeler.yml` 已创建
- [ ] 测试一个 PR 验证功能

---

## 🎉 完成!

现在你的仓库已经配置了:

- ✅ 完整的 CI/CD 流水线
- ✅ 自动代码审查
- ✅ PR 标签管理
- ✅ 安全检查
- ✅ 质量报告
- ✅ （可选）Claude 语义级 PR 审查与 @claude CI 失败分析（需配置 `ANTHROPIC_API_KEY`）

每次创建 PR 都会自动运行所有检查并提供反馈! 线下 Cursor 与线上 GitHub 使用同一套 PR 审查标准（见 `.cursor/rules/github-cursor-sync.mdc`）。
