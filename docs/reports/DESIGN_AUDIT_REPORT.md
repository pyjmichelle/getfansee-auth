# GetFanSee 设计审计报告

> **审计日期**: 2026-02-25  
> **审计范围**: Phase 1–4 全量设计符合性  
> **对照标准**: `docs/design/FIGMA_PIXEL_SPEC.md`

---

## Phase 1: Discovery & Configuration

### 1.1 Figma 文件与配置

| 项目               | 状态                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------- |
| Figma 文件 Key/URL | 未在 `docs/` 或 `README.md` 中发现显式 Figma 文件 Key；文档引用 Figma Make 导出设计稿 |
| 设计规范来源       | `docs/design/FIGMA_PIXEL_SPEC.md` 作为像素级规范                                      |
| 历史审计           | `docs/reports/FIGMA_UI_COMPLIANCE_REVIEW.md` 存在，可作参考                           |

### 1.2 Token 对齐检查

| Token 类型 | 规范 (FIGMA_PIXEL_SPEC)                                  | 实现 (styles/globals.css)             | 状态 |
| ---------- | -------------------------------------------------------- | ------------------------------------- | ---- |
| 基础字号   | 14px                                                     | `--font-size: 14px`                   | ✅   |
| 间距 scale | space-1~20 (4–80px)                                      | `--space-1` ~ `--space-20` 完整定义   | ✅   |
| 圆角       | radius-sm 8px, md 12px, lg 16px, xl 24px, 2xl 32px       | 已定义 `--radius-sm` ~ `--radius-2xl` | ✅   |
| 字号 scale | text-xs~4xl                                              | `--text-xs` ~ `--text-5xl`            | ✅   |
| 动画       | duration-instant/fast/normal/slow, ease-out, ease-spring | 已定义                                | ✅   |
| 滚动条宽度 | 8px                                                      | `::-webkit-scrollbar { width: 8px }`  | ✅   |

**偏差**:

- `app/globals.css` 与 `styles/globals.css` 并存，`app/globals.css` 使用玫瑰粉主题，`styles/globals.css` 使用 Indigo+Amber 主题，存在**双主题源**，需确认哪套为设计基准。
- 规范要求 `html { font-size: 14px }`，`styles/globals.css` 通过 `html { font-size: var(--font-size) }` 实现；`app/globals.css` 在媒体查询中覆盖为 14–16px，与规范不完全一致。

### 1.3 Tailwind 配置

- 未发现 `tailwind.config.ts` 或 `tailwind.config.js`，项目使用 Tailwind v4 的 `@import "tailwindcss"` 与 `@theme inline`，主题通过 `styles/globals.css` 注入。

---

## Phase 2: Component Compliance

### 2.1 Button (`components/ui/button.tsx`)

| 属性         | 规范                    | 实现                                                     | 状态    |
| ------------ | ----------------------- | -------------------------------------------------------- | ------- |
| md 最小高度  | 44px                    | `min-h-[44px]`                                           | ✅      |
| md padding   | 20px 10px (px-5 py-2.5) | `px-5 py-2.5`                                            | ✅      |
| md 字号      | 16px                    | 默认 `text-sm` (14px)                                    | ⚠️ 偏差 |
| sm 最小高度  | 36px                    | `min-h-[36px]`                                           | ✅      |
| sm padding   | 14px 8px (px-3.5 py-2)  | `px-3.5 py-2`                                            | ✅      |
| lg 最小高度  | 48px                    | `min-h-[48px]`                                           | ✅      |
| 圆角         | 12px (rounded-xl)       | `rounded-xl`                                             | ✅      |
| Focus 状态   | -                       | `focus-visible:ring-[3px] focus-visible:ring-primary/50` | ✅      |
| aria-invalid | -                       | 已支持                                                   | ✅      |

**偏差**:

- 规范 md 字号为 16px，默认使用 `text-sm` (14px)，建议 md 使用 `text-base`。

### 2.2 ContentCard (`components/content-card.tsx`)

| 区域               | 规范                     | 实现            | 状态    |
| ------------------ | ------------------------ | --------------- | ------- |
| 创作者头部 padding | 12px 10px (px-3 py-2.5)  | `px-3 py-2.5`   | ✅      |
| 创作者头部 gap     | 10px (gap-2.5)           | `gap-2.5`       | ✅      |
| 头像尺寸           | 36×36px (w-9 h-9)        | `w-9 h-9`       | ✅      |
| 正文区 padding     | 12px 10px (px-3 pb-2.5)  | `px-3 pb-2.5`   | ✅      |
| 操作栏 padding     | 12px 10px (px-3 py-2.5)  | `px-3 py-2.5`   | ✅      |
| 操作按钮 padding   | 10px 6px (px-2.5 py-1.5) | `px-2.5 py-1.5` | ✅      |
| 操作按钮 gap       | 4px (gap-1)              | `gap-0.5` (2px) | ⚠️ 偏差 |
| Tip 按钮 padding   | 16px 8px (px-4 py-2)     | `px-4 py-2`     | ✅      |
| Tip 按钮 gap       | 6px (gap-1.5)            | `gap-1.5`       | ✅      |
| Tip 按钮圆角       | full (rounded-full)      | `rounded-full`  | ✅      |
| 更多菜单图标       | 18px                     | `size={18}`     | ✅      |
| 内容卡片操作图标   | 20px                     | `size={20}`     | ✅      |

**偏差**:

- 操作栏按钮 gap 规范为 4px，实现为 `gap-0.5` (2px)。

### 2.3 Card (`components/ui/card.tsx`)

| 属性   | 规范                     | 实现                               | 状态    |
| ------ | ------------------------ | ---------------------------------- | ------- |
| 圆角   | 24px (rounded-2xl)       | `rounded-[20px]`                   | ⚠️ 偏差 |
| 背景   | surface-base             | 使用 `glass-card`                  | ⚠️ 偏差 |
| 边框   | 1px border-base          | `border border-border`             | ✅      |
| 内边距 | 24px (p-6) 或 32px (p-8) | CardHeader/CardContent 使用 `px-5` | ⚠️ 偏差 |

**偏差**:

- 规范卡片圆角 24px，实现为 20px。
- 规范要求 `bg-surface-base`，实现为 `glass-card`，视觉风格不同。
- CardHeader/CardContent 使用 `px-5` (20px)，规范建议 p-6 (24px) 或 p-8 (32px)。

### 2.4 Input (`components/ui/input.tsx`)

| 属性         | 规范              | 实现                                                     | 状态                      |
| ------------ | ----------------- | -------------------------------------------------------- | ------------------------- |
| 高度         | -                 | `h-11` (44px)                                            | ✅ 满足 44px 最小点击区域 |
| 圆角         | 12px (rounded-xl) | `rounded-xl`                                             | ✅                        |
| Focus 状态   | -                 | `focus-visible:ring-[3px] focus-visible:ring-primary/30` | ✅                        |
| aria-invalid | -                 | 已支持                                                   | ✅                        |
| Label 间距   | -                 | 由父组件控制                                             | -                         |

**说明**: Input 本身符合规范；Auth 页使用自定义 `className` 覆盖，需确保 label 与 input 间距符合规范。

### 2.5 LockOverlay (`components/lock-overlay.tsx`)

| 区域               | 规范                                     | 实现                                     | 状态 |
| ------------------ | ---------------------------------------- | ---------------------------------------- | ---- |
| 渐变               | from black/20, via black/40, to black/60 | `from-black/20 via-black/40 to-black/60` | ✅   |
| 内容区 padding-x   | 24px (px-6)                              | `px-6`                                   | ✅   |
| 内容区 max-width   | 384px (max-w-sm)                         | `max-w-sm`                               | ✅   |
| 紧迫感标签 padding | 12px 6px (px-3 py-1.5)                   | `px-3 py-1.5`                            | ✅   |
| 紧迫感标签 gap     | 8px (gap-2)                              | `gap-2`                                  | ✅   |
| 紧迫感标签图标     | 14px                                     | `size={14}`                              | ✅   |
| 锁定图标容器       | 64×64px (w-16 h-16)                      | `w-16 h-16`                              | ✅   |
| 锁定图标           | 28px                                     | `size={28}`                              | ✅   |
| 解锁按钮 padding   | 32px 16px (px-8 py-4)                    | `px-8 py-4`                              | ✅   |
| 解锁按钮圆角       | 12px (rounded-xl)                        | `rounded-xl`                             | ✅   |
| 解锁按钮字号       | 18px (text-lg)                           | `text-lg`                                | ✅   |

**结论**: LockOverlay 与规范高度一致 ✅

---

## Phase 3: Layout & Structure

### 3.1 Feed (`app/home/components/HomeFeedClient.tsx`)

| 项目               | 规范                   | 实现                         | 状态 |
| ------------------ | ---------------------- | ---------------------------- | ---- |
| max-width          | max-w-2xl (672px)      | `max-w-2xl`                  | ✅   |
| padding-x          | 16px 移动端, 24px 桌面 | `px-4 md:px-6`               | ✅   |
| padding-top        | 56px 移动端, 64px 桌面 | `pt-14 md:pt-16` (56px/64px) | ✅   |
| 底部安全区         | 80px (pb-20)           | `pb-20`                      | ✅   |
| 创作者头部         | px-3 py-2.5, gap-2.5   | 已实现                       | ✅   |
| 锁定预览 Lock 图标 | 28px                   | `h-7 w-7` (28px)             | ✅   |

**偏差**:

- Feed 内锁定预览使用 `aspect-video` + 内联渐变，未复用 LockOverlay 组件，结构略有差异，但视觉符合规范。

### 3.2 Search/Explore (`app/search/SearchPageClient.tsx`)

| 项目             | 规范           | 实现                        | 状态    |
| ---------------- | -------------- | --------------------------- | ------- |
| main padding-top | 80px/96px      | `pt-20 md:pt-24`            | ✅      |
| 主内容 padding-x | 16px/24px      | `px-4 md:px-6`              | ✅      |
| max-width        | 列表 max-w-4xl | 使用 `max-w-7xl`            | ⚠️ 偏差 |
| 搜索框           | -              | 自定义 input，非 Input 组件 | -       |

**偏差**:

- 规范列表页 max-width 为 896px (max-w-4xl)，搜索页使用 max-w-7xl (1280px)，超出规范。

### 3.3 Creator Profile (`app/creator/[id]/page.tsx`)

| 项目             | 规范             | 实现                 | 状态      |
| ---------------- | ---------------- | -------------------- | --------- |
| max-width        | max-w-2xl 信息流 | `max-w-2xl`          | ✅        |
| 顶部导航高度     | 56px (h-14)      | `h-14`               | ✅        |
| 底部安全区       | 80px             | `pb-24` 部分区域     | ⚠️ 需核对 |
| Subscribe 按钮   | 明显、渐变       | `subscribe-gradient` | ✅        |
| monetization CTA | -                | 移动端底部固定栏     | ✅        |

**偏差**:

- 返回按钮误用 Share2 图标旋转，应使用 ChevronLeft 或 ArrowLeft。
- Tab 使用原生 `<button>`，语义正确，但可考虑 `role="tablist"` 等 ARIA 增强。

### 3.4 Dashboard (`app/creator/studio/page.tsx`)

| 项目        | 规范               | 实现                | 状态 |
| ----------- | ------------------ | ------------------- | ---- |
| max-width   | max-w-5xl (1024px) | `max-w-5xl`         | ✅   |
| padding-top | 80px/96px          | `pt-20 md:pt-24`    | ✅   |
| padding-x   | 16px/24px          | `px-4 md:px-6`      | ✅   |
| 统计卡片    | rounded-xl, border | `rounded-xl border` | ✅   |

**偏差**:

- Recent Activity 使用 `bg-${activity.color}/10`，Tailwind 无法动态生成类名，可能导致样式失效。

### 3.5 Auth (`app/auth/AuthPageClient.tsx`)

| 项目           | 规范              | 实现                   | 状态 |
| -------------- | ----------------- | ---------------------- | ---- |
| 表单 max-width | max-w-md 或类似   | `max-w-md`             | ✅   |
| 输入框         | 高度、圆角、focus | 自定义 className 覆盖  | ✅   |
| Tab 切换       | -                 | TabsList + TabsTrigger | ✅   |
| 最小点击区域   | 44px              | Button 满足            | ✅   |

**偏差**:

- Forgot password 使用 `<button type="button">`，未绑定实际逻辑，属功能缺失。

---

## Phase 4: Responsive & UX

### 4.1 Bottom Navigation (`components/bottom-navigation.tsx`)

| 项目               | 规范                    | 实现                     | 状态 |
| ------------------ | ----------------------- | ------------------------ | ---- |
| padding            | 8px 10px (px-2 py-2.5)  | `px-2 py-2.5`            | ✅   |
| 图标尺寸           | 22px                    | `w-[22px] h-[22px]`      | ✅   |
| 底部导航项 padding | 20px 10px (px-5 py-2.5) | `px-5 py-2.5`            | ✅   |
| 移动端显示         | < 768px                 | `md:hidden`              | ✅   |
| 安全区             | -                       | `safe-area-inset-bottom` | ✅   |

**结论**: 底部导航符合规范 ✅

### 4.2 Nav Header (`components/nav-header.tsx`)

| 项目      | 规范                   | 实现                       | 状态 |
| --------- | ---------------------- | -------------------------- | ---- |
| 高度      | 56px 移动端, 64px 桌面 | `h-14 sm:h-16` (56px/64px) | ✅   |
| padding   | 16px 10px              | `px-4` (16px)              | ✅   |
| Logo 容器 | 36×36px                | `w-9 h-9`                  | ✅   |

**结论**: 顶部导航符合规范 ✅

### 4.3 Fake Buttons / 非语义交互

| 位置               | 问题                                                     | 建议                                 |
| ------------------ | -------------------------------------------------------- | ------------------------------------ |
| `content-card.tsx` | 创作者头像区域用 `<div onClick>` 包裹 `<Link>`，存在冗余 | 可简化为仅用 Link，或保留 div 作装饰 |
| `content-card.tsx` | Like/Comment/Share 使用 `<button>`                       | ✅ 语义正确                          |
| `SearchPageClient` | 分类筛选、视图切换使用 `<button>`                        | ✅ 语义正确                          |
| `creator/[id]`     | Tab 使用 `<button>`                                      | ✅ 语义正确                          |

**结论**: 未发现明显的“假按钮”（div + onClick 替代 button），主要交互元素均使用语义化标签。

### 4.4 Hover / Active 状态

- Button: 有 `hover:scale-[1.02] active:scale-[0.98]` ✅
- Card: 有 `hover:shadow-xl hover:border-border-hover` ✅
- 底部导航: 有 `active:scale-95` ✅
- 分类筛选 (Search): 有 `hover:text-text-primary` ✅

### 4.5 Monetization CTA 可见性与一致性

| 位置            | 实现                                         | 状态        |
| --------------- | -------------------------------------------- | ----------- |
| Feed 卡片       | Subscribe / Unlock 使用 `subscribe-gradient` | ✅ 突出     |
| Creator Profile | 底部固定 Subscribe 按钮                      | ✅ 突出     |
| LockOverlay     | Unlock / Subscribe 渐变按钮                  | ✅ 突出     |
| PaywallModal    | 使用 subscribe-gradient / unlock-gradient    | ✅ 一致     |
| ContentCard     | Tip 使用 tip-gradient (金色)                 | ✅ 符合规范 |

**结论**: 变现相关 CTA 风格统一、可见性良好。

---

## 5. 综合评分

| 维度         | 权重 | 得分 (0–10) | 加权  |
| ------------ | ---- | ----------- | ----- |
| Token 配置   | 15%  | 8           | 1.2   |
| 组件符合度   | 30%  | 7           | 2.1   |
| 布局与结构   | 25%  | 7.5         | 1.875 |
| 响应式与 UX  | 20%  | 8           | 1.6   |
| Monetization | 10%  | 9           | 0.9   |
| **总分**     | 100% | **7.7**     | -     |

**综合评分: 7.7 / 10**

---

## 6. Action Items（按优先级）

### P0 – 高优先级

1. **统一主题源**  
   明确 `app/globals.css` 与 `styles/globals.css` 的职责，避免双主题冲突；确认设计基准为 Indigo+Amber 或玫瑰粉。

2. **Button md 字号**  
   将 Button 默认 (md) 字号从 `text-sm` 调整为 `text-base`，以符合规范 16px。

3. **Card 圆角与背景**
   - 将 Card 圆角从 `rounded-[20px]` 改为 `rounded-2xl` 或 `rounded-[24px]`
   - 若规范要求 `bg-surface-base`，则替换 `glass-card` 或提供符合规范的变体。

### P1 – 中优先级

4. **ContentCard 操作栏 gap**  
   将操作按钮 gap 从 `gap-0.5` 改为 `gap-1` (4px)。

5. **Search 页 max-width**  
   将主内容区 max-width 从 `max-w-7xl` 调整为 `max-w-4xl`，或按规范区分不同区块。

6. **Creator Profile 返回图标**  
   将 Share2 旋转 180° 的“返回”图标替换为 ChevronLeft 或 ArrowLeft。

7. **Studio Recent Activity 动态类名**  
   将 `bg-${activity.color}/10` 改为显式类名（如 `bg-brand-primary/10`、`bg-amber-500/10`），避免 Tailwind 无法生成样式。

### P2 – 低优先级

8. **Auth Forgot password**  
   为“Forgot password?”按钮实现跳转或弹窗逻辑。

9. **Card 内边距**  
   将 CardHeader/CardContent 的 `px-5` 调整为 `px-6` 或 `p-6`，以符合规范。

10. **html font-size 响应式**  
    检查 `app/globals.css` 中 14–16px 的媒体查询是否与规范冲突，必要时统一为 14px。

---

## 附录：文件清单

| 文件                                     | 审计状态                   |
| ---------------------------------------- | -------------------------- |
| `docs/design/FIGMA_PIXEL_SPEC.md`        | 规范来源                   |
| `styles/globals.css`                     | Token 定义                 |
| `app/globals.css`                        | 主题覆盖，需与 styles 统一 |
| `components/ui/button.tsx`               | 已审计                     |
| `components/ui/card.tsx`                 | 已审计                     |
| `components/ui/input.tsx`                | 已审计                     |
| `components/content-card.tsx`            | 已审计                     |
| `components/lock-overlay.tsx`            | 已审计                     |
| `components/bottom-navigation.tsx`       | 已审计                     |
| `components/nav-header.tsx`              | 已审计                     |
| `app/home/components/HomeFeedClient.tsx` | 已审计                     |
| `app/search/SearchPageClient.tsx`        | 已审计                     |
| `app/creator/[id]/page.tsx`              | 已审计                     |
| `app/creator/studio/page.tsx`            | 已审计                     |
| `app/auth/AuthPageClient.tsx`            | 已审计                     |
