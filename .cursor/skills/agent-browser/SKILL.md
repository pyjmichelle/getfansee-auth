# Agent Browser - 前端自动化测试 Skill

## 概述

使用 `agent-browser` CLI 工具进行前端自动化测试和网页交互。这是一个为 AI Agent 优化的浏览器自动化工具。

## 安装

```bash
pnpm add -D agent-browser
pnpm agent-browser install  # 下载 Chromium
```

## 核心工作流程

### 1. 导航和快照

```bash
# 打开页面
agent-browser open <url>

# 获取交互元素快照（最佳实践）
agent-browser snapshot -i

# 输出示例:
# - tab "Log in" [ref=e1] [selected]
# - tab "Sign up" [ref=e2]
# - textbox "Email" [ref=e3]
# - button "Continue" [ref=e5]
```

### 2. 使用 Ref 交互

快照中的 `[ref=eX]` 是元素的唯一标识符，用 `@eX` 语法进行交互：

```bash
agent-browser click @e2        # 点击元素
agent-browser fill @e3 "text"  # 填写输入框
agent-browser get text @e1     # 获取文本
agent-browser get value @e3    # 获取输入值
```

### 3. 页面状态检查

```bash
agent-browser get title        # 获取页面标题
agent-browser get url          # 获取当前 URL
agent-browser errors           # 检查 JavaScript 错误
agent-browser screenshot x.png # 截图
```

## 常用命令

| 命令                 | 说明               |
| -------------------- | ------------------ |
| `open <url>`         | 导航到 URL         |
| `snapshot -i`        | 获取交互元素快照   |
| `click @eX`          | 点击元素           |
| `fill @eX "text"`    | 填写输入框         |
| `type @eX "text"`    | 输入文本（不清空） |
| `check @eX`          | 勾选复选框         |
| `uncheck @eX`        | 取消勾选           |
| `select @eX "value"` | 选择下拉选项       |
| `hover @eX`          | 悬停元素           |
| `press Enter`        | 按键               |
| `get text @eX`       | 获取文本           |
| `get value @eX`      | 获取输入值         |
| `get title`          | 获取页面标题       |
| `get url`            | 获取当前 URL       |
| `is visible @eX`     | 检查是否可见       |
| `wait <selector>`    | 等待元素出现       |
| `wait <ms>`          | 等待毫秒数         |
| `screenshot [path]`  | 截图               |
| `errors`             | 查看 JS 错误       |
| `close`              | 关闭浏览器         |

## 测试模式

### JSON 输出（用于自动化）

```bash
agent-browser snapshot -i --json
agent-browser get text @e1 --json
```

### 有头模式（调试用）

```bash
agent-browser open example.com --headed
```

## 本项目测试示例

### 1. 测试认证页面

```bash
# 打开认证页面
agent-browser open http://localhost:3000/auth

# 获取交互元素
agent-browser snapshot -i
# 输出:
# - tab "Log in" [ref=e1] [selected]
# - tab "Sign up" [ref=e2]
# - textbox "Email" [ref=e3]
# - textbox "Password" [ref=e4]
# - button "Continue" [ref=e5]

# 切换到注册标签
agent-browser click @e2

# 填写注册表单
agent-browser fill @e3 "test@example.com"
agent-browser fill @e4 "Password123!"

# 勾选年龄确认
agent-browser snapshot -i  # 重新获取快照找到 checkbox
agent-browser check @e5

# 点击注册按钮
agent-browser click @e6
```

### 2. 测试页面导航

```bash
# 测试未登录访问受保护页面
agent-browser open http://localhost:3000/home
agent-browser get url  # 应该重定向到 /auth

agent-browser open http://localhost:3000/me
agent-browser get url  # 应该重定向到 /auth

agent-browser open http://localhost:3000/creator/studio
agent-browser get url  # 应该重定向到 /auth
```

### 3. 测试 Creator 页面

```bash
agent-browser open http://localhost:3000/creator/onboarding
agent-browser snapshot -i

agent-browser open http://localhost:3000/creator/upgrade
agent-browser snapshot -i
```

### 4. 检查 JavaScript 错误

```bash
agent-browser open http://localhost:3000/auth
agent-browser errors
# 应该返回空或 "No errors"
```

### 5. 截图记录

```bash
agent-browser open http://localhost:3000/auth
agent-browser screenshot auth-page.png

agent-browser open http://localhost:3000/home
agent-browser screenshot home-page.png
```

## 完整测试脚本

运行完整的前端测试：

```bash
pnpm tsx scripts/agent-browser-test.ts
```

或者添加到 package.json:

```json
{
  "scripts": {
    "test:frontend": "tsx scripts/agent-browser-test.ts"
  }
}
```

## 最佳实践

1. **总是先获取快照**：每次页面变化后重新获取 `snapshot -i`
2. **使用 ref 而不是选择器**：`@e1` 比 CSS 选择器更可靠
3. **检查错误**：测试结束前运行 `errors` 检查 JS 错误
4. **截图记录**：关键步骤截图便于调试
5. **关闭浏览器**：测试结束后运行 `close`

## 与 Playwright 对比

| 场景          | agent-browser     | Playwright    |
| ------------- | ----------------- | ------------- |
| 快速手动测试  | ✅ CLI 直接运行   | ❌ 需要写代码 |
| AI Agent 集成 | ✅ 优化的输出格式 | ⚠️ 需要解析   |
| 完整 E2E 套件 | ⚠️ 脚本化         | ✅ 更强大     |
| CI 集成       | ✅ 可以           | ✅ 原生支持   |

建议：

- **快速验证/探索**：使用 agent-browser
- **完整测试套件**：使用 Playwright
- **两者可以互补使用**

## 参考链接

- [agent-browser GitHub](https://github.com/vercel-labs/agent-browser)
- [agent-browser 文档](https://agent-browser.dev)
