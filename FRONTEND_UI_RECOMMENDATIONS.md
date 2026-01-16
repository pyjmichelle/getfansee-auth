# 前端 UI 开发工具推荐 (2026)

基于对 GitHub 和 Claude Code 生态的调研，以下是最优秀的前端开发工具和最佳实践。

---

## 🏆 推荐的 Claude Code Skills

### 1. shadcn/ui + Tailwind 专家 ⭐⭐⭐⭐⭐

**GitHub**: `@huydepzai121/skill/shadcn-ui`

**特点**:

- 基于 Radix UI 的可访问性组件
- Tailwind CSS 样式系统
- 复制模式（完全可控，非 npm 依赖）
- 支持深色模式
- 响应式设计优先
- TypeScript 强类型

**使用场景**:

- 生产级 React 应用
- 需要高度定制的 UI
- 重视可访问性的项目

**当前项目兼容性**: ✅ 完美兼容（已使用 shadcn/ui + Tailwind）

---

### 2. Component Library Architecture

**GitHub**: `@Bbeierle12/Skill-MCP-Claude/component-library`

**特点**:

- 生产就绪的组件库
- 分类完整：表单、展示、反馈、导航、布局
- 自动变体生成（CVA）
- 深色模式和响应式
- 完整的 TypeScript 类型

**使用场景**:

- 构建完整组件库
- 需要标准化组件架构
- 团队协作项目

---

### 3. Frontend Engineering Patterns

**GitHub**: `@vasilyu1983/AI-Agents-public/software-frontend`

**特点**:

- Next.js 16 + React 19 最新版本
- 组件设计模式
- 主题系统和状态管理
- 性能优化指南
- shadcn/ui 集成

**使用场景**:

- Next.js 项目
- 需要架构指导
- 性能优化需求

---

### 4. Frontend Components (CoreyJa)

**GitHub**: `@coreyja/coreyja.com/frontend-components`

**特点**:

- 单一职责组件
- 清晰的 Props 接口
- 最小化本地状态
- 状态提升模式
- 可组合设计

**使用场景**:

- 学习组件设计模式
- 代码审查标准
- 重构现有组件

---

## 🔧 推荐的 MCP 工具

### 1. mcp-ui (核心) ⭐⭐⭐⭐⭐

**GitHub**: https://github.com/MCP-UI-Org/mcp-ui

**功能**:

- UI over MCP 协议
- React `<UIResourceRenderer />` 组件
- 支持多种资源类型：
  - `text/html` - HTML 内容
  - `text/uri-list` - 外部 URL
  - `application/vnd.mcp-ui.remote-dom` - 远程 DOM
- 安全的沙箱渲染（iframe）
- 双向事件处理

**安装**:

```bash
npm install @mcp-ui/client
```

**使用示例**:

```tsx
import { UIResourceRenderer } from "@mcp-ui/client";

<UIResourceRenderer
  resource={uiResource}
  onUIAction={(action) => {
    // 处理用户交互
  }}
/>;
```

**适用场景**:

- 动态 UI 生成
- AI 生成的界面
- 插件系统
- 可视化编辑器

---

### 2. fractal-mcp/sdk

**GitHub**: https://github.com/fractal-mcp/sdk

**功能**:

- 构建自定义 MCP Widget
- React 组件工具包
- 跨 iframe 消息传递
- Widget 预览和调试
- 打包和部署工具

**适用场景**:

- 构建自定义工具
- Widget 系统
- 插件开发

---

### 3. react-design-systems-mcp ⭐⭐⭐⭐

**GitHub**: https://github.com/agentience/react-design-systems-mcp

**功能**:

- 集成主流设计系统：
  - AWS Cloudscape
  - Material-UI (计划中)
  - Ant Design (计划中)
  - Chakra UI (计划中)
- 组件 Props 查询
- 使用指南和代码生成
- 组件验证

**适用场景**:

- 使用企业级设计系统
- 需要组件文档
- 代码生成自动化

---

## 💡 最佳实践建议

### 当前项目的最佳配置

基于你的项目已使用 **Next.js 14 + React + TypeScript + shadcn/ui + Tailwind**，推荐：

#### 1. 安装 shadcn/ui Skill

```bash
# 在 Claude Code 中
/plugin marketplace add huydepzai121/skill
/plugin install shadcn-ui
```

#### 2. 可选：安装 mcp-ui (如果需要动态 UI)

```bash
pnpm add @mcp-ui/client
```

#### 3. 创建项目级 Skill 文件

在 `.cursor/rules/` 或 `.claude-plugin/` 创建自定义规则：

```markdown
# UI Component Standards

## 技术栈

- Next.js 14 App Router
- React + TypeScript (Strict)
- Tailwind CSS (Mobile-first)
- shadcn/ui 组件
- Lucide Icons

## 组件设计原则

1. Server Components 优先
2. 使用 shadcn/ui 现有组件
3. 自定义组件放在 components/ 目录
4. 使用 CVA 处理变体
5. 确保可访问性 (ARIA)
6. 支持深色模式
7. 响应式设计 (mobile-first)

## 命名规范

- 组件文件：kebab-case (post-like-button.tsx)
- 组件名称：PascalCase (PostLikeButton)
- Props 接口：{ComponentName}Props

## 样式规范

- 使用 Tailwind utility classes
- 禁止内联样式
- 使用 cn() 合并类名
- 按逻辑排序类名：layout → spacing → colors → effects
```

---

## 🎯 针对你的项目的具体建议

### 已完成 ✅

- 基础 UI 组件 (shadcn/ui)
- 点赞按钮 (PostLikeButton)
- 标签选择器 (TagSelector)
- 搜索页面
- 工单页面

### 待完善建议 📋

#### 1. 评论组件

创建 `components/post-comments.tsx`：

- 评论列表
- 评论输入框
- 实时更新
- 分页加载

#### 2. 内容审核管理页面

完善 `app/admin/content-review/page.tsx`：

- 待审核列表
- 预览面板
- 批准/拒绝按钮
- 批量操作

#### 3. 标签展示

在帖子卡片中显示标签：

- Badge 组件
- 点击标签筛选
- 标签颜色分类

#### 4. 收益图表

`app/creator/studio/earnings/page.tsx`：

- Recharts 图表集成
- 数据可视化
- 导出功能

---

## 🔗 有用的资源链接

### Claude Code 相关

- [Claude Plugins 市场](https://claude-plugins.dev/skills)
- [Agent Skills 文档](https://agent-skills.md/)

### React UI 库

- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)

### MCP 相关

- [MCP-UI GitHub](https://github.com/MCP-UI-Org/mcp-ui)
- [Fractal MCP SDK](https://github.com/fractal-mcp/sdk)
- [React Design Systems MCP](https://github.com/agentience/react-design-systems-mcp)

### 设计系统

- [AWS Cloudscape](https://cloudscape.design/)
- [Material-UI](https://mui.com/)
- [Ant Design](https://ant.design/)

---

## 📝 下一步行动

1. **执行数据库迁移**

   ```bash
   # 在 Supabase SQL Editor 中按顺序执行
   019_likes_system.sql
   020_tags_system.sql
   021_content_review.sql
   022_notification_triggers.sql
   023_comments_support_refunds.sql
   ```

2. **测试新功能**

   ```bash
   pnpm dev
   # 测试点赞、搜索、工单提交
   ```

3. **可选：安装推荐的 Skills**

   ```bash
   /plugin install shadcn-ui
   /plugin install mcp-ui (如需要)
   ```

4. **完善前端 UI**
   - 评论组件
   - 管理后台 UI
   - 标签展示
   - 图表可视化

---

## 🎉 总结

你的项目现在已经具备：

- ✅ 完整的后端 API
- ✅ 数据库架构
- ✅ 基础前端页面
- ✅ 核心交互功能

推荐工具：

- **shadcn/ui Skill** - 最佳选择
- **mcp-ui** - 如需动态 UI
- **Planning with Files** - 已安装 ✅

准备好进入下一阶段开发！
