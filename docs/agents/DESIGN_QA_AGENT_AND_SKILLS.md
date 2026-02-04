# Design QA / 前端任务：正确的 Agent 与 Skills

做 **Design QA、全站 UI 审计、前端一致性、截图与清单** 时，请按下面方式使用 **Agent** 和 **Skills**，保证和项目规范一致。

---

## 1. 使用哪个 Agent

| 任务类型                                 | Agent                        | 说明                                                 |
| ---------------------------------------- | ---------------------------- | ---------------------------------------------------- |
| **Design QA、UI 一致性、页面/路由/交互** | **chief-frontend-architect** | 负责所有用户可见行为与交互，出 [Chief Frontend Spec] |
| **验收标准、测试覆盖、发布门禁**         | **chief-quality-officer**    | 负责 DoD、验证范围、PASS/FAIL、发布建议              |

**Design QA Lead + UI System Engineer** 场景下，主用 **chief-frontend-architect**；需要定验收标准、写 Playwright 断言、发布门禁时，可让 **chief-quality-officer** 参与。

---

## 2. 使用哪些 Skills（按优先级）

| 优先级 | Skill                     | 路径                                            | 何时用                                                                                |
| ------ | ------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| **P0** | **planning-with-files**   | `.cursor/skills/planning-with-files/SKILL.md`   | 多步骤任务：先建 plan/findings/progress，再执行；sprint backlog 写进 `docs/planning/` |
| **P0** | **frontend-design**       | `.cursor/skills/frontend-design.skill.md`       | 设计一致性、排版/间距/层级、响应式、可访问对比度                                      |
| **P0** | **shadcn-ui**             | `.cursor/skills/shadcn-ui.skill.md`             | Button/Tabs/Input/Checkbox 等 variant 统一、CVA、`cn()`                               |
| **P1** | **web-design-guidelines** | `.cursor/skills/web-design-guidelines.skill.md` | 可访问性、键盘、焦点、表单错误、UX 审查                                               |
| **P1** | **e2e-test-setup**        | `.cursor/skills/e2e-test-setup.skill.md`        | Playwright 截图脚本、稳定等待、testid、断言                                           |
| **P2** | **agent-browser**         | `.cursor/skills/agent-browser/SKILL.md`         | 快速验证/探索页面、CLI 截图与快照（与 Playwright 互补）                               |
| **P2** | **audit-website**         | `.cursor/skills/audit-website.skill.md`         | 全站审计：性能、a11y、SEO、安全                                                       |

---

## 3. 协作方式（和你一起做 Design QA 时）

1. **先声明角色与技能**  
   例如：

   > 本次以 **chief-frontend-architect** 执行，遵循 **planning-with-files**、**frontend-design**、**shadcn-ui**。

2. **多步骤任务用 planning-with-files**
   - 建 `.cursor/plans/design_qa_plan.md`（目标、阶段、当前状态、错误日志）
   - 需要时建 `design_qa_findings.md`、`design_qa_progress.md`
   - 产出写进 `docs/design/`、`docs/planning/sprint-current.md`

3. **证据 → 结论 → 修复映射**
   - 证据：截图路径、DOM/选择器、组件/文件名
   - 结论：具体问题（不写“可能”“大概”）
   - 修复：token / 组件 / 页面 class，并标影响范围

4. **验收与门禁**
   - 需要可执行验收时，引用 **chief-quality-officer**：DoD、Playwright 断言、发布建议

---

## 4. 在 Cursor 里怎么用

- **对话时**：直接说

  > “用 chief-frontend-architect + planning-with-files + frontend-design + shadcn-ui 做 Design QA / 全站 UI 清单。”

- **规则里**（可选）：在 `.cursor/rules` 里加一条，例如：
  > Design QA / 全站 UI 审计任务：先派给 chief-frontend-architect；必须使用 planning-with-files、frontend-design、shadcn-ui；多步骤需建 plan/findings；产出落 docs/design 与 docs/planning。

---

## 5. 快速对照

| 你要做的                              | Agent                                            | Skills                                                                 |
| ------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| 全站 Design QA 清单、Top 20 UI 不一致 | chief-frontend-architect                         | planning-with-files, frontend-design, shadcn-ui, web-design-guidelines |
| 截图脚本 + 断言 + 验收标准            | chief-frontend-architect + chief-quality-officer | e2e-test-setup, planning-with-files                                    |
| 只改 token/组件、不动页面             | chief-frontend-architect                         | shadcn-ui, frontend-design                                             |
| 全站审计（性能/a11y/SEO）             | chief-frontend-architect                         | audit-website, web-design-guidelines                                   |

---

_与 `.cursor/agents/chief-frontend.md`、`.cursor/skills/SKILLS_APPLICATION_GUIDE.md` 保持一致。_
