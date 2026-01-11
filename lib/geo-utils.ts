/**
 * 地理工具函数
 * 用于获取访客国家代码
 */

/**
 * 获取访客国家代码
 * 优先使用 Vercel 的 x-vercel-ip-country 头
 * 如果没有，尝试从其他头获取
 *
 * 注意：此函数只能在服务器端使用（Server Components 或 API Routes）
 * 在客户端会返回 null
 *
 * @returns 国家代码（ISO 3166-1 alpha-2，如 'US', 'CN'）或 null
 */
export async function getVisitorCountry(): Promise<string | null> {
  // 检查是否在服务器端
  if (typeof window !== "undefined") {
    // 客户端环境，返回 null
    return null;
  }

  try {
    // 动态导入 next/headers，只在服务器端执行
    const { headers } = await import("next/headers");
    const headersList = await headers();

    // Vercel 自动添加的国家代码头
    const vercelCountry = headersList.get("x-vercel-ip-country");
    if (vercelCountry) {
      return vercelCountry.toUpperCase();
    }

    // 备用：从 CF-IPCountry 获取（Cloudflare）
    const cfCountry = headersList.get("cf-ipcountry");
    if (cfCountry) {
      return cfCountry.toUpperCase();
    }

    // 备用：从 x-country 获取（自定义头）
    const customCountry = headersList.get("x-country");
    if (customCountry) {
      return customCountry.toUpperCase();
    }

    return null;
  } catch (err) {
    // 如果无法导入 next/headers（例如在客户端），返回 null
    console.warn(
      "[geo-utils] getVisitorCountry: Cannot access headers (may be in client context):",
      err
    );
    return null;
  }
}

/**
 * 检查国家是否被屏蔽
 * @param blockedCountries 屏蔽的国家代码数组
 * @param visitorCountry 访客国家代码
 * @returns true 如果被屏蔽，false 如果未被屏蔽
 */
export function isCountryBlocked(
  blockedCountries: string[] | null | undefined,
  visitorCountry: string | null
): boolean {
  if (!blockedCountries || blockedCountries.length === 0) {
    return false; // 没有屏蔽任何国家
  }

  if (!visitorCountry) {
    return false; // 无法确定国家，默认不屏蔽
  }

  // 检查访客国家是否在屏蔽列表中（不区分大小写）
  return blockedCountries.some((blocked) => blocked.toUpperCase() === visitorCountry.toUpperCase());
}
