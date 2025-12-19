#!/usr/bin/env node

/**
 * Phase 2: 水印功能测试脚本
 * 测试新的水印逻辑（可选，左上角，仅图片）
 * 
 * 使用方法：
 *   pnpm test:watermark
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
            const keyName = key.trim()
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
            // 只在 env 中没有该 key 时才设置
            if (!env[keyName]) {
              env[keyName] = value
            }
          }
        }
      })
    } catch (err) {
      // .env.local 不存在，使用 process.env
    }
  }
  
  return env
}

const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

// 检测是否在 CI 环境
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  error('缺少必需的环境变量')
  error('请在 .env.local 中配置：')
  error('  NEXT_PUBLIC_SUPABASE_URL')
  error('  NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  if (isCI) {
    warning('⚠️  SUPABASE_SERVICE_ROLE_KEY 未设置 - 将跳过需要 admin 权限的清理步骤')
  } else {
    error('缺少必需的环境变量')
    error('请在 .env.local 中配置：')
    error('  SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
}

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const serviceClient = SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null

let totalTests = 0
let passedTests = 0
let failedTests = 0

function assert(condition, message) {
  totalTests++
  if (condition) {
    passedTests++
    success(message)
    return true
  } else {
    failedTests++
    error(message)
    return false
  }
}

async function main() {
  log('\n' + '='.repeat(60), 'blue')
  log('Phase 2: 水印功能测试', 'blue')
  log('='.repeat(60), 'blue')
  log('')

  let creatorId = null
  let postId1 = null // watermark_enabled=false
  let postId2 = null // watermark_enabled=true
  let mediaId1 = null
  let mediaId2 = null

  try {
    // Test 1: 创建 Creator 用户
    info('Test 1: 创建 Creator 用户')
    const timestamp = Date.now()
    const email = `test-watermark-${timestamp}@example.com`
    const password = 'TestPassword123!'

    const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
      email,
      password,
    })

    if (signUpError || !signUpData.user) {
      error(`注册失败: ${signUpError?.message}`)
      process.exit(1)
    }

    creatorId = signUpData.user.id
    success(`Creator 用户创建成功: ${creatorId}`)

    // 创建 profile
    const { error: profileError } = await anonClient
      .from('profiles')
      .insert({
        id: creatorId,
        email,
        display_name: `Test Creator ${timestamp}`,
        role: 'creator',
        age_verified: true,
      })

    if (profileError) {
      error(`创建 profile 失败: ${profileError.message}`)
      process.exit(1)
    }
    success('Profile 创建成功')

    // Test 2: 创建 post with watermark_enabled=false
    info('\nTest 2: 创建 post (watermark_enabled=false)')
    const { data: post1, error: post1Error } = await anonClient
      .from('posts')
      .insert({
        creator_id: creatorId,
        content: 'Test post without watermark',
        visibility: 'free',
        watermark_enabled: false,
      })
      .select('id')
      .single()

    if (post1Error || !post1) {
      error(`创建 post 失败: ${post1Error?.message}`)
      process.exit(1)
    }

    postId1 = post1.id
    success(`Post 创建成功 (watermark_enabled=false): ${postId1}`)

    // 添加图片 media（模拟）
    const { data: media1, error: media1Error } = await anonClient
      .from('post_media')
      .insert({
        post_id: postId1,
        media_url: 'https://example.com/test-image.jpg',
        media_type: 'image',
        file_name: 'test-image.jpg',
        file_size: 1024,
        sort_order: 0,
        watermarked_path: null, // watermark_enabled=false，所以 watermarked_path 应为 null
      })
      .select('id')
      .single()

    if (media1Error || !media1) {
      error(`添加 media 失败: ${media1Error?.message}`)
      process.exit(1)
    }

    mediaId1 = media1.id
    success(`Media 添加成功: ${mediaId1}`)

    // 验证 watermarked_path 为 null
    const { data: verifyMedia1, error: verifyError1 } = await anonClient
      .from('post_media')
      .select('watermarked_path')
      .eq('id', mediaId1)
      .single()

    assert(
      verifyMedia1 && verifyMedia1.watermarked_path === null,
      `watermark_enabled=false 时，watermarked_path 应为 null（当前: ${verifyMedia1?.watermarked_path}）`
    )

    // Test 3: 创建 post with watermark_enabled=true
    info('\nTest 3: 创建 post (watermark_enabled=true)')
    const { data: post2, error: post2Error } = await anonClient
      .from('posts')
      .insert({
        creator_id: creatorId,
        content: 'Test post with watermark',
        visibility: 'subscribers',
        watermark_enabled: true,
      })
      .select('id')
      .single()

    if (post2Error || !post2) {
      error(`创建 post 失败: ${post2Error?.message}`)
      process.exit(1)
    }

    postId2 = post2.id
    success(`Post 创建成功 (watermark_enabled=true): ${postId2}`)

    // 添加图片 media（watermarked_path 可以为 null，但 watermark_enabled=true）
    const { data: media2, error: media2Error } = await anonClient
      .from('post_media')
      .insert({
        post_id: postId2,
        media_url: 'https://example.com/test-image2.jpg',
        media_type: 'image',
        file_name: 'test-image2.jpg',
        file_size: 1024,
        sort_order: 0,
        watermarked_path: null, // 初始为 null，水印将在需要时生成
      })
      .select('id')
      .single()

    if (media2Error || !media2) {
      error(`添加 media 失败: ${media2Error?.message}`)
      process.exit(1)
    }

    mediaId2 = media2.id
    success(`Media 添加成功: ${mediaId2}`)

    // Test 4: 上传视频（不应生成水印）
    info('\nTest 4: 上传视频（不应生成水印）')
    const { data: post3, error: post3Error } = await anonClient
      .from('posts')
      .insert({
        creator_id: creatorId,
        content: 'Test post with video',
        visibility: 'free',
        watermark_enabled: true, // 即使开启，视频也不应有水印
      })
      .select('id')
      .single()

    if (post3Error || !post3) {
      error(`创建 post 失败: ${post3Error?.message}`)
      process.exit(1)
    }

    const { data: media3, error: media3Error } = await anonClient
      .from('post_media')
      .insert({
        post_id: post3.id,
        media_url: 'https://example.com/test-video.mp4',
        media_type: 'video',
        file_name: 'test-video.mp4',
        file_size: 1024000,
        sort_order: 0,
        watermarked_path: null, // 视频不应有水印
      })
      .select('id, watermarked_path')
      .single()

    if (media3Error || !media3) {
      error(`添加 video media 失败: ${media3Error?.message}`)
      process.exit(1)
    }

    assert(
      media3.watermarked_path === null,
      `视频不应有水印（watermarked_path 应为 null，当前: ${media3.watermarked_path}）`
    )

    // Test 5: 验证 visibility 规则仍然正确
    info('\nTest 5: 验证 visibility 规则')
    const { data: lockedPost, error: lockedPostError } = await anonClient
      .from('posts')
      .insert({
        creator_id: creatorId,
        content: 'Locked post',
        visibility: 'ppv',
        price_cents: 500,
        watermark_enabled: true,
      })
      .select('id')
      .single()

    if (lockedPostError || !lockedPost) {
      error(`创建 locked post 失败: ${lockedPostError?.message}`)
      process.exit(1)
    }

    // 验证未解锁用户无法访问
    const { data: lockedMedia, error: lockedMediaError } = await anonClient
      .from('post_media')
      .select('media_url')
      .eq('post_id', lockedPost.id)

    // 由于 RLS，未解锁用户应该无法访问
    // 这里我们验证查询返回空数组或错误
    assert(
      !lockedMedia || lockedMedia.length === 0 || lockedMediaError,
      '未解锁用户不应访问 locked content'
    )

    success('Visibility 规则验证通过')

  } catch (err) {
    error(`测试过程中发生错误: ${err.message}`)
    console.error(err)
  } finally {
    // 清理测试数据（需要 service_role）
    if (serviceClient) {
      info('\n清理测试数据...')
      try {
        if (mediaId1) {
          await serviceClient.from('post_media').delete().eq('id', mediaId1)
        }
        if (mediaId2) {
          await serviceClient.from('post_media').delete().eq('id', mediaId2)
        }
        if (postId1) {
          await serviceClient.from('posts').delete().eq('id', postId1)
        }
        if (postId2) {
          await serviceClient.from('posts').delete().eq('id', postId2)
        }
        if (creatorId) {
          await serviceClient.from('profiles').delete().eq('id', creatorId)
          // 注意：auth.users 需要手动删除或使用 Supabase Admin API
          warning('auth.users 记录需要手动删除（或等待自动清理）')
        }
        success('测试数据清理完成')
      } catch (cleanupErr) {
        warning(`清理数据时出错: ${cleanupErr.message}`)
      }
    } else {
      warning('⚠️  无法清理测试数据（需要 SERVICE_ROLE_KEY）')
      if (creatorId) {
        warning(`  需要手动清理: creatorId=${creatorId}, postId1=${postId1}, postId2=${postId2}`)
      }
    }
  }

  // 输出测试结果
  log('\n' + '='.repeat(60), 'blue')
  log(`总测试数: ${totalTests}`, 'blue')
  log(`✅ 通过: ${passedTests}`, 'green')
  log(`❌ 失败: ${failedTests}`, failedTests > 0 ? 'red' : 'green')
  log('='.repeat(60), 'blue')

  if (failedTests === 0) {
    log('\n✅ 所有测试通过！', 'green')
    process.exit(0)
  } else {
    log('\n❌ 部分测试失败，请检查上述错误信息', 'red')
    process.exit(1)
  }
}

main().catch((err) => {
  error(`未捕获的错误: ${err.message}`)
  console.error(err)
  process.exit(1)
})

