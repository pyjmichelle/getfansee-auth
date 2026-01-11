/**
 * KYC Service - 身份验证服务
 * 预留 Didit SDK 接入槽位
 */

import { getCurrentUser } from "./auth";
import { getProfile } from "./profile-server";
import { getSupabaseServerClient } from "./supabase-server";

export type KYCStatus = "not_started" | "pending" | "approved" | "failed";

export interface KYCResult {
  status: KYCStatus;
  verified: boolean;
  message?: string;
}

/**
 * Mock KYC 状态检查函数
 * TODO: Connect to Didit SDK once API keys are ready
 *
 * @param userId 用户 ID
 * @returns KYC 状态
 */
export async function checkKYCStatus(userId: string): Promise<KYCResult> {
  try {
    // 从 profiles 表获取 age_verified 状态
    const profile = await getProfile(userId);

    if (!profile) {
      return {
        status: "not_started",
        verified: false,
        message: "Profile not found",
      };
    }

    // 目前使用 age_verified 字段作为 KYC 状态
    // TODO: 未来接入 Didit SDK 后，这里会调用真实的 KYC API
    if (profile.age_verified) {
      return {
        status: "approved",
        verified: true,
        message: "KYC verified",
      };
    }

    return {
      status: "not_started",
      verified: false,
      message: "KYC not completed",
    };
  } catch (err: any) {
    console.error("[kyc-service] checkKYCStatus error:", err);
    return {
      status: "failed",
      verified: false,
      message: err?.message || "KYC check failed",
    };
  }
}

/**
 * 检查当前用户是否已完成 KYC
 * @returns true 如果已完成，false 如果未完成
 */
export async function isKYCVerified(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return false;
    }

    const result = await checkKYCStatus(user.id);
    return result.verified;
  } catch (err) {
    console.error("[kyc-service] isKYCVerified error:", err);
    return false;
  }
}

/**
 * 更新 KYC 状态（Mock）
 * TODO: 未来接入 Didit SDK 后，这里会处理真实的 KYC 回调
 *
 * @param userId 用户 ID
 * @param status KYC 状态
 * @returns true 成功，false 失败
 */
export async function updateKYCStatus(userId: string, status: KYCStatus): Promise<boolean> {
  try {
    const supabase = await getSupabaseServerClient();
    // 根据状态更新 age_verified
    const ageVerified = status === "approved";

    const { error } = await supabase
      .from("profiles")
      .update({ age_verified: ageVerified })
      .eq("id", userId);

    if (error) {
      console.error("[kyc-service] updateKYCStatus error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[kyc-service] updateKYCStatus exception:", err);
    return false;
  }
}
