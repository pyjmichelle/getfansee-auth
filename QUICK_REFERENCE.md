# Quick Reference - 常用命令

## 🚀 一键自动化 QA

```bash
pnpm qa:loop
```

**做什么**: 完整的自动化测试流程（需要手动登录 2 次）  
**时长**: 5-10 分钟

---

## 🔐 会话管理

### 导出 Fan 会话

```bash
pnpm test:session:export:fan
```

登录: `fan@test.com` / `TestFan123!`

### 导出 Creator 会话

```bash
pnpm test:session:export:creator
```

登录: `creator@test.com` / `TestCreator123!`

### 创建测试账户

```bash
pnpm exec tsx scripts/auth/create-test-accounts.ts
```

---

## 🧪 测试命令

### 完整站点审计

```bash
pnpm audit:full
```

需要先导出会话

### 前端冒烟测试

```bash
pnpm test:frontend:smoke
```

### E2E 测试

```bash
pnpm test:e2e
```

---

## 🛠️ 开发服务器

### 启动

```bash
pnpm dev
```

### 清理端口

```bash
lsof -ti:3000 | xargs kill -9
```

### 清理缓存

```bash
rm -rf .next
```

---

## 📊 查看结果

### 审计摘要

```bash
cat artifacts/agent-browser-full/summary.json
```

### 服务器日志

```bash
cat artifacts/qa/server.log
```

### 列出截图

```bash
ls -la artifacts/agent-browser-full/fan/
ls -la artifacts/agent-browser-full/creator/
```

---

## 🧹 清理

### 清理所有 artifacts

```bash
rm -rf artifacts/
```

### 清理会话

```bash
rm -rf artifacts/agent-browser-full/sessions/*
```

### 完全重置

```bash
lsof -ti:3000 | xargs kill -9
rm -rf .next artifacts/
pnpm install
```

---

## 🆘 故障排除

### 端口被占用

```bash
lsof -ti:3000 | xargs kill -9
```

### 服务器启动失败

```bash
rm -rf .next
pnpm install
pnpm dev
```

### 会话过期

```bash
rm -rf artifacts/agent-browser-full/sessions/*
pnpm test:session:export:fan
pnpm test:session:export:creator
```

### 账户不存在

```bash
pnpm exec tsx scripts/auth/create-test-accounts.ts
```

---

## 📁 重要文件路径

| 文件         | 路径                                                    |
| ------------ | ------------------------------------------------------- |
| QA Loop 脚本 | `scripts/qa/loop.sh`                                    |
| 会话文件     | `artifacts/agent-browser-full/sessions/`                |
| 审计结果     | `artifacts/agent-browser-full/summary.json`             |
| 服务器日志   | `artifacts/qa/server.log`                               |
| 截图         | `artifacts/agent-browser-full/{anonymous,fan,creator}/` |

---

## 🎯 典型工作流

### 首次运行

```bash
# 1. 一键运行（会引导你登录）
pnpm qa:loop

# 2. 查看结果
cat artifacts/agent-browser-full/summary.json
```

### 后续运行（会话已存在）

```bash
# 直接运行审计
pnpm audit:full
```

### 修复后重新测试

```bash
# 清理旧结果
rm -rf artifacts/agent-browser-full/{anonymous,fan,creator}/

# 重新运行
pnpm audit:full
```

---

**详细文档**: 查看 `QA_LOOP_GUIDE.md`
