# shadcn/ui + Tailwind CSS Skill

**Version**: 1.0  
**Purpose**: 指导 AI 使用 shadcn/ui 组件库和 Tailwind CSS 构建高质量 React UI

---

## 技术栈

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (Strict mode)
- **UI Library**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **State**: React Hooks + Server Actions

---

## 核心原则

### 1. Server Components 优先

- 默认使用 Server Components
- 只在需要交互时使用 `"use client"`
- 状态管理尽量在服务端完成

### 2. 使用现有 shadcn/ui 组件

项目已安装的组件（位于 `components/ui/`）：

- Button, Card, Input, Textarea, Label
- Dialog, Sheet, Tabs
- Badge, Avatar, Separator
- Toast (via Sonner)

**规则**: 优先使用现有组件，避免重复创建

### 3. 组件变体使用 CVA

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva("inline-flex items-center justify-center rounded-md", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      outline: "border border-input bg-background",
      ghost: "hover:bg-accent hover:text-accent-foreground",
    },
    size: {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
```

### 4. 样式工具函数

使用 `cn()` 合并类名：

```typescript
import { cn } from "@/lib/utils";

<div className={cn("base-classes", conditional && "extra-classes")} />
```

---

## 组件设计模式

### 文件命名

- 组件文件：`kebab-case.tsx` (例如: `post-like-button.tsx`)
- 组件名称：`PascalCase` (例如: `PostLikeButton`)
- Props 接口：`{ComponentName}Props`

### 组件结构

```typescript
"use client"; // 仅在需要时添加

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PostLikeButtonProps {
  postId: string;
  initialLikesCount?: number;
  className?: string;
}

export function PostLikeButton({
  postId,
  initialLikesCount = 0,
  className,
}: PostLikeButtonProps) {
  // 逻辑实现

  return (
    <Button
      className={cn("gap-2", className)}
      // props
    >
      {/* 内容 */}
    </Button>
  );
}
```

### Props 设计

- 使用 TypeScript 接口定义 Props
- 提供合理的默认值
- 支持 `className` prop 用于样式覆盖
- 使用可选链和空值合并

---

## Tailwind CSS 规范

### 类名排序

按逻辑分组排序：

1. 布局：`flex`, `grid`, `block`
2. 定位：`relative`, `absolute`
3. 尺寸：`w-`, `h-`, `min-`, `max-`
4. 间距：`m-`, `p-`, `gap-`
5. 颜色：`bg-`, `text-`, `border-`
6. 效果：`shadow-`, `rounded-`, `opacity-`
7. 交互：`hover:`, `focus:`, `active:`
8. 响应式：`sm:`, `md:`, `lg:`

### 示例

```tsx
<div className="flex items-center justify-between w-full p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
```

### 响应式设计

- Mobile-first 方法
- 断点：`sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`
- 最小点击区域：44x44px

```tsx
<Button className="w-full sm:w-auto min-h-[44px] min-w-[44px]">
```

---

## 可访问性 (A11Y)

### 必须遵守

1. **语义化 HTML**: 使用正确的标签
2. **ARIA 属性**: `aria-label`, `aria-describedby`
3. **键盘导航**: 支持 Tab, Enter, Escape
4. **焦点管理**: 明确的焦点指示器
5. **颜色对比**: WCAG AA 标准

### 示例

```tsx
<Button aria-label="Like this post" aria-pressed={isLiked} disabled={isLoading}>
  <Heart aria-hidden="true" />
  <span className="sr-only">Like</span>
</Button>
```

---

## 深色模式支持

使用 Tailwind 的 `dark:` 前缀：

```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
```

CSS 变量（在 `globals.css` 中定义）：

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

---

## 表单处理

### 使用 React Hook Form + Zod

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const formSchema = z.object({
  email: z.string().email(),
  message: z.string().min(10),
});

type FormData = z.infer<typeof formSchema>;

export function ContactForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  // 实现
}
```

---

## 性能优化

### 1. 代码分割

```typescript
import dynamic from "next/dynamic";

const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <Skeleton />,
});
```

### 2. 图片优化

```tsx
import Image from "next/image";

<Image src="/avatar.jpg" alt="User avatar" width={40} height={40} className="rounded-full" />;
```

### 3. Memoization

```typescript
import { memo, useMemo, useCallback } from "react";

export const ExpensiveComponent = memo(function ExpensiveComponent({ data }) {
  const processedData = useMemo(() => processData(data), [data]);
  return <div>{processedData}</div>;
});
```

---

## 错误处理

### 1. 错误边界

```typescript
"use client";

export function ErrorBoundary({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p className="text-muted-foreground">{error.message}</p>
    </div>
  );
}
```

### 2. Toast 通知

```typescript
import { toast } from "sonner";

toast.success("Post liked!");
toast.error("Failed to like post");
```

---

## 常用模式

### 1. 加载状态

```tsx
{
  isLoading ? <Skeleton className="h-10 w-full" /> : <Content />;
}
```

### 2. 空状态

```tsx
{
  items.length === 0 ? (
    <div className="text-center py-12">
      <p className="text-muted-foreground">No items found</p>
    </div>
  ) : (
    <ItemList items={items} />
  );
}
```

### 3. 条件渲染

```tsx
{
  user && <Button onClick={handleAction}>Action</Button>;
}
```

---

## 项目特定规则

### 当前项目已有组件

- `PostLikeButton` - 点赞按钮（乐观更新）
- `TagSelector` - 标签选择器
- `NavHeader` - 导航头部
- `HomeFeedClient` - 主页 Feed

### 新组件创建位置

- 通用 UI: `components/ui/`
- 业务组件: `components/`
- 页面组件: `app/[route]/components/`

### Hooks 位置

- 通用 Hooks: `hooks/`
- 业务逻辑: `lib/`

---

## 示例：创建新组件

```typescript
// components/post-comment-list.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: {
    display_name: string;
    avatar_url?: string;
  };
}

interface PostCommentListProps {
  postId: string;
  initialComments?: Comment[];
  canComment: boolean;
  className?: string;
}

export function PostCommentList({
  postId,
  initialComments = [],
  canComment,
  className,
}: PostCommentListProps) {
  const [comments, setComments] = useState(initialComments);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });

      if (!res.ok) throw new Error("Failed to post comment");

      const data = await res.json();
      setComments([data.comment, ...comments]);
      setNewComment("");
      toast.success("Comment posted!");
    } catch (err) {
      toast.error("Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {canComment && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="min-h-[80px]"
          />
          <Button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
          >
            {isSubmitting ? "Posting..." : "Post Comment"}
          </Button>
        </form>
      )}

      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <Avatar>
              {comment.user.avatar_url && (
                <img src={comment.user.avatar_url} alt="" />
              )}
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {comment.user.display_name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 text-sm">{comment.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 总结

遵循这些规则可以确保：

- ✅ 代码一致性和可维护性
- ✅ 优秀的用户体验
- ✅ 可访问性标准
- ✅ 性能优化
- ✅ 类型安全

**记住**: 优先使用现有组件，保持简洁，注重可访问性！
