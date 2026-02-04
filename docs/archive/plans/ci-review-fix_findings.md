# Findings: CI Review and Fix

## Research Summary

- 已确认 `docs/planning/sprint-current.md` 存在并包含当前任务条目
- 阶段1系统扫描已完成（可靠性与质量），自动化扫描因资源耗尽未完成
- CI 工作流 `ci.yml` 中 QA gate 仅 `pnpm build` 后直接 `pnpm qa:gate`，未显式启动服务

## Code Analysis

- QA gate 依赖运行中的服务（`scripts/qa/check-server.sh`），CI 中可能失败
- Playwright webServer 依赖 `/api/health`，需确认端点存在
- 会话文件依赖 `artifacts/agent-browser-full/sessions/*.json`，CI 中未见生成步骤
- `scripts/qa/gate-ui.ts` 在会话缺失时直接 FAIL，并有多处硬编码等待
- `components/age-gate.tsx` 使用 client-only localStorage 状态，首屏渲染存在 hydration 风险
- `qa:gate` 脚本会先检查服务端口，再自动执行会话生成与 UI/deadclick/audit 全流程
- `scripts/qa/check-server.sh` 仅校验端口与 `/api/health`，不会自动启动服务

## External Resources

## Technical Notes

- CI 作业顺序：lint/type → build → qa-gate → e2e → quality-gate
- 已在 CI 的 QA Gate 作业中增加服务启动与健康检查
- `check-server.sh` 现在支持 lsof/ss/netstat 多种端口检测
