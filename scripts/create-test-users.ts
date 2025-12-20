#!/usr/bin/env tsx

/**
 * 创建测试用户脚本
 * 用于为外部测试人员创建预配置的测试账号
 * 
 * 使用方法：
 *   pnpm tsx scripts/create-test-users.ts
 * 
 * 前置条件：
 *   - 需要 SUPABASE_SERVICE_ROLE_KEY（用于绕过 RLS 创建用户）
 *   - 需要 NEXT_PUBLIC_SUPABASE_URL
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// 加载环境变量
function loadEnv() {
  const env: Record<string, string> = {}
  
  // 优先从 process.env 读取（用于 CI/CD）
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  }
  
  // 如果 process.env 中没有，尝试从 .env.local 读取
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
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
            if (!env[keyTrimmed]) {
              env[keyTrimmed] = valueTrimmed
            }
          }
        }
      })
    } catch (err) {
      // .env.local 不存在或读取失败
    }
  }
  
  return env
}

const testUsers = [
  {
    email: 'test-fan@getfansee.test',
    password: 'TestFan123!',
    role: 'fan' as const,
    displayName: 'Test Fan User',
  },
  {
    email: 'test-creator@getfansee.test',
    password: 'TestCreator123!',
    role: 'creator' as const,
    displayName: 'Test Creator User',
  },
]

async function main() {
  console.log('\n🚀 开始创建测试用户...\n')
  
  const env = loadEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ 缺少环境变量：')
    if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL')
    if (!serviceKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  
  for (const user of testUsers) {
    console.log(`\n📝 创建用户: ${user.email}`)
    
    try {
      // 1. 检查用户是否已存在
      const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()
      
      if (listError) {
        console.error(`  ❌ 无法列出用户: ${listError.message}`)
        continue
      }
      
      const existingUser = existingUsers.users.find(u => u.email === user.email)
      
      if (existingUser) {
        console.log(`  ⚠️  用户已存在，跳过创建 (ID: ${existingUser.id})`)
        
        // 更新密码（如果需要）
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          { password: user.password }
        )
        
        if (updateError) {
          console.error(`  ⚠️  无法更新密码: ${updateError.message}`)
        } else {
          console.log(`  ✅ 密码已更新`)
        }
        
        // 确保 profile 存在
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: existingUser.id,
            email: user.email,
            display_name: user.displayName,
            role: user.role,
            age_verified: true,
          }, { onConflict: 'id' })
        
        if (profileError) {
          console.error(`  ⚠️  无法创建/更新 profile: ${profileError.message}`)
        } else {
          console.log(`  ✅ Profile 已创建/更新`)
        }
        
        // 如果是 creator，确保 creators 表有记录
        if (user.role === 'creator') {
          const { error: creatorError } = await supabase
            .from('creators')
            .upsert({
              id: existingUser.id,
              display_name: user.displayName,
              bio: 'Test Creator Account',
            }, { onConflict: 'id' })
          
          if (creatorError) {
            console.error(`  ⚠️  无法创建/更新 creator: ${creatorError.message}`)
          } else {
            console.log(`  ✅ Creator 记录已创建/更新`)
          }
        }
        
        continue
      }
      
      // 2. 创建新用户
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // 自动确认邮箱，跳过验证
      })
      
      if (createError || !newUser.user) {
        console.error(`  ❌ 创建用户失败: ${createError?.message || 'Unknown error'}`)
        continue
      }
      
      console.log(`  ✅ 用户创建成功 (ID: ${newUser.user.id})`)
      
      // 3. 创建 profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: newUser.user.id,
          email: user.email,
          display_name: user.displayName,
          role: user.role,
          age_verified: true,
        })
      
      if (profileError) {
        console.error(`  ⚠️  创建 profile 失败: ${profileError.message}`)
      } else {
        console.log(`  ✅ Profile 创建成功`)
      }
      
      // 4. 如果是 creator，创建 creators 记录
      if (user.role === 'creator') {
        const { error: creatorError } = await supabase
          .from('creators')
          .insert({
            id: newUser.user.id,
            display_name: user.displayName,
            bio: 'Test Creator Account',
          })
        
        if (creatorError) {
          console.error(`  ⚠️  创建 creator 失败: ${creatorError.message}`)
        } else {
          console.log(`  ✅ Creator 记录创建成功`)
        }
      }
      
    } catch (err: any) {
      console.error(`  ❌ 处理用户时出错: ${err.message}`)
      console.error(err)
    }
  }
  
  console.log('\n✅ 测试用户创建完成！\n')
  console.log('📋 测试账号信息：')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  testUsers.forEach(user => {
    console.log(`\n${user.role === 'creator' ? '👨‍🎨 Creator' : '👤 Fan'}:`)
    console.log(`  邮箱: ${user.email}`)
    console.log(`  密码: ${user.password}`)
  })
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main().catch(err => {
  console.error('脚本执行失败:', err)
  process.exit(1)
})

