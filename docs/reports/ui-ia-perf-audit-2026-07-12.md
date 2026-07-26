# UI IA 走查 + 性能根因诊断报告（2026-07-12）

- 环境：生产构建（`pnpm build && pnpm start`），本地 3000 端口
- 矩阵：MB 375×812 + PC 1280×900 × guest / fan / creator（测试账号 `test-fan@` / `test-creator@example.com`）
- 截图：`docs/reports/screenshots/2026-07-12-ia-review/`（`<页面>-<角色>-<视口>.png` 全页 + `-fold.png` 首屏；实测耗时 `_timings.json`）
- 前置：v5 色板与排版 utility 已在本次先行落地（DESIGN.md v5 / globals.css / design-system.mdc / verify 脚本），`check-all` + `build` 全绿

---

## A 部分 — 性能诊断

### A.1 实测数据（生产构建，冷导航）

| 页面                         | dcl（HTML 可交互） | 骨架消失     | 网络静默 |
| ---------------------------- | ------------------ | ------------ | -------- |
| `/home`（最慢）              | **4.6–7.7s**       | <0.1s        | 6.4–9.7s |
| `/creator/studio`            | 4.1–4.2s           | **5.8–8.9s** | 14.7–18s |
| `/creator/studio/ambassador` | 1.1–1.3s           | **4.9–6.6s** | 6.6–8s   |
| `/subscriptions`             | 1.1–3.1s           | 2.7–2.9s     | 4.3–6.2s |
| `/me`                        | 1.3–3.4s           | 1.7–2.0s     | 3.3–5.5s |
| `/auth`（RSC 页，对照组）    | **0.2–0.3s**       | —            | ~1s      |

结论：纯 RSC 页（auth）秒开；所有慢页都是 `"use client"` + `useEffect` 取数页。**36/59 个页面是客户端页**。

### A.2 根因链（按放大倍数排序）

1. **Supabase 远端 RTT ≈ 700ms**（本机 → `*.supabase.co` 实测 0.71s ×3 次稳定）。这是所有环节的放大器：每个触达数据库的 server hop 都要付 ~0.7s。
   - 生产部署若 Vercel 与 Supabase 同区，此项降到 <20ms；但架构层的"跳数"问题依然存在，只是被缩小。
2. **认证请求链每页固定开销**：middleware `updateSession→getUser()`（1 跳）→ 根布局 `getServerAuthState()`＝`getUser()`+`getProfile()`（串行 2 跳）。已登录时每次导航 TTFB 自带 ~3 跳 × RTT。
3. **客户端瀑布**：hydrate 后 `useEffect` 里 `getAuthBootstrap()`（现为 0ms 快照 ✓）→ `fetch(/api/...)`，而每个 API route 内部又是 `getUser()`+查询（再 2 跳）。fetch 数量 top：`/me` 8 个、`/creator/studio/links` 5 个、`/creator/onboarding`、`/creator/[id]` 各 4 个。
4. **死请求（每次导航白付）**：
   - `/me` L314：`fetch("/api/auth/session", {method:"DELETE"})` — 该路由已在认证重写中删除，现 404；登出应直接走 `supabase.auth.signOut()`。
   - `https://localhost:3000/...` 反复 OPTIONS/GET 失败 + `/_vercel/insights/script.js` 404 — Vercel Analytics 在非 Vercel 环境的 beacon 噪声，应按环境开关。

### A.3 修复方案分级

| 级别              | 动作                                                                                                                             | 预期收益                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Quick win（半天） | 删 `/me` 死端点调用；页面内多 fetch 用 `Promise.all` 并行；`/me` 首屏直接用 `useAuth()`（SSR 注入）渲染，`/api/profile` 只补 bio | `/me` 骨架 2s → 近 0；每页省 1-2 跳     |
| Quick win         | Analytics 按 `NODE_ENV`/部署环境关闭 beacon                                                                                      | 去掉 404/CORS 噪声                      |
| 结构性（1-2 天）  | `/home`、`/creator/studio`、`/creator/studio/ambassador` 转 RSC 服务端取数 + Suspense 流式；骨架只留真实流式边界                 | studio 骨架 5.8–8.9s → <1s              |
| 结构性            | 根布局 `getUser()`+`getProfile()` 用 `React.cache()` 包一层，同请求内与页面级重复调用合并                                        | 每页省 1-2 跳                           |
| 基础设施          | 生产确认 Supabase region 与部署区同区                                                                                            | RTT 700ms → <20ms（本地开发仍慢属正常） |

---

## B 部分 — 逐页布局评审（F 编号 + 优先级）

### 走查中抓到的阻断性问题（已当场处理）

- **F-100（P0，已修复）**：`/posts/[id]` 全角色「Application Error」白屏 — 根因是 `.next` 构建缓存损坏（静态 chunk 404 / MIME text-plain），清缓存重建后消失。**衍生 P1 → F-101**：全局错误边界页是原生白底黑字样式，与品牌完全脱节，需自定义 `global-error.tsx`（Noir 色板 + 品牌文案 + Try again/回首页）。

### F-001（P0）`/me` PC — 双 tab 并存 + 内容被压成窄列

- 现状（`me-fan-pc-fold.png`）：左栏纵向 nav（Profile/Saved/Account/Security/Log Out）与内容区顶部横向 pill tab（Profile/Saved）**同时存在**，职责重复；内容卡被压到 ~120px 宽，「Display Name」折行、Bio 输入框一列一个字，1280px 下约 70% 横向空白。
- 建议：删横向 pill tab，仅保留左栏 nav（PC）；内容卡固定 `--container-doc`（48rem）居中于剩余空间。MB 保留横向 tab（`me-*-mb` 正常）。

### F-002（P1）home feed — sticky tab 遮住第一张卡

- 现状（`home-fan-mb-fold.png` / `home-fan-pc-fold.png`）：For You/Following sticky 头遮住第一张卡的 creator 行（头像/名字被压一半），MB、PC 均复现。
- 建议：feed 容器 `padding-top` 补足 sticky 高度；或 tab 改非透明底（现半透明加重视觉重叠感）。

### F-003（P1）游客首访 — 同屏三层弹出

- 现状（`auth-guest-*.png`、`share-landing-guest-*.png`）：Age Gate modal + Cookie 横幅 + （受邀流程时）InvitedBanner 同屏叠加；MB 上 Cookie 横幅盖住底部导航，`new-post` 页盖住 Publish 按钮（`new-post-creator-mb-fold.png`）。
- 建议：强制时序化——Age Gate 通过后才渲染 Cookie 横幅；Cookie 横幅 `z-index` 降到 bottom-nav 之下并在 MB 上收窄为单行折叠式。**弹出层叠加 = 违反弹出选型规则**（详见 C 部分）。

### F-004（P1）ShareModal 在 PC 上是全宽底部 sheet

- 现状（`post-free-share-fan-pc.png`）：1280px 下分享面板从底部升起、横跨全屏宽（带拖拽把手）——移动 sheet 模式误用到桌面。MB 表现正确（`ambassador-share-creator-mb.png`）。
- 建议：≥1024px 改 ≤560px 居中 modal；平台图标 7 个 + Copy Link 布局保留。

### F-005（P1）`/me/wallet` — creator 角色语气错位

- 现状（`wallet-creator-mb-fold.png`）：creator 首屏与 fan 完全相同——大字 $0.00 + Add Funds + 「Low Balance, top up to avoid missing premium drops」警告。creator 的 pending 收入、提现入口完全不可见；「充值以免错过内容」的文案对 creator 不成立。
- 建议：按 `useAuth().profile.role` 分区——creator 首屏 = 可提现余额 + pending 收入 + Earnings 入口；Add Funds 降级为次要入口。

### F-006（P1）creator 自视角主页 — 自己的内容显示锁定 overlay

- 现状（`creator-self-creator-pc-fold.png`）：头部正确显示 Edit Profile（✓ 角色 CTA 正确），但下方内容网格三格全部是锁 icon overlay——创作者看自己的付费内容不应显示锁定态。
- 建议：网格 item 对 `viewer === creator` 判定为作者态（显示编辑/统计角标而不是锁）。

### F-007（P1）studio / ambassador — 长骨架（性能，联动 A 部分）

- `studio-creator-*`：骨架 5.8–8.9s；`ambassador-creator-*`：4.9–6.6s。修法见 A.3 结构性项。

### F-008（P2）MB 页头占用 — `new-post-creator-mb-fold.png`

大标题「Create New Post」+ 副标题 + 返回箭头占 ~140px 竖屏空间；建议 MB 降为单行紧凑头（返回 + 标题同行，副标题删除）。

### F-009（P2）feed 卡片无图 fallback

`home-*-fold.png` 中无媒体帖子渲染为纯黑大块；建议无图时给 `--bg-raised` 底 + 居中类型 icon，锁定帖保留 EXCLUSIVE 徽标。

### F-010（P2）post 页作者行长 ID 截断

`post-locked-fan-mb-fold.png`：`e2e-creator-1781107399669-3zjqjw` 撑爆两行；display_name 缺失时应回退到 `@handle` 单行 truncate。

### 表现良好（保持）

- `/auth` 双 tab（Sign In/Create Account）取舍正确、表单纵向节奏好、受邀落地 `/r/<code>` → `auth?mode=signup&invited=1&ref_name=…` 链路完整（`share-landing-*`）。
- `/subscriptions` 空状态（heart icon + 引导 Discover Creators）与右侧 Stats 栏分区清晰。
- `/search` PC：Fraunces 大标题 + 搜索框 + 卡片网格 + 筛选段控件层级清楚。
- `/creator/[id]` fan 视角：Follow/Tip/Subscribe CTA 主次正确（Subscribe 唯一 wine 填充）；Buy-me-a-coffee 块 + Recent supporters 完整。
- `/me/wallet` fan 视角：余额 + Low Balance 警示 + 流水 + This Month 侧栏（PC）结构成立。

---

## C 部分 — 全局交互规范建议（确认后写回 DESIGN.md）

1. **弹出选型规则表**（已固化到 `.cursor/skills/page-ia-review/SKILL.md` 检查表 4）：轻确认 = MB sheet / PC 小 modal；中表单 = MB sheet / PC ≤560px modal；重流程 = 独立页；即时反馈 = toast。**禁止弹出层叠加**（F-003 的 age gate + cookie 即违例）。
2. **Tab 使用规则**：仅用于同一实体的平行视图（2–4 个）；筛选/时间范围改分段控件；PC 侧栏 nav 与内容区 tab 二选一（F-001 违例）。
3. **点击反馈**：<100ms 出 active 态；导航后骨架 >1s 记性能债（A 部分阈值）。
4. **角色分流**：共享页面（wallet/creator 主页/feed 空状态）必须按 `role` 出对应首屏（F-005/F-006 违例）。

---

## 修复批次建议（待你确认后执行，UI 域集中改，遵守并行协调规则）

| 批次              | 内容                                                                                             | 项      |
| ----------------- | ------------------------------------------------------------------------------------------------ | ------- |
| 批次 1（P0）      | F-001 me PC 布局重构 + F-101 品牌化错误页                                                        | 2       |
| 批次 2（P1 交互） | F-002 sticky 遮挡、F-003 弹层时序、F-004 PC share modal、F-005 wallet 角色分流、F-006 作者态网格 | 5       |
| 批次 3（P1 性能） | A.3 Quick win 全部 + studio/ambassador RSC 化（F-007）                                           | ~6 文件 |
| 批次 4（P2 打磨） | F-008/009/010 + C 部分写回 DESIGN.md                                                             | 4       |
