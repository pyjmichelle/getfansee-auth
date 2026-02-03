# 代码与 .cursor 全面审查报告

作为代码专家对当前**代码语言结构**、**.cursor 下 skills/agents** 使用情况，以及**页面加载与流畅度**的审查结论与可执行建议。

---

## 一、已修复的规则错误

### 1. Skill 文件名引用错误（已修）

- **问题**：`release-gate.prompt.md` 与 `ci-quality-enforcement.mdc` 中写的是 `supabase-postgres.skill.md`，实际文件名为 `supabase-postgres-best-practices.skill.md`。
- **处理**：已统一改为 `supabase-postgres-best-practices.skill.md`，避免 AI 按错误路径查找 skill。

---

## 二、.cursor/skills 审查结论

### 2.1 规则中明确要求使用的 Skills（保留并保持引用一致）

以下在 `release-gate.prompt.md` / `ci-quality-enforcement.mdc` 中被列为**必须使用**的 skills，**不要删**，且规则中已与真实文件名一致：

| Skill 文件                                  | 用途                                                        |
| ------------------------------------------- | ----------------------------------------------------------- |
| `better-auth-best-practices.skill.md`       | 认证/安全                                                   |
| `supabase-postgres-best-practices.skill.md` | 数据库/Supabase                                             |
| `shadcn-ui.skill.md`                        | UI 组件                                                     |
| `react-best-practices.skill.md`             | React/Next 性能（内部 name 为 vercel-react-best-practices） |
| `frontend-design.skill.md`                  | 前端设计                                                    |
| `e2e-test-setup.skill.md`                   | E2E 测试                                                    |
| `fixture-generator.skill.md`                | 测试 fixture                                                |
| `test-report-generator.skill.md`            | 测试报告                                                    |
| `ci-pipeline-config.skill.md`               | CI 配置                                                     |
| `api-test-runner.skill.md`                  | API 测试                                                    |

### 2.2 项目在用、规则未列但建议保留的 Skills

| Skill                            | 说明                                             | 建议                 |
| -------------------------------- | ------------------------------------------------ | -------------------- |
| `agent-browser/SKILL.md`         | 前端 agent-browser 测试脚本、文档多处引用        | **保留**             |
| `ci-auto-fix.skill.md`           | CI 自动修、plans 中引用                          | **保留**             |
| `planning-with-files/SKILL.md`   | 规划与文件工作流                                 | **保留**             |
| `audit-website.skill.md`         | 全站审计、性能/可访问性                          | **保留**（按需使用） |
| `web-design-guidelines.skill.md` | 可访问性/UX，SKILLS_APPLICATION_GUIDE 中高优先级 | **保留**             |

### 2.3 旧规则 / 低使用、可删或归档的 Skills

| Skill                                | 问题                                                             | 建议                                                                       |
| ------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **remotion-best-practices.skill.md** | 项目未使用 Remotion；SKILLS_APPLICATION_GUIDE 已写「当前不适用」 | **可删**。若将来做视频再加回。                                             |
| **building-native-ui.skill.md**      | 仅在一处注释提及；内容偏通用移动端，与 chief-\* 分工重叠         | **可删或归档**。移动端主要靠 frontend-design + react-best-practices 即可。 |
| **copywriting.skill.md**             | 仅指南内引用，规则未要求；偏文案类                               | **可选保留**。若不做系统化文案规范可删，减少噪音。                         |

### 2.4 需要更新的“旧规则”文档

| 文件                            | 问题                                                                                                                                                                                          | 建议                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SKILLS_APPLICATION_GUIDE.md** | 写的是「9 个 skills」，且未包含 agent-browser、ci-auto-fix、planning-with-files、e2e-test-setup 等；部分名称与文件名不一致（如 vercel-react-best-practices vs react-best-practices.skill.md） | **更新**：改为按当前 `.cursor/skills` 实际文件列表重写「已安装 skills」一节，并注明与 release-gate 必选 skills 的对应关系；remotion 若删除则从指南中移除。 |

---

## 三、.cursor/agents 审查结论

### 3.1 与 docs/agents 对应关系

- `docs/agents/` 存在 `00-authority-model.md` 及 `01-chief-product` … `11-chief-ai-automation`，与 `.cursor/agents` 中各 `chief-*.md` 的 `reference:` 一致，**无旧规则问题**。
- **例外**：`.cursor/agents/security-reviewer.md` 在 **docs/agents 中无对应文档**。
  - 若 security-reviewer 与 chief-security 职责重叠，可考虑合并到 chief-security 或单独补一篇 `docs/agents/12-security-reviewer.md`；
  - 若希望保留为独立角色，建议在 docs/agents 增加对应说明，便于和「权威模型」一致。

### 3.2 从未使用 / 可精简的 Agents

- 从引用看，**没有**在代码或脚本里直接“按名字调用”某个 agent；agents 主要被 **release-gate.prompt / rules** 用来做问题分派（按问题类型 dispatch）。
- **结论**：没有“从未用过的 agent 文件”需要删；若希望精简，可评估 **chief-data-experimentation**、**chief-trust-safety** 等是否在你们实际修复流程中真的被用到，若从不触发可归档，但删除需谨慎，因为规则表里列了这些角色。

---

## 四、.cursor/plans 是否旧规则、能否删

- 当前 plans（如 `ci-auto-monitor.md`、`push-and-pr_plan.md`）里含有**具体 PR/commit（如 feature/add-readme-badge、77b5b8d）**，属于历史执行记录。
- **建议**：视为**历史记录**，不当作“现行规则”。可整体移动到 `docs/archive/plans/` 或保留在 `.cursor/plans` 但注明「仅作历史参考」；新任务用 `docs/planning/sprint-current.md` 或 `_auto/<timestamp>-release-plan.md`，避免 AI 误读旧 plan 为当前要求。

---

## 五、代码结构与冗余、加载速度与流畅度

### 5.1 当前做得好的地方

- **根 layout**：只引入 Inter、Analytics（按 test 关闭）、AgeGate、Toaster、globals.css，无多余同步大依赖，有利于首屏。
- **Home 数据流**：`app/home/page.tsx` 已用 `Promise.all` 做 `canViewPost` 并行检查，无异步瀑布流，符合 react-best-practices/supabase 类 skill 的预期。
- **动态加载**：`app/creator/studio/page.tsx` 对图表用 `next/dynamic` 加载，有利于该路由首屏。

### 5.2 可进一步优化（加快页面加载与流畅度）

| 方向                          | 说明                                                                        | 建议                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **更多路由级 code splitting** | 除 studio 图表外，其它重组件（如 recharts、复杂表单、编辑器）未看到 dynamic | 对 recharts、大表单、富文本等做 `dynamic(..., { ssr: false })` 或带 loading 的 dynamic，减少主 bundle 和 TTI。 |
| **首屏 JS**                   | 未做全应用级的 bundle 分析                                                  | 跑 `pnpm build` 后看 `.next` 的 chunk 分布，把单 chunk 过大的路由拆成 dynamic。                                |
| **图片与媒体**                | 未在本审查中逐页查                                                          | 确保列表/Feed 用 next/image、合适尺寸与 priority，以提升 LCP 与流畅度。                                        |
| **冗余代码**                  | 未发现明显的重复业务逻辑块；`@/components` / `@/lib` 引用较多但属正常       | 保持「按需从 @/ 引用」即可；避免在 app 下新增大的 barrel index 一次性导出过多组件。                            |

### 5.3 与“规则/技能”无关的代码冗余

- **.cursor 下的 skills/agents/rules/plans** 本身**不参与前端构建**，不会影响页面加载速度；删除或归档未使用的 skill/agent 主要是**降低 AI 噪音、避免旧规则误导**，对运行时性能无直接影响。
- 页面是否冗余、能否加快加载，主要取决于：**bundle 体积、服务端数据请求方式、图片与关键 CSS**；当前看没有因“语言结构”或“项目结构”导致的明显冗余，可按上面 5.2 逐项做即可。

---

## 六、可执行清单（建议顺序）

1. **已完成**：将 `release-gate.prompt.md` 与 `ci-quality-enforcement.mdc` 中的 `supabase-postgres.skill.md` 改为 `supabase-postgres-best-practices.skill.md`。
2. **建议执行**：
   - 删除或归档：`remotion-best-practices.skill.md`（可选：`building-native-ui.skill.md`、`copywriting.skill.md`）。
   - 更新 `SKILLS_APPLICATION_GUIDE.md`：与当前 skills 列表及 release-gate 必选 skills 对齐；删除或标注已移除的 skill。
3. **可选**：为 `security-reviewer` 在 `docs/agents` 增加对应说明，或将职责合并进 chief-security。
4. **可选**：将 `.cursor/plans` 中过时执行记录迁到 `docs/archive/plans` 或加「仅历史参考」说明。
5. **性能**：对重组件/重库做 dynamic 拆分；用 build 分析 chunk；检查首屏图片与 next/image 使用。

### Phase 4 可选执行情况（已核对）

- **路由级 code splitting**：`app/creator/studio/page.tsx` 已对 `StudioChart`（recharts）使用 `next/dynamic` 且 `ssr: false`，其余页面未发现需拆分的重图表/富文本组件。
- **Bundle 分析**：建议后续运行 `pnpm build` 后查看 `.next` 的 chunk 分布，对单 chunk 过大的路由再考虑 dynamic 拆分。
- **next/image**：当前 `next.config.mjs` 为 `images.unoptimized: true`；Feed/媒体使用 `<img>` 且 URL 可能为 Supabase 外链或水印 blob。若启用 next/image，需先配置 `images.remotePatterns`（如 Supabase 域名）再在 `components/media-display.tsx` 等处逐步替换。

---

## 七、总结

- **规则错误**：Skill 文件名 `supabase-postgres.skill.md` 已修正为 `supabase-postgres-best-practices.skill.md`。
- **Skills**：必选 10 个保留；agent-browser、ci-auto-fix、planning-with-files、audit-website、web-design-guidelines 建议保留；remotion 可删，building-native-ui/copywriting 视需要删或归档；SKILLS_APPLICATION_GUIDE 需更新以反映当前列表与旧规则清理。
- **Agents**：与 docs/agents 基本一致；仅 security-reviewer 缺文档或可合并进 chief-security。
- **Plans**：属历史记录，建议归档或标注，避免被当现行规则。
- **代码与加载**：无严重结构冗余；首屏与流畅度可通过对重组件 dynamic 拆分、bundle 分析和图片优化继续提升；.cursor 配置本身不参与构建，不影响页面加载速度。

按上述清单执行后，当前代码与 .cursor 配置会更一致、更易维护，且有利于页面加载与流畅度进一步优化。
