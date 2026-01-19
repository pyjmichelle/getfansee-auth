# Full Site Audit - Execution Guide

**Date**: 2026-01-18  
**Status**: ✅ Ready to Execute

---

## 你需要做的事（4 步）

### 步骤 1: 启动开发服务器

**终端 1**:

```bash
cd "/Users/puyijun/Downloads/authentication-flow-design (1)"
pnpm dev
```

**等待输出**:

```
   ▲ Next.js 16.0.10 (Turbopack)
   - Local:         http://localhost:3000
   ✓ Ready in 539ms
```

**保持这个终端运行！**

---

### 步骤 2: 导出 Fan 会话

**终端 2**:

```bash
cd "/Users/puyijun/Downloads/authentication-flow-design (1)"
pnpm test:session:export:fan
```

**会发生什么**:

1. 浏览器窗口会自动打开（headed 模式）
2. 自动导航到 http://127.0.0.1:3000/auth
3. **你需要手动登录**:
   - Email: `fan@test.com`
   - Password: `TestFan123!`
   - 点击 "Sign In"
4. 登录成功后，脚本会自动检测并导出会话
5. 浏览器自动关闭

**预期输出**:

```
🔐 Manual Login Session Export
============================================================
Role: Fan
Base URL: http://127.0.0.1:3000
Test Page: /home

✋ PLEASE LOGIN NOW
   Waiting for you to complete login...

✓ Login detected! Current URL: http://127.0.0.1:3000/home
✓ Verification passed!
💾 Exporting session to: artifacts/agent-browser-full/sessions/fan.json
   ✓ Session exported
📸 Taking verification screenshot
   ✓ Screenshot saved

============================================================
✅ SUCCESS
============================================================
Session file: artifacts/agent-browser-full/sessions/fan.json
Screenshot: artifacts/agent-browser-full/sessions/fan-post-login.png
```

---

### 步骤 3: 导出 Creator 会话

**终端 2** (同一个):

```bash
pnpm test:session:export:creator
```

**会发生什么**:

1. 浏览器再次打开
2. 导航到 http://127.0.0.1:3000/auth
3. **你需要手动登录**:
   - Email: `creator@test.com`
   - Password: `TestCreator123!`
   - 点击 "Sign In"
4. 脚本验证你能访问 `/creator/studio`
5. 导出会话并关闭

**预期输出**:

```
✅ SUCCESS
Session file: artifacts/agent-browser-full/sessions/creator.json
Screenshot: artifacts/agent-browser-full/sessions/creator-post-login.png
```

---

### 步骤 4: 运行完整审计

**终端 2**:

```bash
pnpm audit:full
```

**会发生什么**:

1. 启动新的 dev 服务器（自动）
2. 测试 20 个路由 × 3 个认证状态 = 60 个场景
3. 生成 60 张截图
4. 验证 Fan/Creator 会话有效性（<5% 认证页面）
5. 生成报告

**预期输出**:

```
🔍 Full Site Interactive Audit
📍 Base URL: http://127.0.0.1:3000
📋 Routes to test: 20
🔐 Auth states: anonymous, fan, creator

============================================================
🔐 Testing as: FAN
============================================================
  ✓ Loading fan session from artifacts/agent-browser-full/sessions/fan.json
     Cookies: 5, Origins: 1

🧪 Testing: /home (fan)
  → Status: 200
  → Final URL: http://127.0.0.1:3000/home
  ✓ Screenshot: artifacts/agent-browser-full/fan/home.png
  ✅ Route OK

...

============================================================
🔍 VALIDATING AUTH SESSIONS
============================================================
Fan auth pages: 0/20 (0.0%)
Creator auth pages: 1/20 (5.0%)
✅ Fan session validation PASSED: 0.0% <= 5%
✅ Creator session validation PASSED: 5.0% <= 5%

✅ AUDIT PASSED: All gates met
```

**预期时长**: 3-5 分钟

---

## 验收命令（你完成后运行）

### 检查会话文件

```bash
ls -la artifacts/agent-browser-full/sessions/
```

**预期输出**:

```
-rw-r--r--  1 user  staff  XXXX  fan.json
-rw-r--r--  1 user  staff  XXXX  creator.json
-rw-r--r--  1 user  staff  XXXX  fan-post-login.png
-rw-r--r--  1 user  staff  XXXX  creator-post-login.png
```

**必须有 4 个文件！**

---

### 检查截图数量

```bash
ls -la artifacts/agent-browser-full/fan/ | wc -l
ls -la artifacts/agent-browser-full/creator/ | wc -l
```

**预期输出**:

```
21  # (20 screenshots + 1 directory line)
21
```

---

### 检查审计总结

```bash
cat artifacts/agent-browser-full/summary.json
```

**预期输出**:

```json
{
  "timestamp": "2026-01-18T...",
  "totalTests": 60,
  "successfulLoads": 60,
  "redirects": XX,
  "errors": 0,
  "totalConsoleErrors": X,
  "totalNetworkErrors": X,
  "passRate": "100.0%",
  "sessionsValid": true,
  "fanAuthPageRatio": "0.0%",      ← 必须 < 5%
  "creatorAuthPageRatio": "5.0%"   ← 必须 < 5%
}
```

**关键字段验证**:

- ✅ `sessionsValid: true`
- ✅ `fanAuthPageRatio` < 5%
- ✅ `creatorAuthPageRatio` < 5%

---

### 验证关键路由

```bash
cat artifacts/agent-browser-full/audit-results.json | grep -A 5 '"route": "/home"' | grep '"authState": "fan"' -A 4
```

**预期输出**:

```json
"authState": "fan",
"httpStatus": 200,
"finalUrl": "http://127.0.0.1:3000/home",  ← 不是 /auth！
"consoleErrors": [],
```

```bash
cat artifacts/agent-browser-full/audit-results.json | grep -A 5 '"route": "/creator/new-post"' | grep '"authState": "creator"' -A 4
```

**预期输出**:

```json
"authState": "creator",
"httpStatus": 200,
"finalUrl": "http://127.0.0.1:3000/creator/new-post",  ← 不是 /auth！
"consoleErrors": [],
```

---

## 如果出错

### 错误 1: "Session file not found"

**原因**: 你还没导出会话

**解决**:

```bash
pnpm test:session:export:fan
pnpm test:session:export:creator
```

---

### 错误 2: "Session validation FAILED: XX% > 5%"

**原因**: 会话已过期或无效

**解决**:

```bash
# 重新导出会话
pnpm test:session:export:fan
pnpm test:session:export:creator

# 重新运行审计
pnpm audit:full
```

---

### 错误 3: "Verification failed: Redirected back to /auth"

**原因**:

- 登录时选错了账户
- 账户没有对应的角色

**解决**:

```bash
# 确认账户角色
pnpm exec tsx scripts/auth/create-test-accounts.ts

# 重新导出会话（确保用对应的邮箱）
pnpm test:session:export:fan    # 用 fan@test.com
pnpm test:session:export:creator # 用 creator@test.com
```

---

### 错误 4: 浏览器不打开

**原因**: Playwright 浏览器未安装

**解决**:

```bash
pnpm exec playwright install chromium
```

---

## 完成后发给我

把这 3 个文件的内容发给我：

1. `artifacts/agent-browser-full/summary.json`
2. `artifacts/agent-browser-full/sessions/fan.json` 的前 20 行
3. 截图验证：
   ```bash
   ls -la artifacts/agent-browser-full/sessions/*.png
   ls -la artifacts/agent-browser-full/fan/ | head -5
   ls -la artifacts/agent-browser-full/creator/ | head -5
   ```

---

## 快速命令清单（复制粘贴）

```bash
# 终端 1 - 启动服务器（保持运行）
cd "/Users/puyijun/Downloads/authentication-flow-design (1)"
pnpm dev

# 终端 2 - 导出会话并运行审计
cd "/Users/puyijun/Downloads/authentication-flow-design (1)"
pnpm test:session:export:fan      # 手动登录 fan@test.com
pnpm test:session:export:creator  # 手动登录 creator@test.com
pnpm audit:full                    # 自动运行完整审计

# 验收
ls -la artifacts/agent-browser-full/sessions/
cat artifacts/agent-browser-full/summary.json
```

---

**预期总时长**: 10-15 分钟（包括 2 次手动登录）

**状态**: ✅ Ready to Execute
