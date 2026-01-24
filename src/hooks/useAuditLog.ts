import { supabase } from "@/integrations/supabase/client";

type TargetType = "user" | "subscription" | "notification" | "settings" | "security" | "feature" | "support";

type ActionType = 
  | "create_user"
  | "update_user"
  | "block_user"
  | "unblock_user"
  | "delete_user"
  | "view_user"
  | "create_subscription"
  | "update_subscription"
  | "cancel_subscription"
  | "send_notification"
  | "update_settings"
  | "resolve_ticket"
  | "reply_ticket"
  | "approve_feature"
  | "reject_feature";

export async function logAdminAction(
  action: ActionType,
  targetType: TargetType,
  targetId?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await supabase.rpc("log_admin_action" as any, {
      p_action: action,
      p_target_type: targetType,
      p_target_id: targetId || null,
      p_details: details || {},
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
    // Don't throw - audit logging should not break the main flow
  }
}

export function useAuditLog() {
  return { logAdminAction };
}
