# 🚀 快速启动指南

完成 MVP 功能后的快速部署和测试指南。

---

## 📋 前置检查清单

运行自动化测试：

```bash
./scripts/test-mvp-features.sh
```

应该看到：

```
✅ 所有测试通过
通过: 22
失败: 0
```

---

## 🗄️ 步骤 1: 执行数据库迁移

在 **Supabase Dashboard → SQL Editor** 中，**按顺序**执行以下文件：

### 1️⃣ 点赞系统

```sql
-- 复制 migrations/019_likes_system.sql 的内容并执行
```

**预期结果**:

- ✅ post_likes 表已创建
- ✅ posts.likes_count 列已添加
- ✅ 触发器已创建

### 2️⃣ 标签系统

```sql
-- 复制 migrations/020_tags_system.sql 的内容并执行
```

**预期结果**:

- ✅ tags 表已创建
- ✅ post_tags 表已创建
- ✅ creator_tags 表已创建
- ✅ 16 个预设标签已插入

### 3️⃣ 内容审核

```sql
-- 复制 migrations/021_content_review.sql 的内容并执行
```

**预期结果**:

- ✅ posts.review_status 列已添加
- ✅ content_review_logs 表已创建
- ✅ RLS 策略已更新

### 4️⃣ 通知触发

```sql
-- 复制 migrations/022_notification_triggers.sql 的内容并执行
```

**预期结果**:

- ✅ 4 个通知触发器函数已创建
- ✅ 触发器已绑定到对应表

### 5️⃣ 评论、工单、退款

```sql
-- 复制 migrations/023_comments_support_refunds.sql 的内容并执行
```

**预期结果**:

- ✅ post_comments 表已创建
- ✅ support_tickets 表已创建
- ✅ refund_requests 表已创建

---

## 🧪 步骤 2: 测试新功能

### 启动开发服务器

```bash
pnpm dev
```

### 测试清单

#### ✅ 点赞功能

1. 登录账号
2. 访问 `/home`
3. 点击任意帖子的 Like 按钮
4. 验证：
   - 心形图标变红
   - 点赞数 +1
   - 再次点击取消点赞

#### ✅ 搜索功能

1. 点击顶部导航的 "Search creators..." 按钮
2. 跳转到 `/search` 页面
3. 输入关键词（如 "test"）
4. 验证：
   - Creator 结果显示
   - Post 结果显示
   - 可切换标签筛选

#### ✅ Creator Studio 统计

1. 以 Creator 身份登录
2. 访问 `/creator/studio`
3. 验证：
   - 收益数据显示真实值
   - 订阅者数量正确
   - PPV 销售数量正确
   - 切换时间范围 (7d/30d/90d) 数据变化

#### ✅ 客服工单

1. 访问 `/support`
2. 填写工单表单
3. 提交
4. 验证：
   - 成功提示
   - 表单重置

#### ✅ 通知系统

1. 以 Fan 身份订阅一个 Creator
2. 切换到 Creator 账号
3. 访问 `/notifications`
4. 验证：
   - 看到新订阅通知

---

## 🎨 步骤 3: 安装前端 UI Skills (可选)

### 方案 A: Claude Code Plugin (推荐)

如果使用 Claude Code：

```bash
/plugin marketplace add huydepzai121/skill
/plugin install shadcn-ui
```

### 方案 B: 手动添加 Skill 文件

创建 `.cursor/rules/frontend-ui.md`:

```markdown
# Frontend UI Standards

使用 shadcn/ui + Tailwind CSS

- Server Components 优先
- 使用现有组件
- CVA 处理变体
- 确保可访问性
- 支持深色模式
- Mobile-first 响应式
```

---

## 📊 功能对照表

| 功能        | 数据库 | API | 前端 | 状态     |
| ----------- | ------ | --- | ---- | -------- |
| 点赞        | ✅     | ✅  | ✅   | 完整     |
| 搜索        | N/A    | ✅  | ✅   | 完整     |
| 标签        | ✅     | ✅  | ⚠️   | 基础完成 |
| 审核        | ✅     | ✅  | ⚠️   | 基础完成 |
| 通知触发    | ✅     | N/A | N/A  | 自动化   |
| 评论        | ✅     | ⚠️  | ⚠️   | 架构完成 |
| 工单        | ✅     | ⚠️  | ✅   | 完整     |
| 退款        | ✅     | ⚠️  | ⚠️   | 架构完成 |
| Creator统计 | N/A    | ✅  | ✅   | 完整     |

**图例**:

- ✅ 完整实现
- ⚠️ 基础架构完成，待完善
- N/A 不适用

---

## 🐛 常见问题

### Q1: 迁移执行失败？

**解决**: 确保按顺序执行，检查是否有依赖的表或列缺失

### Q2: API 返回 401?

**解决**: 检查 `.env.local` 中的 `SUPABASE_SERVICE_ROLE_KEY`

### Q3: 点赞按钮不显示计数？

**解决**: 确保已执行 `019_likes_system.sql`

### Q4: 搜索无结果？

**解决**: 检查 Supabase 数据库中是否有内容

---

## 📞 支持

遇到问题？

1. 查看 `FRONTEND_UI_RECOMMENDATIONS.md`
2. 查看 `MVP_IMPLEMENTATION_SUMMARY.md`
3. 使用 `/support` 页面提交工单

---

**准备好了吗？开始部署吧！** 🚀
