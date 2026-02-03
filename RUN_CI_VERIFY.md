# CI Verification Run Guide

## 前置条件检查

在运行 `pnpm ci:verify` 之前，请确保：

### 1. 环境变量已配置

```bash
# 检查环境变量
pnpm check:env
```

应该看到所有 ✅。如果有 ❌：

```bash
# 复制模板
cp env.ci.template .env.local

# 编辑并填入你的 Supabase credentials
# 需要填写：
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
```

### 2. 测试账号已创建

确保你的 Supabase 项目中有以下两个账号（email 已验证）：

- **Fan**: test-fan@example.com / TestPassword123!
- **Creator**: test-creator@example.com / TestPassword123!

### 3. 端口 3000 未被占用

```bash
# macOS/Linux
lsof -i :3000

# 如果有进程占用，先停止它
```

## 运行完整验证

```bash
pnpm ci:verify
```

## 预期输出

验证过程包含 6 个阶段：

### [0/5] 环境检查

```
✅ NEXT_PUBLIC_SUPABASE_URL - https://xxx...
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY - eyJhbG...
✅ SUPABASE_SERVICE_ROLE_KEY - eyJhbG...
```

### [1/5] ESLint

```
✅ ESLint passed
```

允许 warnings ≤ 155

### [2/5] TypeScript Type Check

```
✅ Type check passed
```

必须 0 errors

### [3/5] Production Build

```
✅ Build passed
```

这是关键检查 - 确保 Next.js build 成功

### [4/5] QA Gate

```
🎯 Running QA Gate (UI + Dead Click + Audit)...
⚠️  Session file not found: ...  (可接受 - 跳过认证检查)
✅ QA Gate passed
```

可能会跳过部分检查（如果没有 session 文件）

### [5/5] E2E Tests (Chromium)

```
🎭 Running E2E tests (chromium)...
Running X tests using 1 worker
...
✅ E2E tests passed
```

### 最终输出

```
========================================
✅ All CI verification checks passed!
========================================
```

## 如果失败

### Build 失败

- 检查语法错误
- 检查环境变量是否正确
- 运行 `rm -rf .next && pnpm build` 清除缓存

### E2E 测试失败

- 确保测试账号存在且 email 已验证
- 检查 Supabase credentials 是否正确
- 查看失败截图：`test-results/*/test-failed-*.png`

### QA Gate 失败

- 可以忽略 session 相关警告
- 如果是其他错误，检查 `artifacts/qa/` 目录

## 连续运行两次

为了确保稳定性，成功后再运行一次：

```bash
pnpm ci:verify  # 第二次
```

两次都通过后，即可安全 push！

## 清理（可选）

测试完成后可以清理生成的文件：

```bash
rm -rf test-results/ playwright-report/ artifacts/
```
