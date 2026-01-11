#!/usr/bin/env node

/**
 * Role 和 Creator Onboarding 功能自动化测试脚本
 * 测试 setRoleCreator 和 updateCreatorProfile
 * 
 * 使用方法：
 *   pnpm test:role
 * 
 * 前置条件：
 *   1. 已配置 .env.local 文件
 *   2. 已执行 migrations/006_creator_onboarding.sql
 */

const { createClient } = require('@supabase/supabase-js')
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

// 加载环境变量
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env.local')
    const envContent = readFileSync(envPath, 'utf-8')
    const env = {}
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim()
        }
      }
    })
    
    return env
  } catch (err) {
    error(`无法读取 .env.local 文件: ${err.message}`)
    process.exit(1)
  }
}

// 初始化 Supabase 客户端
function initSupabase() {
  const env = loadEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !anonKey) {
    error('缺少环境变量：NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(1)
  }
  
  return createClient(supabaseUrl, anonKey)
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

// ensureProfile 实现
async function ensureProfile(supabase, userId, userEmail) {
  try {
    const { data, error: selectError } = await supabase
      .from('profiles')
      .select('id, role, age_verified')
      .eq('id', userId)
      .maybeSingle()

    if (selectError) {
      return false
    }

    if (!data) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: userId,
        email: userEmail,
        display_name: userEmail.split('@')[0],
        role: 'fan',
        age_verified: false,
      })
      return !insertError
    }

    return true
  } catch (_err) {
    return false
  }
}

// getProfile 实现
async function getProfile(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, display_name, bio, avatar_url, email')
      .eq('id', userId)
      .single()

    if (error) {
      return null
    }

    return data
  } catch (_err) {
    return null
  }
}

// setRoleCreator 实现
async function setRoleCreator(supabase, userId) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'creator' })
      .eq('id', userId)

    return !error
  } catch (_err) {
    return false
  }
}

// updateCreatorProfile 实现
async function updateCreatorProfile(supabase, params) {
  try {
    const updateData = {}

    if (params.display_name !== undefined) {
      updateData.display_name = params.display_name
    }
    if (params.bio !== undefined) {
      updateData.bio = params.bio
    }
    if (params.avatar_url !== undefined) {
      updateData.avatar_url = params.avatar_url
    }

    if (Object.keys(updateData).length === 0) {
      return true
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', params.userId)

    return !error
  } catch (_err) {
    return false
  }
}

// 测试 1: 注册新用户并登录
async function testRegisterAndLogin(supabase) {
  log('\n📝 测试 1: 注册新用户并登录', 'blue')
  
  const testEmail = `role-test-${Date.now()}@example.com`
  const testPassword = 'TestPassword123!'
  
  try {
    // 注册
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    })
    
    if (signUpError || !signUpData?.user) {
      recordTest('注册新用户', false, signUpError?.message || '注册失败')
      return null
    }
    
    recordTest('注册新用户', true, `userId: ${signUpData.user.id.substring(0, 8)}...`)
    
    // 登录（如果注册时没有 session）
    if (!signUpData.session) {
      await supabase.auth.signOut()
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      })
      
      if (signInError || !signInData?.session) {
        recordTest('登录', false, signInError?.message || '登录失败')
        return null
      }
      
      recordTest('登录', true, '登录成功')
      return { userId: signInData.user.id, email: testEmail, password: testPassword }
    }
    
    recordTest('登录', true, '注册时已有 session')
    return { userId: signUpData.user.id, email: testEmail, password: testPassword }
  } catch (err) {
    recordTest('注册和登录', false, err.message)
    return null
  }
}

// 测试 2: ensureProfile 并验证初始 role
async function testEnsureProfileAndInitialRole(supabase, userId, userEmail) {
  log('\n👤 测试 2: ensureProfile 并验证初始 role', 'blue')
  
  try {
    // ensureProfile
    const ensureSuccess = await ensureProfile(supabase, userId, userEmail)
    if (!ensureSuccess) {
      recordTest('ensureProfile', false, 'ensureProfile 失败')
      return false
    }
    
    recordTest('ensureProfile', true, 'Profile 已创建/存在')
    
    // 读取 role
    const profile = await getProfile(supabase, userId)
    if (!profile) {
      recordTest('读取初始 role', false, '无法读取 profile')
      return false
    }
    
    if (profile.role !== 'fan') {
      recordTest('初始 role 为 fan', false, `期望 'fan'，实际 '${profile.role}'`)
      return false
    }
    
    recordTest('初始 role 为 fan', true, `role: ${profile.role}`)
    return true
  } catch (err) {
    recordTest('ensureProfile 和初始 role', false, err.message)
    return false
  }
}

// 测试 3: setRoleCreator
async function testSetRoleCreator(supabase, userId) {
  log('\n🎭 测试 3: setRoleCreator', 'blue')
  
  try {
    const success = await setRoleCreator(supabase, userId)
    
    if (!success) {
      recordTest('setRoleCreator 调用', false, '返回 false')
      return false
    }
    
    recordTest('setRoleCreator 调用', true, '返回 true')
    
    // 验证 role 已更新
    await new Promise(resolve => setTimeout(resolve, 500))
    const profile = await getProfile(supabase, userId)
    
    if (!profile) {
      recordTest('setRoleCreator 后读取 role', false, '无法读取 profile')
      return false
    }
    
    if (profile.role !== 'creator') {
      recordTest('setRoleCreator 后 role 为 creator', false, `期望 'creator'，实际 '${profile.role}'`)
      return false
    }
    
    recordTest('setRoleCreator 后 role 为 creator', true, `role: ${profile.role}`)
    return true
  } catch (err) {
    recordTest('setRoleCreator', false, err.message)
    return false
  }
}

// 测试 4: updateCreatorProfile
async function testUpdateCreatorProfile(supabase, userId) {
  log('\n✏️  测试 4: updateCreatorProfile', 'blue')
  
  const testDisplayName = `Test Creator ${Date.now()}`
  const testBio = 'This is a test bio for creator onboarding'
  
  try {
    const success = await updateCreatorProfile(supabase, {
      userId,
      display_name: testDisplayName,
      bio: testBio,
    })
    
    if (!success) {
      recordTest('updateCreatorProfile 调用', false, '返回 false')
      return false
    }
    
    recordTest('updateCreatorProfile 调用', true, '返回 true')
    
    // 验证字段已写入
    await new Promise(resolve => setTimeout(resolve, 500))
    const profile = await getProfile(supabase, userId)
    
    if (!profile) {
      recordTest('updateCreatorProfile 后读取 profile', false, '无法读取 profile')
      return false
    }
    
    if (profile.display_name !== testDisplayName) {
      recordTest('display_name 写入成功', false, `期望 '${testDisplayName}'，实际 '${profile.display_name}'`)
      return false
    }
    
    recordTest('display_name 写入成功', true, `display_name: ${profile.display_name}`)
    
    if (profile.bio !== testBio) {
      recordTest('bio 写入成功', false, `期望 '${testBio}'，实际 '${profile.bio}'`)
      return false
    }
    
    recordTest('bio 写入成功', true, `bio: ${profile.bio}`)
    return true
  } catch (err) {
    recordTest('updateCreatorProfile', false, err.message)
    return false
  }
}

// 测试 5: 清理测试数据
async function testCleanup(supabase, userId) {
  log('\n🧹 测试 5: 清理测试数据', 'blue')
  
  try {
    // 删除 profile
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)
    
    if (deleteError) {
      warning(`清理 profile 失败: ${deleteError.message}`)
      recordTest('清理 profile', false, deleteError.message)
    } else {
      recordTest('清理 profile', true, '已删除')
    }
    
    info('测试 profile 已清理（auth.users 需要手动删除）')
    return true
  } catch (err) {
    recordTest('清理测试数据', false, err.message)
    return false
  }
}

// 主测试函数
async function runTests() {
  log('\n🚀 开始 Role 和 Creator Onboarding 功能自动化测试\n', 'blue')
  
  const supabase = initSupabase()
  const env = loadEnv()
  info(`Supabase URL: ${env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...`)
  
  // 测试 1: 注册和登录
  const userInfo = await testRegisterAndLogin(supabase)
  if (!userInfo) {
    error('\n❌ 无法创建测试用户，测试终止')
    process.exit(1)
  }
  
  // 测试 2: ensureProfile 并验证初始 role
  await testEnsureProfileAndInitialRole(supabase, userInfo.userId, userInfo.email)
  
  // 测试 3: setRoleCreator
  await testSetRoleCreator(supabase, userInfo.userId)
  
  // 测试 4: updateCreatorProfile
  await testUpdateCreatorProfile(supabase, userInfo.userId)
  
  // 测试 5: 清理
  await testCleanup(supabase, userInfo.userId)
  
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
    process.exit(0)
  } else {
    error(`\n❌ 有 ${testResults.failed} 个测试失败`)
    process.exit(1)
  }
}

// 运行测试
runTests().catch(err => {
  error(`\n💥 测试执行出错: ${err.message}`)
  console.error(err)
  process.exit(1)
})



