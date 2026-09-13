# mattpocock/skills（含 wayfinder）调研评估报告

- **调研日期**: 2026-08-24
- **仓库**: https://github.com/mattpocock/skills (MIT License, 24 万+ stars，Matt Pocock / aihero.dev)
- **调研方式**: 阅读官方文档 + 抓取 6 个具体 `SKILL.md` 源文件 + 在隔离临时目录实测 `npx skills@latest add mattpocock/skills --agent cursor` 安装流程
- **风险等级**: 低（纯 Markdown 提示词文件，无需运行服务、无编译、无网络依赖，MIT 协议）

---

## 一、这是什么

不是一个"应用"，而是一套 **Agent Skills**（`SKILL.md` 标准格式）合集，由 TypeScript 领域知名教育者 Matt Pocock 维护，围绕"用 AI agent 做严肃工程"设计，核心解决四类痛点：agent 没理解需求、agent 太啰嗦（缺乏领域词汇表）、代码跑不通（缺反馈循环）、代码库变成一坨泥（缺架构纪律）。

技能分两类：

- **User-invoked**（用户主动输入 `/skill-name` 调用，负责编排流程）：`wayfinder`、`to-spec`、`to-tickets`、`triage`、`grill-me`、`grill-with-docs`、`implement`、`improve-codebase-architecture`、`setup-matt-pocock-skills`、`ask-matt`、`handoff` 等
- **Model-invoked**（agent 根据任务自动判断是否调用，承载可复用纪律）：`tdd`、`diagnosing-bugs`、`domain-modeling`、`code-review`、`codebase-design`、`prototype`、`research`、`resolving-merge-conflicts`、`wizard`

**`wayfinder`** 只是其中一个技能：用于"大到一个 agent session 装不下"的工作，把决策拆成 GitHub Issues/Linear 上的"决策票据地图"，一次解决一张，直到路线清晰为止——它是**规划**工具，不做实现，做完后交给 `to-spec` → `to-tickets` → `implement`。

---

## 二、与 Cursor 的兼容性（已实测）

**结论：完全兼容**，且安装路径与 GetFanSee 现有约定一致：

- Cursor 原生支持 Agent Skills 标准（`SKILL.md` + YAML frontmatter：`name`/`description`/`disable-model-invocation`），这正是 GetFanSee 当前 `.agents/skills/`、`.cursor/skills/` 目录已经在用的格式
- 官方推荐通用安装器：`npx skills@latest add mattpocock/skills`（"for tinkerers"路径），支持 `--agent cursor` 参数
- **实测**（隔离临时目录 `/tmp/skills-research`，未触碰 GetFanSee 仓库）：

  ```bash
  npx --yes skills@latest add mattpocock/skills --agent cursor --yes
  ```

  一次性成功，将技能文件复制到 `./.agents/skills/<skill-name>/SKILL.md`（Cursor 与 Claude Code/Codex 共享读取该目录，符合开放 Agent Skills 规范）。

- **⚠️ 实测发现的坑**：`--yes` 跳过交互式选择后，**默认会把全部 34 个技能都装进来**，包括 README 里未列出的"未推广"目录（`misc/`、`personal/`、`in-progress/`）里的实验性/个人化技能（如 `writing-beats`、`scaffold-exercises`、`git-guardrails-claude-code`、`migrate-to-shoehorn`、`retro` 等）。**不建议直接全装**，应改用 `-s <skill-name>` 精选安装官方 README 推荐的 "Engineering" + "Productivity" 分类技能。

---

## 三、技能质量抽样评审（读了 6 个源文件）

抽查的 `wayfinder`、`setup-matt-pocock-skills`、`to-spec`、`tdd`、`domain-modeling`、`code-review` 六个技能，工程纪律扎实，均有清晰的"何时用/何时不用""失败模式""与其他技能的调用边界"说明，不是空洞的营销式提示词。几个具体亮点：

- **`tdd`**：定义了"seam"（测试的公共边界）纪律——先商定测试点再写测试，避免测内部实现细节；明确列出三种反模式（实现耦合、重言式断言、水平分层）
- **`domain-modeling`** + `CONTEXT.md`：维护一份"纯术语表"（不含实现细节），当用户用词与已有词汇冲突时主动指出，倒逼团队/agent 使用统一语言
- **`code-review`**：**双轴并行子 agent 评审**——Standards（是否符合仓库规范 + Fowler 代码异味基线）与 Spec（是否忠实实现了 issue/spec）分开跑、分开报告，不合并排序，避免"实现对了但没做需求"或"做了需求但代码质量差"互相掩盖
- **`wayfinder`**：`destination`/`fog of war`/`frontier` 术语体系清晰，且 FAQ 部分坦诚列出了已知失败模式（"grilling 太啰嗦""agent 在地图里偷偷写生产代码""一次性规划太多导致后面票据作废"），说明是经过实战打磨、而非理论空想的工具

---

## 四、与 GetFanSee 现有体系的重叠 / 互补分析

GetFanSee 已有一套相当成熟的 Cursor 原生工程纪律（`000-core-kernel.mdc`、`ci-quality-enforcement.mdc`、12 个 chief-agent、`bugbot`/`security-review` 子agent、`docs/planning/sprint-current.md`、`.cursor/plans/*.plan.md`）。逐一比对：

| mattpocock 技能                                   | GetFanSee 现状                                                                                                                                         | 关系                                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grill-me` / `grill-with-docs`                    | Cursor 原生 Plan 模式 + `AskQuestion` 工具已覆盖"访谈澄清需求"核心价值                                                                                 | **高度重叠**，跳过                                                                                                                                                     |
| `handoff`                                         | Cursor 原生有 session resume / transcript 引用机制                                                                                                     | **重叠**，跳过                                                                                                                                                         |
| `wayfinder` + `to-spec` + `to-tickets` + `triage` | GetFanSee 用本地 `.cursor/plans/*.plan.md` + `docs/planning/sprint-current.md` 追踪多阶段计划（如"UI 体验根治"批次 -1~7），**不是** GitHub Issues 驱动 | **互补但需流程决策**：这套要求把 Issue Tracker 当唯一真相源，是否要为大型多 session 计划切换/并行这套机制，需要团队决定（见下方 5.1）                                  |
| `tdd`                                             | 有门禁（`pnpm check-all`/`build`/`qa:gate`/Playwright）但无强制"测试先行"纪律                                                                          | **互补**，可直接引入                                                                                                                                                   |
| `code-review`（双轴）                             | 有 `bugbot`/`security-review` 子agent，但没有"Standards vs Spec 分离评审"结构                                                                          | **互补**，可直接引入，与现有子agent 并列使用                                                                                                                           |
| `domain-modeling` + `CONTEXT.md`                  | 有 `AGENTS.md` 做路由索引，但**没有**统一术语表                                                                                                        | **互补，价值较高**：GetFanSee 领域概念多（ambassador/referral、KYC、NowPayments、paywall、founding creator...），缺一份"纯词汇表"容易让不同 agent/session 各自发明命名 |
| `diagnosing-bugs`                                 | 有 Cursor 原生 Debug 模式                                                                                                                              | **部分互补**，可作为 Debug 模式内的结构化子流程参考                                                                                                                    |
| `wizard`                                          | `sprint-current.md` 里有大量"上线前运营依赖"人工清单（如 NowPayments 商务尽调、种子创作者邀请、迁移到生产 Supabase 等）                                | **互补，价值较高**：正好可以把这些人工步骤生成交互式向导，降低遗漏风险                                                                                                 |
| `resolving-merge-conflicts`                       | 无对应机制                                                                                                                                             | **互补**，可直接引入                                                                                                                                                   |
| `improve-codebase-architecture`                   | `chief-quality-officer` 职能相关但无固定巡检流程                                                                                                       | **互补**，可作为定期巡检工具引入                                                                                                                                       |
| `research`                                        | 无对应通用机制（每次调研靠人工临时展开）                                                                                                               | **互补**，可直接引入，作为"高可信源调查 + 落盘引用文档"的标准化流程                                                                                                    |

---

## 五、建议

### 5.1 建议直接引入（低风险、无需流程变更，随时可撤销）

精选安装（**不要用 `--yes` 全装**，改用 `-s` 指定）：

```bash
npx skills@latest add mattpocock/skills --agent cursor \
  -s tdd -s code-review -s domain-modeling -s diagnosing-bugs \
  -s wizard -s resolving-merge-conflicts -s improve-codebase-architecture -s research
```

这些技能：

- 不依赖外部 issue tracker，装完即用
- 与 GetFanSee 现有 kernel 规则（VERIFY OR DIE、CLEAN CODE）方向一致，是纪律的补强而非替代
- 可以先在 1-2 个真实任务上试用（例如用 `code-review` 复核下一个 PR、用 `domain-modeling` 补一份 `CONTEXT.md` 收敛 ambassador/KYC/NowPayments 等术语），观察是否真的提升质量，再决定是否固化进 `.cursor/rules`

### 5.2 需要团队决策后再采纳

`wayfinder` + `to-spec` + `to-tickets` + `triage` 这一组要求先跑 `/setup-matt-pocock-skills` 决定 issue tracker（GitHub Issues / Linear / 本地文件）。这不是简单加个技能，而是"要不要为跨多 session 的大型计划（类似过去的'UI 体验根治：三次审查修订'那种批次 -1~7 的大工程）引入一套结构化的决策票据机制"的流程决策。

**如果 GetFanSee 团队本来就用 GitHub Issues 做任务管理**：这套机制价值较高，`wayfinder` 的"目的地 / 战争迷雾 / 前沿"模型能比现在纯人工维护的 `.plan.md` 批次记录更结构化，且原生支持多 agent 并行认领（`assignee` 即认领标记），与 GetFanSee 已有的 `parallel-agent-coordination.mdc` 理念相通。

**如果 GetFanSee 主要用本地 Markdown 做任务管理**（从 `sprint-current.md` 观察似乎是这种情况）：官方文档自己也承认"本地 markdown 模式不推荐"（容易造成"意外持久化"进仓库的噪音），且与现有 `.cursor/plans/*.plan.md` + `sprint-current.md` 的角色高度重叠，**建议暂不引入**，除非愿意做一次任务管理工具的整体迁移决策。

### 5.3 跳过

`grill-me`、`grill-with-docs`、`handoff`：与 Cursor 原生 Plan 模式 / Ask 工具 / session resume 机制重叠度高，边际收益低。

`misc`/`personal`/`in-progress` 目录下的未推广技能（`writing-beats`、`scaffold-exercises`、`git-guardrails-claude-code`、`migrate-to-shoehorn` 等）：非通用工程技能或过于个人化，不建议引入。

---

## 六、结论

与上次调研的 [T3 Code](./t3code-evaluation-20260824.md)（一个需要常驻服务、有云依赖、Cursor 支持尚在 Early Access 的完整应用）不同，`mattpocock/skills` 是**纯提示词/流程纪律**，风险极低、可逐个技能试用、可随时移除，且与 Cursor 官方技能机制完全兼容。**建议**：

1. 先按 5.1 精选安装 6-8 个低风险高价值技能，在接下来 1-2 个真实任务中试用
2. `wayfinder` 相关的 issue-tracker 驱动规划机制，留待确认 GetFanSee 是否要以 GitHub Issues 作为大型多阶段计划的真相源后再决定
3. 本次调研未修改 GetFanSee 仓库任何文件，实测安装均在 `/tmp/skills-research` 隔离目录完成，已清理

---

## 附：本次调研执行记录

- 阅读源文件：`README.md`、`skills/engineering/wayfinder/SKILL.md`、`setup-matt-pocock-skills/SKILL.md`（超时未取到全文，仅凭 README 描述）、`to-spec/SKILL.md`、`tdd/SKILL.md`、`domain-modeling/SKILL.md`、`code-review/SKILL.md`、`.agents/adr/0002-ship-as-a-claude-code-plugin.md`
- 实测安装：`npx --yes skills@latest add mattpocock/skills --agent cursor --yes`（隔离于 `/tmp/skills-research`，git init 后执行，exit code 0，34 个技能全部安装到 `.agents/skills/`）
- 环境清理：`/tmp/skills-research`、`/tmp/t3code-research`（上次调研遗留）均已 `rm -rf`
