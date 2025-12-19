#!/usr/bin/env node

/**
 * MVP 测试运行器
 * 按顺序运行所有测试脚本，遇到第一个错误即退出
 * 
 * 使用方法：
 *   pnpm test:mvp
 */

const { spawn } = require('child_process')
const { join } = require('path')

const tests = [
  { name: 'test:auth', script: 'test-auth-flow.js' },
  { name: 'test:visibility', script: 'scripts/test-visibility.js' },
  { name: 'test:paywall', script: 'scripts/test-paywall.js' },
  { name: 'test:watermark', script: 'scripts/test-watermark.js' },
]

function runTest(test) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Running: ${test.name}`)
    console.log('='.repeat(60))
    
    const scriptPath = join(process.cwd(), test.script)
    const proc = spawn('node', [scriptPath], {
      stdio: 'inherit',
      shell: false,
      env: process.env,
    })
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${test.name} failed with exit code ${code}`))
      }
    })
    
    proc.on('error', (err) => {
      reject(new Error(`${test.name} failed to start: ${err.message}`))
    })
  })
}

async function main() {
  console.log('\n🚀 Starting MVP Test Suite')
  console.log(`Running ${tests.length} test suites in sequence...\n`)
  
  for (const test of tests) {
    try {
      await runTest(test)
      console.log(`\n✅ ${test.name} passed\n`)
    } catch (err) {
      console.error(`\n❌ ${test.name} failed: ${err.message}\n`)
      process.exit(1)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('✅ All MVP tests passed!')
  console.log('='.repeat(60) + '\n')
  process.exit(0)
}

main().catch((err) => {
  console.error(`\n❌ Fatal error: ${err.message}\n`)
  process.exit(1)
})

