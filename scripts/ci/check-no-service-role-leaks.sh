#!/bin/bash
#
# CI 门禁脚本：检查 Service Role Key 泄露
#
# 目的：
# 确保 SUPABASE_SERVICE_ROLE_KEY 只在 lib/supabase-admin.ts 中使用，
# 防止 Service Role Key 被意外引入到客户端代码中。
#
# 允许的位置：
# - lib/supabase-admin.ts (re-export)
# - lib/server/supabase-admin.ts (唯一使用 Service Role Key 的实现)
# - lib/env.ts (仅声明变量名用于校验，不暴露 key 值)
# - scripts/ (开发/测试脚本)
# - tests/ (测试代码)
# - .env* 文件
# - node_modules/ (依赖)
# - docs/ (文档)
# - migrations/ (数据库迁移)
#
# 用法：
# ./scripts/ci/check-no-service-role-leaks.sh
#

set -e

echo "🔍 Checking for Service Role Key leaks..."

# 检查是否有 ripgrep
if ! command -v rg &> /dev/null; then
  echo "⚠️  ripgrep (rg) not found, falling back to grep"
  USE_RG=false
else
  USE_RG=true
fi

# 定义搜索模式
PATTERN="SUPABASE_SERVICE_ROLE_KEY"

# 定义允许的路径（正则表达式）
ALLOWED_PATHS=(
  "lib/supabase-admin.ts"
  "lib/server/supabase-admin.ts"
  "lib/env.ts"
  "scripts/"
  "tests/"
  "\.env"
  "node_modules/"
  "docs/"
  "migrations/"
  "\.md$"
  "check-no-service-role-leaks"
  "\.next/"
  "sentry\."
)

# 构建排除模式
build_exclude_pattern() {
  local pattern=""
  for path in "${ALLOWED_PATHS[@]}"; do
    if [ -n "$pattern" ]; then
      pattern="$pattern|"
    fi
    pattern="$pattern$path"
  done
  echo "$pattern"
}

EXCLUDE_PATTERN=$(build_exclude_pattern)

# 执行搜索
if [ "$USE_RG" = true ]; then
  # 使用 ripgrep（更快）
  LEAKS=$(rg -l "$PATTERN" --type ts --type tsx --type js --type jsx 2>/dev/null | grep -vE "$EXCLUDE_PATTERN" || true)
else
  # 使用 grep
  LEAKS=$(grep -rl "$PATTERN" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . 2>/dev/null | grep -vE "$EXCLUDE_PATTERN" || true)
fi

# 检查结果
if [ -n "$LEAKS" ]; then
  echo ""
  echo "❌ ERROR: Service Role Key found outside allowed locations!"
  echo ""
  echo "Leaked files:"
  echo "$LEAKS" | while read -r file; do
    echo "  - $file"
  done
  echo ""
  echo "Service Role Key should only be used in lib/server/supabase-admin.ts or lib/env.ts (schema)"
  echo "Please refactor these files to import from lib/supabase-admin.ts"
  echo ""
  exit 1
fi

echo "✅ No Service Role Key leaks found"
echo ""
echo "Verified: SUPABASE_SERVICE_ROLE_KEY is only used in:"
echo "  - lib/server/supabase-admin.ts (production code)"
echo "  - lib/env.ts (env schema only)"
echo "  - scripts/ (development scripts)"
echo "  - tests/ (test code)"
echo ""
exit 0
