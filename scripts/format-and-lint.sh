#!/bin/bash

echo "🔍 Running TypeScript type check..."
pnpm exec tsc --noEmit

if [ $? -ne 0 ]; then
  echo "❌ TypeScript type check failed!"
  exit 1
fi

echo "🧹 Running ESLint..."
if command -v pnpm &> /dev/null && pnpm exec eslint --version &> /dev/null; then
  pnpm exec eslint . --ext .ts,.tsx --fix
else
  echo "⚠️  ESLint not installed, skipping..."
fi

echo "💅 Running Prettier..."
if command -v pnpm &> /dev/null && pnpm exec prettier --version &> /dev/null; then
  pnpm exec prettier --write "**/*.{ts,tsx,json,md}"
else
  echo "⚠️  Prettier not installed, skipping..."
fi

echo "✅ Formatting and linting complete!"

