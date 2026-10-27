#!/usr/bin/env node

/**
 * Phase 1.5: Visibility 功能自动化测试脚本
 * 测试 free/subscribers/ppv 三种 visibility 的显示逻辑
 * 
 * 使用方法：
 *   pnpm test:visibility
 * 
 * 前置条件：
 *   1. 已配置 .env.local 文件
 *   2. 已执行 migrations/010_visibility_pricing.sql
 */

const { createClient: createUnsafeClient } = require('@supabase/supabase-js')
const { assertDedicatedTestProject, requireTestPassword } = require('./utils/assert-test-environment.cjs')
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
  } catch (_err) {
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

// 辅助函数：注册和登录
async function registerAndLogin(supabase, email, password) {
  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (signUpError || !signUpData?.user) {
      return null
    }
    
    if (!signUpData.session) {
      await supabase.auth.signOut()
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (signInError || !signInData?.session) {
        return null
      }
      
      return { userId: signInData.user.id, email, password }
    }
    
    return { userId: signUpData.user.id, email, password }
  } catch (_err) {
        return null
      }
    }
    
// 辅助函数：确保 profile
async function ensureProfile(supabase, userId, email, role = 'fan') {
  try {
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email,
        display_name: email.split('@')[0],
        role,
        age_verified: false,
      }, { onConflict: 'id' })
    
    if (upsertError) {
      console.error('[test] ensureProfile error:', {
        code: upsertError.code,
        message: upsertError.message,
        details: upsertError.details,
        hint: upsertError.hint,
        userId,
        email,
        role,
      })
      return false
    }
    
    // Note: For creator role, we explicitly insert into creators table
    // in the test flow, not here in ensureProfile
    // This avoids RLS issues with triggers
    
    return true
  } catch (err) {
    console.error('[test] ensureProfile exception:', err)
    return false
  }
}

// 辅助函数：创建 post
async function createPost(supabase, creatorId, content, visibility, priceCents = null) {
  try {
    // For new schema: price_cents=0 means subscriber-only, >0 means PPV
    // Map visibility to price_cents
    let finalPriceCents = 0
    if (visibility === 'ppv' && priceCents) {
      finalPriceCents = priceCents
    } else if (visibility === 'subscribers') {
      finalPriceCents = 0 // subscriber-only
    } else {
      finalPriceCents = 0 // free (but we'll keep visibility for backward compatibility)
    }
    
    const { data, error } = await supabase
      .from('posts')
      .insert({
        creator_id: creatorId,
        content,
        visibility, // Keep for backward compatibility
        price_cents: finalPriceCents,
        is_locked: visibility !== 'free',
      })
      .select('id')
      .single()
    
    if (error) {
      console.error('[test] createPost error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        creatorId,
        visibility,
        priceCents: finalPriceCents,
      })
      return null
    }
    
    return data.id
  } catch (err) {
    console.error('[test] createPost exception:', err)
    return null
  }
}

// 辅助函数：检查 post 是否可见
async function canViewPost(supabase, userId, postId, creatorId) {
  try {
    // Creator 本人永远可见
    if (creatorId === userId) {
      return true
    }
    
    // 查询 post
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, visibility, creator_id, price_cents')
      .eq('id', postId)
      .single()
    
    if (postError || !post) {
      return false
    }
    
    // Free 所有人可见
    if (post.visibility === 'free') {
      return true
    }
    
    // Subscribers-only: 检查订阅
    if (post.visibility === 'subscribers') {
      const { data: sub, error: _subError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('subscriber_id', userId)
        .eq('creator_id', post.creator_id)
        .eq('status', 'active')
        .gt('current_period_end', new Date().toISOString())
        .maybeSingle()
      
      return !!sub
    }
    
    // PPV: 检查解锁（使用 purchases 表）
    if (post.visibility === 'ppv') {
      const { data: purchase, error: _purchaseError } = await supabase
        .from('purchases')
        .select('id')
        .eq('fan_id', userId)
        .eq('post_id', postId)
        .maybeSingle()
      
      return !!purchase
    }
    
    return false
  } catch (err) {
    console.error('[test] canViewPost exception:', err)
    return false
  }
}

// 辅助函数：订阅
async function subscribe(supabase, userId, creatorId) {
  try {
    const now = new Date()
    const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        subscriber_id: userId,
        creator_id: creatorId,
        plan: 'monthly',
        status: 'active',
        current_period_end: endsAt.toISOString(),
      }, {
        onConflict: 'subscriber_id,creator_id',
      })
    
    if (error) {
      console.error('[test] subscribe error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId,
        creatorId,
      })
      return false
    }
    
    return true
  } catch (err) {
    console.error('[test] subscribe exception:', err)
    return false
  }
}

// 辅助函数：解锁 PPV（使用 purchases 表）
async function unlockPPV(supabase, userId, postId) {
  try {
    // Get post price_cents
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('price_cents')
      .eq('id', postId)
      .single()
    
    if (postError || !post) {
      console.error('[test] unlockPPV: post not found', postError)
      return false
    }
    
    const { error } = await supabase
      .from('purchases')
      .insert({
        fan_id: userId,
        post_id: postId,
        paid_amount_cents: post.price_cents || 0,
      })
    
    if (error) {
      if (error.code === '23505') {
        // Already purchased, treat as success
        return true
      }
      console.error('[test] unlockPPV error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId,
        postId,
      })
      return false
    }
    
    return true
  } catch (err) {
    console.error('[test] unlockPPV exception:', err)
    return false
  }
}

// 主函数
async function main() {
  log('\n🚀 Phase 1.5 Visibility 自动化测试开始', 'blue')
  log('='.repeat(60), 'blue')
  
  const { anon: fanSupabase, service: serviceSupabase } = initSupabase()
  
  // 创建独立的 creator supabase 客户端
  const env = loadEnv()
  const creatorSupabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  
  const timestamp = Date.now()
  const fanEmail = `test-visibility-fan-${timestamp}@example.com`
  const fanPassword = requireTestPassword()
  const creatorEmail = `test-visibility-creator-${timestamp}@example.com`
  const creatorPassword = requireTestPassword()
  
  let fanUser = null
  let creatorUser = null
  let postIds = { free: null, subscribers: null, ppv: null }
  
  try {
    // 测试 1: 创建 Creator 和 Fan
    log('\n👥 测试 1: 创建 Creator 和 Fan', 'blue')
    
    creatorUser = await registerAndLogin(creatorSupabase, creatorEmail, creatorPassword)
    if (!creatorUser) {
      recordTest('创建 Creator 用户', false, '注册失败')
      process.exit(1)
    }
    recordTest('创建 Creator 用户', true, `creatorId: ${creatorUser.userId.substring(0, 8)}...`)
    
    // First create profile as 'fan' to avoid trigger issues
    const creatorProfileOk = await ensureProfile(creatorSupabase, creatorUser.userId, creatorEmail, 'fan')
    if (!creatorProfileOk) {
      recordTest('创建 Creator profile (初始)', false, 'profile 创建失败 - 检查 RLS 策略和 id 字段')
      process.exit(1)
    }
    recordTest('创建 Creator profile (初始)', true, 'role=fan')
    
    // Explicitly create creator record BEFORE updating role (don't rely on trigger)
    const { error: creatorInsertError } = await creatorSupabase
      .from('creators')
      .insert({
        id: creatorUser.userId,
        display_name: creatorEmail.split('@')[0],
        avatar_url: null,
        bio: 'Test creator for visibility tests',
      })
    
    if (creatorInsertError) {
      console.error('[test] createCreator error:', {
        code: creatorInsertError.code,
        message: creatorInsertError.message,
        details: creatorInsertError.details,
        hint: creatorInsertError.hint,
        userId: creatorUser.userId,
      })
      recordTest('创建 Creator 记录', false, `插入失败: ${creatorInsertError.message} (code: ${creatorInsertError.code})`)
      process.exit(1)
    }
    recordTest('创建 Creator 记录', true, `creatorId: ${creatorUser.userId.substring(0, 8)}...`)
    
    // Now update profile role to 'creator' (trigger will try to sync, but record already exists)
    const { error: updateRoleError } = await creatorSupabase
      .from('profiles')
      .update({ role: 'creator' })
      .eq('id', creatorUser.userId)
    
    if (updateRoleError) {
      console.error('[test] updateRole error:', {
        code: updateRoleError.code,
        message: updateRoleError.message,
        details: updateRoleError.details,
        hint: updateRoleError.hint,
        userId: creatorUser.userId,
      })
      recordTest('更新 Creator role', false, `更新失败: ${updateRoleError.message} (code: ${updateRoleError.code})`)
      process.exit(1)
    }
    recordTest('更新 Creator role', true, 'role=creator')
    
    fanUser = await registerAndLogin(fanSupabase, fanEmail, fanPassword)
    if (!fanUser) {
      recordTest('创建 Fan 用户', false, '注册失败')
      process.exit(1)
    }
    recordTest('创建 Fan 用户', true, `fanId: ${fanUser.userId.substring(0, 8)}...`)
    
    const fanProfileOk = await ensureProfile(fanSupabase, fanUser.userId, fanEmail, 'fan')
    if (!fanProfileOk) {
      recordTest('创建 Fan profile', false, 'profile 创建失败')
      process.exit(1)
    }
    recordTest('创建 Fan profile', true, 'role=fan')
    
    // 测试 2: Creator 创建 3 条 post
    log('\n📝 测试 2: Creator 创建 3 条 post', 'blue')
    
    postIds.free = await createPost(creatorSupabase, creatorUser.userId, `Free post ${timestamp}`, 'free')
    if (!postIds.free) {
      recordTest('创建 free post', false, '创建失败')
      process.exit(1)
    }
    recordTest('创建 free post', true, `postId: ${postIds.free.substring(0, 8)}...`)
    
    postIds.subscribers = await createPost(creatorSupabase, creatorUser.userId, `Subscribers post ${timestamp}`, 'subscribers')
    if (!postIds.subscribers) {
      recordTest('创建 subscribers post', false, '创建失败')
      process.exit(1)
    }
    recordTest('创建 subscribers post', true, `postId: ${postIds.subscribers.substring(0, 8)}...`)
    
    // For new schema: use price_cents instead of visibility='ppv'
    // But keep visibility for backward compatibility
    postIds.ppv = await createPost(creatorSupabase, creatorUser.userId, `PPV post ${timestamp}`, 'ppv', 500) // $5.00 (500 cents)
    if (!postIds.ppv) {
      recordTest('创建 ppv post', false, '创建失败')
      process.exit(1)
    }
    recordTest('创建 ppv post', true, `postId: ${postIds.ppv.substring(0, 8)}... (price: $5.00)`)
    
    // 测试 3: Fan 初始状态断言
    log('\n🔍 测试 3: Fan 初始状态断言', 'blue')
    
    const canViewFree = await canViewPost(fanSupabase, fanUser.userId, postIds.free, creatorUser.userId)
    if (canViewFree !== true) {
      recordTest('初始状态: free 可读', false, `期望 true，实际 ${canViewFree}`)
    } else {
      recordTest('初始状态: free 可读', true, 'free post 可见')
    }
    
    const canViewSubscribers = await canViewPost(fanSupabase, fanUser.userId, postIds.subscribers, creatorUser.userId)
    if (canViewSubscribers !== false) {
      recordTest('初始状态: subscribers 不可读', false, `期望 false，实际 ${canViewSubscribers}`)
    } else {
      recordTest('初始状态: subscribers 不可读', true, 'subscribers post 不可见')
    }
    
    const canViewPPV = await canViewPost(fanSupabase, fanUser.userId, postIds.ppv, creatorUser.userId)
    if (canViewPPV !== false) {
      recordTest('初始状态: ppv 不可读', false, `期望 false，实际 ${canViewPPV}`)
    } else {
      recordTest('初始状态: ppv 不可读', true, 'ppv post 不可见')
    }
    
    // 测试 4: Fan 订阅 creator 后断言
    log('\n💳 测试 4: Fan 订阅 creator 后断言', 'blue')
    
    const subscribeOk = await subscribe(fanSupabase, fanUser.userId, creatorUser.userId)
    if (!subscribeOk) {
      recordTest('订阅 creator', false, '订阅失败 - 检查 subscriptions 表 RLS 策略')
      process.exit(1)
    }
    recordTest('订阅 creator', true, '订阅成功')
    
    await new Promise(resolve => setTimeout(resolve, 500)) // 等待 DB 更新
    
    const canViewSubscribersAfter = await canViewPost(fanSupabase, fanUser.userId, postIds.subscribers, creatorUser.userId)
    if (canViewSubscribersAfter !== true) {
      recordTest('订阅后: subscribers 可读', false, `期望 true，实际 ${canViewSubscribersAfter}`)
    } else {
      recordTest('订阅后: subscribers 可读', true, 'subscribers post 可见')
    }
    
    const canViewPPVAfter = await canViewPost(fanSupabase, fanUser.userId, postIds.ppv, creatorUser.userId)
    if (canViewPPVAfter !== false) {
      recordTest('订阅后: ppv 仍不可读', false, `期望 false，实际 ${canViewPPVAfter}（订阅不覆盖 PPV）`)
    } else {
      recordTest('订阅后: ppv 仍不可读', true, 'ppv post 仍不可见（订阅不覆盖 PPV）')
    }
    
    // 测试 5: Fan 解锁 ppv 后断言
    log('\n🔓 测试 5: Fan 解锁 ppv 后断言', 'blue')
    
    const unlockOk = await unlockPPV(fanSupabase, fanUser.userId, postIds.ppv)
    if (!unlockOk) {
      recordTest('解锁 ppv', false, '解锁失败')
      process.exit(1)
    }
    recordTest('解锁 ppv', true, '解锁成功')
    
    await new Promise(resolve => setTimeout(resolve, 500)) // 等待 DB 更新
    
    const canViewPPVAfterUnlock = await canViewPost(fanSupabase, fanUser.userId, postIds.ppv, creatorUser.userId)
    if (canViewPPVAfterUnlock !== true) {
      recordTest('解锁后: ppv 可读', false, `期望 true，实际 ${canViewPPVAfterUnlock}`)
    } else {
      recordTest('解锁后: ppv 可读', true, 'ppv post 可见')
    }
    
  } catch (err) {
    error(`测试过程中发生错误: ${err.message}`)
    console.error(err)
  } finally {
    // 清理测试数据
    log('\n🧹 清理测试数据', 'blue')
    
    const cleanupSupabase = serviceSupabase || fanSupabase
    
    try {
      // 删除 purchases (PPV unlocks)
      if (postIds.ppv) {
        await cleanupSupabase
          .from('purchases')
          .delete()
          .eq('post_id', postIds.ppv)
      }
      
      // 删除 subscriptions
      if (fanUser && creatorUser) {
        await cleanupSupabase
          .from('subscriptions')
          .delete()
          .eq('subscriber_id', fanUser.userId)
          .eq('creator_id', creatorUser.userId)
      }
      
      // 删除 posts
      if (postIds.free) {
        await cleanupSupabase.from('posts').delete().eq('id', postIds.free)
      }
      if (postIds.subscribers) {
        await cleanupSupabase.from('posts').delete().eq('id', postIds.subscribers)
      }
      if (postIds.ppv) {
        await cleanupSupabase.from('posts').delete().eq('id', postIds.ppv)
      }
      
      // 删除 profiles
      if (fanUser) {
        await cleanupSupabase.from('profiles').delete().eq('id', fanUser.userId)
      }
      if (creatorUser) {
        await cleanupSupabase.from('profiles').delete().eq('id', creatorUser.userId)
      }
      
      info('测试数据已清理（auth.users 需要手动删除）')
    } catch (err) {
      warning(`清理测试数据时出错: ${err.message}`)
      warning('请手动删除 auth.users 中的测试用户')
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
