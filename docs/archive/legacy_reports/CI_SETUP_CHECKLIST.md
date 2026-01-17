# CI/CD Setup Checklist

## GitHub Secrets 配置

在 GitHub Repository Settings → Secrets and variables → Actions 中添加以下 secrets：

1. **NEXT_PUBLIC_SUPABASE_URL**
   - 你的 Supabase 项目 URL
   - 示例：`https://xxxxx.supabase.co`

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Supabase 匿名密钥（公开，可安全提交）
   - 在 Supabase Dashboard → Settings → API 中找到

3. **SUPABASE_SERVICE_ROLE_KEY**
   - Supabase 服务角色密钥（**敏感，永远不要提交到代码库**）
   - 在 Supabase Dashboard → Settings → API 中找到
   - ⚠️ **重要**：此密钥仅在 GitHub Secrets 中配置，永远不要出现在代码或日志中

## 验证 Workflow

### 1. 创建 Pull Request

1. 创建一个新分支：

   ```bash
   git checkout -b test/ci-pipeline
   ```

2. 提交更改：

   ```bash
   git add .
   git commit -m "Add CI pipeline"
   git push origin test/ci-pipeline
   ```

3. 在 GitHub 上创建 Pull Request 到 `main` 分支

### 2. 检查 Workflow 状态

1. 在 GitHub 上打开你的 Pull Request
2. 查看 "Checks" 标签页
3. 应该看到 "MVP Test Pipeline" workflow 正在运行
4. 等待完成（通常 2-5 分钟）

### 3. 验证结果

- ✅ **绿色勾号**：所有测试通过
- ❌ **红色叉号**：测试失败，查看日志找出问题

### 4. 查看 Workflow 日志

1. 点击 workflow 名称
2. 点击 "test" job
3. 展开各个步骤查看详细日志
4. 确认没有打印任何 secrets（URL 和 keys 不应出现在日志中）

## 本地验证命令

在提交 PR 之前，可以在本地运行测试：

```bash
# 确保环境变量已设置
export NEXT_PUBLIC_SUPABASE_URL="your-url"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"

# 运行 MVP 测试套件
pnpm test:mvp
```

或者使用 `.env.local` 文件（本地开发）：

```bash
# .env.local 文件内容
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# 运行测试
pnpm test:mvp
```

## 测试顺序

`pnpm test:mvp` 按以下顺序运行：

1. `test:auth` - 认证流程测试
2. `test:visibility` - 可见性规则测试
3. `test:paywall` - 付费墙测试
4. `test:watermark` - 水印功能测试

如果任何测试失败，整个流程会立即停止并返回错误代码。

## 故障排除

### Workflow 失败

1. **检查 Secrets 是否正确配置**
   - 确保所有 3 个 secrets 都已添加
   - 确保 secret 名称完全匹配（区分大小写）

2. **检查测试日志**
   - 查看 "Run MVP tests" 步骤的输出
   - 查找具体的错误消息

3. **本地复现问题**
   - 使用相同的环境变量在本地运行 `pnpm test:mvp`
   - 如果本地通过但 CI 失败，可能是环境差异

### Secrets 泄露检查

- ✅ Workflow 日志中不应包含完整的 URL 或 keys
- ✅ 如果看到 secrets 在日志中，检查是否有 `console.log` 或 `echo` 命令打印了环境变量
- ✅ 确保所有测试脚本使用环境变量，而不是硬编码值
