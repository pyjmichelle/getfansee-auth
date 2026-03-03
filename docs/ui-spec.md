# GetFanSee UI 规范（Phase 1）

## 目标

统一 Auth、Home、Search、Me 及后续页面的视觉语言，避免“页面各做各的”导致的风格漂移。

## 设计令牌

- 颜色：仅使用 `globals.css` 中的 CSS 变量（如 `--brand-primary`、`--surface-base`、`--text-primary`）
- 圆角：优先使用 `rounded-xl`（控件）与 `rounded-2xl`（卡片）
- 间距：优先 4/6/8 系列（`p-4`、`p-6`、`gap-4`、`gap-6`）
- 阴影：使用 `shadow-glow`、`shadow-md`，避免硬编码阴影

## 组件优先级

新增页面或重构必须优先复用以下组件：

- `GlassCard`：高优先级容器（hero、关键操作区）
- `SectionHeader`：区块标题 + 副标题 + 右侧动作
- `PageHero`：顶部视觉区（mesh 背景）
- `ProfileBanner`：个人/创作者头图信息区
- `CategoryCard`：分类卡片（Search/Home）
- `SettingsTabs`：设置页 tab 导航
- `TrustStrip`：信任背书信息条
- `SuggestedCard`：推荐创作者卡片
- `EmptyState`（illustration 模式）：空状态统一入口

## 布局规范

- 页面骨架优先：`PageShell` + 内容容器 + 可选侧栏
- Hero 区避免超高标题；`h1` 推荐 `text-2xl` 或 `text-3xl`
- 表单区避免 oversized 控件：按钮默认 `h-10`，输入框建议 `h-10`

## 图标与插画规范

- 禁止新增原始内联 SVG 图标块（尤其多 path 彩色图标）
- 功能图标优先使用 `lucide-react` + `.icon-glow` 容器
- 空状态优先使用 AI 插画：
  - `/images/illustrations/home-empty.png`
  - `/images/illustrations/search-empty.png`
  - `/images/illustrations/feed-empty.png`

## 空状态规范

所有空状态必须使用 `EmptyState` 组件，默认规则：

- 标题：一句话说明当前状态
- 描述：告诉用户下一步
- 动作：给出主 CTA（如 Discover/Create）

## 后续页面适配映射

- `subscriptions`：`PageHero` + `GlassCard` + `EmptyState(illustration)`
- `purchases`：`SectionHeader` + `EmptyState(illustration)`
- `notifications`：`SectionHeader` + `EmptyState(illustration)` + `SettingsTabs`
- `wallet`：`ProfileBanner` + `SectionHeader` + `GlassCard`
- `creator/studio/*`：`PageHero` + `SectionHeader` + `GlassCard` + `TrustStrip`

## 工程约束

- 所有新组件必须支持 `className`
- 使用 `cn()` 合并样式
- 保留关键 `data-testid`
- 深色模式下不得使用硬编码亮色背景
