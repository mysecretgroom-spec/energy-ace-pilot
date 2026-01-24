import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useSaasAdmin() {
  const { user } = useAuth();

  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["saas-admin", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase.rpc("is_saas_admin" as any, {
        p_user_id: user.id
      });

      if (error) {
        return false;
      }

      return !!data;
    },
    enabled: !!user?.id,
  });

  return {
    isAdmin: isAdmin ?? false,
    isLoading,
  };
}
