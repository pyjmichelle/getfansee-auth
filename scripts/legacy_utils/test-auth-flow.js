#!/usr/bin/env node

/**
 * 认证流程自动化测试脚本
 * 使用 SERVICE_ROLE_KEY 进行 schema 校验和插入/查询验收（绕过 RLS）
 * 
 * 使用方法：
 *   pnpm test:auth
 * 
 * 前置条件：
 *   1. 已配置 .env.local 文件（包含所有必需的环境变量）
 *   2. 已执行 migrations/004_fix_profiles_final.sql
 */

const { createClient: createUnsafeClient } = require('@supabase/supabase-js')
const { assertDedicatedTestProject, requireTestPassword } = require('../utils/assert-test-environment.cjs')
function createClient(url, ...args) {
  assertDedicatedTestProject(url)
  return createUnsafeClient(url, ...args)
}
const { readFileSync } = require('fs')
const { join } = require('path')

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function success(message) {
  log(`✅ ${message}`, 'green')
}

function error(message) {
  log(`❌ ${message}`, 'red')
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan')
}

// 加载环境变量（优先从 process.env，fallback 到 .env.local）
function loadEnv() {
  const env = {}
  
  // 首先从 process.env 读取（用于 CI/CD）
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  }
  
  // 如果 process.env 中没有，尝试从 .env.local 读取（用于本地开发）
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const envPath = join(__dirname, '.env.local')
      const envContent = readFileSync(envPath, 'utf-8')
      
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=')
          if (key && valueParts.length > 0) {
            const keyTrimmed = key.trim()
            const valueTrimmed = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
            // 只在 process.env 中没有时才使用 .env.local 的值
            if (!env[keyTrimmed]) {
              env[keyTrimmed] = valueTrimmed
            }
          }
        }
      })
    } catch (err) {
      // .env.local 不存在或读取失败，继续使用 process.env
    }
  }
  
  return env
}

// 验证 JWT token 的 role
function validateJwtRole(token, expectedRole) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
    return payload.role === expectedRole
  } catch {
    return false
  }
}

// 打印修复建议
function printFixSuggestion(title, steps) {
  log(`\n🔧 修复建议: ${title}`, 'yellow')
  steps.forEach((step, i) => {
    log(`   ${i + 1}. ${step}`, 'cyan')
  })
  log('')
}

// 初始化 Supabase 客户端
function initSupabaseClients() {
  const env = loadEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  
  // 检测是否在 CI 环境
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
  
  // 检查必需的环境变量
  if (!supabaseUrl) {
    error('❌ 缺少环境变量：NEXT_PUBLIC_SUPABASE_URL')
    printFixSuggestion('配置环境变量', [
      '打开 .env.local 文件',
      '添加一行: NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co',
      '保存文件并重新运行测试'
    ])
    process.exit(1)
  }
  
  if (!anonKey) {
    error('❌ 缺少环境变量：NEXT_PUBLIC_SUPABASE_ANON_KEY')
    printFixSuggestion('配置环境变量', [
      '打开 .env.local 文件',
      '添加一行: NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_anon_key',
      '在 Supabase Dashboard → Settings → API 中获取',
      '保存文件并重新运行测试'
    ])
    process.exit(1)
  }
  
  // 在 CI 环境中，service_role 是可选的
  if (!serviceRoleKey) {
    if (isCI) {
      warning('⚠️  SUPABASE_SERVICE_ROLE_KEY 未设置 - 将跳过需要 admin 权限的测试')
    } else {
      error('❌ 缺少环境变量：SUPABASE_SERVICE_ROLE_KEY')
      printFixSuggestion('配置环境变量', [
        '打开 .env.local 文件',
        '添加一行: SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key',
        '⚠️ 在本地填写，不要粘贴到对话中',
        '在 Supabase Dashboard → Settings → API 中获取（service_role key）',
        '保存文件并重新运行测试'
      ])
      process.exit(1)
    }
  }
  
  // 检查占位符
  if (supabaseUrl.includes('placeholder')) {
    error('❌ NEXT_PUBLIC_SUPABASE_URL 包含占位符')
    printFixSuggestion('修复环境变量', [
      '打开 .env.local 文件',
      '将 NEXT_PUBLIC_SUPABASE_URL 替换为真实的 Supabase URL',
      '保存文件并重新运行测试'
    ])
    process.exit(1)
  }
  
  if (anonKey.includes('placeholder')) {
    error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY 包含占位符')
    printFixSuggestion('修复环境变量', [
      '打开 .env.local 文件',
      '将 NEXT_PUBLIC_SUPABASE_ANON_KEY 替换为真实的 anon key',
      '在 Supabase Dashboard → Settings → API 中获取',
      '保存文件并重新运行测试'
    ])
    process.exit(1)
  }
  
  // 验证 SERVICE_ROLE_KEY 的 role（如果提供了）
  if (serviceRoleKey && !validateJwtRole(serviceRoleKey, 'service_role')) {
    error('❌ SUPABASE_SERVICE_ROLE_KEY 的 JWT role 不正确')
    printFixSuggestion('修复 SERVICE_ROLE_KEY', [
      '检查 .env.local 中的 SUPABASE_SERVICE_ROLE_KEY',
      '确保使用的是 service_role key（不是 anon key）',
      '在 Supabase Dashboard → Settings → API 中获取正确的 service_role key',
      '⚠️ 在本地填写，不要粘贴到对话中',
      '保存文件并重新运行测试'
    ])
    process.exit(1)
  }
  
  // 验证 URL 格式
  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
    error('❌ NEXT_PUBLIC_SUPABASE_URL 格式不正确')
    printFixSuggestion('修复 URL', [
      '检查 .env.local 中的 NEXT_PUBLIC_SUPABASE_URL',
      '格式应为: https://你的项目.supabase.co',
      '在 Supabase Dashboard → Settings → API 中获取',
      '保存文件并重新运行测试'
    ])
    process.exit(1)
  }
  
  // 创建两个客户端：
  // 1. anonClient - 用于测试正常的用户操作（受 RLS 限制）
  // 2. serviceClient - 用于 schema 校验和插入/查询验收（绕过 RLS）
  const anonClient = createClient(supabaseUrl, anonKey)
  const serviceClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }) : null
  
  return { anonClient, serviceClient, supabaseUrl, hasServiceRole: !!serviceRoleKey }
}

// 测试结果统计
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
}

function recordTest(name, passed, details = '') {
  testResults.total++
  if (passed) {
    testResults.passed++
    success(`${name} - 通过`)
    if (details) info(`   详情: ${details}`)
  } else {
    testResults.failed++
    error(`${name} - 失败`)
    if (details) error(`   详情: ${details}`)
  }
}

// 测试 1: 使用 SERVICE_ROLE_KEY 检查 profiles 表结构
async function testProfilesTableStructure(serviceClient) {
  log('\n📋 测试 1: 检查 profiles 表结构（使用 SERVICE_ROLE_KEY）', 'blue')
  
  try {
    // 使用 service role 查询所有字段（绕过 RLS）
    const { data, error: selectError } = await serviceClient
      .from('profiles')
      .select('id, email, display_name, role, age_verified, created_at, updated_at, avatar_url')
      .limit(0)
    
    if (selectError) {
      // 检查是否是字段缺失错误
      if (selectError.message.includes('column') && selectError.message.includes('does not exist')) {
        const missingField = selectError.message.match(/column "(\w+)" does not exist/)?.[1] || '未知字段'
        recordTest('profiles 表结构', false, `缺少字段: ${missingField}`)
        printFixSuggestion('修复表结构', [
          '打开 Supabase Dashboard → SQL Editor',
          '复制 migrations/004_fix_profiles_final.sql 的全部内容',
          '粘贴到 SQL Editor 并点击 Run',
          '等待执行完成（应该看到字段列表）',
          '重新运行测试: pnpm test:auth'
        ])
        return false
      }
      // 其他错误（如表不存在）
      if (selectError.message.includes('relation') && selectError.message.includes('does not exist')) {
        recordTest('profiles 表结构', false, 'profiles 表不存在')
        printFixSuggestion('创建表结构', [
          '打开 Supabase Dashboard → SQL Editor',
          '复制 migrations/001_init.sql 的全部内容（首次创建）',
          '或复制 migrations/004_fix_profiles_final.sql（修复现有表）',
          '粘贴到 SQL Editor 并点击 Run',
          '等待执行完成',
          '重新运行测试: pnpm test:auth'
        ])
        return false
      }
      // 权限错误（可能是 SERVICE_ROLE_KEY 不正确）
      if (selectError.message.includes('permission') || selectError.message.includes('JWT')) {
        recordTest('profiles 表结构', false, `权限错误: ${selectError.message}`)
        printFixSuggestion('修复 SERVICE_ROLE_KEY', [
          '检查 .env.local 中的 SUPABASE_SERVICE_ROLE_KEY',
          '确保使用的是 service_role key（不是 anon key）',
          '在 Supabase Dashboard → Settings → API 中获取正确的 service_role key',
          '⚠️ 在本地填写，不要粘贴到对话中',
          '保存文件并重新运行测试'
        ])
        return false
      }
      recordTest('profiles 表结构', false, selectError.message)
      printFixSuggestion('检查错误', [
        '查看上述错误信息',
        '如果是字段缺失 → 执行 migrations/004_fix_profiles_final.sql',
        '如果是权限错误 → 检查 SERVICE_ROLE_KEY',
        '如果是表不存在 → 执行 migrations/001_init.sql'
      ])
      return false
    }
    
    // 验证所有必需字段都存在
    const requiredFields = ['id', 'email', 'display_name', 'role', 'age_verified', 'created_at', 'updated_at']
    recordTest('profiles 表结构', true, `所有必需字段都存在: ${requiredFields.join(', ')}`)
    return true
  } catch (err) {
    recordTest('profiles 表结构', false, err.message)
    return false
  }
}

// 测试 2: 使用 SERVICE_ROLE_KEY 测试插入和查询（schema 验收）
async function testProfilesInsertAndQuery(serviceClient, supabaseUrl, serviceRoleKey) {
  log('\n🔍 测试 2: Schema 验收 - 插入和查询 profiles（使用 SERVICE_ROLE_KEY）', 'blue')
  
  const testEmail = `schema-test-${Date.now()}@example.com`
  const testPassword = requireTestPassword()
  let testUserId = null
  
  try {
    // 1. 先创建一个测试用户（使用 Supabase Admin API）
    // 注意：profiles.id 是外键引用 auth.users.id，所以必须先创建用户
    
    // 使用 REST API 创建用户（需要 service_role key）
    const createUserResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        email_confirm: true // 自动确认邮箱，避免需要验证
      })
    })
    
    if (!createUserResponse.ok) {
      const errorText = await createUserResponse.text()
      recordTest('Schema 验收 - 创建测试用户', false, `HTTP ${createUserResponse.status}: ${errorText}`)
      printFixSuggestion('修复用户创建', [
        '检查 SERVICE_ROLE_KEY 是否正确',
        '确保使用的是 service_role key（不是 anon key）',
        '⚠️ 在本地填写，不要粘贴到对话中',
        '保存文件并重新运行测试'
      ])
      return false
    }
    
    const userData = await createUserResponse.json()
    testUserId = userData.id
    
    if (!testUserId) {
      recordTest('Schema 验收 - 创建测试用户', false, '创建用户后未返回 user ID')
      return false
    }
    
    recordTest('Schema 验收 - 创建测试用户', true, `用户创建成功: ${testUserId.substring(0, 8)}...`)
    
    // 2. 测试插入 profile（使用 service role，绕过 RLS）
    const { error: insertError } = await serviceClient.from('profiles').insert({
      id: testUserId,
      email: testEmail,
      display_name: 'schema_test',
      role: 'fan',
      age_verified: false,
    })
    
    if (insertError) {
      recordTest('Schema 验收 - 插入', false, insertError.message)
      // 清理用户
      try {
        await fetch(`${supabaseUrl}/auth/v1/admin/users/${testUserId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
          }
        })
      } catch {}
      
      // 检查是否是字段缺失
      if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
        printFixSuggestion('修复表结构', [
          '打开 Supabase Dashboard → SQL Editor',
          '复制 migrations/004_fix_profiles_final.sql 的全部内容',
          '粘贴到 SQL Editor 并点击 Run',
          '等待执行完成',
          '重新运行测试: pnpm test:auth'
        ])
      } else if (insertError.message.includes('permission') || insertError.message.includes('JWT')) {
        printFixSuggestion('修复 SERVICE_ROLE_KEY', [
          '检查 .env.local 中的 SUPABASE_SERVICE_ROLE_KEY',
          '确保使用的是 service_role key',
          '⚠️ 在本地填写，不要粘贴到对话中',
          '保存文件并重新运行测试'
        ])
      } else if (insertError.message.includes('foreign key')) {
        printFixSuggestion('修复外键约束', [
          '这通常不应该发生，因为我们已经创建了用户',
          '如果持续出现，请检查 profiles 表的外键约束',
          '重新运行测试: pnpm test:auth'
        ])
      }
      return false
    }
    
    recordTest('Schema 验收 - 插入', true, `成功插入测试记录: ${testEmail}`)
    
    // 3. 测试查询（使用 service role）
    const { data: queryData, error: queryError } = await serviceClient
      .from('profiles')
      .select('id, email, display_name, role, age_verified, created_at, updated_at')
      .eq('id', testUserId)
      .single()
    
    if (queryError) {
      recordTest('Schema 验收 - 查询', false, queryError.message)
      // 清理测试数据
      await serviceClient.from('profiles').delete().eq('id', testUserId)
      try {
        await fetch(`${supabaseUrl}/auth/v1/admin/users/${testUserId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
          }
        })
      } catch {}
      if (queryError.message.includes('column') && queryError.message.includes('does not exist')) {
        printFixSuggestion('修复表结构', [
          '打开 Supabase Dashboard → SQL Editor',
          '复制 migrations/004_fix_profiles_final.sql 的全部内容',
          '粘贴到 SQL Editor 并点击 Run',
          '等待执行完成',
          '重新运行测试: pnpm test:auth'
        ])
      }
      return false
    }
    
    if (!queryData) {
      recordTest('Schema 验收 - 查询', false, '查询返回 null')
      await serviceClient.from('profiles').delete().eq('id', testUserId)
      try {
        await fetch(`${supabaseUrl}/auth/v1/admin/users/${testUserId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
          }
        })
      } catch {}
      return false
    }
    
    // 验证所有字段都存在且类型正确
    const hasAllFields = 
      queryData.id === testUserId &&
      queryData.email === testEmail &&
      queryData.display_name === 'schema_test' &&
      queryData.role === 'fan' &&
      queryData.age_verified === false &&
      queryData.created_at !== null &&
      queryData.updated_at !== null
    
    if (!hasAllFields) {
      recordTest('Schema 验收 - 查询', false, `字段不完整: ${JSON.stringify(queryData)}`)
      await serviceClient.from('profiles').delete().eq('id', testUserId)
      try {
        await fetch(`${supabaseUrl}/auth/v1/admin/users/${testUserId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
          }
        })
      } catch {}
      return false
    }
    
    recordTest('Schema 验收 - 查询', true, `所有字段正确: email=${queryData.email}, role=${queryData.role}`)
    
    // 4. 清理测试数据
    const { error: deleteError } = await serviceClient.from('profiles').delete().eq('id', testUserId)
    if (deleteError) {
      warning(`清理测试 profile 失败: ${deleteError.message}`)
    } else {
      info('测试 profile 已删除')
    }
    
    // 删除测试用户
    try {
      const deleteUserResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${testUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      })
      if (deleteUserResponse.ok) {
        info('测试用户已删除')
      } else {
        warning(`清理测试用户失败: HTTP ${deleteUserResponse.status}`)
      }
    } catch (err) {
      warning(`清理测试用户异常: ${err.message}`)
    }
    
    return true
  } catch (err) {
    recordTest('Schema 验收', false, err.message)
    // 尝试清理
    if (testUserId) {
      try {
        await serviceClient.from('profiles').delete().eq('id', testUserId)
        const serviceRoleKey = loadEnv().SUPABASE_SERVICE_ROLE_KEY
        await fetch(`${initSupabaseClients().supabaseUrl}/auth/v1/admin/users/${testUserId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
          }
        })
      } catch {}
    }
    return false
  }
}

// 测试 3: 测试注册（使用 anon key，正常用户操作）
async function testSignUp(anonClient) {
  log('\n📝 测试 3: 测试注册功能（使用 ANON_KEY）', 'blue')
  
  const testEmail = `test-${Date.now()}@example.com`
  const testPassword = requireTestPassword()
  
  try {
    const { data, error } = await anonClient.auth.signUp({
      email: testEmail,
      password: testPassword,
    })
    
    if (error) {
      recordTest('注册功能', false, error.message)
      return { success: false, email: testEmail, userId: null, password: testPassword }
    }
    
    const hasUser = !!data?.user
    const hasSession = !!data?.session
    
    if (!hasUser) {
      recordTest('注册功能', false, '注册后没有返回 user 对象')
      return { success: false, email: testEmail, userId: null, password: testPassword }
    }
    
    const details = `hasUser: ${hasUser}, hasSession: ${hasSession}, userId: ${data.user.id}`
    recordTest('注册功能', true, details)
    
    return { success: true, email: testEmail, userId: data.user.id, hasSession, password: testPassword }
  } catch (err) {
    recordTest('注册功能', false, err.message)
    return { success: false, email: testEmail, userId: null, password: testPassword }
  }
}

// 测试 4: 使用 SERVICE_ROLE_KEY 测试 ensureProfile 逻辑（插入/查询验收）
async function testEnsureProfileWithServiceRole(serviceClient, userId, userEmail) {
  log('\n👤 测试 4: ensureProfile 逻辑验收（使用 SERVICE_ROLE_KEY）', 'blue')
  
  if (!userId || !userEmail) {
    recordTest('ensureProfile 逻辑验收', false, '需要先注册用户')
    return false
  }
  
  try {
    // 1. 检查 profile 是否存在（使用 service role）
    const { data: existingProfile, error: selectError } = await serviceClient
      .from('profiles')
      .select('id, email, display_name, role, age_verified')
      .eq('id', userId)
      .maybeSingle()
    
    if (selectError) {
      recordTest('ensureProfile 逻辑验收 - 查询', false, selectError.message)
      if (selectError.message.includes('column') && selectError.message.includes('does not exist')) {
        printFixSuggestion('修复表结构', [
          '打开 Supabase Dashboard → SQL Editor',
          '复制 migrations/004_fix_profiles_final.sql 的全部内容',
          '粘贴到 SQL Editor 并点击 Run',
          '等待执行完成',
          '重新运行测试: pnpm test:auth'
        ])
      }
      return false
    }
    
    if (existingProfile) {
      recordTest('ensureProfile 逻辑验收 - 查询', true, `Profile 已存在: email=${existingProfile.email}, role=${existingProfile.role}`)
      
      // 验证字段完整性
      const hasAllFields = 
        existingProfile.id === userId &&
        existingProfile.email === userEmail &&
        existingProfile.role === 'fan' &&
        existingProfile.age_verified === false
      
      if (!hasAllFields) {
        recordTest('ensureProfile 逻辑验收 - 字段验证', false, `字段不完整: ${JSON.stringify(existingProfile)}`)
        return false
      }
      
      recordTest('ensureProfile 逻辑验收 - 字段验证', true, '所有字段正确')
      return true
    }
    
    // 2. 如果不存在，使用 service role 创建（模拟 ensureProfile 逻辑）
    const { error: insertError } = await serviceClient.from('profiles').insert({
      id: userId,
      email: userEmail,
      display_name: userEmail.split('@')[0],
      role: 'fan',
      age_verified: false,
    })
    
    if (insertError) {
      recordTest('ensureProfile 逻辑验收 - 创建', false, insertError.message)
      if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
        printFixSuggestion('修复表结构', [
          '打开 Supabase Dashboard → SQL Editor',
          '复制 migrations/004_fix_profiles_final.sql 的全部内容',
          '粘贴到 SQL Editor 并点击 Run',
          '等待执行完成',
          '重新运行测试: pnpm test:auth'
        ])
      } else if (insertError.message.includes('permission') || insertError.message.includes('JWT')) {
        printFixSuggestion('修复 SERVICE_ROLE_KEY', [
          '检查 .env.local 中的 SUPABASE_SERVICE_ROLE_KEY',
          '确保使用的是 service_role key',
          '⚠️ 在本地填写，不要粘贴到对话中',
          '保存文件并重新运行测试'
        ])
      }
      return false
    }
    
    recordTest('ensureProfile 逻辑验收 - 创建', true, 'Profile 创建成功')
    
    // 3. 再次查询验证
    const { data: newProfile, error: verifyError } = await serviceClient
      .from('profiles')
      .select('id, email, display_name, role, age_verified')
      .eq('id', userId)
      .single()
    
    if (verifyError || !newProfile) {
      recordTest('ensureProfile 逻辑验收 - 验证', false, '创建后查询失败')
      return false
    }
    
    recordTest('ensureProfile 逻辑验收 - 验证', true, `Profile 验证成功: ${JSON.stringify(newProfile)}`)
    return true
  } catch (err) {
    recordTest('ensureProfile 逻辑验收', false, err.message)
    return false
  }
}

// 测试 5: 测试登录（使用 anon key）
async function testSignIn(anonClient, email, password) {
  log('\n🔐 测试 5: 测试登录功能（使用 ANON_KEY）', 'blue')
  
  if (!email || !password) {
    recordTest('登录功能', false, '需要先注册用户')
    return false
  }
  
  try {
    // 先退出当前 session（如果有）
    await anonClient.auth.signOut()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const { data, error } = await anonClient.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      recordTest('登录功能', false, error.message)
      return false
    }
    
    const hasUser = !!data?.user
    const hasSession = !!data?.session
    
    if (!hasUser || !hasSession) {
      recordTest('登录功能', false, `hasUser: ${hasUser}, hasSession: ${hasSession}`)
      return false
    }
    
    recordTest('登录功能', true, `userId: ${data.user.id}`)
    return { success: true, userId: data.user.id, email: data.user.email }
  } catch (err) {
    recordTest('登录功能', false, err.message)
    return false
  }
}

// 测试 6: 使用 SERVICE_ROLE_KEY 验证登录后的 profile
async function testProfileAfterLogin(serviceClient, userId, userEmail) {
  log('\n✅ 测试 6: 登录后 profile 验证（使用 SERVICE_ROLE_KEY）', 'blue')
  
  if (!userId || !userEmail) {
    recordTest('登录后 profile 验证', false, '需要先登录')
    return false
  }
  
  try {
    const { data: profile, error: queryError } = await serviceClient
      .from('profiles')
      .select('id, email, display_name, role, age_verified, created_at, updated_at')
      .eq('id', userId)
      .single()
    
    if (queryError) {
      recordTest('登录后 profile 验证', false, queryError.message)
      if (queryError.message.includes('column') && queryError.message.includes('does not exist')) {
        printFixSuggestion('修复表结构', [
          '打开 Supabase Dashboard → SQL Editor',
          '复制 migrations/004_fix_profiles_final.sql 的全部内容',
          '粘贴到 SQL Editor 并点击 Run',
          '等待执行完成',
          '重新运行测试: pnpm test:auth'
        ])
      }
      return false
    }
    
    if (!profile) {
      recordTest('登录后 profile 验证', false, 'Profile 不存在')
      return false
    }
    
    // 验证所有字段
    const isValid = 
      profile.id === userId &&
      profile.email === userEmail &&
      profile.role === 'fan' &&
      profile.age_verified === false &&
      profile.created_at !== null &&
      profile.updated_at !== null
    
    if (!isValid) {
      recordTest('登录后 profile 验证', false, `字段验证失败: ${JSON.stringify(profile)}`)
      return false
    }
    
    recordTest('登录后 profile 验证', true, `Profile 完整: email=${profile.email}, role=${profile.role}`)
    return true
  } catch (err) {
    recordTest('登录后 profile 验证', false, err.message)
    return false
  }
}

// 测试 7: 清理测试数据（使用 SERVICE_ROLE_KEY）
async function cleanupTestData(serviceClient, userId, email) {
  log('\n🧹 测试 7: 清理测试数据（使用 SERVICE_ROLE_KEY）', 'blue')
  
  if (!userId) {
    return
  }
  
  try {
    // 使用 service role 删除 profile（绕过 RLS）
    const { error: deleteError } = await serviceClient
      .from('profiles')
      .delete()
      .eq('id', userId)
    
    if (deleteError) {
      warning(`无法删除测试 profile: ${deleteError.message}`)
      recordTest('清理测试数据', false, deleteError.message)
    } else {
      info('测试 profile 已删除')
      recordTest('清理测试数据', true, '测试数据已清理（auth.users 需要手动删除）')
    }
  } catch (err) {
    warning(`清理失败: ${err.message}`)
    recordTest('清理测试数据', false, err.message)
  }
}

// 主测试函数
async function runTests() {
  log('\n🚀 开始认证流程自动化测试\n', 'blue')
  
  const { anonClient, serviceClient, supabaseUrl, hasServiceRole } = initSupabaseClients()
  info(`Supabase URL: ${supabaseUrl.substring(0, 30)}...`)
  
  if (hasServiceRole) {
    info(`使用 SERVICE_ROLE_KEY 进行 schema 校验和插入/查询验收`)
  } else {
    warning('⚠️  SERVICE_ROLE_KEY 未设置 - 将跳过需要 admin 权限的测试')
  }
  
  // 测试 1: 检查表结构（使用 service role，如果可用）
  if (hasServiceRole) {
    const tableOk = await testProfilesTableStructure(serviceClient)
    if (!tableOk) {
      error('\n❌ 表结构检查失败，请先执行 migrations/004_fix_profiles_final.sql')
      process.exit(1)
    }
    
    // 测试 2: Schema 验收 - 插入和查询（使用 service role）
    const env = loadEnv()
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
    await testProfilesInsertAndQuery(serviceClient, supabaseUrl, serviceRoleKey)
  } else {
    info('⏭️  跳过表结构检查和 schema 验收（需要 SERVICE_ROLE_KEY）')
  }
  
  // 测试 3: 注册（使用 anon key）
  const signUpResult = await testSignUp(anonClient)
  
  // 测试 4: ensureProfile 逻辑验收（使用 service role，如果可用）
  if (signUpResult.success && hasServiceRole) {
    await testEnsureProfileWithServiceRole(serviceClient, signUpResult.userId, signUpResult.email)
  } else if (signUpResult.success && !hasServiceRole) {
    info('⏭️  跳过 ensureProfile 逻辑验收（需要 SERVICE_ROLE_KEY）')
  }
  
  // 测试 5: 登录（使用 anon key）
  let loginResult = null
  if (signUpResult.success) {
    // 先退出当前 session
    await anonClient.auth.signOut()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    loginResult = await testSignIn(anonClient, signUpResult.email, signUpResult.password)
    
    // 测试 6: 登录后 profile 验证（使用 service role，如果可用）
    if (loginResult && loginResult.success) {
      if (hasServiceRole) {
        await testProfileAfterLogin(serviceClient, loginResult.userId, loginResult.email)
      } else {
        info('⏭️  跳过登录后 profile 验证（需要 SERVICE_ROLE_KEY）')
      }
    }
  }
  
  // 测试 7: 清理（使用 service role，如果可用）
  const userIdToClean = loginResult?.userId || signUpResult?.userId
  const emailToClean = loginResult?.email || signUpResult?.email
  if (userIdToClean && hasServiceRole) {
    await cleanupTestData(serviceClient, userIdToClean, emailToClean)
  } else if (userIdToClean && !hasServiceRole) {
    warning(`⚠️  无法清理测试数据（需要 SERVICE_ROLE_KEY）- userId: ${userIdToClean}`)
  }
  
  // 输出测试结果
  log('\n' + '='.repeat(50), 'blue')
  log('📊 测试结果汇总', 'blue')
  log('='.repeat(50), 'blue')
  log(`总测试数: ${testResults.total}`, 'cyan')
  success(`通过: ${testResults.passed}`)
  if (testResults.failed > 0) {
    error(`失败: ${testResults.failed}`)
  }
  log('='.repeat(50), 'blue')
  
  if (testResults.failed === 0) {
    success('\n🎉 所有测试通过！')
    log('\n✅ 可以进入 Step2/Step3 功能开发', 'green')
    process.exit(0)
  } else {
    error(`\n❌ 有 ${testResults.failed} 个测试失败`)
    log('\n📋 请按照上述修复建议操作，然后重新运行: pnpm test:auth', 'yellow')
    log('⚠️  只有测试全绿，才能进入 Step2/Step3 功能开发！', 'yellow')
    process.exit(1)
  }
}

// 运行测试
runTests().catch(err => {
  error(`\n💥 测试执行出错: ${err.message}`)
  console.error(err)
  process.exit(1)
})
