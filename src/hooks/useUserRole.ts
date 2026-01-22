import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type AppRole = 'admin' | 'moderator' | 'user';

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRoles();
    } else {
      setRoles([]);
      setIsAdmin(false);
      setLoading(false);
    }
  }, [user]);

  const fetchRoles = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;

      const userRoles = (data || []).map(r => r.role as AppRole);
      setRoles(userRoles);
      setIsAdmin(userRoles.includes('admin'));
    } catch (error) {
      console.error("Error fetching user roles:", error);
      setRoles([]);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return {
    roles,
    isAdmin,
    loading,
    hasRole,
    refetch: fetchRoles
  };
}
