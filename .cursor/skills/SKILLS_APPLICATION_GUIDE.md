# Skills 应用指南

本文档说明当前已安装的 skills 及与 release-gate 必选列表的对应关系。

**Release-gate 必选 (10 个)**：better-auth-best-practices、supabase-postgres-best-practices、shadcn-ui、react-best-practices、frontend-design、e2e-test-setup、fixture-generator、test-report-generator、ci-pipeline-config、api-test-runner。

**项目保留 (5 个)**：agent-browser、ci-auto-fix、planning-with-files、audit-website、web-design-guidelines。

## 项目技术栈概览

- **框架**: Next.js 16 (App Router), React 19
- **语言**: TypeScript (严格模式)
- **数据库**: Supabase (PostgreSQL)
- **认证**: Supabase Auth
- **UI 库**: shadcn/ui (基于 Radix UI) + Tailwind CSS
- **测试**: Playwright (E2E), Vitest (单元测试)

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

## 4. better-auth-best-practices

### 功能

认证实现最佳实践（Better Auth 或类似库）。

### 在本项目中的应用场景

- **安全实践**: 会话管理、错误处理、速率限制 — `lib/auth.ts`, `lib/auth-server.ts`, AuthPageClient, API 路由
- **OAuth**: Google 登录流程安全 — `lib/auth.ts` (signInWithGoogle)

### 使用时机总结

- 实现认证流程、审查安全实践、处理会话、实现 OAuth 时使用。

---

## 5. supabase-postgres-best-practices

### 功能

Supabase 和 PostgreSQL 最佳实践。

### 在本项目中的应用场景

- **查询优化**: 避免 N+1、索引、并行查询 — `lib/posts.ts`, `app/home/page.tsx`
- **RLS**: 策略与数据最小化 — 所有表与查询
- **事务**: 多步操作 — `lib/paywall.ts` 解锁逻辑

### 使用时机总结

- 编写数据库查询、设计模式、实现 RLS、优化性能、处理事务时使用。

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

| Skill                                                    | 用途                                             |
| -------------------------------------------------------- | ------------------------------------------------ |
| **agent-browser** (`agent-browser/SKILL.md`)             | 前端 agent-browser CLI 自动化测试与网页交互      |
| **ci-auto-fix**                                          | CI 失败分析与自动修复，与 plans 配合使用         |
| **planning-with-files** (`planning-with-files/SKILL.md`) | 规划与文件工作流（.cursor/plans、docs/planning） |
| **e2e-test-setup**                                       | E2E 测试环境与 Playwright 配置                   |
| **fixture-generator**                                    | 测试 fixture 生成                                |
| **test-report-generator**                                | 测试报告生成                                     |
| **ci-pipeline-config**                                   | CI 流水线配置                                    |
| **api-test-runner**                                      | API 测试运行与断言                               |
| **shadcn-ui**                                            | shadcn/ui 组件与 cn() 使用规范                   |

---

## 总结：Skills 使用优先级

### 立即应用 (高优先级)

1. **react-best-practices** — 异步与 bundle 优化、Feed 加载
2. **supabase-postgres-best-practices** — 数据库查询与 N+1 避免
3. **web-design-guidelines** — 可访问性与 UX 审查

### 近期应用 (中优先级)

4. **frontend-design** — 设计一致性
5. **better-auth-best-practices** — 安全与认证审查

### 按需应用 (低优先级)

6. **audit-website** — 定期全站审计

---

## 快速参考：何时使用哪个 Skill

| 任务              | 使用的 Skill                                                 |
| ----------------- | ------------------------------------------------------------ |
| 编写新 React 组件 | react-best-practices                                         |
| 实现数据获取      | react-best-practices, supabase-postgres-best-practices       |
| 审查 UI           | web-design-guidelines, frontend-design                       |
| 优化性能          | react-best-practices, audit-website                          |
| 数据库查询        | supabase-postgres-best-practices                             |
| 认证实现          | better-auth-best-practices                                   |
| 移动端/响应式     | frontend-design, web-design-guidelines                       |
| 全站审计          | audit-website                                                |
| 安全审查          | better-auth-best-practices, supabase-postgres-best-practices |
| 前端自动化测试    | agent-browser                                                |
| CI 修复与配置     | ci-auto-fix, ci-pipeline-config, api-test-runner             |
| E2E/测试报告      | e2e-test-setup, fixture-generator, test-report-generator     |

---

_最后更新: 2026-01-28_
