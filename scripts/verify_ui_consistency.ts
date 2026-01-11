#!/usr/bin/env tsx
/**
 * UI Consistency Verification Script
 * 检查代码中是否有硬编码的旧颜色值
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

// 禁止使用的旧颜色值
const FORBIDDEN_COLORS = [
  "#14B8A6", // 旧的青色主题色
  "#00c2b2", // 旧的青色变体
  "#070a0f", // 旧的背景色
  "#0e1422", // 旧的卡片色
  "#1a2030", // 旧的次要色
  "#eaf0ff", // 旧的文字色
];

// 允许的新颜色值（Midnight Neon）
const ALLOWED_COLORS = [
  "#050505", // Background
  "#0D0D0D", // Surface/Card
  "#1F1F1F", // Border
  "#6366F1", // Primary (Indigo)
  "#A855F7", // Primary-Purple
  "#EC4899", // Accent-Pink
  "#10B981", // Success
  "#F43F5E", // Danger
  "#F59E0B", // Warning
  "#E5E5E5", // Foreground
  "#999999", // Muted foreground
  "#121212", // Muted background
  "#1A1A1A", // Muted hover
];

// 需要检查的文件扩展名
const FILE_EXTENSIONS = [".tsx", ".ts", ".css", ".jsx", ".js"];

// 需要排除的目录
const EXCLUDE_DIRS = ["node_modules", ".next", ".git", "dist", "build"];

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);

  files.forEach((file) => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else {
      const ext = file.substring(file.lastIndexOf("."));
      if (FILE_EXTENSIONS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

function checkFile(filePath: string): {
  file: string;
  issues: Array<{ line: number; content: string; color: string }>;
} {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const issues: Array<{ line: number; content: string; color: string }> = [];

  lines.forEach((line, index) => {
    FORBIDDEN_COLORS.forEach((color) => {
      // 检查是否包含禁止的颜色（忽略注释中的颜色说明）
      if (line.includes(color) && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
        // 检查是否在字符串中
        const colorIndex = line.indexOf(color);
        if (colorIndex !== -1) {
          // 简单检查：如果前后是引号或空格，可能是硬编码的颜色
          const before = line[colorIndex - 1];
          const after = line[colorIndex + color.length];
          if (
            (before === '"' || before === "'" || before === " " || before === ":") &&
            (after === '"' || after === "'" || after === " " || after === ";" || after === ",")
          ) {
            issues.push({
              line: index + 1,
              content: line.trim(),
              color,
            });
          }
        }
      }
    });
  });

  return { file: filePath, issues };
}

function main() {
  const projectRoot = process.cwd();
  const appDir = join(projectRoot, "app");
  const componentsDir = join(projectRoot, "components");
  const libDir = join(projectRoot, "lib");

  const allFiles: string[] = [];

  if (statSync(appDir).isDirectory()) {
    getAllFiles(appDir, allFiles);
  }
  if (statSync(componentsDir).isDirectory()) {
    getAllFiles(componentsDir, allFiles);
  }
  if (statSync(libDir).isDirectory()) {
    getAllFiles(libDir, allFiles);
  }

  console.log(`\n🔍 Checking ${allFiles.length} files for UI consistency...\n`);

  const allIssues: Array<{
    file: string;
    issues: Array<{ line: number; content: string; color: string }>;
  }> = [];

  allFiles.forEach((file) => {
    const result = checkFile(file);
    if (result.issues.length > 0) {
      allIssues.push(result);
    }
  });

  if (allIssues.length === 0) {
    console.log("✅ All files passed UI consistency check!");
    console.log("   No forbidden colors found.\n");
    process.exit(0);
  } else {
    console.log(`❌ Found ${allIssues.length} file(s) with UI consistency issues:\n`);

    allIssues.forEach(({ file, issues }) => {
      console.log(`📄 ${file}`);
      issues.forEach(({ line, content, color }) => {
        console.log(`   Line ${line}: Found forbidden color "${color}"`);
        console.log(`   ${content.substring(0, 80)}${content.length > 80 ? "..." : ""}`);
      });
      console.log("");
    });

    console.log(`\n⚠️  Total issues: ${allIssues.reduce((sum, f) => sum + f.issues.length, 0)}`);
    console.log("\n💡 Please replace forbidden colors with Midnight Neon design tokens.\n");
    process.exit(1);
  }
}

main();
