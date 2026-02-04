# 本项目用 React 写前端组件指南

基于现有代码库与 Cursor 技能/规则的调研总结。

---

## 1. 技术栈（项目已定）

| 层级    | 技术                                                         |
| ------- | ------------------------------------------------------------ |
| 框架    | Next.js 14+（App Router）                                    |
| 语言    | TypeScript（严格模式）                                       |
| UI 基础 | **shadcn/ui**（基于 Radix UI），位于 `components/ui/`        |
| 样式    | **Tailwind CSS**（Mobile-first）                             |
| 图标    | **Lucide React**                                             |
| 状态    | React Hooks + Server Actions（必要时 React Query / Zustand） |

---

## 2. 核心原则（必须遵守）

### 2.1 Server Components 优先

- **默认**：不写 `"use client"`，组件是 Server Component，可 async、可直接读库/API。
- **仅在有交互时**加 `"use client"`：onClick、useState、useEffect、浏览器 API、第三方 client 库等。
- 页面结构建议：**Page 用 Server Component 拉数据 → 把数据通过 props 传给 Client Component 渲染/交互**。

示例（来自 `app/home/page.tsx`）：

```tsx
// app/home/page.tsx — Server Component，无 "use client"
export default async function HomePage() {
  const [user, _] = await Promise.all([getCachedUser(), ensureProfile()]);
  const posts = await getCachedFeed(20);
  // 并行检查 paywall 等…
  return (
    <HomeFeedClient
      initialPosts={posts}
      initialUnlockedStates={unlockedStates}
      currentUserId={user.id}
      userProfile={…}
    />
  );
}
```

### 2.2 使用现有 shadcn/ui，用 `cn()` 拼样式

- **基础 UI**：一律用 `@/components/ui/` 里已有组件（Button、Card、Input、Dialog、Badge、Avatar 等），不要重复造轮子。
- **类名合并**：用 `cn()`（来自 `@/lib/utils`），避免手写字符串拼接。

```tsx
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

<div className={cn("flex gap-4", isActive && "bg-muted", className)} />
<Button className={cn("rounded-xl", className)} />
```

### 2.3 类型与规范（来自 .cursorrules）

- **禁止 `any`**：用明确类型或 `unknown` + 收窄。
- **样式**：Tailwind 工具类为主，避免 inline style；类名按布局 → 尺寸 → 间距 → 颜色 → 效果排序。
- **错误与反馈**：Server Actions 返回 `{ success, data?, error? }`；toast 用 `sonner`（`toast.success` / `toast.error`）。

---

## 3. 组件放在哪、怎么命名

| 类型                         | 位置                      | 命名                                                                         |
| ---------------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| 通用 UI（shadcn 或基础原子） | `components/ui/`          | 已有：`button.tsx`, `card.tsx` 等                                            |
| 业务/功能组件                | `components/`             | `kebab-case.tsx`，如 `empty-state.tsx`, `stat-card.tsx`, `paywall-modal.tsx` |
| 仅某页用的组件               | `app/[route]/components/` | 如 `HomeFeedClient.tsx`                                                      |

- 组件名：**PascalCase**（如 `EmptyState`, `StatCard`）。
- Props 接口：**`{ComponentName}Props`**（如 `EmptyStateProps`）。

---

## 4. 写一个新业务组件的模板

```tsx
"use client"; // 仅在有交互时加

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MyFeatureCardProps {
  title: string;
  onAction?: () => void;
  className?: string;
}

export function MyFeatureCard({ title, onAction, className }: MyFeatureCardProps) {
  return (
    <div className={cn("rounded-xl border p-4", className)}>
      <h3 className="text-lg font-semibold">{title}</h3>
      {onAction && (
        <Button variant="outline" onClick={onAction}>
          Action
        </Button>
      )}
    </div>
  );
}
```

要点：

- Props 用 TypeScript 接口，并支持 `className` 便于外层覆盖样式。
- 优先用 `components/ui` 的 Button/Card/Input 等，用 `cn()` 拼类名。

---

## 5. 与项目一致的写法示例（来自现有组件）

### EmptyState（`components/empty-state.tsx`）

- `"use client"` + 从 `@/components/ui/button` 引入、用 `cn()`。
- Props：`icon`, `title`, `description?`, `action?`（含 `label`, `href?` 或 `onClick?`），以及 `...HTMLAttributes` 和 `className`。

### StatCard（`components/stat-card.tsx`）

- 用 `Card`, `CardHeader`, `CardTitle`, `CardContent`；图标用 Lucide（`TrendingUp`, `TrendingDown`）；趋势用 `cn()` 做条件样式；`aria-hidden` 给装饰性图标。

### Button（`components/ui/button.tsx`）

- 用 **CVA**（`class-variance-authority`）定义 `buttonVariants`，再在组件里 `cn(buttonVariants({ variant, size, className }))`；支持 `asChild`（Radix Slot）用于渲染成 `<Link>` 等。

---

## 6. 性能与最佳实践（来自 react-best-practices.skill）

- **避免瀑布请求**：在 Server Component 里用 `Promise.all` / 并行 fetch，或 `React.cache()` 做同请求内去重。
- **大组件**：用 `next/dynamic` 做按需加载，配 `loading`（如 `<Skeleton />`）。
- **图片**：用 `next/image`，设 `width`/`height` 或 `fill`。
- **重计算/大列表**：用 `useMemo`/`useCallback` 或 `memo`，按需使用；避免在 Server Component 里用 hooks。

---

## 7. 可访问性（A11Y）

- 语义化标签（如 `button`、`nav`、`main`）。
- 交互控件：`aria-label`、`aria-pressed` 等；装饰性图标加 `aria-hidden="true"`。
- 仅图标按钮：内层可加 `<span className="sr-only">描述</span>`。
- 最小点击区域建议约 44×44px（如 `min-h-[44px] min-w-[44px]`）。

---

## 8. 表单（需要时）

- 使用 **React Hook Form + Zod**：`useForm` + `zodResolver(schema)`，校验与类型一致。
- 表单 UI 用 `components/ui` 的 Input、Textarea、Label、Button 等。

---

## 9. 相关文件一览

| 用途                     | 路径                                           |
| ------------------------ | ---------------------------------------------- |
| 样式工具                 | `lib/utils.ts`（`cn`）                         |
| shadcn 规范              | `.cursor/skills/shadcn-ui.skill.md`            |
| React/Next 性能          | `.cursor/skills/react-best-practices.skill.md` |
| 项目规范                 | `.cursor/rules/.cursorrules`                   |
| GitHub/PR 与 Cursor 协同 | `.cursor/rules/github-cursor-sync.mdc`         |

---

## 10. 小结

- **用 React 写前端组件** = 在 Next.js App Router 下，**默认 Server Component，仅交互部分用 `"use client"`**；UI 一律用 **shadcn/ui + Tailwind + `cn()`**，类型用 TypeScript 严格定义，遵循现有 `components/` 与 `components/ui/` 的命名与结构。
- 写新组件时优先参考 `components/empty-state.tsx`、`components/stat-card.tsx` 和 `components/ui/button.tsx`，并对照 `.cursor/skills/shadcn-ui.skill.md` 与 `.cursor/skills/react-best-practices.skill.md` 即可与项目风格一致。
