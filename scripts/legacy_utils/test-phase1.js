#!/usr/bin/env node

/**
 * Phase 1 功能自动化测试脚本
 * 测试 Creator Profile + 发帖 + Feed 列表
 * 
 * 使用方法：
 *   pnpm test:phase1
 * 
 * 前置条件：
 *   1. 已配置 .env.local 文件（包含所有必需的环境变量）
 *   2. 已执行 migrations/007_phase1_posts.sql
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

// 加载环境变量
function loadEnv() {
  try {
    const envPath = join(__dirname, '.env.local')
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
function initSupabaseClients() {
  const env = loadEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !anonKey) {
    error('缺少环境变量：NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(1)
  }
  
  if (!serviceRoleKey) {
    error('缺少环境变量：SUPABASE_SERVICE_ROLE_KEY（用于清理测试数据）')
    process.exit(1)
  }
  
  const anonClient = createClient(supabaseUrl, anonKey)
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  return { anonClient, serviceClient, supabaseUrl }
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

// 测试 1: 环境变量检查
function testEnvVars() {
  log('\n🔍 测试 1: 环境变量检查', 'blue')
  
  const env = loadEnv()
  const hasUrl = !!env.NEXT_PUBLIC_SUPABASE_URL
  const hasAnonKey = !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasServiceKey = !!env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!hasUrl) {
    recordTest('NEXT_PUBLIC_SUPABASE_URL', false, '缺失')
    return false
  }
  recordTest('NEXT_PUBLIC_SUPABASE_URL', true, '已配置')
  
  if (!hasAnonKey) {
    recordTest('NEXT_PUBLIC_SUPABASE_ANON_KEY', false, '缺失')
    return false
  }
  recordTest('NEXT_PUBLIC_SUPABASE_ANON_KEY', true, '已配置')
  
  if (!hasServiceKey) {
    recordTest('SUPABASE_SERVICE_ROLE_KEY', false, '缺失')
    return false
  }
  recordTest('SUPABASE_SERVICE_ROLE_KEY', true, '已配置')
  
  return true
}

// 测试 2: Schema 校验
async function testSchema(serviceClient) {
  log('\n📋 测试 2: Schema 校验', 'blue')
  
  try {
    // 检查 profiles 表字段
    const { data: profilesData, error: profilesError } = await serviceClient
      .from('profiles')
      .select('id, email, display_name, role, age_verified, bio, avatar_url, created_at, updated_at')
      .limit(0)
    
    if (profilesError) {
      if (profilesError.message.includes('column') && profilesError.message.includes('does not exist')) {
        const missingField = profilesError.message.match(/column "(\w+)" does not exist/)?.[1] || '未知字段'
        recordTest('profiles 表字段', false, `缺少字段: ${missingField}`)
        return false
      }
      recordTest('profiles 表字段', false, profilesError.message)
      return false
    }
    
    recordTest('profiles 表字段（bio, avatar_url）', true, '所有必需字段都存在')
    
    // 检查 posts 表
    const { data: postsData, error: postsError } = await serviceClient
      .from('posts')
      .select('id, creator_id, title, content, media_url, is_locked, created_at')
      .limit(0)
    
    if (postsError) {
      if (postsError.message.includes('relation') && postsError.message.includes('does not exist')) {
        recordTest('posts 表存在', false, 'posts 表不存在，请执行 migrations/007_phase1_posts.sql')
        return false
      }
      if (postsError.message.includes('column') && postsError.message.includes('does not exist')) {
        const missingField = postsError.message.match(/column "(\w+)" does not exist/)?.[1] || '未知字段'
        recordTest('posts 表字段', false, `缺少字段: ${missingField}`)
        return false
      }
      recordTest('posts 表字段', false, postsError.message)
      return false
    }
    
    recordTest('posts 表存在且字段齐全', true, '所有必需字段都存在')
    return true
  } catch (err) {
    recordTest('Schema 校验', false, err.message)
    return false
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
  } catch (err) {
    return false
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
  } catch (err) {
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
  } catch (err) {
    return false
  }
}

// createPost 实现
async function createPost(supabase, userId, params) {
  try {
    // 先检查用户是否为 creator
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (profileError || !profile || profile.role !== 'creator') {
      return null
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        creator_id: userId,
        title: params.title || null,
        content: params.content,
        media_url: params.media_url || null,
        is_locked: params.is_locked || false,
      })
      .select('id')
      .single()

    if (error) {
      return null
    }

    return data.id
  } catch (err) {
    return null
  }
}

// listFeed 实现
async function listFeed(supabase, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        creator_id,
        title,
        content,
        media_url,
        is_locked,
        created_at,
        profiles:creator_id (
          display_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return []
    }

    return (data || []).map((item) => ({
      id: item.id,
      creator_id: item.creator_id,
      title: item.title,
      content: item.content,
      media_url: item.media_url,
      is_locked: item.is_locked,
      created_at: item.created_at,
      creator: {
        display_name: item.profiles?.display_name,
        avatar_url: item.profiles?.avatar_url,
      },
    }))
  } catch (err) {
    return []
  }
}

// listCreatorPosts 实现
async function listCreatorPosts(supabase, creatorId) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })

    if (error) {
      return []
    }

    return data || []
  } catch (err) {
    return []
  }
}

// 测试 3: 注册新用户并登录
async function testRegisterAndLogin(anonClient) {
  log('\n📝 测试 3: 注册新用户并登录', 'blue')
  
  const testEmail = `phase1-test-${Date.now()}@example.com`
  const testPassword = requireTestPassword()
  
  try {
    const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
      email: testEmail,
      password: testPassword,
    })
    
    if (signUpError || !signUpData?.user) {
      recordTest('注册新用户', false, signUpError?.message || '注册失败')
      return null
    }
    
    recordTest('注册新用户', true, `userId: ${signUpData.user.id.substring(0, 8)}...`)
    
    if (!signUpData.session) {
      await anonClient.auth.signOut()
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
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

// 测试 4: ensureProfile
async function testEnsureProfile(anonClient, userId, userEmail) {
  log('\n👤 测试 4: ensureProfile', 'blue')
  
  try {
    const success = await ensureProfile(anonClient, userId, userEmail)
    if (!success) {
      recordTest('ensureProfile', false, '创建 profile 失败')
      return false
    }
    
    recordTest('ensureProfile', true, 'Profile 已创建')
    return true
  } catch (err) {
    recordTest('ensureProfile', false, err.message)
    return false
  }
}

// 测试 5: setRoleCreator
async function testSetRoleCreator(anonClient, userId) {
  log('\n🎭 测试 5: setRoleCreator', 'blue')
  
  try {
    const success = await setRoleCreator(anonClient, userId)
    if (!success) {
      recordTest('setRoleCreator', false, '更新 role 失败')
      return false
    }
    
    recordTest('setRoleCreator', true, 'Role 已更新为 creator')
    return true
  } catch (err) {
    recordTest('setRoleCreator', false, err.message)
    return false
  }
}

// 测试 6: updateCreatorProfile
async function testUpdateCreatorProfile(anonClient, userId) {
  log('\n✏️  测试 6: updateCreatorProfile', 'blue')
  
  const testDisplayName = `Test Creator ${Date.now()}`
  const testBio = 'This is a test bio for Phase 1'
  
  try {
    const success = await updateCreatorProfile(anonClient, {
      userId,
      display_name: testDisplayName,
      bio: testBio,
    })
    
    if (!success) {
      recordTest('updateCreatorProfile', false, '更新 profile 失败')
      return false
    }
    
    recordTest('updateCreatorProfile', true, `display_name: ${testDisplayName}, bio: ${testBio}`)
    return true
  } catch (err) {
    recordTest('updateCreatorProfile', false, err.message)
    return false
  }
}

// 测试 7: createPost
async function testCreatePost(anonClient, userId) {
  log('\n📝 测试 7: createPost', 'blue')
  
  const testContent = `Test post content ${Date.now()}`
  const testMediaUrl = 'https://example.com/test-image.jpg'
  
  try {
    const postId = await createPost(anonClient, userId, {
      title: 'Test Post',
      content: testContent,
      media_url: testMediaUrl,
      is_locked: false,
    })
    
    if (!postId) {
      recordTest('createPost', false, '创建 post 失败')
      return null
    }
    
    recordTest('createPost', true, `postId: ${postId.substring(0, 8)}...`)
    return postId
  } catch (err) {
    recordTest('createPost', false, err.message)
    return null
  }
}

// 测试 8: listFeed
async function testListFeed(anonClient, userId, postId) {
  log('\n📰 测试 8: listFeed', 'blue')
  
  try {
    await new Promise(resolve => setTimeout(resolve, 500)) // 等待 DB 更新
    
    const feed = await listFeed(anonClient, 20)
    
    if (feed.length === 0) {
      recordTest('listFeed 返回数据', false, 'Feed 为空')
      return false
    }
    
    recordTest('listFeed 返回数据', true, `返回 ${feed.length} 条 posts`)
    
    // 检查是否包含我们创建的 post
    const ourPost = feed.find(p => p.id === postId)
    if (!ourPost) {
      recordTest('listFeed 包含创建的 post', false, 'Feed 中找不到创建的 post')
      return false
    }
    
    recordTest('listFeed 包含创建的 post', true, '找到创建的 post')
    
    // 检查是否包含 creator 信息
    if (!ourPost.creator || !ourPost.creator.display_name) {
      recordTest('listFeed 包含 creator 信息', false, '缺少 creator.display_name')
      return false
    }
    
    recordTest('listFeed 包含 creator 信息', true, `creator.display_name: ${ourPost.creator.display_name}`)
    return true
  } catch (err) {
    recordTest('listFeed', false, err.message)
    return false
  }
}

// 测试 9: listCreatorPosts
async function testListCreatorPosts(anonClient, userId, postId) {
  log('\n📋 测试 9: listCreatorPosts', 'blue')
  
  try {
    const posts = await listCreatorPosts(anonClient, userId)
    
    if (posts.length === 0) {
      recordTest('listCreatorPosts 返回数据', false, 'Posts 为空')
      return false
    }
    
    recordTest('listCreatorPosts 返回数据', true, `返回 ${posts.length} 条 posts`)
    
    // 检查是否包含我们创建的 post
    const ourPost = posts.find(p => p.id === postId)
    if (!ourPost) {
      recordTest('listCreatorPosts 包含创建的 post', false, 'Posts 中找不到创建的 post')
      return false
    }
    
    recordTest('listCreatorPosts 包含创建的 post', true, '找到创建的 post')
    return true
  } catch (err) {
    recordTest('listCreatorPosts', false, err.message)
    return false
  }
}

// 测试 10: 清理测试数据
async function testCleanup(serviceClient, userId, postId) {
  log('\n🧹 测试 10: 清理测试数据', 'blue')
  
  try {
    // 删除 posts（使用 service role）
    if (postId) {
      const { error: deletePostError } = await serviceClient
        .from('posts')
        .delete()
        .eq('id', postId)
      
      if (deletePostError) {
        warning(`清理 post 失败: ${deletePostError.message}`)
        recordTest('清理 post', false, deletePostError.message)
      } else {
        recordTest('清理 post', true, '已删除')
      }
    }
    
    // 删除 profile（使用 service role）
    const { error: deleteProfileError } = await serviceClient
      .from('profiles')
      .delete()
      .eq('id', userId)
    
    if (deleteProfileError) {
      warning(`清理 profile 失败: ${deleteProfileError.message}`)
      recordTest('清理 profile', false, deleteProfileError.message)
    } else {
      recordTest('清理 profile', true, '已删除')
    }
    
    info('测试数据已清理（auth.users 需要手动删除）')
    return true
  } catch (err) {
    recordTest('清理测试数据', false, err.message)
    return false
  }
}

// 主测试函数
async function runTests() {
  log('\n🚀 开始 Phase 1 功能自动化测试\n', 'blue')
  
  const { anonClient, serviceClient, supabaseUrl } = initSupabaseClients()
  info(`Supabase URL: ${supabaseUrl?.substring(0, 30)}...`)
  
  // 测试 1: 环境变量检查
  if (!testEnvVars()) {
    error('\n❌ 环境变量检查失败，测试终止')
    process.exit(1)
  }
  
  // 测试 2: Schema 校验
  const schemaOk = await testSchema(serviceClient)
  if (!schemaOk) {
    error('\n❌ Schema 校验失败，请先执行 migrations/007_phase1_posts.sql')
    process.exit(1)
  }
  
  // 测试 3: 注册和登录
  const userInfo = await testRegisterAndLogin(anonClient)
  if (!userInfo) {
    error('\n❌ 无法创建测试用户，测试终止')
    process.exit(1)
  }
  
  // 测试 4: ensureProfile
  await testEnsureProfile(anonClient, userInfo.userId, userInfo.email)
  
  // 测试 5: setRoleCreator
  await testSetRoleCreator(anonClient, userInfo.userId)
  
  // 测试 6: updateCreatorProfile
  await testUpdateCreatorProfile(anonClient, userInfo.userId)
  
  // 测试 7: createPost
  const postId = await testCreatePost(anonClient, userInfo.userId)
  if (!postId) {
    error('\n❌ 无法创建 post，测试终止')
    process.exit(1)
  }
  
  // 测试 8: listFeed
  await testListFeed(anonClient, userInfo.userId, postId)
  
  // 测试 9: listCreatorPosts
  await testListCreatorPosts(anonClient, userInfo.userId, postId)
  
  // 测试 10: 清理
  await testCleanup(serviceClient, userInfo.userId, postId)
  
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
    log('\n✅ Phase 1 功能验证完成', 'green')
    process.exit(0)
  } else {
    error(`\n❌ 有 ${testResults.failed} 个测试失败`)
    log('\n请检查上述错误信息并修复后重新运行测试', 'yellow')
    process.exit(1)
  }
}

// 运行测试
runTests().catch(err => {
  error(`\n💥 测试执行出错: ${err.message}`)
  console.error(err)
  process.exit(1)
})

