---
name: test-report-generator
description: 生成测试报告，汇总所有测试结果和覆盖率
triggers:
  - "生成测试报告"
  - "查看测试结果"
  - "测试覆盖率报告"
---

# 测试报告生成器

## 功能说明

自动收集并生成全面的测试报告，包括单元测试、集成测试和 E2E 测试的结果。

## 使用方式

```bash
# 生成完整测试报告
"生成完整测试报告"

# 生成特定类型报告
"生成单元测试报告"
"生成 E2E 测试报告"
"生成覆盖率报告"
```

## 报告内容

### 1. 测试概览

```markdown
# 测试报告

**生成时间**: 2024-01-15 10:30:00
**项目**: Authentication Flow Design
**版本**: 1.0.0

## 总体统计

| 测试类型 | 总数   | 通过   | 失败  | 跳过  | 通过率    |
| -------- | ------ | ------ | ----- | ----- | --------- |
| 单元测试 | 45     | 43     | 2     | 0     | 95.6%     |
| 集成测试 | 24     | 24     | 0     | 0     | 100%      |
| E2E 测试 | 18     | 16     | 2     | 0     | 88.9%     |
| **总计** | **87** | **83** | **4** | **0** | **95.4%** |
```

### 2. 单元测试详情

```markdown
## 单元测试 (Vitest)

### lib/auth.test.ts ✅

- ✅ ensureProfile - 为新用户创建 profile
- ✅ ensureProfile - 跳过已存在的 profile
- ✅ ensureProfile - 用户未登录时返回 null
- ✅ signUpWithEmail - 成功注册新用户
- ❌ signUpWithEmail - 处理注册错误
- ✅ signInWithEmail - 成功登录
- ✅ signInWithEmail - 处理登录错误
- ✅ signOut - 成功登出

### lib/paywall.test.ts ✅

- ✅ canViewPost - 允许查看免费帖子
- ✅ canViewPost - 允许 Creator 查看自己的帖子
- ✅ canViewPost - 拒绝未订阅用户查看订阅帖子
- ✅ canViewPost - 允许已订阅用户查看订阅帖子
- ✅ canViewPost - 拒绝未购买用户查看 PPV 帖子
- ✅ canViewPost - 允许已购买用户查看 PPV 帖子

### lib/wallet.test.ts ✅

- ✅ getWalletBalance - 返回正确的余额
- ✅ getWalletBalance - 返回 0 当钱包不存在时
- ✅ deposit - 成功充值
- ❌ deposit - 拒绝负数充值
- ✅ getTransactions - 返回交易历史

### lib/posts.test.ts ✅

- ✅ createPost - 接受 >= $1.00 的 PPV 价格
- ✅ createPost - 拒绝 < $1.00 的 PPV 价格
- ✅ createPost - 接受免费帖子
- ✅ listCreatorPosts - 返回 Creator 的帖子列表
```

### 3. 集成测试详情

```markdown
## 集成测试 (API Tests)

### tests/integration/api/posts.test.ts ✅

- ✅ POST /api/posts - 创建免费帖子
- ✅ POST /api/posts - 验证 PPV 价格 >= $1.00
- ✅ POST /api/posts - 创建有效的 PPV 帖子
- ✅ GET /api/posts/[id] - 获取帖子详情
- ✅ GET /api/posts/[id] - 返回 404 对于不存在的帖子

### tests/integration/api/paywall.test.ts ✅

- ✅ POST /api/subscribe - 成功订阅 Creator
- ✅ POST /api/subscribe - 拒绝重复订阅
- ✅ POST /api/unlock - 成功解锁 PPV 帖子
- ✅ POST /api/unlock - 拒绝重复购买
- ✅ POST /api/unlock - 拒绝余额不足的购买

### tests/integration/api/wallet.test.ts ✅

- ✅ GET /api/wallet/balance - 返回用户钱包余额
- ✅ GET /api/wallet/transactions - 返回用户交易历史
```

### 4. E2E 测试详情

```markdown
## E2E 测试 (Playwright)

### e2e/fan-journey.spec.ts ⚠️

- ✅ 邮箱注册新用户
- ✅ 邮箱登录已存在用户
- ✅ 查看 Creator 主页
- ✅ 订阅 Creator
- ❌ 解锁 PPV 帖子 (超时)
- ✅ 查看钱包余额

### e2e/creator-journey.spec.ts ✅

- ✅ Creator 注册和 Onboarding
- ✅ 创建免费帖子
- ✅ 创建订阅帖子
- ✅ 创建 PPV 帖子
- ✅ 编辑帖子
- ✅ 删除帖子
- ✅ 查看订阅者列表
- ✅ 查看收益

### e2e/complete-journey.spec.ts ⚠️

- ✅ 完整用户旅程 - 注册到购买
- ❌ 完整 Creator 旅程 - 发布到收益 (断言失败)
```

### 5. 代码覆盖率

```markdown
## 代码覆盖率

| 文件           | 语句      | 分支      | 函数      | 行        |
| -------------- | --------- | --------- | --------- | --------- |
| lib/auth.ts    | 85%       | 75%       | 90%       | 85%       |
| lib/paywall.ts | 92%       | 88%       | 95%       | 92%       |
| lib/wallet.ts  | 78%       | 70%       | 80%       | 78%       |
| lib/posts.ts   | 88%       | 82%       | 90%       | 88%       |
| **总计**       | **85.8%** | **78.8%** | **88.8%** | **85.8%** |

### 未覆盖代码

- `lib/auth.ts:45-50` - Google OAuth 回调处理
- `lib/wallet.ts:120-125` - 提现功能（未实现）
- `lib/posts.ts:200-210` - 批量删除功能
```

### 6. 失败测试分析

```markdown
## 失败测试分析

### 1. lib/auth.test.ts - signUpWithEmail 处理注册错误

**原因**: Mock 数据不正确
**影响**: 低
**修复建议**: 更新 Mock 返回值

### 2. lib/wallet.test.ts - deposit 拒绝负数充值

**原因**: 验证逻辑未实现
**影响**: 高
**修复建议**: 在 `deposit` 函数中添加负数检查

### 3. e2e/fan-journey.spec.ts - 解锁 PPV 帖子

**原因**: Playwright 超时，元素未找到
**影响**: 中
**修复建议**: 增加等待时间或修复选择器

### 4. e2e/complete-journey.spec.ts - 完整 Creator 旅程

**原因**: 收益金额断言错误
**影响**: 中
**修复建议**: 检查收益计算逻辑
```

### 7. 性能指标

```markdown
## 性能指标

| 测试类型 | 执行时间  | 平均时间/用例 |
| -------- | --------- | ------------- |
| 单元测试 | 2.5s      | 0.06s         |
| 集成测试 | 8.3s      | 0.35s         |
| E2E 测试 | 45.2s     | 2.51s         |
| **总计** | **56.0s** | **0.64s**     |
```

### 8. 趋势分析

```markdown
## 测试趋势

### 最近 5 次运行

| 日期       | 通过率 | 覆盖率 | 执行时间 |
| ---------- | ------ | ------ | -------- |
| 2024-01-15 | 95.4%  | 85.8%  | 56.0s    |
| 2024-01-14 | 93.1%  | 84.2%  | 58.3s    |
| 2024-01-13 | 91.8%  | 82.5%  | 60.1s    |
| 2024-01-12 | 89.7%  | 80.1%  | 62.5s    |
| 2024-01-11 | 88.5%  | 78.9%  | 65.2s    |

**趋势**: ✅ 通过率持续上升，覆盖率稳步提高
```

## 生成命令

```bash
# 运行所有测试并生成报告
pnpm test:unit && pnpm test:integration && pnpm test:e2e
pnpm vitest run --coverage
pnpm playwright test --reporter=html

# 查看报告
open coverage/index.html
open playwright-report/index.html
```

## 报告格式

支持多种输出格式：

- **Markdown**: 用于文档和 PR 评论
- **HTML**: 交互式网页报告
- **JSON**: 用于 CI/CD 集成
- **Terminal**: 命令行输出

## CI/CD 集成

在 CI 流程中自动生成报告：

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: pnpm test:all

- name: Generate Report
  run: pnpm test:report

- name: Upload Report
  uses: actions/upload-artifact@v3
  with:
    name: test-report
    path: test-report.html
```

## 最佳实践

1. **定期生成**：每次 PR 和 merge 前生成报告
2. **趋势跟踪**：记录历史数据，分析趋势
3. **失败分析**：详细记录失败原因和修复建议
4. **覆盖率目标**：设置最低覆盖率阈值（如 80%）
5. **性能监控**：跟踪测试执行时间，优化慢测试
