#!/usr/bin/env node

/**
 * Phase 2 Paywall 功能自动化测试脚本
 * 测试 subscriptions 和 post_unlocks 的完整流程
 * 
 * 使用方法：
 *   pnpm test:paywall
 * 
 * 前置条件：
 *   1. 已配置 .env.local 文件
 *   2. 已执行 migrations/008_phase2_paywall.sql
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
      const envPath = join(__dirname, '..', '.env.local')
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

// 初始化 Supabase 客户端
function initSupabase() {
  const env = loadEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !anonKey) {
    error('缺少环境变量：NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(1)
  }
  
  return {
    anon: createClient(supabaseUrl, anonKey),
    service: serviceKey ? createClient(supabaseUrl, serviceKey) : null,
  }
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

// 模拟 getMyPaywallState（用于测试）
async function getMyPaywallState(supabase, userId) {
  try {
    // 查询 active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('creator_id')
      .eq('subscriber_id', userId)
      .eq('status', 'active')
      .gt('ends_at', new Date().toISOString())
    
    if (subError) {
      console.error('[test] getMyPaywallState subscriptions error:', subError)
      return null
    }
    
    // 查询 unlocked posts
    const { data: unlocks, error: unlockError } = await supabase
      .from('post_unlocks')
      .select('post_id')
      .eq('user_id', userId)
    
    if (unlockError) {
      console.error('[test] getMyPaywallState post_unlocks error:', unlockError)
      return null
    }
    
    return {
      hasActiveSubscription: (subscriptions?.length || 0) > 0,
      unlockedPostIds: new Set(unlocks?.map(u => u.post_id) || []),
    }
  } catch (err) {
    console.error('[test] getMyPaywallState exception:', err)
    return null
  }
}

// 测试 1: 注册和登录
async function testRegisterAndLogin(supabase) {
  log('\n👤 测试 1: 注册和登录', 'blue')
  
  const timestamp = Date.now()
  const testEmail = `test-paywall-${timestamp}@example.com`
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

// 测试 2: 创建 Creator 和 Post
async function testCreateCreatorAndPost(fanSupabase, fanUserId) {
  log('\n👨‍🎨 测试 2: 创建 Creator 和 Post', 'blue')
  
  try {
    // 创建新的 supabase 客户端用于 creator（避免影响 fan 的 session）
    const { createClient } = require('@supabase/supabase-js')
    const env = loadEnv()
    const creatorSupabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    
    // 创建 Creator 用户
    const timestamp = Date.now()
    const creatorEmail = `creator-paywall-${timestamp}@example.com`
    const creatorPassword = 'CreatorPassword123!'
    
    const { data: creatorSignUp, error: creatorSignUpError } = await creatorSupabase.auth.signUp({
      email: creatorEmail,
      password: creatorPassword,
    })
    
    if (creatorSignUpError || !creatorSignUp?.user) {
      recordTest('创建 Creator 用户', false, creatorSignUpError?.message || '注册失败')
      return null
    }
    
    const creatorId = creatorSignUp.user.id
    recordTest('创建 Creator 用户', true, `creatorId: ${creatorId.substring(0, 8)}...`)
    
    // 如果注册时没有 session，需要登录
    if (!creatorSignUp.session) {
      await creatorSupabase.auth.signOut()
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const { data: creatorSignIn, error: creatorSignInError } = await creatorSupabase.auth.signInWithPassword({
        email: creatorEmail,
        password: creatorPassword,
      })
      
      if (creatorSignInError || !creatorSignIn?.session) {
        recordTest('Creator 登录', false, creatorSignInError?.message || '登录失败')
        return null
      }
    }
    
    // 确保 Creator profile 存在并设置为 creator
    const { error: profileError } = await creatorSupabase
      .from('profiles')
      .upsert({
        id: creatorId,
        email: creatorEmail,
        display_name: `Creator ${timestamp}`,
        role: 'creator',
        age_verified: false,
      }, { onConflict: 'id' })
    
    if (profileError) {
      recordTest('创建 Creator profile', false, profileError.message)
      return null
    }
    
    recordTest('创建 Creator profile', true, 'role=creator')
    
    // 创建 locked post（使用 creator 的 session）
    const { data: postData, error: postError } = await creatorSupabase
      .from('posts')
      .insert({
        creator_id: creatorId,
        content: `Test locked post ${timestamp}`,
        is_locked: true,
      })
      .select('id')
      .single()
    
    if (postError || !postData) {
      recordTest('创建 locked post', false, postError?.message || '创建失败')
      return null
    }
    
    recordTest('创建 locked post', true, `postId: ${postData.id.substring(0, 8)}...`)
    
    return { creatorId, postId: postData.id, creatorEmail, creatorPassword, creatorSupabase }
  } catch (err) {
    recordTest('创建 Creator 和 Post', false, err.message)
    return null
  }
}

// 测试 3: 验证初始状态（locked 不可见）
async function testInitialState(supabase, fanUserId, creatorId, postId) {
  log('\n🔍 测试 3: 验证初始状态（locked 不可见）', 'blue')
  
  try {
    // 检查是否有 active subscription
    const hasSub = await hasActiveSubscription(supabase, fanUserId, creatorId)
    if (hasSub !== false) {
      recordTest('初始 hasActiveSubscription', false, `期望 false，实际 ${hasSub}`)
      return false
    }
    recordTest('初始 hasActiveSubscription', true, 'false（正确）')
    
    // 检查是否可以查看 post
    const canView = await canViewPost(supabase, fanUserId, postId, creatorId)
    if (canView !== false) {
      recordTest('初始 canViewPost (locked)', false, `期望 false，实际 ${canView}`)
      return false
    }
    recordTest('初始 canViewPost (locked)', true, 'false（locked 不可见）')
    
    return true
  } catch (err) {
    recordTest('验证初始状态', false, err.message)
    return false
  }
}

// 测试 4: subscribe30d 后 locked 可见
async function testSubscribe30d(supabase, fanUserId, creatorId, postId) {
  log('\n💳 测试 4: subscribe30d 后 locked 可见', 'blue')
  
  try {
    // 验证当前 session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      recordTest('验证 session', false, '没有 session')
      return false
    }
    if (session.user.id !== fanUserId) {
      recordTest('验证 session', false, `session user_id 不匹配: 期望 ${fanUserId}, 实际 ${session.user.id}`)
      return false
    }
    info(`当前 session user_id: ${session.user.id}`)
    
    // 订阅
    const success = await subscribe30d(supabase, fanUserId, creatorId)
    if (!success) {
      recordTest('subscribe30d', false, '订阅失败')
      return false
    }
    recordTest('subscribe30d', true, '订阅成功')
    
    // 等待一下让数据库更新
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 检查 hasActiveSubscription
    const hasSub = await hasActiveSubscription(supabase, fanUserId, creatorId)
    if (hasSub !== true) {
      recordTest('subscribe30d 后 hasActiveSubscription', false, `期望 true，实际 ${hasSub}`)
      return false
    }
    recordTest('subscribe30d 后 hasActiveSubscription', true, 'true（正确）')
    
    // 检查是否可以查看 post
    const canView = await canViewPost(supabase, fanUserId, postId, creatorId)
    if (canView !== true) {
      recordTest('subscribe30d 后 canViewPost', false, `期望 true，实际 ${canView}`)
      return false
    }
    recordTest('subscribe30d 后 canViewPost', true, 'true（locked 可见）')
    
    return true
  } catch (err) {
    recordTest('subscribe30d 测试', false, err.message)
    return false
  }
}

// 测试 5: cancel 后再次不可见
async function testCancelSubscription(supabase, fanUserId, creatorId, postId) {
  log('\n🚫 测试 5: cancel 后再次不可见', 'blue')
  
  try {
    // 取消订阅
    const success = await cancelSubscription(supabase, fanUserId, creatorId)
    if (!success) {
      recordTest('cancelSubscription', false, '取消订阅失败')
      return false
    }
    recordTest('cancelSubscription', true, '取消订阅成功')
    
    // 等待一下让数据库更新
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 检查 hasActiveSubscription
    const hasSub = await hasActiveSubscription(supabase, fanUserId, creatorId)
    if (hasSub !== false) {
      recordTest('cancel 后 hasActiveSubscription', false, `期望 false，实际 ${hasSub}`)
      return false
    }
    recordTest('cancel 后 hasActiveSubscription', true, 'false（正确）')
    
    // 检查是否可以查看 post
    const canView = await canViewPost(supabase, fanUserId, postId, creatorId)
    if (canView !== false) {
      recordTest('cancel 后 canViewPost', false, `期望 false，实际 ${canView}`)
      return false
    }
    recordTest('cancel 后 canViewPost', true, 'false（locked 再次不可见）')
    
    return true
  } catch (err) {
    recordTest('cancelSubscription 测试', false, err.message)
    return false
  }
}

// 测试 6: unlockPost 后（即使未订阅）该 post 可见
async function testUnlockPost(supabase, fanUserId, postId, creatorId) {
  log('\n🔓 测试 6: unlockPost 后（即使未订阅）该 post 可见', 'blue')
  
  try {
    // 验证当前 session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      recordTest('验证 session', false, '没有 session')
      return false
    }
    if (session.user.id !== fanUserId) {
      recordTest('验证 session', false, `session user_id 不匹配: 期望 ${fanUserId}, 实际 ${session.user.id}`)
      return false
    }
    info(`当前 session user_id: ${session.user.id}`)
    
    // 解锁 post
    const success = await unlockPost(supabase, fanUserId, postId)
    if (!success) {
      recordTest('unlockPost', false, '解锁失败')
      return false
    }
    recordTest('unlockPost', true, '解锁成功')
    
    // 等待一下让数据库更新
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 检查是否可以查看 post（即使没有订阅）
    const canView = await canViewPost(supabase, fanUserId, postId, creatorId)
    if (canView !== true) {
      recordTest('unlockPost 后 canViewPost', false, `期望 true，实际 ${canView}`)
      return false
    }
    recordTest('unlockPost 后 canViewPost', true, 'true（即使未订阅也可见）')
    
    return true
  } catch (err) {
    recordTest('unlockPost 测试', false, err.message)
    return false
  }
}

// 辅助函数：hasActiveSubscription
async function hasActiveSubscription(supabase, userId, creatorId) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('subscriber_id', userId)
      .eq('creator_id', creatorId)
      .eq('status', 'active')
      .gt('ends_at', new Date().toISOString())
      .maybeSingle()
    
    if (error) {
      console.error('[test] hasActiveSubscription error:', error)
      return false
    }
    
    return !!data
  } catch (err) {
    console.error('[test] hasActiveSubscription exception:', err)
    return false
  }
}

// 辅助函数：canViewPost
async function canViewPost(supabase, userId, postId, creatorId) {
  try {
    // 1. 检查是否是 creator 本人
    if (creatorId === userId) {
      return true
    }
    
    // 2. 查询 post 信息
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, is_locked, creator_id')
      .eq('id', postId)
      .single()
    
    if (postError || !post) {
      return false
    }
    
    // 3. 如果是公开 post，可以直接查看
    if (!post.is_locked) {
      return true
    }
    
    // 4. 如果是 creator 本人
    if (post.creator_id === userId) {
      return true
    }
    
    // 5. 检查是否有 active subscription
    const hasSub = await hasActiveSubscription(supabase, userId, post.creator_id)
    if (hasSub) {
      return true
    }
    
    // 6. 检查是否已解锁
    const { data: unlock, error: unlockError } = await supabase
      .from('post_unlocks')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle()
    
    if (unlockError) {
      return false
    }
    
    return !!unlock
  } catch (err) {
    console.error('[test] canViewPost exception:', err)
    return false
  }
}

// 辅助函数：subscribe30d
async function subscribe30d(supabase, userId, creatorId) {
  try {
    // 验证当前 session 的 user_id 是否匹配
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || session.user.id !== userId) {
      console.error('[test] subscribe30d: session mismatch', {
        expected: userId,
        actual: session?.user?.id,
      })
      return false
    }
    
    const now = new Date()
    const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        subscriber_id: userId,
        creator_id: creatorId,
        status: 'active',
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
      }, {
        onConflict: 'subscriber_id,creator_id',
      })
    
    if (error) {
      console.error('[test] subscribe30d error:', error)
      return false
    }
    
    return true
  } catch (err) {
    console.error('[test] subscribe30d exception:', err)
    return false
  }
}

// 辅助函数：cancelSubscription
async function cancelSubscription(supabase, userId, creatorId) {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('subscriber_id', userId)
      .eq('creator_id', creatorId)
    
    if (error) {
      console.error('[test] cancelSubscription error:', error)
      return false
    }
    
    return true
  } catch (err) {
    console.error('[test] cancelSubscription exception:', err)
    return false
  }
}

// 辅助函数：unlockPost
async function unlockPost(supabase, userId, postId) {
  try {
    // 验证当前 session 的 user_id 是否匹配
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || session.user.id !== userId) {
      console.error('[test] unlockPost: session mismatch', {
        expected: userId,
        actual: session?.user?.id,
      })
      return false
    }
    
    const { error } = await supabase
      .from('post_unlocks')
      .insert({
        user_id: userId,
        post_id: postId,
      })
    
    if (error) {
      // unique 冲突视为成功
      if (error.code === '23505') {
        return true
      }
      console.error('[test] unlockPost error:', error)
      return false
    }
    
    return true
  } catch (err) {
    console.error('[test] unlockPost exception:', err)
    return false
  }
}

// 清理测试数据
async function cleanup(supabase, fanUserId, creatorId, postId, serviceSupabase) {
  log('\n🧹 清理测试数据', 'blue')
  
  try {
    // 使用 service role 清理（如果有）
    const cleanupSupabase = serviceSupabase || supabase
    
    // 删除 post_unlocks
    await cleanupSupabase
      .from('post_unlocks')
      .delete()
      .eq('user_id', fanUserId)
    
    // 删除 subscriptions
    await cleanupSupabase
      .from('subscriptions')
      .delete()
      .eq('subscriber_id', fanUserId)
    
    // 删除 posts
    await cleanupSupabase
      .from('posts')
      .delete()
      .eq('id', postId)
    
    // 删除 profiles
    await cleanupSupabase
      .from('profiles')
      .delete()
      .eq('id', fanUserId)
    
    await cleanupSupabase
      .from('profiles')
      .delete()
      .eq('id', creatorId)
    
    info('测试数据已清理（auth.users 需要手动删除）')
  } catch (err) {
    warning(`清理测试数据时出错: ${err.message}`)
    warning('请手动删除 auth.users 中的测试用户')
  }
}

// 主函数
async function main() {
  log('\n🚀 Phase 2 Paywall 自动化测试开始', 'blue')
  log('=' .repeat(60), 'blue')
  
  const { anon: supabase, service: serviceSupabase } = initSupabase()
  
  let fanUser = null
  let creatorData = null
  
  try {
    // 测试 1: 注册和登录（fan 用户）
    fanUser = await testRegisterAndLogin(supabase)
    if (!fanUser) {
      error('测试终止：无法创建测试用户')
      process.exit(1)
    }
    
    // 确保 fan 用户的 session 仍然有效
    const { data: { session: fanSession } } = await supabase.auth.getSession()
    if (!fanSession || fanSession.user.id !== fanUser.userId) {
      error('测试终止：fan 用户 session 无效')
      process.exit(1)
    }
    
    // 测试 2: 创建 Creator 和 Post（使用新的 supabase 客户端，不影响 fan session）
    creatorData = await testCreateCreatorAndPost(supabase, fanUser.userId)
    if (!creatorData) {
      error('测试终止：无法创建 Creator 和 Post')
      process.exit(1)
    }
    
    // 重新验证 fan 用户的 session（确保没有被 creator 的登录覆盖）
    const { data: { session: fanSessionAfter } } = await supabase.auth.getSession()
    if (!fanSessionAfter || fanSessionAfter.user.id !== fanUser.userId) {
      warning(`fan 用户 session 可能被覆盖，重新登录... (期望: ${fanUser.userId}, 实际: ${fanSessionAfter?.user?.id})`)
      await supabase.auth.signOut()
      await new Promise(resolve => setTimeout(resolve, 500))
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: fanUser.email,
        password: fanUser.password,
      })
      if (signInError || !signInData?.session) {
        error(`测试终止：无法重新登录 fan 用户: ${signInError?.message}`)
        process.exit(1)
      }
      info(`fan 用户重新登录成功: ${signInData.session.user.id}`)
    } else {
      info(`fan 用户 session 正常: ${fanSessionAfter.user.id}`)
    }
    
    // 测试 3: 验证初始状态
    await testInitialState(supabase, fanUser.userId, creatorData.creatorId, creatorData.postId)
    
    // 测试 4: subscribe30d 后 locked 可见
    await testSubscribe30d(supabase, fanUser.userId, creatorData.creatorId, creatorData.postId)
    
    // 测试 5: cancel 后再次不可见
    await testCancelSubscription(supabase, fanUser.userId, creatorData.creatorId, creatorData.postId)
    
    // 测试 6: unlockPost 后（即使未订阅）该 post 可见
    await testUnlockPost(supabase, fanUser.userId, creatorData.postId, creatorData.creatorId)
    
  } catch (err) {
    error(`测试过程中发生错误: ${err.message}`)
    console.error(err)
  } finally {
    // 清理测试数据
    if (fanUser && creatorData) {
      await cleanup(supabase, fanUser.userId, creatorData.creatorId, creatorData.postId, serviceSupabase)
    }
  }
  
  // 输出测试结果
  log('\n' + '='.repeat(60), 'blue')
  log('📊 测试结果汇总', 'blue')
  log(`总计: ${testResults.total}`, 'cyan')
  log(`通过: ${testResults.passed}`, 'green')
  log(`失败: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green')
  
  if (testResults.failed === 0) {
    log('\n✅ 通过：全部测试通过', 'green')
    process.exit(0)
  } else {
    log('\n❌ 失败：部分测试未通过', 'red')
    process.exit(1)
  }
}

// 运行测试
main().catch(err => {
  error(`测试脚本执行失败: ${err.message}`)
  console.error(err)
  process.exit(1)
})
