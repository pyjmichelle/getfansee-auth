# create-t3-app 与 Next.js SaaS Starter 学习借鉴报告

> 面向当前项目（GetFanSee：Next.js + Supabase + 创作者/订阅 平台）的对比分析与可落地借鉴点。  
> 报告日期：2025-02-28

---

## 一、三个项目概览

| 维度         | create-t3-app               | Next.js SaaS Starter                | 当前项目 (GetFanSee)                   |
| ------------ | --------------------------- | ----------------------------------- | -------------------------------------- |
| **定位**     | 全栈类型安全脚手架 CLI      | 官方 SaaS 模板（开箱即用）          | 创作者/粉丝订阅与内容平台              |
| **Star**     | ~2.8 万                     | ~1 万+                              | -                                      |
| **前端**     | Next.js + Tailwind          | Next.js + Tailwind + shadcn/ui      | Next.js 16 + Tailwind + shadcn/ui      |
| **后端/API** | tRPC（类型安全 RPC）        | Route Handlers + Server Actions     | Route Handlers + `lib/*` 业务层        |
| **数据库**   | Prisma 或 Drizzle（二选一） | PostgreSQL + Drizzle                | Supabase (PostgreSQL + PostgREST)      |
| **认证**     | NextAuth.js                 | 邮件/密码 + JWT（或 Supabase Auth） | Supabase Auth + profiles.role          |
| **支付**     | 无内置                      | Stripe 订阅/结账/Webhook            | 自有支付/解锁逻辑                      |
| **类型安全** | 端到端（tRPC + ORM）        | Drizzle + Zod 校验                  | TypeScript + 部分 Zod，无统一 env 校验 |

---

## 二、create-t3-app：优劣势与适用场景

### 2.1 优势

- **类型安全第一**：tRPC 让前端调用后端像调本地函数，入参/出参全类型推导，减少手写 API 契约错误。
- **模块化、可选**：CLI 按需勾选 tRPC、Prisma/Drizzle、NextAuth、Tailwind，不堆砌无关依赖。
- **明确的设计哲学（T3 Axioms）**：
  - 只解决核心技术栈内的问题，不引入泛用状态库等。
  - “Bleed responsibly”：在非关键路径用新技术（如 tRPC），在数据层保守（SQL/成熟 ORM）。
- **环境变量规范**：`@t3-oss/env-nextjs` + Zod，服务端/客户端 env 分离、构建时与运行时校验，缺变量直接报错。
- **目录清晰**：`src/server/`（api/trpc、db、auth）与 `src/app/` 分离，服务端代码不混入前端包。
- **社区与文档**：文档全、示例多，适合作为“如何组织全栈 TS 项目”的参考。

### 2.2 劣势

- **非成品应用**：生成的是空白脚手架，没有支付、团队、仪表盘等业务；需要自己接 Stripe、Supabase 等。
- **认证方案**：默认 NextAuth，若你已深度使用 Supabase Auth，需要自行替换或适配。
- **无内置支付/订阅**：商业化能力要自己接。
- **学习成本**：tRPC 概念与 React Query 集成需要团队熟悉。

### 2.3 适用场景

- 新项目从零搭建，希望**类型安全 + 清晰边界**的全栈 TS 应用。
- 团队认可「API 即函数」、希望减少 REST 契约维护。
- 数据库选型为自建 Postgres/MySQL + Prisma 或 Drizzle，而非 Supabase 全家桶。

---

## 三、Next.js SaaS Starter：优劣势与适用场景

### 3.1 优势

- **业务完整**：登录、仪表盘、定价页、Stripe 订阅、Webhook、角色（Owner/Member）一应俱全，可直接在此基础上改。
- **技术栈与当前项目接近**：Next.js、Drizzle、shadcn/ui、PostgreSQL；部分版本使用 Supabase Auth，与当前项目一致。
- **支付闭环**：Stripe 定价表、Checkout、客户门户、订阅状态与 Webhook 处理，可直接参考计费与权限设计。
- **官方背书**：Vercel/Next.js 官方模板，长期维护，与 Next 新特性对齐快。
- **适合“先跑起来再迭代”**：克隆即可部署，适合 MVP 或内部工具型 SaaS。

### 3.2 劣势

- **API 层**：以 Route Handlers + Server Actions 为主，类型安全依赖手写类型与 Zod，无 tRPC 那种端到端推导。
- **定制多时**：若业务与模板差异大（如你们是创作者/粉丝/内容/付费墙），需要大量删改与抽象。
- **架构相对“页面驱动”**：更多是按页面/功能组织，而不是按领域（domain）或端口/适配器分层。

### 3.3 适用场景

- 需要**快速上线**的 B2B/B2C SaaS（订阅、团队、仪表盘）。
- 希望参考** Stripe 集成、订阅状态、权限与中间件**的写法。
- 技术选型与当前项目接近（Next + DB + shadcn），便于对照代码实现。

---

## 四、当前项目（GetFanSee）简要对照

- **已具备**：Supabase Auth、角色（fan/creator/admin）、中间件保护路由、`lib/*` 业务拆分（posts、paywall、wallet、subscriptions、kyc 等）、Route Handlers 与 Server Components。
- **与 T3 的差异**：无 tRPC、无统一 env 校验、服务端代码分布在 `lib/` 与 `app/api/`，未严格集中到 `server/`。
- **与 SaaS Starter 的差异**：无 Stripe 标准订阅流程、无官方 Drizzle 迁移流程；业务域更偏「内容 + 付费墙 + 创作者后台」，而非通用团队/租户 SaaS。

---

## 五、学习借鉴清单（按思路、架构、设计、代码实现）

### 5.1 思路与原则

| 来源             | 可借鉴点                                                 | 落地建议                                                                                        |
| ---------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **T3 Axioms**    | “Solve Problems”——只解决当前技术栈内的问题，不堆无关依赖 | 在 sprint/技术方案评审时显式问：这个依赖/模块是否解决我们当前栈内的具体问题？                   |
| **T3**           | “Typesafety Isn’t Optional”——类型安全不妥协              | 新 API、新 env 变量都要求类型或 Zod 校验，避免 `process.env.XXX` 裸用。                         |
| **SaaS Starter** | 支付与订阅是“一等公民”——定价、结账、Webhook、权限一体化  | 若有计划接入 Stripe/标准化订阅，可直接参考其 Stripe 目录与 Webhook 处理、订阅状态与 UI 的联动。 |

### 5.2 架构

| 来源             | 可借鉴点                                        | 落地建议                                                                                                                                                         |
| ---------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T3**           | 服务端代码集中到 `src/server/`（api、db、auth） | 在现有仓库中可渐进式做：新建 `src/server/` 或 `lib/server/`，将纯服务端逻辑（如 Supabase 服务端 client、部分 auth 逻辑）迁入，避免与前端共用入口树。             |
| **T3**           | tRPC 的“单一路由 + 多子 router”                 | 当前为多 Route Handler；若不想上 tRPC，可借鉴“按领域分 router”的思想：在 `lib/` 或 `app/api/` 下按 domain（posts、paywall、creator）组织，统一错误与鉴权中间件。 |
| **SaaS Starter** | 中间件统一保护“需登录”路由 + 角色               | 你们已有 creator/admin 保护；可再对照其“全局 middleware + 角色重定向”的实现，统一 401/403 与跳转逻辑。                                                           |
| **两者**         | 环境变量在应用入口处集中校验                    | 引入 `@t3-oss/env-nextjs` 或自建 `lib/env.ts`（Zod），在应用启动/构建时校验必需 env，缺则直接 fail，避免运行时才报错。                                           |

### 5.3 设计（产品/交互与安全）

| 来源             | 可借鉴点                              | 落地建议                                                                         |
| ---------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| **SaaS Starter** | 定价页 → Checkout → 客户门户的动线    | 若做“订阅档位 + 升级/降级”，可参考其页面划分与状态机（未订阅/已订阅/已取消等）。 |
| **SaaS Starter** | 活动/审计日志（谁在什么时候做了什么） | 若有合规或运营需求，可增加轻量 activity 表与写入点，便于后续审计。               |
| **T3**           | 服务端/客户端 env 严格分离            | 在 env 方案中明确 `NEXT_PUBLIC_*` 与仅服务端变量，避免敏感变量泄露到前端。       |

### 5.4 代码实现

| 来源             | 可借鉴点                                                  | 落地建议                                                                                                                                                                                     |
| ---------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T3**           | `src/env.js`：Zod schema + createEnv，client/server 分离  | 新增 `lib/env.ts`（或 `src/env.ts`），用 Zod 定义所有用到的 env，在 `middleware.ts` 与 `lib/supabase-server.ts` 等处改用 `env.NEXT_PUBLIC_SUPABASE_URL` 等，删除分散的 `getEnv()` 重复实现。 |
| **T3**           | 在 tRPC 的 context 中注入 db 与 session                   | 在你们的 Route Handler 或封装层中，统一“创建 Supabase client + 取当前用户”，避免每个 handler 重复写 getCurrentUser + createClient。                                                          |
| **SaaS Starter** | Stripe Webhook 的签名校验与幂等                           | 若接入 Stripe，直接参考其 `api/stripe/webhook` 的校验与事件处理结构；对非 Stripe 的 Webhook 也可沿用“签名 + 幂等”模式。                                                                      |
| **SaaS Starter** | Drizzle 的迁移与 seed 脚本                                | 当前使用 Supabase 管理表结构；若未来有“本地优先迁移”或多环境 schema 一致需求，可参考其 `db:setup` / `db:migrate` 与 seed 的脚本设计。                                                        |
| **两者**         | 错误返回格式统一（如 `{ error: string, code?: string }`） | 在 `app/api/` 或封装层约定统一 JSON 错误结构，便于前端与 E2E 一致处理。                                                                                                                      |

---

## 六、优先建议（针对当前项目）

1. **环境变量校验（高优先级）**  
   引入 `@t3-oss/env-nextjs` 或自建 Zod env 模块，在构建/启动时校验 `NEXT_PUBLIC_SUPABASE_*`、`SUPABASE_SERVICE_ROLE_KEY` 等，并逐步替换各处 `getEnv()` 与裸 `process.env`。

2. **服务端边界清晰（中优先级）**  
   将“仅服务端”逻辑（如 Supabase server client、部分 auth）集中到 `lib/server/` 或 `server/`，并坚持 `import "server-only"`，减少误在前端 bundle 中引用。

3. **API 与鉴权统一（中优先级）**  
   为 Route Handlers 提供统一封装：创建 Supabase client、获取当前用户、统一 401/403 与 JSON 错误格式，减少每个 handler 的样板代码。

4. **支付/订阅设计参考（按需）**  
   若规划标准化订阅与支付，直接克隆或参考 Next.js SaaS Starter 的 Stripe 相关目录与文档，再按“创作者/粉丝”模型做裁剪。

5. **类型安全强化（长期）**  
   不一定要上 tRPC；可先为关键 API 定义请求/响应类型与 Zod schema，并在服务端与调用端共用，逐步向“端到端类型安全”靠拢。

---

## 七、参考链接

- create-t3-app: <https://github.com/t3-oss/create-t3-app>
- T3 文档（目录结构、env、tRPC）：<https://create.t3.gg/>
- Next.js SaaS Starter: <https://github.com/vercel/nextjs>（examples 或独立 saas-starter 仓库）
- T3 Env：<https://env.t3.gg/>

---

_本报告基于公开文档与社区资料整理，具体实现以各仓库最新代码为准。_

---

## 八、已落地实现（2025-02-28）

- **环境变量校验**：已引入 `@t3-oss/env-nextjs`，新增 `lib/env.ts`，在构建/启动时校验 `NEXT_PUBLIC_SUPABASE_*` 等；`middleware`、`lib/supabase-*`、`lib/server/*` 已改为使用 `env`，移除分散的 `getEnv()`。
- **服务端边界**：已建立 `lib/server/`，将 `supabase-server`、`supabase-route`、`supabase-admin`、`auth-server`、`profile-server` 迁入并加 `server-only`；原 `lib/` 下对应文件改为 re-export，保持既有 import 路径兼容。
- **Route Handler 封装**：已新增 `lib/server/route-handler.ts` 与 `lib/route-handler.ts`，提供 `withAuth`、`jsonError`、`unauthorized`、`forbidden`、`badRequest`、`serverError`；`/api/feed`、`/api/user` 已改为使用 `withAuth` 与统一错误响应，其余 API 可按需逐步迁移。
