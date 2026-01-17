#!/bin/bash

# 本地模拟 CI Pipeline 测试脚本

set -e  # 遇到错误立即退出

echo "======================================"
echo "🧪 本地 CI Pipeline 测试"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果统计
PASSED=0
FAILED=0

# 测试函数
run_test() {
    local test_name=$1
    local command=$2
    
    echo "----------------------------------------"
    echo "📋 测试: $test_name"
    echo "----------------------------------------"
    
    if eval "$command"; then
        echo -e "${GREEN}✅ $test_name - 通过${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ $test_name - 失败${NC}"
        ((FAILED++))
        return 1
    fi
    echo ""
}

# 1. Lint & Type Check
echo ""
echo "🔍 阶段 1: Lint & Type Check"
echo "======================================"
run_test "ESLint" "pnpm lint"
run_test "TypeScript Type Check" "pnpm type-check"

# 2. Legacy Tests
echo ""
echo "🧪 阶段 2: Legacy Test Scripts"
echo "======================================"
run_test "Auth Tests" "pnpm test:auth" || true
run_test "Paywall Tests" "pnpm test:paywall" || true

# 3. RLS Security Tests
echo ""
echo "🔒 阶段 3: RLS Security Tests"
echo "======================================"
run_test "System Lockdown Verification" "pnpm verify:lockdown"

# 4. Build
echo ""
echo "🏗️  阶段 4: Build"
echo "======================================"
run_test "Next.js Build" "pnpm build" || true

# 总结
echo ""
echo "======================================"
echo "📊 测试结果总结"
echo "======================================"
echo -e "✅ 通过: ${GREEN}$PASSED${NC}"
echo -e "❌ 失败: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！可以安全推送到 GitHub${NC}"
    exit 0
else
    echo -e "${RED}⚠️  有 $FAILED 个测试失败，请修复后再推送${NC}"
    exit 1
fi
