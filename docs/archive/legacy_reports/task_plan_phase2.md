# Task Plan Phase 2: 使用 shadcn/ui Skill 完善前端

**Created**: 2026-01-14  
**Goal**: 使用新的 shadcn/ui 开发规范完善前端 UI 组件

---

## 背景

Phase 1 已完成：

- ✅ 数据库迁移验证
- ✅ 功能架构分析
- ✅ shadcn/ui Skill 规则创建

现在进入 Phase 2：使用 shadcn/ui 规范完善前端组件

---

## Phase 1: 评论系统前端 🔄

### 目标

创建完整的评论系统 UI，遵循 shadcn/ui 规范

### 任务

- [ ] 创建 PostCommentList 组件
- [ ] 创建 CommentItem 子组件
- [ ] 创建 CommentForm 组件
- [ ] 创建 /api/posts/[id]/comments API
- [ ] 在帖子详情页集成评论
- [ ] 测试评论功能

### 成功标准

- ✅ 订阅者/购买者可以评论
- ✅ 评论实时显示
- ✅ 表单验证正确
- ✅ 错误处理完善
- ✅ 符合 A11Y 标准

**Status**: 待开始  
**Priority**: P0  
**Estimated**: 2-3 小时

---

## Phase 2: 标签展示和筛选 🔄

### 目标

在 Feed 页面显示标签，支持点击筛选

### 任务

- [ ] 在 PostCard 中显示标签 Badge
- [ ] 创建标签筛选 UI
- [ ] 实现标签点击筛选逻辑
- [ ] 添加"清除筛选"功能
- [ ] 优化标签显示样式

### 成功标准

- ✅ 标签在帖子卡片中显示
- ✅ 点击标签可筛选内容
- ✅ 筛选状态清晰可见
- ✅ 响应式设计

**Status**: 待开始  
**Priority**: P1  
**Estimated**: 1-2 小时

---

## Phase 3: 内容审核管理后台 🔄

### 目标

创建管理员内容审核页面

### 任务

- [ ] 创建 /admin/content-review 页面
- [ ] 创建待审核内容列表组件
- [ ] 创建内容预览面板
- [ ] 添加批准/拒绝操作按钮
- [ ] 实现拒绝原因输入
- [ ] 添加筛选和搜索功能

### 成功标准

- ✅ 管理员可查看待审核内容
- ✅ 可预览帖子详情
- ✅ 批准/拒绝操作正常
- ✅ 拒绝需要填写原因
- ✅ 操作有确认提示

**Status**: 待开始  
**Priority**: P1  
**Estimated**: 3-4 小时

---

## Phase 4: Creator Studio 收益图表 🔄

### 目标

添加可视化收益图表

### 任务

- [ ] 安装 Recharts 或 Chart.js
- [ ] 创建 RevenueChart 组件
- [ ] 创建 SubscribersChart 组件
- [ ] 集成到 Creator Studio 页面
- [ ] 添加图表交互（tooltip, zoom）
- [ ] 响应式图表设计

### 成功标准

- ✅ 收益趋势图显示正确
- ✅ 订阅者增长图显示正确
- ✅ 图表可交互
- ✅ 移动端友好

**Status**: 待开始  
**Priority**: P2  
**Estimated**: 2-3 小时

---

## Phase 5: 优化现有组件 🔄

### 目标

使用 shadcn/ui 规范优化现有组件

### 任务

- [ ] 审查 PostLikeButton 是否符合规范
- [ ] 审查 TagSelector 是否符合规范
- [ ] 优化 NavHeader 响应式
- [ ] 优化 HomeFeedClient 加载状态
- [ ] 添加骨架屏（Skeleton）
- [ ] 统一错误提示样式

### 成功标准

- ✅ 所有组件符合 shadcn/ui 规范
- ✅ 一致的加载状态
- ✅ 统一的错误处理
- ✅ 优秀的用户体验

**Status**: 待开始  
**Priority**: P2  
**Estimated**: 2-3 小时

---

## 开发原则（基于 shadcn/ui Skill）

### 必须遵守

1. ✅ Server Components 优先
2. ✅ 使用现有 shadcn/ui 组件
3. ✅ CVA 处理组件变体
4. ✅ cn() 合并类名
5. ✅ 类名按逻辑排序
6. ✅ Mobile-first 响应式
7. ✅ 最小点击区域 44x44px
8. ✅ 完整的 A11Y 支持
9. ✅ 深色模式支持
10. ✅ 错误边界和 Toast

### 组件命名

- 文件：`kebab-case.tsx`
- 组件：`PascalCase`
- Props：`{ComponentName}Props`

### 目录结构

```
components/
  ui/              # shadcn/ui 组件
  post-comment-list.tsx
  comment-item.tsx
  comment-form.tsx
  tag-badge.tsx
  revenue-chart.tsx
  content-review-card.tsx
```

---

## 工作流程

### 每个组件开发流程

1. 创建 task 分支（可选）
2. 编写组件代码（遵循 shadcn/ui 规范）
3. 添加 TypeScript 类型
4. 实现响应式设计
5. 添加 A11Y 属性
6. 测试功能
7. 更新 progress.md
8. 提交代码

### Planning with Files

- 每个 Phase 开始前更新 task_plan_phase2.md
- 发现记录到 findings_phase2.md
- 进度记录到 progress_phase2.md
- 遇到问题记录解决方案

---

## 成功标准

### Phase 2 完成标准

- ✅ 评论系统完整可用
- ✅ 标签筛选功能正常
- ✅ 管理后台基本可用
- ✅ 收益图表显示正确
- ✅ 所有组件符合 shadcn/ui 规范
- ✅ 代码质量高，可维护性强

---

## 预计时间

- Phase 1: 2-3 小时
- Phase 2: 1-2 小时
- Phase 3: 3-4 小时
- Phase 4: 2-3 小时
- Phase 5: 2-3 小时

**总计**: 10-15 小时

---

## 下一步

1. 从 Phase 1（评论系统）开始
2. 创建 findings_phase2.md 和 progress_phase2.md
3. 使用 explore agent 分析现有评论架构
4. 开始编写 PostCommentList 组件
