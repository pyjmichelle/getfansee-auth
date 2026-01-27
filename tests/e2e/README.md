# GetFanSee 端到端测试文档

## 测试结构

### 测试文件

1. **`fan-journey.spec.ts`** - Fan 端完整流程测试
   - 用户注册与登录
   - Feed 内容浏览
   - 订阅 Creator
   - 解锁 PPV 内容
   - 个人中心功能
   - 成为 Creator 流程

2. **`creator-journey.spec.ts`** - Creator 端完整流程测试
   - Creator Onboarding 完成
   - 创建内容（Post）
   - 编辑和删除 Post
   - 管理订阅者
   - 查看收益
   - Creator Analytics

3. **`complete-journey.spec.ts`** - 完整端到端测试
   - 从注册到订阅到解锁的完整用户旅程

4. **`edge-cases.spec.ts`** - 边界情况和错误处理测试
   - 认证相关边界情况
   - 支付相关边界情况
   - 内容相关边界情况
   - 数据一致性测试

5. **`shared/helpers.ts`** - 共享测试工具函数
   - 用户注册/登录辅助函数
   - 页面导航辅助函数
   - 元素等待和验证函数

## 运行测试

### 运行所有测试

```bash
pnpm exec playwright test
```

### 运行特定测试文件

```bash
# Fan 端测试
pnpm exec playwright test fan-journey.spec.ts

# Creator 端测试
pnpm exec playwright test creator-journey.spec.ts

# 完整流程测试
pnpm exec playwright test complete-journey.spec.ts

# 边界情况测试
pnpm exec playwright test edge-cases.spec.ts
```

### 运行特定测试用例

```bash
# 运行特定测试
pnpm exec playwright test -g "邮箱注册新用户"
```

### 以 UI 模式运行（调试）

```bash
pnpm exec playwright test --headed
```

### 生成测试报告

```bash
pnpm exec playwright test --reporter=html
```

报告将生成在 `playwright-report/` 目录中。

## 测试环境要求

1. **开发服务器运行**: 确保 `pnpm run dev` 正在运行在 `http://localhost:3000`
2. **Supabase 配置**: 确保 `.env.local` 中配置了正确的 Supabase 凭据
3. **测试数据库**: 建议使用独立的测试数据库或确保测试数据清理

## 测试数据管理

- 测试使用时间戳和随机后缀生成唯一邮箱（`e2e-{prefix}-{timestamp}-{random}@example.com`）
- 测试密码统一为 `TestPassword123!`
- 每个测试前会自动清除 cookies 和 localStorage

## 注意事项

1. **文件上传测试**: 某些测试需要真实的测试文件，目前部分测试会跳过文件上传步骤
2. **KYC 验证**: KYC 验证需要上传证件照片，测试中可能会跳过此步骤
3. **支付流程**: 支付流程使用模拟数据，不会产生真实费用
4. **并发测试**: 某些测试可能需要在独立的环境中运行以避免数据冲突

## 测试覆盖范围

### ✅ 已实现

- [x] 用户注册与登录（邮箱）
- [x] Feed 内容浏览
- [x] 订阅 Creator 流程
- [x] PPV 解锁流程
- [x] 个人中心功能
- [x] Creator Onboarding
- [x] 创建 Post
- [x] 编辑和删除 Post
- [x] 订阅者管理
- [x] 收益查看
- [x] 边界情况测试

### ⏳ 待完善

- [ ] Google OAuth 登录测试
- [ ] 文件上传完整测试（需要测试文件）
- [ ] KYC 完整流程测试（需要文件上传）
- [ ] 钱包余额不足测试（需要设置测试数据）
- [ ] 地理屏蔽功能测试（需要模拟不同 IP）
- [ ] 性能测试
- [ ] 安全测试（RLS 策略验证）

## 调试技巧

1. **使用 `--headed` 模式**: 可以看到浏览器实际运行情况
2. **使用 `page.pause()`**: 在测试代码中添加 `await page.pause()` 可以暂停测试进行调试
3. **查看测试报告**: 运行 `pnpm exec playwright show-report` 查看详细的测试报告
4. **截图和视频**: 测试失败时会自动截图，可以在报告中查看

## 持续集成

测试可以在 CI/CD 环境中运行：

```bash
# CI 环境运行测试
pnpm exec playwright test --reporter=html
```

确保 CI 环境中配置了必要的环境变量和 Supabase 凭据。
