#!/usr/bin/env tsx
/**
 * UI Consistency Verification Script
 * 检查代码中是否有硬编码的旧颜色值
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

// 禁止使用的旧颜色值（Midnight Neon + 旧系统）
const FORBIDDEN_COLORS = [
  // Midnight Neon violet/purple palette
  "#8B5CF6",
  "#7C3AED",
  "#6D28D9",
  "#6366F1",
  "#4F46E5",
  "#A855F7",
  // Old amber gold
  "#F59E0B",
  "#D97706",
  "#B45309",
  // Old teal/blue-green
  "#14B8A6",
  "#00c2b2",
  // Old background layers
  "#070a0f",
  "#0e1422",
  "#1a2030",
  "#000000",
  "#050505",
  "#0a0a0a",
  "#0d0d0f",
  "#131318",
  // Old electric pink
  "#EC4899",
  // Noir Cabaret v4 palette (superseded by v5)
  "#9E4A57",
  "#B05A66",
  "#8A3F4B",
  "#D9594C",
  "#C8BFC1",
  "#96878A",
  "#0E0B0C",
  "#1E1719",
];

// Noir Cabaret v5 — 允许的颜色值（只在 globals.css 中出现）
const ALLOWED_COLORS = [
  // Backgrounds (warm black)
  "#0B0B0D",
  "#111013",
  "#141114",
  "#161113",
  "#302222",
  "#251D1F",
  // Wine (primary)
  "#8B313A",
  "#A03E48",
  "#6F272E",
  "#54232D",
  // Premium (champagne gold)
  "#C9A876",
  "#D9BC90",
  "#2A241B",
  // Semantic
  "#6B9E87",
  "#C9924E",
  "#C13D26",
  "#E86A50",
  "#7A9EBB",
  // Text
  "#F5F0EE",
  "#B5A9AC",
  "#82767A",
  "#5C5053",
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

// Bare Tailwind palette class patterns (forbidden in app/ and components/)
const FORBIDDEN_CLASS_PATTERNS = [
  /\b(violet|purple|indigo)-\d{3}\b/,
  /\bamber-\d{3}\b/,
  /\bfrom-(violet|purple|indigo|amber)-\d{3}\b/,
  /\bto-(violet|purple|indigo|amber)-\d{3}\b/,
  /shadow-glow-/,
  // Removed in the v5 refactor (Batch A) — CSS no longer defines these, so
  // reintroducing them silently no-ops instead of erroring at build time.
  /\bbg-accent-gradient\b/,
  /\bbg-brand-primary-subtle\b/,
  /\btext-gradient-primary\b/,
  /\bduotone-overlay\b/,
  /\bfocus-ring\b/,
  /\bcontainer-app\b/,
  /\bfeed-(layout|center|sidebar)\b/,
  /\bstudio-(layout|sidebar)\b/,
  /\bpost-grid-[23]\b/,
  /\bscroll-to-top\b/,
  /\bh-btn-(xs|sm|md|lg)\b/,
];

function checkFile(filePath: string): {
  file: string;
  issues: Array<{ line: number; content: string; color: string }>;
} {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const issues: Array<{ line: number; content: string; color: string }> = [];
  const isGlobals = filePath.includes("globals.css");

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;

    // Check forbidden hex colors
    FORBIDDEN_COLORS.forEach((color) => {
      if (line.includes(color)) {
        const colorIndex = line.indexOf(color);
        if (colorIndex !== -1) {
          const before = line[colorIndex - 1];
          const after = line[colorIndex + color.length];
          if (
            (before === '"' || before === "'" || before === " " || before === ":") &&
            (after === '"' || after === "'" || after === " " || after === ";" || after === ",")
          ) {
            issues.push({ line: index + 1, content: trimmed, color });
          }
        }
      }
    });

    // Check forbidden class patterns (only in .tsx/.jsx files, not in globals.css)
    if (!isGlobals && (filePath.endsWith(".tsx") || filePath.endsWith(".jsx"))) {
      FORBIDDEN_CLASS_PATTERNS.forEach((pattern) => {
        if (pattern.test(line)) {
          issues.push({
            line: index + 1,
            content: trimmed,
            color: `forbidden-class: ${pattern.toString()}`,
          });
        }
      });
    }
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
    console.log(
      "\n💡 Replace forbidden colors with Noir Cabaret v4 design tokens (see DESIGN.md).\n"
    );
    console.log("   Use: var(--wine) for primary actions, var(--premium) for paid identity.\n");
    process.exit(1);
  }
}

main();
