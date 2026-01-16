#!/bin/bash

# MVP 功能测试脚本
# 测试所有新实现的功能

echo "🧪 开始 MVP 功能测试"
echo "================================"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数
PASSED=0
FAILED=0

# 1. 检查数据库迁移文件
echo -e "\n${YELLOW}1. 检查数据库迁移文件...${NC}"
migrations=(
  "migrations/019_likes_system.sql"
  "migrations/020_tags_system.sql"
  "migrations/021_content_review.sql"
  "migrations/022_notification_triggers.sql"
  "migrations/023_comments_support_refunds.sql"
)

for migration in "${migrations[@]}"; do
  if [ -f "$migration" ]; then
    echo -e "${GREEN}✓${NC} $migration 存在"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $migration 缺失"
    ((FAILED++))
  fi
done

# 2. 检查新建的 API 路由
echo -e "\n${YELLOW}2. 检查 API 路由...${NC}"
apis=(
  "app/api/creator/stats/route.ts"
  "app/api/posts/[id]/like/route.ts"
  "app/api/search/route.ts"
  "app/api/tags/route.ts"
  "app/api/posts/[id]/tags/route.ts"
  "app/api/admin/content-review/route.ts"
)

for api in "${apis[@]}"; do
  if [ -f "$api" ]; then
    echo -e "${GREEN}✓${NC} $api 存在"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $api 缺失"
    ((FAILED++))
  fi
done

# 3. 检查新建的页面
echo -e "\n${YELLOW}3. 检查新页面...${NC}"
pages=(
  "app/search/page.tsx"
  "app/support/page.tsx"
)

for page in "${pages[@]}"; do
  if [ -f "$page" ]; then
    echo -e "${GREEN}✓${NC} $page 存在"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $page 缺失"
    ((FAILED++))
  fi
done

# 4. 检查新组件
echo -e "\n${YELLOW}4. 检查新组件...${NC}"
components=(
  "components/post-like-button.tsx"
  "components/tag-selector.tsx"
  "hooks/use-post-like.ts"
  "lib/creator-stats.ts"
)

for component in "${components[@]}"; do
  if [ -f "$component" ]; then
    echo -e "${GREEN}✓${NC} $component 存在"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $component 缺失"
    ((FAILED++))
  fi
done

# 5. 检查环境变量
echo -e "\n${YELLOW}5. 检查环境变量...${NC}"
if [ -f ".env.local" ]; then
  echo -e "${GREEN}✓${NC} .env.local 存在"
  ((PASSED++))
  
  # 检查必需的环境变量
  if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local; then
    echo -e "${GREEN}✓${NC} NEXT_PUBLIC_SUPABASE_URL 已配置"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} NEXT_PUBLIC_SUPABASE_URL 未配置"
    ((FAILED++))
  fi
  
  if grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local; then
    echo -e "${GREEN}✓${NC} SUPABASE_SERVICE_ROLE_KEY 已配置"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} SUPABASE_SERVICE_ROLE_KEY 未配置"
    ((FAILED++))
  fi
else
  echo -e "${RED}✗${NC} .env.local 不存在"
  ((FAILED++))
fi

# 6. 检查 TypeScript 类型
echo -e "\n${YELLOW}6. 检查 TypeScript 类型...${NC}"
if grep -q "likes_count" lib/types.ts; then
  echo -e "${GREEN}✓${NC} Post 类型包含 likes_count"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} Post 类型缺少 likes_count"
  ((FAILED++))
fi

# 7. 检查 Planning Skill
echo -e "\n${YELLOW}7. 检查 Planning with Files...${NC}"
if [ -d ".planning-skill" ]; then
  echo -e "${GREEN}✓${NC} Planning with Files 已安装"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} Planning with Files 未安装"
  ((FAILED++))
fi

# 总结
echo -e "\n================================"
echo -e "${YELLOW}测试总结${NC}"
echo -e "================================"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
TOTAL=$((PASSED + FAILED))
echo -e "总计: $TOTAL"

if [ $FAILED -eq 0 ]; then
  echo -e "\n${GREEN}🎉 所有测试通过！${NC}"
  exit 0
else
  echo -e "\n${RED}⚠️  有 $FAILED 个测试失败${NC}"
  exit 1
fi
