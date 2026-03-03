# GetFanSee 像素级设计规范

> 基于 Figma Make 导出设计稿提取，所有页面必须严格遵循此规范。

---

## 1. 基础设置

| 属性         | 值      | 说明                       |
| ------------ | ------- | -------------------------- |
| 基础字号     | 14px    | `html { font-size: 14px }` |
| 间距基准     | 8px     | 所有 spacing 为 4 的倍数   |
| 最小点击区域 | 44×44px | 移动端 tap target          |
| 滚动条宽度   | 8px     | 自定义滚动条               |

---

## 2. 间距 Scale (px)

| Token    | px  | Tailwind | 用途         |
| -------- | --- | -------- | ------------ |
| space-1  | 4   | p-1      | 最小间距     |
| space-2  | 8   | p-2      | 紧凑间距     |
| space-3  | 12  | p-3      | 内容区内边距 |
| space-4  | 16  | p-4      | 标准内边距   |
| space-5  | 20  | p-5      | 区块间距     |
| space-6  | 24  | p-6      | 卡片内边距   |
| space-8  | 32  | p-8      | 大区块       |
| space-10 | 40  | p-10     | Hero 内边距  |
| space-12 | 48  | p-12     | 页面顶部留白 |
| space-16 | 64  | p-16     | 特大留白     |
| space-20 | 80  | p-20     | 底部导航留白 |

---

## 3. 圆角 (px)

| Token       | px   | Tailwind       | 用途           |
| ----------- | ---- | -------------- | -------------- |
| radius-sm   | 8    | rounded-lg     | 小元素、标签   |
| radius-md   | 12   | rounded-xl     | 按钮、输入框   |
| radius-lg   | 16   | rounded-2xl    | 卡片           |
| radius-xl   | 24   | rounded-3xl    | 大卡片、弹窗   |
| radius-2xl  | 32   | rounded-[32px] | 特大容器       |
| radius-full | 9999 | rounded-full   | 头像、药丸按钮 |

---

## 4. 字号 (px，基于 14px rem)

| Token     | px  | 行高 | 字重    | 用途             |
| --------- | --- | ---- | ------- | ---------------- |
| text-xs   | 12  | 1.5  | 500     | 辅助信息、时间戳 |
| text-sm   | 14  | 1.5  | 500-600 | 正文、标签       |
| text-base | 16  | 1.6  | 400     | 段落、输入       |
| text-lg   | 18  | 1.5  | 500     | 小标题           |
| text-xl   | 22  | 1.4  | 500     | 区块标题         |
| text-2xl  | 28  | 1.3  | 600     | 页面标题         |
| text-3xl  | 36  | 1.2  | 600     | 大标题           |
| text-4xl  | 48  | 1.1  | 700     | Hero 标题        |

---

## 5. 图标尺寸 (px)

| 场景         | 尺寸 | 说明                 |
| ------------ | ---- | -------------------- |
| 导航项       | 18   | 顶部导航、菜单       |
| 底部导航     | 22   | 移动端底部           |
| 内容卡片操作 | 20   | Like、Comment、Share |
| Tip 按钮     | 18   | 金色 Tip 图标        |
| 锁定图标     | 28   | 锁定遮罩主图标       |
| 紧迫感标签   | 14   | 24HR EXCLUSIVE       |
| 更多菜单     | 18   | MoreHorizontal       |

---

## 6. 组件像素规范

### 6.1 ContentCard

| 区域       | 属性    | 值                       |
| ---------- | ------- | ------------------------ |
| 创作者头部 | padding | 12px 10px (px-3 py-2.5)  |
| 创作者头部 | gap     | 10px (gap-2.5)           |
| 头像       | size    | 36×36px (w-9 h-9)        |
| 正文区     | padding | 12px 10px (px-3 pb-2.5)  |
| 操作栏     | padding | 12px 10px (px-3 py-2.5)  |
| 操作按钮   | padding | 10px 6px (px-2.5 py-1.5) |
| 操作按钮   | gap     | 4px (gap-1)              |
| Tip 按钮   | padding | 16px 8px (px-4 py-2)     |
| Tip 按钮   | gap     | 6px (gap-1.5)            |
| Tip 按钮   | 圆角    | full (rounded-full)      |

### 6.2 LockOverlay

| 区域         | 属性      | 值                     |
| ------------ | --------- | ---------------------- |
| 渐变         | from      | black/20               |
| 渐变         | via       | black/40               |
| 渐变         | to        | black/60               |
| 内容区       | padding-x | 24px (px-6)            |
| 内容区       | max-width | 384px (max-w-sm)       |
| 紧迫感标签   | padding   | 12px 6px (px-3 py-1.5) |
| 紧迫感标签   | gap       | 8px (gap-2)            |
| 紧迫感标签   | 图标      | 14px                   |
| 锁定图标容器 | size      | 64×64px (w-16 h-16)    |
| 锁定图标     | size      | 28px                   |
| 解锁按钮     | padding   | 32px 16px (px-8 py-4)  |
| 解锁按钮     | 圆角      | 12px (rounded-xl)      |
| 解锁按钮     | 字号      | 18px (text-lg)         |

### 6.3 导航

| 区域       | 属性    | 值                      |
| ---------- | ------- | ----------------------- |
| 顶部导航   | padding | 16px 10px (px-4 py-2.5) |
| 顶部导航   | 高度    | 56px (h-14)             |
| 底部导航   | padding | 8px 10px (px-2 py-2.5)  |
| 底部导航   | 图标    | 22px                    |
| 底部导航项 | padding | 20px 10px (px-5 py-2.5) |
| 底部导航项 | gap     | 4px (gap-1)             |
| Logo 容器  | size    | 36×36px (w-9 h-9)       |

### 6.4 按钮

| 尺寸 | padding                 | 字号 | 最小高度 |
| ---- | ----------------------- | ---- | -------- |
| sm   | 14px 8px (px-3.5 py-2)  | 14px | 36px     |
| md   | 20px 10px (px-5 py-2.5) | 16px | 44px     |
| lg   | 28px 14px (px-7 py-3.5) | 18px | 48px     |
| 圆角 | 12px (rounded-xl)       | -    | -        |

### 6.5 卡片

| 属性   | 值                       |
| ------ | ------------------------ |
| 背景   | surface-base             |
| 边框   | 1px border-base          |
| 圆角   | 24px (rounded-2xl)       |
| 内边距 | 24px (p-6) 或 32px (p-8) |

---

## 7. 页面布局规范

### 7.1 最大宽度 (px)

| 页面类型    | max-width | 类名   | 像素               |
| ----------- | --------- | ------ | ------------------ |
| 信息流/帖子 | max-w-2xl | 672px  | Feed, 帖子详情     |
| 表单/设置   | max-w-3xl | 768px  | 个人资料           |
| 列表页      | max-w-4xl | 896px  | 通知、购买         |
| 仪表盘      | max-w-5xl | 1024px | 订阅、钱包         |
| 内容管理    | max-w-7xl | 1280px | 工作室、分析、收益 |

### 7.2 页面内边距

| 场景                  | 值                                     |
| --------------------- | -------------------------------------- |
| 主内容区 padding-x    | 16px (px-4) 移动端, 24px (px-6) 桌面   |
| 主内容区 padding-top  | 80px (pt-20) 移动端, 96px (pt-24) 桌面 |
| 底部安全区 (有底导航) | 80px (pb-20) 或 96px (pb-24) 移动端    |

### 7.3 固定头部

| 属性              | 值                                   |
| ----------------- | ------------------------------------ |
| 顶部导航高度      | 56px (h-14) 移动端, 64px (h-16) 桌面 |
| main padding-top  | 56px (pt-14) 或 64px (pt-16)         |
| sticky header top | 56px (top-14) 或 64px (top-16)       |

---

## 8. 颜色规范（严格按 Figma）

见 `styles/globals.css` 中的 CSS 变量定义。Dark 模式为默认设计稿状态。

---

## 9. 动画

| Token            | 值                                |
| ---------------- | --------------------------------- |
| duration-instant | 100ms                             |
| duration-fast    | 200ms                             |
| duration-normal  | 300ms                             |
| duration-slow    | 500ms                             |
| ease-out         | cubic-bezier(0.33, 1, 0.68, 1)    |
| ease-spring      | cubic-bezier(0.34, 1.56, 0.64, 1) |

---

## 10. 强制规则

1. **所有新组件**必须使用本规范中的 Token，禁止硬编码 px 值（除本规范已列出的固定值）。
2. **所有页面**必须使用规范中的 max-width、padding、底部安全区。
3. **所有按钮**必须满足最小 44px 高度（移动端）。
4. **所有卡片**必须使用 `rounded-2xl`、`border-border-base`、`bg-surface-base` 或 `bg-surface-raised`。
