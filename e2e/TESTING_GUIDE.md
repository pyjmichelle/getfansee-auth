# 测试运行指南

## 问题诊断

如果测试一直卡住，可能的原因：

1. **服务器未运行或卡住**
   - 检查：`lsof -ti:3000`
   - 解决：重启服务器 `pnpm run dev`

2. **服务器响应慢**
   - 检查：`curl http://localhost:3000`
   - 解决：等待服务器完全启动

3. **Playwright 等待服务器启动**
   - 解决：使用 `PLAYWRIGHT_SKIP_SERVER=true` 环境变量

## 运行测试的正确步骤

### 方法 1：手动启动服务器（推荐）

```bash
# 1. 在一个终端启动服务器
pnpm run dev

# 2. 等待服务器完全启动（看到 "Ready" 消息）

# 3. 在另一个终端运行测试（跳过服务器启动）
PLAYWRIGHT_SKIP_SERVER=true pnpm exec playwright test --project=chromium
```

### 方法 2：让 Playwright 自动启动服务器

```bash
# 确保没有服务器在运行
lsof -ti:3000 | xargs kill -9 2>/dev/null

# 运行测试（会自动启动服务器）
pnpm exec playwright test --project=chromium
```

### 方法 3：使用测试脚本

```bash
# 检查服务器健康状态
pnpm test:server-health

# 如果服务器未运行，启动它
pnpm run dev

# 然后运行测试
pnpm exec playwright test --project=chromium
```

## 快速测试单个用例

```bash
# 运行第一个注册测试
PLAYWRIGHT_SKIP_SERVER=true pnpm exec playwright test fan-journey.spec.ts:27 --project=chromium --reporter=line
```

## 调试技巧

1. **查看服务器日志**：检查 `pnpm run dev` 的输出
2. **使用 UI 模式**：`pnpm exec playwright test --ui`
3. **增加超时时间**：在测试代码中增加 `timeout` 参数
4. **检查网络**：确保 localhost:3000 可访问

## 常见错误

### 错误：测试超时
- **原因**：服务器未响应
- **解决**：重启服务器或检查服务器日志

### 错误：无法连接到服务器
- **原因**：服务器未启动或端口被占用
- **解决**：运行 `pnpm test:server-health` 检查状态

### 错误：Playwright 卡住
- **原因**：等待服务器启动但服务器已卡住
- **解决**：使用 `PLAYWRIGHT_SKIP_SERVER=true` 跳过自动启动

