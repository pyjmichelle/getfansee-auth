/**
 * UI 一致性审查脚本
 * 检查所有页面是否使用统一的 shadcn/ui 组件和设计系统
 */

import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

interface UIIssue {
  file: string;
  line: number;
  issue: string;
  severity: "error" | "warning" | "info";
  suggestion?: string;
}

interface PageAuditResult {
  file: string;
  issues: UIIssue[];
  score: number; // 0-100
}

const issues: UIIssue[] = [];

// 检查项配置
const checks = {
  // 硬编码颜色
  hardcodedColors: {
    patterns: [/bg-\[#[0-9A-Fa-f]{6}\]/, /text-\[#[0-9A-Fa-f]{6}\]/, /border-\[#[0-9A-Fa-f]{6}\]/],
    severity: "error" as const,
    message: "使用硬编码颜色，应使用语义化颜色类",
  },

  // 旧的加载状态
  oldLoadingState: {
    patterns: [/Loading\.\.\./],
    severity: "warning" as const,
    message: "使用旧的加载文本，应使用 LoadingState 组件",
  },

  // 简单错误提示
  simpleErrorText: {
    patterns: [/<div[^>]*>Error:/i, /<p[^>]*>Error:/i],
    severity: "warning" as const,
    message: "使用简单错误文本，应使用 ErrorState 组件",
  },

  // 简单空状态
  simpleEmptyState: {
    patterns: [/No .+ found/, /No .+ yet/],
    severity: "info" as const,
    message: "可能需要使用 EmptyState 组件改进空状态展示",
  },

  // 缺少 ARIA 属性
  missingAriaLabel: {
    patterns: [/<button[^>]*onClick[^>]*>(?!.*aria-label)/],
    severity: "warning" as const,
    message: "交互按钮缺少 aria-label 属性",
  },

  // 图标缺少 aria-hidden
  iconMissingAriaHidden: {
    patterns: [/<[A-Z][a-zA-Z]*\s+className="[^"]*w-\d+\s+h-\d+[^"]*"(?![^>]*aria-hidden)/],
    severity: "info" as const,
    message: '图标可能缺少 aria-hidden="true" 属性',
  },

  // 按钮缺少最小触摸目标
  buttonMissingMinHeight: {
    patterns: [/<Button[^>]*(?!.*min-h-\[44px\])/],
    severity: "warning" as const,
    message: "按钮可能缺少最小触摸目标尺寸 (min-h-[44px])",
  },
};

function checkFile(filePath: string): UIIssue[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const fileIssues: UIIssue[] = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // 检查硬编码颜色
    checks.hardcodedColors.patterns.forEach((pattern) => {
      if (pattern.test(line)) {
        fileIssues.push({
          file: filePath,
          line: lineNumber,
          issue: checks.hardcodedColors.message,
          severity: checks.hardcodedColors.severity,
          suggestion: "使用 bg-background, text-foreground, border-border 等语义化类",
        });
      }
    });

    // 检查旧的加载状态
    if (checks.oldLoadingState.patterns[0].test(line) && !line.includes("LoadingState")) {
      fileIssues.push({
        file: filePath,
        line: lineNumber,
        issue: checks.oldLoadingState.message,
        severity: checks.oldLoadingState.severity,
        suggestion: "import { LoadingState } from '@/components/loading-state'",
      });
    }

    // 检查简单错误提示
    checks.simpleErrorText.patterns.forEach((pattern) => {
      if (pattern.test(line) && !line.includes("ErrorState")) {
        fileIssues.push({
          file: filePath,
          line: lineNumber,
          issue: checks.simpleErrorText.message,
          severity: checks.simpleErrorText.severity,
          suggestion: "import { ErrorState } from '@/components/error-state'",
        });
      }
    });

    // 检查简单空状态
    if (checks.simpleEmptyState.patterns[0].test(line) && !line.includes("EmptyState")) {
      fileIssues.push({
        file: filePath,
        line: lineNumber,
        issue: checks.simpleEmptyState.message,
        severity: checks.simpleEmptyState.severity,
        suggestion: "import { EmptyState } from '@/components/empty-state'",
      });
    }
  });

  return fileIssues;
}

function calculateScore(issues: UIIssue[]): number {
  let score = 100;

  issues.forEach((issue) => {
    switch (issue.severity) {
      case "error":
        score -= 5;
        break;
      case "warning":
        score -= 2;
        break;
      case "info":
        score -= 0.5;
        break;
    }
  });

  return Math.max(0, Math.round(score));
}

async function auditAllPages() {
  console.log("🔍 开始 UI 一致性审查...\n");

  // 获取所有页面文件
  const pageFiles = await glob("app/**/page.tsx", {
    cwd: process.cwd(),
    absolute: true,
  });

  console.log(`📄 找到 ${pageFiles.length} 个页面文件\n`);

  const results: PageAuditResult[] = [];

  for (const file of pageFiles) {
    const relativePath = path.relative(process.cwd(), file);
    const fileIssues = checkFile(file);
    const score = calculateScore(fileIssues);

    results.push({
      file: relativePath,
      issues: fileIssues,
      score,
    });
  }

  // 按分数排序
  results.sort((a, b) => a.score - b.score);

  // 生成报告
  console.log("=".repeat(80));
  console.log("📊 UI 一致性审查报告");
  console.log("=".repeat(80));
  console.log();

  // 统计
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const errorCount = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "error").length,
    0
  );
  const warningCount = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "warning").length,
    0
  );
  const infoCount = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "info").length,
    0
  );
  const avgScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);

  console.log("📈 总体统计:");
  console.log(`   总页面数: ${results.length}`);
  console.log(`   总问题数: ${totalIssues}`);
  console.log(`   错误 (Error): ${errorCount}`);
  console.log(`   警告 (Warning): ${warningCount}`);
  console.log(`   信息 (Info): ${infoCount}`);
  console.log(`   平均分数: ${avgScore}/100`);
  console.log();

  // 问题页面 (分数 < 90)
  const problematicPages = results.filter((r) => r.score < 90);

  if (problematicPages.length > 0) {
    console.log("⚠️  需要改进的页面 (分数 < 90):");
    console.log();

    problematicPages.forEach((result) => {
      console.log(`📄 ${result.file}`);
      console.log(`   分数: ${result.score}/100`);
      console.log(`   问题数: ${result.issues.length}`);

      // 按严重程度分组
      const errors = result.issues.filter((i) => i.severity === "error");
      const warnings = result.issues.filter((i) => i.severity === "warning");
      const infos = result.issues.filter((i) => i.severity === "info");

      if (errors.length > 0) {
        console.log(`   ❌ 错误: ${errors.length}`);
        errors.slice(0, 3).forEach((issue) => {
          console.log(`      L${issue.line}: ${issue.issue}`);
          if (issue.suggestion) {
            console.log(`             建议: ${issue.suggestion}`);
          }
        });
        if (errors.length > 3) {
          console.log(`      ... 还有 ${errors.length - 3} 个错误`);
        }
      }

      if (warnings.length > 0) {
        console.log(`   ⚠️  警告: ${warnings.length}`);
        warnings.slice(0, 2).forEach((issue) => {
          console.log(`      L${issue.line}: ${issue.issue}`);
        });
        if (warnings.length > 2) {
          console.log(`      ... 还有 ${warnings.length - 2} 个警告`);
        }
      }

      if (infos.length > 0) {
        console.log(`   ℹ️  信息: ${infos.length}`);
      }

      console.log();
    });
  }

  // 优秀页面 (分数 >= 95)
  const excellentPages = results.filter((r) => r.score >= 95);

  if (excellentPages.length > 0) {
    console.log(`✅ 优秀页面 (分数 >= 95): ${excellentPages.length} 个`);
    excellentPages.forEach((result) => {
      console.log(`   ${result.file} - ${result.score}/100`);
    });
    console.log();
  }

  // 生成 Markdown 报告
  const reportPath = "UI_CONSISTENCY_REPORT.md";
  let markdown = `# UI 一致性审查报告\n\n`;
  markdown += `## 审查日期\n${new Date().toISOString().split("T")[0]}\n\n`;
  markdown += `## 总体统计\n\n`;
  markdown += `| 指标 | 数值 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 总页面数 | ${results.length} |\n`;
  markdown += `| 总问题数 | ${totalIssues} |\n`;
  markdown += `| 错误数 | ${errorCount} |\n`;
  markdown += `| 警告数 | ${warningCount} |\n`;
  markdown += `| 信息数 | ${infoCount} |\n`;
  markdown += `| 平均分数 | ${avgScore}/100 |\n\n`;

  markdown += `## 页面详情\n\n`;
  markdown += `| 页面 | 分数 | 错误 | 警告 | 信息 | 状态 |\n`;
  markdown += `|------|------|------|------|------|------|\n`;

  results.forEach((result) => {
    const errors = result.issues.filter((i) => i.severity === "error").length;
    const warnings = result.issues.filter((i) => i.severity === "warning").length;
    const infos = result.issues.filter((i) => i.severity === "info").length;
    const status = result.score >= 95 ? "✅ 优秀" : result.score >= 90 ? "✓ 良好" : "⚠️ 需改进";

    markdown += `| ${result.file} | ${result.score}/100 | ${errors} | ${warnings} | ${infos} | ${status} |\n`;
  });

  markdown += `\n## 详细问题列表\n\n`;

  results.forEach((result) => {
    if (result.issues.length > 0) {
      markdown += `### ${result.file}\n\n`;
      markdown += `**分数**: ${result.score}/100\n\n`;

      const errorIssues = result.issues.filter((i) => i.severity === "error");
      const warningIssues = result.issues.filter((i) => i.severity === "warning");
      const infoIssues = result.issues.filter((i) => i.severity === "info");

      if (errorIssues.length > 0) {
        markdown += `#### ❌ 错误 (${errorIssues.length})\n\n`;
        errorIssues.forEach((issue) => {
          markdown += `- **L${issue.line}**: ${issue.issue}\n`;
          if (issue.suggestion) {
            markdown += `  - 建议: ${issue.suggestion}\n`;
          }
        });
        markdown += `\n`;
      }

      if (warningIssues.length > 0) {
        markdown += `#### ⚠️ 警告 (${warningIssues.length})\n\n`;
        warningIssues.forEach((issue) => {
          markdown += `- **L${issue.line}**: ${issue.issue}\n`;
          if (issue.suggestion) {
            markdown += `  - 建议: ${issue.suggestion}\n`;
          }
        });
        markdown += `\n`;
      }

      if (infoIssues.length > 0) {
        markdown += `#### ℹ️ 信息 (${infoIssues.length})\n\n`;
        infoIssues.slice(0, 5).forEach((issue) => {
          markdown += `- **L${issue.line}**: ${issue.issue}\n`;
        });
        if (infoIssues.length > 5) {
          markdown += `- ... 还有 ${infoIssues.length - 5} 个信息提示\n`;
        }
        markdown += `\n`;
      }
    }
  });

  markdown += `## 改进建议\n\n`;
  markdown += `### 高优先级 (错误)\n\n`;
  if (errorCount > 0) {
    markdown += `1. 替换所有硬编码颜色为语义化颜色类\n`;
    markdown += `   - 使用 \`bg-background\`, \`text-foreground\`, \`border-border\` 等\n`;
    markdown += `   - 运行批量替换: \`find app -name "*.tsx" -exec sed -i '' 's/bg-\\[#050505\\]/bg-background/g' {} +\`\n\n`;
  } else {
    markdown += `✅ 无高优先级问题\n\n`;
  }

  markdown += `### 中优先级 (警告)\n\n`;
  if (warningCount > 0) {
    markdown += `1. 使用 LoadingState 组件替代简单加载文本\n`;
    markdown += `2. 使用 ErrorState 组件替代简单错误提示\n`;
    markdown += `3. 为所有交互按钮添加 aria-label 属性\n`;
    markdown += `4. 确保所有按钮有最小触摸目标尺寸\n\n`;
  } else {
    markdown += `✅ 无中优先级问题\n\n`;
  }

  markdown += `### 低优先级 (信息)\n\n`;
  if (infoCount > 0) {
    markdown += `1. 考虑使用 EmptyState 组件改进空状态展示\n`;
    markdown += `2. 为装饰性图标添加 aria-hidden="true" 属性\n\n`;
  } else {
    markdown += `✅ 无低优先级问题\n\n`;
  }

  fs.writeFileSync(reportPath, markdown);
  console.log(`📝 详细报告已保存到: ${reportPath}`);
  console.log();

  // 返回结果
  if (errorCount > 0) {
    console.log("❌ 审查发现严重问题，需要立即修复");
    process.exit(1);
  } else if (warningCount > 10) {
    console.log("⚠️  审查发现较多警告，建议尽快修复");
    process.exit(0);
  } else {
    console.log("✅ UI 一致性审查通过");
    process.exit(0);
  }
}

auditAllPages().catch((err) => {
  console.error("❌ 审查过程出错:", err);
  process.exit(1);
});
