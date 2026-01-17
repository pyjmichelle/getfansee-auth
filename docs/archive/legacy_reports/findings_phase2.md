# Findings Phase 2: 前端组件开发

**Session**: 2026-01-14  
**Task**: 使用 shadcn/ui Skill 规则完善前端组件

---

## 评论系统架构分析

### 数据库层（已完成）

- ✅ `post_comments` 表已创建
- ✅ RLS 策略：订阅者/购买者可评论
- ✅ 用户可删除自己的评论

### API 层 ✅

已创建：

- ✅ `POST /api/posts/[id]/comments` - 发表评论
- ✅ `GET /api/posts/[id]/comments` - 获取评论列表（支持分页）
- ✅ `DELETE /api/comments/[id]` - 删除评论

### 服务层 ✅

已创建 `lib/comments.ts`：

- ✅ `getPostComments()` - 获取评论列表
- ✅ `createComment()` - 创建评论（含权限验证）
- ✅ `deleteComment()` - 删除评论（含权限验证）
- ✅ `checkCommentPermission()` - 权限检查
- ✅ `getCommentCount()` - 获取评论数量

### 前端层 ✅

已创建组件（严格遵循 shadcn/ui 规范）：

1. ✅ `CommentList` - 评论列表容器（含加载更多）
2. ✅ `CommentItem` - 单条评论显示（含删除功能）
3. ✅ `CommentForm` - 评论输入表单（含字符计数）

---

## shadcn/ui 组件清单

### 已安装组件

- ✅ Button
- ✅ Card
- ✅ Input
- ✅ Textarea
- ✅ Label
- ✅ Dialog
- ✅ Sheet
- ✅ Tabs
- ✅ Badge
- ✅ Avatar
- ✅ Separator
- ✅ Toast (Sonner)

### 可能需要的新组件

- [ ] Skeleton - 加载占位
- [ ] Alert - 提示信息
- [ ] Popover - 弹出菜单
- [ ] DropdownMenu - 下拉菜单

---

## 设计决策

### 1. 权限验证双重检查

- RLS 策略在数据库层控制
- API 层额外验证权限（checkCommentPermission）
- 提供更好的错误消息

### 2. 评论不可编辑

- 遵循数据库设计（无 UPDATE 策略）
- 简化 UI 和逻辑
- 用户只能删除自己的评论

### 3. 分页加载

- 默认每页 20 条评论
- 支持 "Load More" 按钮
- 优化大量评论的性能

### 4. 乐观 UI 更新

- 新评论立即显示在列表顶部
- 删除评论立即从列表移除
- 失败时显示 Toast 提示

---

## 遇到的问题

### 问题 1: 字符计数显示位置

**解决**: 使用 `absolute` 定位在 Textarea 右下角，不占用额外空间

### 问题 2: 删除按钮可访问性

**解决**:

- 使用 `aria-label` 描述按钮功能
- 图标添加 `aria-hidden="true"`
- 确认对话框防止误删

---

## 最佳实践发现

### shadcn/ui 规范应用

1. ✅ **组件命名**: kebab-case 文件名，PascalCase 组件名
2. ✅ **Props 接口**: 明确的 TypeScript 类型定义
3. ✅ **cn() 工具**: 所有条件类名使用 cn() 合并
4. ✅ **响应式设计**: 使用 Tailwind 断点
5. ✅ **可访问性**:
   - `aria-label` 和 `aria-describedby`
   - `aria-live="polite"` 用于字符计数
   - `sr-only` 用于屏幕阅读器
6. ✅ **最小点击区域**: 按钮 min-h-[44px]
7. ✅ **加载状态**: Loader2 图标 + 禁用状态
8. ✅ **错误处理**: Toast 通知 + 结构化错误消息
9. ✅ **深色模式**: 使用语义化颜色（foreground, muted-foreground）
10. ✅ **组件复用**: Avatar, Button, Textarea, Separator
