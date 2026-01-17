# 测试卡住问题 - 完整解决方案

## 🔍 问题诊断结果

1. **服务器进程存在但无响应**
   - 进程 PID 60120 在运行
   - 端口 3000 在监听
   - 但 HTTP 请求超时（`net::ERR_ABORTED`）

2. **根本原因**
   - 服务器可能卡住或处于异常状态
   - 需要重启服务器

## ✅ 解决方案（按优先级）

### 方案 1：重启服务器（推荐）

```bash
# 1. 停止现有服务器
lsof -ti:3000 | xargs kill -9

# 2. 启动新服务器（在新终端）
pnpm run dev

# 3. 等待服务器完全启动（看到 "Ready" 消息）

# 4. 运行测试（跳过 Playwright 的自动启动）
PLAYWRIGHT_SKIP_SERVER=true pnpm exec playwright test --project=chromium
```

### 方案 2：使用重启脚本

```bash
# 运行重启脚本
./scripts/restart-server.sh

# 然后在新终端启动服务器
pnpm run dev

# 运行测试
PLAYWRIGHT_SKIP_SERVER=true pnpm exec playwright test --project=chromium
```

### 方案 3：修复 Playwright 配置（已修复）

已更新 `playwright.config.ts`：
- 添加 `PLAYWRIGHT_SKIP_SERVER` 环境变量支持
- 修复 `clearStorage` 函数的安全错误

## 📝 测试运行步骤

### 快速测试单个用例

```bash
# 1. 确保服务器运行
pnpm test:server-health

# 2. 如果服务器未运行，启动它
pnpm run dev

# 3. 运行测试（跳过自动启动）
PLAYWRIGHT_SKIP_SERVER=true pnpm exec playwright test fan-journey.spec.ts:27 --project=chromium --reporter=line
```

### 运行所有测试

```bash
PLAYWRIGHT_SKIP_SERVER=true pnpm exec playwright test --project=chromium
```

## 🛠️ 已修复的问题

1. ✅ `clearStorage` 函数的安全错误
2. ✅ Playwright 配置支持跳过服务器启动
3. ✅ 添加服务器健康检查脚本
4. ✅ 添加测试指南文档

## 📋 检查清单

运行测试前，确保：

- [ ] 服务器正在运行（`pnpm test:server-health`）
- [ ] 服务器响应正常（浏览器访问 http://localhost:3000）
- [ ] 使用 `PLAYWRIGHT_SKIP_SERVER=true` 环境变量
- [ ] 测试超时时间足够（默认 30 秒）

## 🐛 如果仍然卡住

1. **检查服务器日志**：查看 `pnpm run dev` 的输出
2. **检查端口占用**：`lsof -i:3000`
3. **重启服务器**：`./scripts/restart-server.sh`
4. **使用 UI 模式调试**：`pnpm exec playwright test --ui`

