# UI 视觉审计报告 — 去 AI 味改造基线

- 日期：2026-06-10
- 方法：impeccable critique 流程（人工设计评审 + `detect.mjs` 确定性扫描 + 浏览器走查）
- 走查页面：/auth、/home、/search、/creator/studio、/creator/studio/earnings、/creator/studio/ambassador、/creator/[id]（404 态）
- 品牌基准：见 `PRODUCT.md`（sensual / restrained / premium，参考 LELO + Instagram 内容优先）

## 总体结论

当前 UI 是教科书级的「2025 AI 生成审美」：紫罗兰 #8B5CF6 主色 + 金色 #F59E0B CTA + 渐变 + 霓虹 glow + 玻璃拟态，叠加 Inter + Playfair Display 字体组合。与 PRODUCT.md 定义的「高级、克制、暧昧」定位相距甚远。问题不在执行细节，而在设计系统本身 —— 建议先重做 token 层（globals.css），再逐页清理硬编码颜色。

## P0 — 系统级（改 token 层，全站受益）

| #    | 问题                                                                                                                                           | 证据                                                             | 建议                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| P0-1 | **紫罗兰+金色+靛蓝三色品牌系统 = AI 默认色板**。`--rose:#8B5CF6`（名为 rose 实为紫，命名也已失真）、`--gold:#F59E0B`、`--purple:#6366F1`       | `app/globals.css:20-40`；detect.mjs 报 ai-color-palette ×4       | 重设品牌色：暗底 + 单一低饱和暖色系强调色（如深酒红/裸肤色调，呼应 LELO 式情色高级感），强调色占比 ≤10% |
| P0-2 | **霓虹 glow 阴影系统**：`--rose-glow`、`--gold-glow` 等 6 个发光 token，按钮/卡片到处发光                                                      | `app/globals.css:25-40`；Earnings 页 Request Payout 按钮紫色光晕 | 删除全部 glow token，改用普通层级阴影                                                                   |
| P0-3 | **渐变文字**（gradient text，`background-clip:text`）×4 处                                                                                     | `app/globals.css:367,373,379,495`（detect.mjs gradient-text）    | 改为实色，强调靠字重/字号                                                                               |
| P0-4 | **Inter + Playfair Display 字体组合**：Inter 是公认的 AI 滥用字体；Playfair 衬线只在 /search 标题出现一次，全站不统一                          | `app/layout.tsx:3`；/search「Discover Creators」衬线标题突兀     | 产品界面可保留系统级 sans（产品 register 允许），但展示性标题需选一款有性格的字体并全站统一使用规则     |
| P0-5 | **硬编码 Tailwind 调色板类大面积扩散，绕过 token 系统**：violet×121、red×58、amber×53、green/emerald×42、purple×7、indigo×3、blue×5，渐变类×19 | grep 统计（app/ + components/ 的 .tsx）                          | 一律改为语义 token（bg-primary、text-success 等）；CI 加 lint 禁止裸色板类                              |

## P1 — 模式级（典型 AI 套路，逐组件改）

| #    | 问题                                                                                                                                                  | 证据                                                | 建议                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| P1-1 | **hero-metric 模板卡片网格**：Studio 仪表盘 4 张同构卡（图标+大数字+标签+绿色 +0%），图标一绿一紫一蓝随机配色；$0 时还显示绿色「+0% from last month」 | /creator/studio 截图                                | 重组为单行数据条或分层信息；增长为 0 时不显示涨幅；图标统一单色 |
| P1-2 | **CTA 颜色不一致**：Earnings 页同屏出现紫色和绿色两个「Request Payout」按钮                                                                           | /creator/studio/earnings 截图                       | 同一动作只用一种按钮样式；主 CTA 全站唯一颜色                   |
| P1-3 | **uppercase 字距 eyebrow 标签**：AVAILABLE BALANCE / PENDING PAYOUT 等全大写小标签是 AI 脚手架特征                                                    | Earnings 页                                         | 改为正常大小写的次级文字层级                                    |
| P1-4 | **emoji 当图标**：大使计划等级用 ⭐🏆👑                                                                                                               | `app/creator/studio/ambassador/page.tsx:91,100,109` | 换 Lucide 单色 SVG（项目已用 Lucide）                           |
| P1-5 | **side-stripe 色条**：toast 的 `border-l-4` 彩色侧边条                                                                                                | `components/ui/toast.tsx:35`                        | 改全边框或背景色块                                              |
| P1-6 | **弹性/bounce 动效**：`--ease-spring: cubic-bezier(0.34,1.56,0.64,1)` 及 bounce 动画 ×4                                                               | `app/globals.css:94,907,909,919`                    | 改 ease-out-quart/expo；保留 like-pop 一处可作为「时刻性」彩蛋  |
| P1-7 | **布局遮挡/dead click**：sticky 顶栏遮住 feed 卡片头部（「Unknown Creator」被截断）；/search 创作者卡片被底部导航拦截点击；底部导航悬浮在卡片内容上   | /home、/search 走查；点击被 `Main navigation` 拦截  | 给滚动容器加 scroll-margin/padding；修 z-index 与点击区域       |

## P2 — 页面级

| #    | 问题                                                                                        | 证据           | 建议                                                 |
| ---- | ------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------- |
| P2-1 | 404 错误态文案重复：「Creator Not Found」+「Creator not found」连排两行                     | /creator/mock1 | 标题+有用的引导文案（去搜索/回首页）                 |
| P2-2 | /search 价格筛选 chips「$ 9.99 /mo」空格断裂、价格档位 10 个并排超出工作记忆                | /search 快照   | 价格区间滑块或 3 档分组                              |
| P2-3 | 营销话术散落产品界面：「Explore exclusive content from talented creators around the world」 | /search 副标题 | 产品界面文案收敛，留白即可                           |
| P2-4 | 信息流卡片同构重复（头像+Follow+Subscribe $9.99/mo ×19 张一模一样）                         | /home          | 测试数据问题为主，但卡片本身可增加内容驱动的视觉差异 |

## 建议执行顺序

1. `$impeccable document` — 把现状 token 生成 DESIGN.md，然后基于 PRODUCT.md 重做调色板（P0-1/2/3）
2. 全站替换硬编码色板类为语义 token（P0-5），一次 PR 一个目录
3. `$impeccable polish creator/studio` + `polish earnings`（P1-1/2/3）
4. 杂项清理：emoji 图标、toast 色条、bounce 动效（P1-4/5/6）
5. 布局遮挡修复（P1-7）走 qa:gate 的 dead-click 检查回归

## Run Notes

- 检测器：`detect.mjs` 扫 app/ + components/，14 findings（ai-color-palette×4、gradient-text×4、bounce-easing×4、side-tab×1、heading violet×1）
- 浏览器：已登录 creator 测试账号走查 7 个页面；浏览器覆盖层注入未执行（用截图证据代替）
- 评审独立性：degraded（单线程顺序执行，无子代理）
