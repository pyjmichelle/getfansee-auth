# UI 样式指南

## 目录

1. [设计原则](#设计原则)
2. [颜色系统](#颜色系统)
3. [排版系统](#排版系统)
4. [间距系统](#间距系统)
5. [组件规范](#组件规范)
6. [响应式设计](#响应式设计)
7. [可访问性](#可访问性)
8. [最佳实践](#最佳实践)

---

## 设计原则

### 1. 一致性优先

- 使用 shadcn/ui 组件库作为基础
- 统一使用 Tailwind CSS 语义化颜色
- 保持视觉语言的一致性

### 2. 可访问性第一

- 所有交互元素最小触摸目标 44x44px
- 提供清晰的焦点指示器
- 使用语义化 HTML 和 ARIA 属性

### 3. 移动端优先

- 从小屏幕开始设计
- 渐进增强到大屏幕
- 确保核心功能在所有设备上可用

### 4. 性能优化

- 使用 Skeleton 改进感知性能
- 懒加载非关键组件
- 优化图片和资源加载

---

## 颜色系统

### 主色调

使用 Tailwind CSS 语义化颜色，支持自动暗色模式：

```tsx
// ✅ 正确 - 使用语义化颜色
<div className="bg-background text-foreground">
<div className="bg-card border-border">
<Button variant="destructive">Delete</Button>

// ❌ 错误 - 硬编码颜色
<div className="bg-[#050505] text-[#E5E5E5]">
<div className="bg-[#0D0D0D] border-[#1F1F1F]">
```

### 颜色映射表

| 用途     | Tailwind 类                          | 描述          |
| -------- | ------------------------------------ | ------------- |
| 页面背景 | `bg-background`                      | 主背景色      |
| 卡片背景 | `bg-card`                            | 卡片/面板背景 |
| 主要文本 | `text-foreground`                    | 正文颜色      |
| 次要文本 | `text-muted-foreground`              | 辅助文本      |
| 边框     | `border-border`                      | 分隔线/边框   |
| 主要操作 | `bg-primary`                         | CTA 按钮      |
| 危险操作 | `bg-destructive`                     | 删除/警告     |
| 成功状态 | `text-green-600 dark:text-green-400` | 成功提示      |
| 警告状态 | `text-amber-600 dark:text-amber-400` | 警告提示      |
| 禁用状态 | `bg-muted`                           | 禁用元素      |
| 悬停状态 | `hover:bg-accent`                    | 悬停效果      |

### 渐变色

```tsx
// 主要渐变（用于 CTA）
className="bg-gradient-to-r from-primary to-purple-600"

// 或使用 variant
<Button variant="gradient">Action</Button>
```

---

## 排版系统

### 字体大小

| 用途     | Tailwind 类             | 大小 |
| -------- | ----------------------- | ---- |
| 页面标题 | `text-3xl font-bold`    | 30px |
| 章节标题 | `text-2xl font-bold`    | 24px |
| 卡片标题 | `text-xl font-semibold` | 20px |
| 子标题   | `text-lg font-semibold` | 18px |
| 正文     | `text-base`             | 16px |
| 小字     | `text-sm`               | 14px |
| 辅助文本 | `text-xs`               | 12px |

### 字重

- `font-normal` (400) - 正文
- `font-medium` (500) - 强调
- `font-semibold` (600) - 小标题
- `font-bold` (700) - 大标题

### 行高

- 标题: `leading-tight`
- 正文: `leading-normal`
- 宽松: `leading-relaxed`

### 示例

```tsx
<h1 className="text-3xl font-bold text-foreground mb-2">
  Page Title
</h1>
<p className="text-muted-foreground">
  Description text
</p>
```

---

## 间距系统

### 间距单位

使用 Tailwind 的 4px 基础单位系统：

| 类名    | 值   | 用途     |
| ------- | ---- | -------- |
| `gap-2` | 8px  | 紧密元素 |
| `gap-3` | 12px | 相关元素 |
| `gap-4` | 16px | 标准间距 |
| `gap-6` | 24px | 组间距   |
| `gap-8` | 32px | 章节间距 |

### 内边距

```tsx
// 按钮
className = "px-4 py-2"; // 小按钮
className = "px-6 py-3"; // 大按钮

// 卡片
className = "p-6"; // 标准卡片

// 页面容器
className = "px-4 py-6"; // 移动端
className = "px-4 md:px-8 py-8 md:py-12"; // 响应式
```

### 外边距

```tsx
// 垂直间距
className = "space-y-4"; // 子元素间距
className = "mb-6"; // 底部间距
className = "mt-8"; // 顶部间距

// 水平间距
className = "space-x-3"; // 内联元素
```

---

## 组件规范

### 按钮

#### 尺寸

```tsx
<Button size="sm">Small</Button>  // h-9
<Button size="default">Default</Button>  // h-10
<Button size="lg">Large</Button>  // h-11

// 触摸友好（移动端）
<Button className="min-h-[44px]">Touch Target</Button>
```

#### 变体

```tsx
<Button variant="default">Primary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Secondary</Button>
<Button variant="ghost">Tertiary</Button>
<Button variant="gradient">CTA</Button>
```

#### 圆角

```tsx
<Button className="rounded-xl">Rounded Button</Button>
```

### 卡片

```tsx
<Card className="rounded-2xl border-border">
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>{/* Content */}</CardContent>
</Card>
```

### 输入框

```tsx
<Label htmlFor="email">Email</Label>
<Input
  id="email"
  type="email"
  placeholder="Enter your email"
  className="h-11 rounded-xl"
  aria-label="Email address"
/>
```

### 头像

```tsx
<Avatar className="h-12 w-12 ring-2 ring-border">
  <AvatarImage src={url} alt="User name" />
  <AvatarFallback className="bg-primary/10 text-primary">UN</AvatarFallback>
</Avatar>
```

### Badge

```tsx
<Badge variant="default">Active</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="outline">Draft</Badge>
<Badge variant="destructive">Error</Badge>
```

---

## 响应式设计

### 断点

```tsx
// Tailwind 断点
sm: 640px   // 小屏幕平板
md: 768px   // 平板
lg: 1024px  // 桌面
xl: 1280px  // 大桌面
2xl: 1536px // 超大桌面
```

### 响应式模式

#### 1. 移动端优先

```tsx
<div className="flex flex-col md:flex-row gap-4">{/* 移动端垂直，桌面端水平 */}</div>
```

#### 2. 隐藏/显示

```tsx
<span className="hidden md:inline">Desktop Only</span>
<span className="md:hidden">Mobile Only</span>
```

#### 3. 网格布局

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{/* 响应式网格 */}</div>
```

#### 4. 按钮宽度

```tsx
<Button className="w-full sm:w-auto">Responsive Button</Button>
```

---

## 可访问性

### ARIA 属性

#### 装饰性图标

```tsx
<Search className="w-5 h-5" aria-hidden="true" />
```

#### 交互按钮

```tsx
<Button aria-label="Search for creators">
  <Search className="w-5 h-5" aria-hidden="true" />
</Button>
```

#### 表单字段

```tsx
<Label htmlFor="username">Username</Label>
<Input
  id="username"
  aria-label="Enter your username"
  aria-describedby="username-hint"
/>
<p id="username-hint" className="text-xs text-muted-foreground">
  Must be 2-20 characters
</p>
```

#### 动态内容

```tsx
<div role="status" aria-live="polite">
  <Loader2 className="animate-spin" aria-hidden="true" />
  <span className="sr-only">Loading...</span>
</div>
```

#### 错误提示

```tsx
<Alert variant="destructive" role="alert">
  <AlertCircle className="h-4 w-4" aria-hidden="true" />
  <AlertDescription>Error message</AlertDescription>
</Alert>
```

### 触摸目标

所有交互元素最小尺寸 44x44px：

```tsx
// ✅ 正确
<Button className="min-h-[44px] min-w-[44px]">
  <Icon />
</Button>

// ❌ 错误
<button className="p-1">
  <Icon />
</button>
```

### 键盘导航

确保所有功能可通过键盘访问：

- Tab: 在元素间导航
- Enter/Space: 激活按钮
- Escape: 关闭模态框
- Arrow keys: 在列表中导航

### 屏幕阅读器

```tsx
// 隐藏视觉内容，保留给屏幕阅读器
<span className="sr-only">Screen reader only text</span>

// 隐藏装饰性内容
<Icon aria-hidden="true" />
```

---

## 最佳实践

### 1. 组件命名

```tsx
// ✅ 清晰的组件名
<LoadingState />
<ErrorState />
<EmptyState />
<StatCard />

// ❌ 模糊的命名
<Loader />
<Error />
<Empty />
<Card />
```

### 2. 类名排序

按照功能分组排序：

```tsx
className="
  // 布局
  flex items-center justify-between
  // 尺寸
  w-full h-12
  // 间距
  px-4 py-2 gap-3
  // 外观
  bg-card border border-border rounded-xl
  // 文本
  text-foreground font-semibold
  // 交互
  hover:bg-accent transition-colors
  // 响应式
  md:w-auto lg:px-6
"
```

### 3. 条件类名

使用 `cn()` 工具函数：

```tsx
import { cn } from "@/lib/utils";

<Button
  className={cn(
    "rounded-xl",
    isActive && "bg-primary",
    isDisabled && "opacity-50 cursor-not-allowed"
  )}
/>;
```

### 4. 组件组合

```tsx
// ✅ 使用组合
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// ❌ 平铺结构
<div className="card">
  <div className="card-header">
    <h3>Title</h3>
  </div>
  <div className="card-content">Content</div>
</div>
```

### 5. 加载状态

```tsx
// ✅ 使用专用组件
{
  isLoading ? <LoadingState type="spinner" text="Loading..." /> : <Content />;
}

// ❌ 简单文本
{
  isLoading ? <p>Loading...</p> : <Content />;
}
```

### 6. 空状态

```tsx
// ✅ 友好的空状态
{
  items.length === 0 ? (
    <EmptyState
      icon={<FileText className="w-8 h-8" />}
      title="No items yet"
      description="Get started by creating your first item"
      action={{ label: "Create Item", href: "/create" }}
    />
  ) : (
    <ItemList items={items} />
  );
}

// ❌ 简单提示
{
  items.length === 0 ? <p>No items</p> : <ItemList />;
}
```

### 7. 错误处理

```tsx
// ✅ 友好的错误提示
{
  error && (
    <ErrorState
      title="Failed to load"
      message={error.message}
      retry={() => refetch()}
      variant="centered"
    />
  );
}

// ❌ 原始错误
{
  error && <div>{error.message}</div>;
}
```

---

## 组件使用示例

### 完整的表单示例

```tsx
<Card className="rounded-2xl border-border">
  <CardHeader>
    <CardTitle>Profile Settings</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="name">Display Name</Label>
      <Input
        id="name"
        type="text"
        placeholder="Enter your name"
        className="h-11 rounded-xl"
        aria-label="Display name"
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="bio">Bio</Label>
      <Textarea
        id="bio"
        placeholder="Tell us about yourself"
        className="min-h-[100px] rounded-xl"
        maxLength={500}
      />
      <p className="text-xs text-muted-foreground text-right">{bio.length}/500 characters</p>
    </div>

    <div className="flex gap-3">
      <Button
        variant="gradient"
        className="flex-1 rounded-xl min-h-[44px]"
        onClick={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
            Saving...
          </>
        ) : (
          "Save Changes"
        )}
      </Button>
      <Button variant="outline" className="flex-1 rounded-xl min-h-[44px]" onClick={handleCancel}>
        Cancel
      </Button>
    </div>
  </CardContent>
</Card>
```

### 完整的列表示例

```tsx
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h2 className="text-xl font-semibold">Recent Posts</h2>
    <Button asChild variant="ghost" size="sm">
      <Link href="/posts">View All</Link>
    </Button>
  </div>

  {isLoading ? (
    <LoadingState type="skeleton" />
  ) : error ? (
    <ErrorState title="Failed to load posts" message={error.message} retry={() => refetch()} />
  ) : posts.length === 0 ? (
    <EmptyState
      icon={<FileText className="w-8 h-8 text-muted-foreground" />}
      title="No posts yet"
      description="Start creating content to see it here"
      action={{ label: "Create Post", href: "/create" }}
    />
  ) : (
    posts.map((post) => (
      <Card key={post.id} className="rounded-2xl border-border">
        <CardContent className="p-6">{/* Post content */}</CardContent>
      </Card>
    ))
  )}
</div>
```

---

## 检查清单

在提交代码前，确保：

- [ ] 使用语义化颜色（无硬编码 hex 值）
- [ ] 所有交互元素最小 44x44px
- [ ] 装饰性图标添加 `aria-hidden="true"`
- [ ] 交互按钮添加 `aria-label`
- [ ] 表单字段关联 `<label>` 或 `aria-label`
- [ ] 动态内容添加 `aria-live`
- [ ] 使用统一的圆角（`rounded-xl` 或 `rounded-2xl`）
- [ ] 移动端优先的响应式设计
- [ ] 使用 LoadingState、ErrorState、EmptyState 组件
- [ ] 类名按功能分组排序

---

**版本**: 1.0  
**最后更新**: 2026-01-11  
**维护者**: Development Team
