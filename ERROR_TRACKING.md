# 错误追踪报告

**生成时间**: 2026-01-17
**环境**: mvp.getfansee.com

---

## P0 错误（阻塞性 - 必须立即修复）

### [P0-001] Playwright 浏览器安装问题

- **发现时间**: 2026-01-17 09:14
- **页面**: N/A (测试环境)
- **重现步骤**:
  1. 运行 `pnpm playwright test`
  2. 错误：`Executable doesn't exist at /Users/puyijun/Library/Caches/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-mac-x64/chrome-headless-shell`
- **错误信息**: Playwright 浏览器未正确安装
- **影响**: 无法运行 E2E 测试
- **状态**: 🔴 待修复
- **建议修复**:
  - 运行 `pnpm exec playwright install --with-deps`
  - 或使用 Browser Extension 进行手动测试

### [P0-002] 购买记录缺少对应的交易记录

- **发现时间**: 2026-01-17 09:16
- **页面**: 数据库 - purchases 表
- **重现步骤**:
  1. 查询 `purchases` 表
  2. 查询对应的 `transactions` 表记录
  3. 发现 20 条购买记录中，0 条有匹配的交易记录
- **错误信息**: `No matching transaction found for purchase`
- **影响**:
  - 购买历史与交易记录不一致
  - 可能导致退款/对账问题
  - Creator 收益统计可能不准确
- **状态**: 🔴 待修复
- **数据详情**:
  - 总购买记录: 20
  - 匹配的交易记录: 0
  - 不匹配的记录: 20
- **建议修复**:
  - 检查 `rpc_purchase_post` 函数是否正确插入 transactions 记录
  - 验证 `metadata` 字段的 JSON 结构是否正确
  - 补充缺失的交易记录

### [P0-003] profiles 表缺少 username 字段

- **发现时间**: 2026-01-17 09:16
- **页面**: 数据库 - profiles 表
- **重现步骤**:
  1. 查询 `profiles` 表的 `username` 字段
  2. 错误：`column profiles.username does not exist`
- **错误信息**: `column profiles.username does not exist`
- **影响**:
  - Creator 查询失败
  - 无法验证 Creator 收益
  - 可能影响用户资料显示
- **状态**: 🔴 待修复
- **建议修复**:
  - 检查 profiles 表 schema
  - 确认正确的用户名字段名（可能是 `display_name`）
  - 更新数据完整性检查脚本使用正确的字段名

---

## P1 错误（严重 - 影响用户体验）

### [P1-001] E2E 测试无法运行

- **发现时间**: 2026-01-17 09:14
- **页面**: 测试环境
- **重现步骤**:
  1. 运行 Money Flow E2E 测试
  2. 测试失败，无法启动浏览器
- **错误信息**: 见 P0-001
- **影响**: 无法自动化验证核心功能
- **状态**: 🔴 待修复
- **建议修复**: 使用 Browser Extension 进行手动测试

---

## P2 错误（一般 - 可延后修复）

### [P2-001] 环境变量未设置

- **发现时间**: 2026-01-17 09:13
- **页面**: 环境配置
- **详情**:
  - `NEXT_PUBLIC_APP_URL`: 未设置
  - `NODE_ENV`: 未设置
- **影响**: 可能影响 OAuth 回调和环境识别
- **状态**: ⚠️ 警告
- **建议修复**: 在 `.env.local` 中添加这些变量

---

## 数据完整性问题总结

### 钱包余额一致性

- **状态**: ✅ 通过
- **检查数量**: 7 个钱包账户
- **结果**: 所有钱包余额与交易记录一致

### 购买记录一致性

- **状态**: ❌ 失败
- **检查数量**: 20 条购买记录
- **结果**: 0 条匹配，20 条不匹配
- **问题**: 购买记录没有对应的交易记录

### Creator 收益一致性

- **状态**: ❌ 失败
- **问题**: 无法查询 Creator（profiles.username 字段不存在）

---

## 待验证项目

### E2E 测试（未完成）

- ❌ Money Flow 护城河测试（4 个测试）
- ❌ Sprint 4 MVP 测试
- ❌ Paywall Flow 测试

### Browser Extension 测试（待执行）

- ⏳ Fan 用户完整旅程
- ⏳ Creator 用户完整旅程
- ⏳ 自动化可点击元素扫描

### Next.js 特定问题（待检查）

- ⏳ API Route 参数类型
- ⏳ useSearchParams Suspense 边界
- ⏳ Middleware 弃用警告
- ⏳ Server/Client 组件混用

---

## 优先级修复顺序

1. **立即修复（P0）**:
   - 修复 profiles 表 schema 问题
   - 修复购买记录与交易记录不匹配问题
   - 解决 Playwright 浏览器安装问题

2. **尽快修复（P1）**:
   - 完成 E2E 测试或使用 Browser Extension 测试

3. **计划修复（P2）**:
   - 添加缺失的环境变量

---

## 下一步行动

1. 使用 Browser Extension 进行手动测试（绕过 Playwright 问题）
2. 修复数据库 schema 问题
3. 验证 `rpc_purchase_post` 函数的交易记录插入逻辑
4. 重新运行数据完整性检查
5. 生成最终修复计划
