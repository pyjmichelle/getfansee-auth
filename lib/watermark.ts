/**
 * 图片水印功能（最终实现）
 * Phase 2: 可选水印，左上角，仅图片
 * 
 * 水印规则：
 * - 仅图片（不处理视频）
 * - 可选（Creator 可开关）
 * - 位置：左上角
 * - 透明度：约 35%
 * - 大小：约 3-5% 图片宽度
 */

/**
 * 为图片添加水印（左上角）
 * @param imageUrl 原始图片 URL
 * @param watermarkText 水印文本（Creator display_name 或 email prefix）
 * @returns 带水印的图片 Blob URL
 */
export async function addWatermarkToImage(
  imageUrl: string,
  watermarkText: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('无法创建 Canvas context'))
          return
        }
        
        // 绘制原始图片
        ctx.drawImage(img, 0, 0)
        
        // 设置水印样式（左上角）
        const fontSize = Math.max(img.width * 0.03, 16) // 3-5% 图片宽度，最小 16px
        ctx.font = `${fontSize}px Arial`
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)' // 35% 透明度
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        
        // 在左上角添加水印（留出一些边距）
        const padding = fontSize * 0.5
        ctx.fillText(watermarkText, padding, padding)
        
        // 转换为 Blob URL
        canvas.toBlob((blob) => {
          if (blob) {
            const blobUrl = URL.createObjectURL(blob)
            resolve(blobUrl)
          } else {
            reject(new Error('无法生成水印图片'))
          }
        }, 'image/jpeg', 0.9)
      } catch (err) {
        reject(err)
      }
    }
    
    img.onerror = () => {
      reject(new Error('图片加载失败'))
    }
    
    img.src = imageUrl
  })
}

/**
 * 检查是否需要添加水印
 * @param watermarkEnabled post 的 watermark_enabled 设置
 * @param mediaType 媒体类型
 * @param isCreator 是否为 creator 本人
 * @returns 是否需要添加水印
 */
export function shouldAddWatermark(
  watermarkEnabled: boolean,
  mediaType: 'image' | 'video',
  isCreator: boolean
): boolean {
  // Creator 本人查看时不添加水印
  if (isCreator) {
    return false
  }
  
  // 仅图片需要水印
  if (mediaType !== 'image') {
    return false
  }
  
  // 必须开启 watermark_enabled
  return watermarkEnabled
}
