"use client";

/**
 * KYC 身份验证数据访问层
 * 创作者身份验证提交和审核
 */

import { getSupabaseBrowserClient } from "./supabase-browser";
import { getCurrentUser } from "./auth";
import { uploadFile } from "./storage";

const supabase = getSupabaseBrowserClient();

export interface VerificationData {
  real_name: string;
  birth_date: string; // YYYY-MM-DD
  country: string;
  id_doc_files: File[]; // 证件照片文件
}

/**
 * 提交身份验证申请
 * @param userId 用户 ID
 * @param data 验证数据
 * @returns true 成功，false 失败
 */
export async function submitVerification(userId: string, data: VerificationData): Promise<boolean> {
  try {
    // 上传证件照片
    const idDocUrls: string[] = [];
    for (const file of data.id_doc_files) {
      try {
        // 使用 storage.ts 的 uploadFile，但需要指定 bucket
        // 这里我们直接上传到 avatars bucket（临时方案，后续可以创建专门的 verification bucket）
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(`verifications/${userId}/${Date.now()}-${file.name}`, file);

        if (uploadError) {
          console.error("[kyc] upload id doc error:", uploadError);
          throw new Error(`上传证件失败: ${uploadError.message}`);
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(uploadData.path);
        idDocUrls.push(publicUrl);
      } catch (err: any) {
        console.error("[kyc] upload file exception:", err);
        throw err;
      }
    }

    // 创建验证记录
    const { error } = await supabase.from("creator_verifications").upsert(
      {
        user_id: userId,
        real_name: data.real_name,
        birth_date: data.birth_date,
        country: data.country,
        id_doc_urls: idDocUrls,
        status: "pending",
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      console.error("[kyc] submitVerification error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[kyc] submitVerification exception:", err);
    return false;
  }
}

/**
 * 审核身份验证申请（管理员使用）
 * @param verificationId 验证记录 ID
 * @param approve true 通过，false 拒绝
 * @param reason 拒绝原因（可选）
 * @returns true 成功，false 失败
 */
export async function reviewVerification(
  verificationId: string,
  approve: boolean,
  reason?: string
): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error("[kyc] reviewVerification: no user");
      return false;
    }

    const { error } = await supabase
      .from("creator_verifications")
      .update({
        status: approve ? "approved" : "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: approve ? null : reason || null,
      })
      .eq("id", verificationId);

    if (error) {
      console.error("[kyc] reviewVerification error:", error);
      return false;
    }

    // 如果通过，更新 profiles.age_verified
    if (approve) {
      const { data: verification } = await supabase
        .from("creator_verifications")
        .select("user_id")
        .eq("id", verificationId)
        .single();

      if (verification) {
        await supabase
          .from("profiles")
          .update({ age_verified: true })
          .eq("id", verification.user_id);
      }
    }

    return true;
  } catch (err) {
    console.error("[kyc] reviewVerification exception:", err);
    return false;
  }
}

/**
 * 获取待审核列表（管理员使用）
 * @returns 验证记录列表
 */
export async function listPendingVerifications(): Promise<
  Array<{
    id: string;
    user_id: string;
    real_name: string;
    birth_date: string;
    country: string;
    id_doc_urls: string[];
    status: string;
    created_at: string;
    user?: {
      display_name?: string;
      avatar_url?: string;
    };
  }>
> {
  try {
    const { data, error } = await supabase
      .from("creator_verifications")
      .select(
        `
        id,
        user_id,
        real_name,
        birth_date,
        country,
        id_doc_urls,
        status,
        created_at,
        profiles!creator_verifications_user_id_fkey (
          display_name,
          avatar_url
        )
      `
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[kyc] listPendingVerifications error:", error);
      return [];
    }

    return (data || []).map((v: any) => ({
      id: v.id,
      user_id: v.user_id,
      real_name: v.real_name,
      birth_date: v.birth_date,
      country: v.country,
      id_doc_urls: v.id_doc_urls,
      status: v.status,
      created_at: v.created_at,
      user: v.profiles
        ? {
            display_name: v.profiles.display_name,
            avatar_url: v.profiles.avatar_url,
          }
        : undefined,
    }));
  } catch (err) {
    console.error("[kyc] listPendingVerifications exception:", err);
    return [];
  }
}
