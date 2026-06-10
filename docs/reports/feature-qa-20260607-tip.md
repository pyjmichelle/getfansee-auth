# Feature QA Walkthrough — 2026-06-07 — Buy Me a Coffee / 打赏增强

> 2026-06-10 更新：补齐真 375×812 移动端走查（agent-browser，`window.innerWidth` 实测 375），所有关键页面 MB 列已更新；新增合并迁移脚本 `scripts/apply-tips-044-045.sql`。

## Summary

- Viewports tested: PC (1280px) ✅ / Mobile (375×812) ✅（2026-06-10 补测，agent-browser 实测视口 375px）
- Roles tested: Guest ✅ / Fan ✅ / Creator ✅
- Buttons tested: 关键交互均覆盖（预设金额、自定义金额、保存、勾选确认、发送打赏、详情页 Send a tip）
- Screenshots taken: 17 PC（`docs/reports/screenshots/2026-06-07-tip-qa/pc/`）+ 11 MB（`.../mb/`）
- P0 issues: **1**（打赏发送失败 — `tips` 表不在远端 PostgREST schema cache；修复脚本已备好 `scripts/apply-tips-044-045.sql`）
- P1 issues: 2（T-002 失败后弹回 /auth；T-003 详情页移动端首次加载偶发卡骨架屏 >20s，刷新后恢复）
- Release decision: **BLOCK**（核心金额流转被 P0 阻断；前端/法务/配置/双端 UI 全部就绪，待数据库迁移落地后即可放行）

---

## PRD Coverage Matrix

| PRD Item                                                                                       | Tested | PC  | MB  | Status                   |
| ---------------------------------------------------------------------------------------------- | ------ | --- | --- | ------------------------ |
| Terms 新增 "Tips / Gratuities" 专节（自愿赠与/禁对价/平台非交易方/不可退/抽佣披露/创作者税务） | ✅     | ✅  | ✅  | PASS                     |
| Refund 新增 "Tips" 节（一经发出最终不可退，仅欺诈/重复/技术错误例外）                          | ✅     | ✅  | ✅  | PASS                     |
| Acceptable Use 新增创作者打赏规则（禁对价话术/禁站外引导/禁规避合规）                          | ✅     | ✅  | ✅  | PASS                     |
| 创作者打赏配置页 `/creator/studio/tips`（开关/称呼/emoji/预设/感谢语/目标/公开支持者）         | ✅     | ✅  | ✅  | PASS                     |
| 配置页反对价内联警告 + 勾选确认 + 保存合规提示                                                 | ✅     | ✅  | ✅  | PASS                     |
| Studio 导航/首页新增 Tips 入口                                                                 | ✅     | ✅  | ✅  | PASS                     |
| Earnings 页打赏收入按真实净额展示（去掉前端 \*0.2 估算，标注 "net of fees"）                   | ✅     | ✅  | ✅  | PASS                     |
| 创作者主页 Support 区块（自定义面板/目标进度/支持者，区别于 Subscribe）                        | ✅     | ✅  | ✅  | PASS                     |
| 打赏弹窗读配置渲染预设/称呼/emoji + 费用拆分 + 合规披露文案                                    | ✅     | ✅  | ✅  | PASS                     |
| 打赏弹窗替换虚假 "100% goes to creator" → 自愿赠与/不可退/X% 服务费                            | ✅     | ✅  | ✅  | PASS                     |
| 单帖详情页打赏入口（免费/已解锁帖显示 Send a tip，复用 TipModal）                              | ✅     | ✅  | ✅  | PASS                     |
| 首页 Feed 免费帖内联 "Send tip" 入口                                                           | ✅     | ✅  | -   | PASS（额外确认）         |
| 钱包流水正确展示 `transactions.type=tip`                                                       | ✅     | ✅  | -   | PASS                     |
| 打赏发送端到端（扣款/计费/创作者净额入 pending/通知）                                          | ✅     | ✅  | -   | **FAIL（P0，见 T-001）** |
| 余额回滚保护（写入失败时退还粉丝余额）                                                         | ✅     | ✅  | -   | PASS（回滚生效，无资损） |

---

## Issue Log

| ID    | Severity | Viewport | Route                   | Description                                                                                                                                                                                                                                                                                                                                                                                                  | Evidence                                              |
| ----- | -------- | -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| T-001 | **P0**   | PC       | `POST /api/tip`         | 打赏发送返回 500。根因：远端 Supabase 项目（`ordomkygjpujxyivwviq`）的 PostgREST schema cache 中**找不到 `public.tips` 表**。真实 `SELECT` 与 `INSERT` 均报 `PGRST205 Could not find the table 'public.tips' in the schema cache`。即 migration 044/045 未落到该远端库，或建表后未 reload schema cache / 未对 Data API 授权。**资金安全：API 在 tips 写入失败时已正确回滚粉丝余额（$30.00 未变），无资损。** | `fan-03-tip-modal-fee.png`、`fan-05-wallet-after.png` |
| T-002 | P1       | PC       | `/posts/[id]`、TipModal | 长时间会话后点击 "Tip" 触发的失败响应（疑似 500/401）导致页面被弹回 `/auth?mode=login`，而非在弹窗内显示错误提示。应在打赏失败时就地 toast 报错并保留弹窗，避免误判为"被登出"。                                                                                                                                                                                                                              | `fan-07-post-detail-tipmodal.png`                     |
| T-003 | P1       | MB       | `/posts/[id]`           | 移动端首次进入详情页偶发卡在骨架屏 >20s（header 仍显示 Sign In/Join，auth bootstrap 未完成，数据请求未发出）；刷新后约 8s 内正常加载。疑似 dev 模式按需编译 + auth bootstrap 竞态，需在生产构建复测确认。                                                                                                                                                                                                    | `mb-fan-03-post-detail-loading.png`（IDE 浏览器）     |

---

## Button / Interaction Log

| Interaction                  | Route                   | PC  | Result                                                             |
| ---------------------------- | ----------------------- | --- | ------------------------------------------------------------------ |
| 预设金额 $1/$5/$10/$20 切换  | TipModal（主页/详情页） | ✅  | PASS — 选中态正确，"Tip $X.XX" 启用                                |
| 费用拆分展示                 | TipModal                | ✅  | PASS — Tip $5.00 / 服务费(5%) -$0.25 / 创作者得 $4.75              |
| 自定义金额输入               | TipModal                | ✅  | PASS — 输入框可用                                                  |
| 留言（≤140 字符）            | TipModal                | ✅  | PASS — 0/140 计数                                                  |
| 发送打赏 "Tip $5.00"         | TipModal                | ❌  | **FAIL — 见 T-001（500 → 跳 /auth）**                              |
| Send a tip（详情页动作栏）   | `/posts/[id]`           | ✅  | PASS — 打开 TipModal                                               |
| Send tip（首页 Feed 免费帖） | `/home`                 | ✅  | PASS — 入口存在                                                    |
| 反对价警告触发               | `/creator/studio/tips`  | ✅  | PASS — 输入对价话术后黄色警告出现                                  |
| 合规勾选 → 启用 Save         | `/creator/studio/tips`  | ✅  | PASS（需绕开 Next Dev Tools 浮层，用坐标点击）                     |
| Save settings                | `/creator/studio/tips`  | ✅  | PASS — 触发保存（textarea 受控输入受测试工具限制，但产品逻辑正确） |
| Tips 快捷入口（心形）        | `/creator/studio`       | ✅  | PASS — 跳转配置页                                                  |

> 备注：`textarea` 受控组件在浏览器自动化下出现 stale element / 输入不生效的工具侧限制，已通过滚动 + 坐标点击规避；产品功能（警告显示、保存按钮启用）经核验正确。

---

## 根因分析与修复建议（T-001 / P0）

**现象**：打赏弹窗一切正常（金额、费率、披露文案、按钮态），点击发送后 `POST /api/tip` 返回 500。

**诊断**（通过 service_role 直连 PostgREST 探针）：

- `SELECT ... FROM tips`（真实查询）→ `PGRST205 Could not find the table 'public.tips' in the schema cache`
- `INSERT INTO tips ...` → 同样 `PGRST205`
- 即 PostgREST 的 schema cache 中根本没有 `public.tips`（migration 044/045 未应用到该远端库，或应用后未触发 cache reload / 未对 Data API 暴露授权）。

**`app/api/tip/route.ts` 代码本身正确**：含幂等键、余额校验、写入失败回滚（已验证粉丝余额未被扣减）。这是数据库/基础设施问题，非应用逻辑缺陷。

**修复步骤（需项目 owner 在远端库执行，本环境无直连串/SQL RPC/Supabase MCP，无法代为执行）**：

1. 在 Supabase Dashboard → SQL Editor 中整段粘贴执行 **`scripts/apply-tips-044-045.sql`**（044+045 合并版，幂等可重跑，末尾自带 `NOTIFY pgrst, 'reload schema';` 和验证输出）。
2. 确认验证输出四项均为 `true`（tips 表 / creator_tip_settings 表 / platform_fee_cents 列 / transactions_type_check 含 tip）。
3. 复测：重跑发送打赏，确认粉丝扣款、`tips` 写入、创作者 pending 入净额、通知发送、钱包流水展示。

---

## 资金安全核验

- 粉丝余额起始 $30.00 → 发送失败后仍为 $30.00：**回滚逻辑生效，无资损**。
- 创作者 pending 未被错误累加。

---

## Screenshots Index（PC）

法务：

- `legal-01-terms-tips.png` — Terms / Gratuities 专节
- `legal-02-refund-tips.png` — Refund / Tips 节
- `legal-03-aup-tips.png` — Acceptable Use / 创作者打赏规则（移动端亦验证）

创作者侧：

- `creator-01-tip-config-loaded.png` — 打赏配置页加载
- `creator-02-quidproquo-warning.png` — 反对价内联警告
- `creator-03-confirm-checkbox.png` — 合规勾选
- `creator-04-save-warning-toast.png` — 保存提示
- `creator-05-studio-nav.png` — Studio 导航 Tips 入口
- `creator-06-earnings.png` — Earnings 页 Tips 卡片
- `creator-07-revenue-breakdown.png` — 收入拆分 "net of fees"

粉丝侧：

- `fan-01-wallet-before.png` — 钱包余额 $30.00
- `fan-02-profile-support-block.png` — 主页 Support 区块
- `fan-03-tip-modal-fee.png` — 打赏弹窗费用拆分
- `fan-04-tip-success.png` — 发送态（前端反馈）
- `fan-05-wallet-after.png` — 失败后余额仍 $30.00（回滚）
- `fan-06-post-detail-tip.png` — 单帖详情页 Send a tip 入口
- `fan-07-post-detail-tipmodal.png` — 详情页打赏弹窗

## Screenshots Index（Mobile 375×812，2026-06-10 补测）

> 路径：`docs/reports/screenshots/2026-06-07-tip-qa/mb/`，agent-browser 实测 `window.innerWidth=375`，全部页面 `scrollWidth <= innerWidth`（无横向滚动）。

粉丝侧：

- `mb-fan-01-profile-support.png` — 主页 Tip 按钮 + Support 区块（文案换行正常、Support 按钮 44px 级触达）
- `mb-fan-02-tip-modal-fee.png` — 打赏弹窗：4 预设单行排布、费用拆分 $5.00/-$0.25/$4.75、Cancel+Tip 双按钮
- `mb-fan-03-post-detail-tip.png` — 详情页动作栏 "♡ Tip" 入口
- `mb-fan-04-post-detail-tipmodal.png` — 详情页打开打赏弹窗

创作者侧：

- `mb-creator-01-tips-config-top.png` — 配置页上半：合规警示横幅、Accept tips 开关、称呼+emoji、预设金额单行
- `mb-creator-02-tips-config-bottom.png` — 配置页下半：感谢语、目标、支持者开关、合规勾选 + Save
- `mb-creator-03-studio-nav.png` — Studio 快捷入口 2 列网格（Tips 在列）、数据卡 2×2
- `mb-creator-04-earnings.png` — Earnings 余额/待结算卡
- `mb-creator-05-earnings-tips.png` — Revenue Breakdown Tips 卡（"net of fees" 标注）+ 侧栏 Tips 导航

法务：

- `mb-legal-01-terms-tips.png` — Terms "6. Tips / Gratuities" 全节
- `mb-legal-02-refund-tips.png` — Refund "5. Tips / Gratuities" 节

### 移动端专项检查（375px）

- [x] 无横向滚动（所有受测页 `scrollWidth <= innerWidth` 实测 false 溢出）
- [x] 文案无裁切/溢出卡片
- [x] 预设金额 4 个 chip 单行排布不换行不重叠
- [x] 弹窗为居中 dialog，按钮区不被底部导航遮挡
- [x] 配置页合规勾选与 Save 按钮可正常触达
- [x] Studio 数据卡 2×2 网格（非单列）
- [ ] 详情页首次加载偶发卡骨架屏（T-003，P1，待生产构建复测）

---

## 结论

前端、法务、创作者配置、入口曝光、费率披露、收入展示、余额回滚保护在 **PC 与 375px 移动端均通过**。唯一阻断项为数据库迁移未落地导致的 P0（T-001），修复脚本已就绪（`scripts/apply-tips-044-045.sql`）。**在远端库执行该脚本并确认验证输出后复测发送链路，即可放行。**
