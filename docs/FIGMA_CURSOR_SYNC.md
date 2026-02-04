# Figma 与 Cursor 协同、接入现有前端框架

调研结论：**可以**在现有前端框架（Next.js + React + shadcn/ui + Tailwind）下接入 Figma 设计到代码；推荐用 **Figma MCP + Cursor** 直接在本项目中生成/修改组件，Figma Make 可作为补充（在 Figma 里快速出稿再复制到 Cursor 按规范改）。

---

## 1. 两种方式对比

| 方式                   | 在哪里用                                  | 与 Cursor 的关系                   | 输出质量                              | 是否直接进项目                           |
| ---------------------- | ----------------------------------------- | ---------------------------------- | ------------------------------------- | ---------------------------------------- |
| **Figma Make**         | Figma 内（选 frame → Send to Figma Make） | 无直接打通，需复制代码到 Cursor    | 中等（偏静态 HTML/CSS 或通用 React）  | 否，需手动粘贴并改一轮                   |
| **Figma MCP + Cursor** | Cursor 内（连 Figma 桌面/API）            | MCP 打通，Cursor 直接读 Figma 文件 | 高（读 layers/variables/auto layout） | 是，可直接生成到 `components/` 或 `app/` |

- **Figma Make**：适合在 Figma 里快速出静态稿或初版代码，再**复制到 Cursor** 后按本项目规范（shadcn、`cn()`、目录）改一版。
- **Figma MCP + Cursor**：适合「设计在 Figma、代码在 Cursor」的闭环：在 Cursor 里贴 Figma 链接或依赖选中层，让 AI 按**本项目栈**生成/改代码，直接落入当前仓库。

---

## 2. 推荐：Figma MCP + Cursor（接入现有框架）

### 2.1 为什么能接入现有前端框架

- Cursor 生成代码时，会参考**当前打开的项目**（文件结构、已有组件、规则）。
- 在 **prompt 里明确项目栈和规范**，生成的组件就会贴合：
  - **Next.js 14 App Router**
  - **React + TypeScript**
  - **Tailwind CSS**，类名用 **`cn()`**（`@/lib/utils`）
  - **shadcn/ui**：用 `@/components/ui/` 的 Button、Card、Input 等，不重复造轮子
  - **Server Component 优先**：仅交互部分 `"use client"`
  - 组件位置：业务组件 `components/`，页面专属 `app/[route]/components/`

这样生成的代码可以直接放在现有前端框架下，无需大改。

### 2.2 Cursor 中配置 Figma MCP（桌面版）

1. **Figma 桌面端**
   - 安装并打开 [Figma Desktop](https://help.figma.com/hc/en-us/articles/5601429983767)。
   - 打开一个 Design 文件，画布上不选中任何对象时，点工具栏切换到 **Dev Mode**（Shift+D）。
   - 在右侧边栏找到 **MCP server**，打开开关。
   - 底部会提示“已启用并运行”，点 **Copy URL**（一般为 `http://127.0.0.1:3845/mcp`）。

2. **Cursor**
   - 打开命令面板：macOS `Shift+Command+P` / Windows `Shift+Ctrl+P`。
   - 搜 **Cursor settings** → 打开 **MCP** 标签。
   - 点 **Add Custom MCP**，填入并保存：

```json
{
  "mcpServers": {
    "figma-desktop": {
      "url": "http://127.0.0.1:3845/mcp"
    }
  }
}
```

3. 保存后，Cursor 中会出现 Figma MCP 工具，即可使用。

（若用浏览器版 Figma，可用 [Figma 官方 Remote MCP](https://help.figma.com/hc/en-us/articles/35281350665623)，用 Personal Access Token 配置，此处不展开。）

### 2.3 使用方式（接入本项目约定）

1. 在 **Figma 桌面端**选中要出码的 frame 或组件（MCP 是 selection-based）。
2. 在 **Cursor** 里用 Composer/Agent，粘贴 **Figma 链接**（或说明“用当前 Figma 选中层”），并加上**项目栈与规范**的 prompt，例如：

```
用当前 Figma 选中的设计，在本项目中实现一个 React 组件。要求：
- 技术栈：Next.js 14 App Router、React、TypeScript、Tailwind、shadcn/ui
- 使用 @/components/ui/ 的 Button/Card/Input 等，样式用 cn() 合并类名（@/lib/utils）
- 若无交互则用 Server Component；有 onClick/useState 再 "use client"
- 业务组件放在 components/，Props 用 TypeScript 接口，支持 className
- 参考项目规范：docs/REACT_FRONTEND_COMPONENTS.md 和 .cursor/skills/shadcn-ui.skill.md
```

3. Cursor 会读取 Figma 选中层并生成/修改代码，放到 `components/` 或你指定的 `app/.../components/`，与现有前端框架一致。

### 2.4 Figma 文件侧建议（提高生成质量）

- 使用 **Auto Layout**，避免到处绝对定位。
- 用 **Variables** 管理间距、圆角、颜色（便于对应 Tailwind / 设计 token）。
- 颜色、字体尽量用 **Design tokens**，便于和 `globals.css` / shadcn 主题对齐。

---

## 3. 备选：Figma Make 再进 Cursor

若你主要用 **Figma Make** 在 Figma 里出稿：

1. 在 Figma 中选 frame → **Send to Figma Make**，生成 HTML/CSS 或 React。
2. **复制生成的代码**，在 Cursor 里新建或粘贴到对应文件。
3. **按本项目规范改一轮**：
   - 用 shadcn 的 Button/Card/Input 等替换原生标签或自定义组件；
   - 用 Tailwind + `cn()` 统一类名；
   - 需要交互的加 `"use client"`，其余保持 Server Component；
   - 放到 `components/` 或 `app/[route]/components/`，并补全 TypeScript 类型。

这样也算「接入现有前端框架」，只是多一步“从 Figma Make 复制 + 在 Cursor 里按规范改”。

---

## 4. 小结

| 问题                            | 结论                                                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Figma Make 怎么跟 Cursor 协同？ | Figma Make 在 Figma 里用，无直接 API 连 Cursor；协同方式 = Make 出码 → **复制到 Cursor** → 按项目规范改。                                                              |
| 能否在现有前端框架下接入？      | **可以**。用 **Figma MCP + Cursor** 时，在 prompt 里写明 Next.js + React + Tailwind + shadcn/ui + `cn()` + 项目规范，生成的组件可直接落在当前框架内。                  |
| 哪个好一点？                    | **更推荐 Figma MCP + Cursor**：代码直接进仓库、可对话迭代、能读 Figma 结构和变量，更贴合现有技术栈。Figma Make 适合在 Figma 内快速出静态稿，再复制到 Cursor 做规范化。 |

---

## 5. 相关文档

- 本项目 React 组件规范：[docs/REACT_FRONTEND_COMPONENTS.md](REACT_FRONTEND_COMPONENTS.md)
- shadcn/ui 技能：[.cursor/skills/shadcn-ui.skill.md](../.cursor/skills/shadcn-ui.skill.md)
- Figma 桌面 MCP 设置：[Figma Help – Desktop MCP server](https://help.figma.com/hc/en-us/articles/35281186390679)
- Figma 远程 MCP（Token）：[Figma Help – Remote MCP server](https://help.figma.com/hc/en-us/articles/35281350665623)
