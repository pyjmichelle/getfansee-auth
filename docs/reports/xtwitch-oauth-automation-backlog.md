# X/Twitch OAuth 自动化 Backlog

## 阶段 1（已落地）

- 手动 smoke 脚本：`scripts/auth/xtwitch-manual-smoke.ts`
- 结果留档：`artifacts/qa/auth-smoke/<provider>/`
- CI 定位：非阻断，手动执行

## 阶段 2（半自动）

目标：减少 provider 登录交互成本，重点验证回站后的站内授权结果。

- [ ] 一次性人工登录后导出 `storageState`
- [ ] 使用 `storageState` 回归受保护页面访问
- [ ] 增加 session 过期重建流程（失败自动提示重录）

建议脚本：

- `pnpm test:session:export:fan`（现有）
- 新增 `pnpm test:auth:xtwitch:state-smoke`（后续）

## 阶段 3（全自动）

目标：实现 provider 级别全自动（与 Google 同等级）。

- [ ] 引入专用测试账号（X、Twitch）
- [ ] 补充 provider 页面交互脚本（输入账号、密码、授权）
- [ ] 对验证码/风控分支做隔离：触发时自动标记 `quarantined`
- [ ] 将稳定用例接入定时流水线，仍保持主 CI 非阻断

## 风险与缓解

- 风控策略变化 -> 采用弹性 locator + URL 阶段断言
- 账号冻结/限流 -> 维护多组测试账号，轮换使用
- 第三方波动 -> 独立 job + 重试 + 非阻断策略
