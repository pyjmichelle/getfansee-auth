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

每次创建 PR 都会自动运行所有检查并提供反馈!
