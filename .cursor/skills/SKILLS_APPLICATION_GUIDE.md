# Skills 应用指南

本文档说明当前已安装的 skills 及与 release-gate 必选列表的对应关系。

**Release-gate 必选（与 `.cursor/rules` 对齐，10 个）**：supabase（官方 supabase/agent-skills）、supabase-postgres-best-practices、shadcn-ui、react-best-practices、frontend-design、e2e-test-setup、fixture-generator、test-report-generator、ci-pipeline-config、api-test-runner。

> 注：`better-auth-best-practices` 已从 release-gate 必选列表中移除，项目使用 Supabase Auth（非 Better Auth），请改用 `supabase` 官方 skill（`supabase/agent-skills`）覆盖认证安全场景。

**项目内常用补充（非 release-gate 清单替代项）**：`code-check`（等价于对话里「跑 check-all」）、`planning-with-files`、`agent-browser`、`ui-ux-pro-max`（设计 token/栈对齐）、`feishu-docs`（飞书需求对齐时）。

**UI/布局深度诊断（2026-07-26 补录，此前未索引）**：

- `.cursor/skills/page-ia-review/SKILL.md` — 布局/信息架构/tab 取舍、弹层、≥44px 触控审查
- `.agents/skills/impeccable/SKILL.md` — UI 打磨实现（配合 shadcn-ui）
- `.agents/skills/web-quality-audit/SKILL.md` — Lighthouse 式性能/a11y/SEO/CLS 审计
- `.agents/skills/frontend-design/SKILL.md`（注意：与 `.cursor/skills/frontend-design.skill.md` 是两个不同文件，前者偏视觉/排版直觉判断，后者偏系统化设计模式清单，两者互补而非替代）
- `.agents/skills/interface-design/SKILL.md` — 仪表盘/后台/工具类界面专用（非营销页）
- `.cursor/skills/qa-gate/SKILL.md` — 项目专属 QA 门禁流水线（gate-ui/gate-deadclick/audit:full）
- `.cursor/skills/feature-qa-walkthrough/SKILL.md` — PRD 驱动的双视口双角色全按钮走查
- `.cursor/skills/release-review-walkthrough/SKILL.md` — 结构化发布走查报告（F-001 编号模板）

**维护类**：ci-auto-fix、audit-website、web-design-guidelines。

## 项目技术栈概览

- **框架**: Next.js 16 (App Router), React 19
- **语言**: TypeScript (严格模式)
- **数据库**: Supabase (PostgreSQL)
- **认证**: Supabase Auth（`lib/server/auth-server.ts` 为服务端核心；`lib/auth-server.ts` 为历史遗留，逐步向 `lib/server/` 迁移）
- **UI 库**: shadcn/ui (基于 Radix UI) + Tailwind CSS v4
- **测试**: Playwright (E2E), Vitest (单元测试)
- **KYC**: Didit（`lib/kyc/kyc-service.ts`，Webhook + Admin API）
- **支付**: Stripe + 内置 Wallet

## 门禁命令（以 `package.json` 为准）

- **`pnpm check-all`**：`type-check` → `lint` → `format:check` → `check:service-role` → `check:admin-client`。（**不含** `test:unit`、**不含** `build`。）
- **合并前完整路径（与内核一致）**：`pnpm check-all` → `pnpm build` → `pnpm qa:gate` → `pnpm exec playwright test --project=chromium`（或按变更范围跑 `pnpm test:e2e:smoke` / 定向 spec）。
- **`pnpm test:e2e:smoke`**：对应 `tests/e2e/smoke.spec.ts`。另有 `tests/e2e/smoke-check.spec.ts`（历史/补充冒烟），以脚本为准优先用 `test:e2e:smoke`。
- **Pre-push（`.husky/pre-push`）**：`SKIP_QA_GATE=1 pnpm ci:verify` → 当前为 `check:env`、`lint`、`type-check`、`build`；**跳过** `qa:gate` 与 E2E（由 CI 承担）。

## 项目当前关键业务面（2026-06-07）

- **认证**: `app/auth/*`（含 `forgot-password/`、`reset-password/`、`verify/`）
- **创作者 / 个人**: `app/creator/`、`app/creator/upgrade/`、`app/me/`（含 `wallet/`）
- **Ambassador / 推荐计划（新）**: `app/creator/studio/ambassador/`（Studio 页面）、`app/api/referral/enroll/`、`app/api/referral/me/`、`app/api/referral/me/referrals/`、`app/r/[code]/route.ts`（推荐码落地重定向）；业务逻辑：`lib/ambassador/bind.ts`、`lib/ambassador/server.ts`、`lib/ambassador/types.ts`、`lib/referral.ts`；PRD 见 `docs/planning/creator-ambassador-referral-program.md`
- **内容与发现**: `app/home/`、`app/posts/`、`app/search/`
- **合规与信任**: `app/report/`、`app/support/`、`app/api/support/`、`app/api/report/`、`app/api/age-verify/`
- **法律合规页（已更新）**: `app/2257/`、`app/privacy/`、`app/dmca/`、`app/about/`、`app/acceptable-use/`；常量见 `lib/constants/legal.ts`
- **管理后台**: `app/admin/content-review/`、`app/admin/creator-verifications/`、`app/admin/reports/` 等
- **AI 演示面**: `app/ai-dashboard/`、`app/api/ai/generate/`
- **KYC / 创作者申请**: `app/api/kyc/`、`app/api/creator/apply/`、`lib/kyc/kyc-service.ts`
- **数据库侧近期评审带**: `migrations/032`–`042`（RLS/可见性、索引、钱包硬化、年龄验证、support tickets、Didit KYC（040）、creator ambassador program（042）等；以具体文件名与 PR 为准）
- **Playwright**: `playwright.config.ts` 中 `testDir: tests/e2e`；工程 `chromium` | `firefox` | `webkit` | `auth-mock-chromium` | `auth-real-chromium`；子目录含 `auth-mock/`、`auth-real/`、`design-qa/`

---

## 1. react-best-practices（展示名：vercel-react-best-practices）

**文件**: `react-best-practices.skill.md`

### 功能

React 和 Next.js 性能优化指南，包含 57 条规则，按影响优先级分为 8 个类别。

### 在本项目中的应用场景

#### 立即应用 (Critical Priority)

1. **消除异步瀑布流** (`async-*`)
   - **位置**: `app/home/page.tsx`（已用 Promise.all 并行 canViewPost，符合本规则）
   - **时机**: 重构 Feed 加载逻辑时

2. **Bundle 大小优化** (`bundle-*`)
   - **位置**: 所有页面组件
   - **时机**: 构建时检查 bundle 大小、添加新功能时、性能审计时

#### 高优先级应用 (High Priority)

3. **服务端性能优化** (`server-*`) — `lib/posts.ts`, `lib/paywall.ts`；优化 Feed 查询与支付墙检查时使用 React.cache() 与并行查询。
4. **客户端数据获取** (`client-*`) — `app/home/components/HomeFeedClient.tsx`；实现 Feed 刷新时考虑请求去重。

#### 中等优先级应用 (Medium Priority)

5. **重渲染优化** — `components/paywall-modal.tsx`, `HomeFeedClient.tsx`
6. **渲染性能** — 长列表虚拟化、静态 JSX 提取

### 使用时机总结

- 编写新 React 组件、实现数据获取、代码审查、重构、优化 bundle 大小时使用本 skill。

---

## 2. web-design-guidelines

### 功能

审查 UI 代码是否符合 Web 界面指南，包含 100+ 条规则，涵盖可访问性、性能和 UX。

### 在本项目中的应用场景

- **可访问性**: ARIA、键盘导航、焦点状态 — 所有 UI 组件、paywall-modal、nav-header
- **表单与输入**: 验证与错误处理 — `app/auth/AuthPageClient.tsx`
- **性能与动画**: prefers-reduced-motion、图片 lazy loading — 媒体展示组件

### 使用时机总结

- 审查 UI、检查可访问性、审计设计、审查 UX、创建新组件时使用。

---

## 3. frontend-design

### 功能

前端设计模式和 UI/UX 最佳实践。

### 在本项目中的应用场景

- **设计一致性**: 响应式布局、间距与排版、视觉层次 — 所有页面与组件、HomeFeedClient
- **用户体验**: 用户流程优化 — AuthPageClient、paywall-modal

### 使用时机总结

- 设计新 UI 组件、审查视觉一致性、实现响应式布局、优化用户流程时使用。

---

## 4. supabase（官方 skill，替代 better-auth-best-practices）

> 通过 `npx skills add supabase/agent-skills --skill supabase -a cursor` 安装，存放于 `.cursor/skills/supabase/`。

### 功能

Supabase 官方 Agent Skill，覆盖所有 Supabase 产品的认证、SSR 集成、数据库、RLS、迁移、MCP 用法。

### 在本项目中的应用场景

- **服务端认证**: `lib/server/auth-server.ts`（核心）、`lib/auth-server.ts`（历史，逐步迁移）；`@supabase/ssr` Cookie 管理；`getAll`/`setAll` 模式（不可用旧的 `get`/`set`/`remove`）
- **OAuth**: Google / xTwitter 登录流程 — middleware + callback 路由安全
- **邮箱链路**: verify / forgot-password / reset-password 页面与 Supabase Auth API 一致性
- **RLS 审查**: 所有 `migrations/032`–`042`，重点 040（Didit KYC）、042（ambassador 推荐计划）
- **MCP**: 连接 Supabase MCP 可让 agent 直接查询真实 schema 与 RLS 策略（见 `.cursor/mcp.json`）
- **测试覆盖**: `tests/e2e/auth-mock/`, `tests/e2e/auth-real/`

### 使用时机总结

- 实现或审查 Supabase Auth、RLS、迁移、Edge Functions、Storage 时使用。

---

## 5. supabase-postgres-best-practices

### 功能

Supabase 和 PostgreSQL 最佳实践。

### 在本项目中的应用场景

- **查询优化**: 避免 N+1、索引、并行查询 — `lib/posts.ts`, `app/home/page.tsx`
- **RLS**: 策略与数据最小化 — 所有表与查询
- **事务**: 多步操作 — `lib/paywall.ts` 解锁逻辑
- **迁移评审重点**: `migrations/032`~`038`（RLS/可见性、性能索引、钱包与解锁、年龄验证、support 相关表等；新迁移必须过 RLS 与支付/隐私审查）

### 使用时机总结

- 编写数据库查询、设计模式、实现 RLS、优化性能、处理事务时使用。
- **迁移评审重点**: `migrations/032`~`042`（新增：040 Didit KYC、042 creator ambassador program）；新迁移必须过 RLS 与支付/隐私审查。

---

## 6. audit-website

### 功能

全面的网站审计指南，涵盖性能、可访问性、SEO 和安全。

### 在本项目中的应用场景

- **性能**: Core Web Vitals、Bundle 大小、加载时间
- **可访问性**: WCAG、键盘导航
- **SEO**: Meta 标签、结构化数据 — `app/layout.tsx`
- **安全**: HTTPS、CSP、部署配置

### 使用时机总结

- 执行全站审计、审查性能指标、检查可访问性、分析 SEO、审查安全实践时使用。

---

## 其他 Skills（简要）

| Skill                                                    | 用途                                                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **code-check** (`code-check/SKILL.md`)                   | 用户说「检查代码」时跑 `pnpm check-all`（+ 可选 `build`）并解读输出                            |
| **agent-browser** (`agent-browser/SKILL.md`)             | 前端 agent-browser CLI 自动化测试与网页交互（含 `creator/studio/ambassador` 路由）             |
| **ui-ux-pro-max** (`ui-ux-pro-max/SKILL.md`)             | 按栈（含 Next/shadcn）检索设计数据 CSV，做 UI 一致性；脚本路径 `.cursor/skills/ui-ux-pro-max/` |
| **feishu-docs** (`feishu-docs/SKILL.md`)                 | 飞书文档为需求源时的读取与对齐流程                                                             |
| **ci-auto-fix**                                          | CI 失败分析与自动修复，互链 `scripts/ci/auto-monitor-and-fix.sh`                               |
| **planning-with-files** (`planning-with-files/SKILL.md`) | 规划与文件工作流（.cursor/plans、docs/planning）；ambassador PRD 首选                          |
| **e2e-test-setup**                                       | E2E 测试环境与 Playwright 配置；fixture 路径 `tests/e2e/shared/fixtures.ts`                    |
| **fixture-generator**                                    | 测试 fixture 生成                                                                              |
| **test-report-generator**                                | 测试报告生成（格式参考 `docs/reports/ui-walkthrough-*`）                                       |
| **ci-pipeline-config**                                   | CI 流水线配置（对齐 `.github/workflows/ci.yml`）                                               |
| **api-test-runner**                                      | API 测试运行；命令：`pnpm vitest run tests/integration/api/`                                   |
| **shadcn-ui**                                            | shadcn/ui 组件与 cn() 使用规范（Next 16 + Tailwind v4）                                        |

---

## 维护触发条件（新增）

以下任一变化发生时，必须同步更新 agent 与 skill 文档（至少更新 `SKILLS_APPLICATION_GUIDE.md` 和相关 `docs/agents/*.md`）：

1. 新增或重命名 App Router 路由（例如 `app/admin/*`、`app/auth/*`）。
2. 新增迁移文件（`migrations/*.sql`）且影响权限、账务、可见性或查询性能。
3. 新增或调整质量门禁命令（`package.json` scripts 中的 check/build/test/qa 命令）。
4. 新增测试目录或关键测试场景（例如 `tests/e2e/auth-real/`）。
5. 发布前发现 agent 输出与项目现状不一致。

维护标准：

- 文档变更必须写明“覆盖范围 + 命令 + 验证证据”。
- 如果无法即时更新，必须在 `docs/planning/sprint-current.md` 加一个 P1/P2 backfill 任务并注明截止条件。

---

## 总结：Skills 使用优先级

### 立即应用 (高优先级)

1. **react-best-practices** — 异步与 bundle 优化、Feed 加载
2. **supabase-postgres-best-practices** — 数据库查询与 N+1 避免
3. **web-design-guidelines** — 可访问性与 UX 审查

### 近期应用 (中优先级)

4. **frontend-design** — 设计一致性
5. **supabase**（官方 skill）— 安全与认证审查、RLS、迁移

### 按需应用 (低优先级)

6. **audit-website** — 定期全站审计

---

## 快速参考：何时使用哪个 Skill

| 任务                        | 使用的 Skill                                                        |
| --------------------------- | ------------------------------------------------------------------- |
| 编写新 React 组件           | react-best-practices                                                |
| 实现数据获取                | react-best-practices, supabase-postgres-best-practices              |
| 审查 UI                     | web-design-guidelines, frontend-design                              |
| 优化性能                    | react-best-practices, audit-website                                 |
| 数据库查询                  | supabase-postgres-best-practices                                    |
| 认证实现                    | supabase（官方 skill）                                              |
| 移动端/响应式               | frontend-design, web-design-guidelines                              |
| 全站审计                    | audit-website                                                       |
| 安全审查                    | supabase（官方 skill）、supabase-postgres-best-practices            |
| 前端自动化测试              | agent-browser                                                       |
| CI 修复与配置               | ci-auto-fix, ci-pipeline-config, api-test-runner                    |
| E2E/测试报告                | e2e-test-setup, fixture-generator, test-report-generator            |
| 发布门禁判定                | e2e-test-setup, test-report-generator, ci-pipeline-config           |
| 口语「跑一下检查」          | code-check（→ `pnpm check-all`）                                    |
| 设计系统深度对齐            | ui-ux-pro-max, frontend-design, shadcn-ui                           |
| Tab/布局跳变、触控尺寸、CLS | page-ia-review, web-quality-audit, impeccable                       |
| PRD 全量走查/发布前复核     | feature-qa-walkthrough, release-review-walkthrough, qa-gate         |
| 并行多 agent/防冲突         | parallel-agent-orchestration（+ `parallel-agent-coordination.mdc`） |

---

## 治理层自动同步（rule → agent/skill）

- 规则/门禁/路由/迁移变更受 `agent-skill-sync.mdc`（软）+ `.cursor/hooks/check-rule-sync.py`（`postToolUse` 硬层）双重约束：编辑治理文件会**自动注入同步清单**，必须在同一任务内同步 agent/skill/本指南并刷新日期。
- 门红与作者无关（内核 §1.4）：`pnpm check-all` 任一步红都必须修绿，哪怕是预存债或非本次改动。

---

_最后更新: 2026-07-26（补录 page-ia-review/impeccable/web-quality-audit/interface-design/qa-gate/feature-qa-walkthrough/release-review-walkthrough 索引；同步 UI 根治三次审查计划涉及的 agent 覆盖面变更；批次7 收尾校对：`tests/e2e/tab-stability.spec.ts` 落地后 e2e-test-setup 覆盖面新增跳变/CLS/触控断言，`chief-quality` 门禁盲区记录同步更新为"部分补齐"）_
