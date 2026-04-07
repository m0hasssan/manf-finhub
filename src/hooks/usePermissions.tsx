import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { buildAdminPermissions, hasPermission, type PermissionsMap } from "@/lib/permissions";

interface PermissionsContextType {
  role: string | null;
  permissions: PermissionsMap;
  loading: boolean;
  can: (section: string, action: string) => boolean;
  isAdmin: boolean;
}

const PermissionsContext = createContext<PermissionsContextType>({
  role: null,
  permissions: {},
  loading: true,
  can: () => false,
  isAdmin: false,
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const { data: roleData, isLoading: roleLoading } = useQuery({
    queryKey: ["user_role", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error || !data) return "customized";
      return data.role || "customized";
    },
  });

  const { data: permData, isLoading: permLoading } = useQuery({
    queryKey: ["user_permissions", user?.id],
    enabled: !!user?.id && roleData === "customized",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("permissions")
        .eq("user_id", user!.id)
        .single();
      if (error) return {};
      return (data?.permissions as PermissionsMap) || {};
    },
  });

  const isAdmin = roleData === "admin";
  const permissions = isAdmin ? buildAdminPermissions() : (permData || {});
  // Ensure loading stays true until permissions are actually fetched for customized users
  const loading = roleLoading || (roleData === "customized" && (permLoading || permData === undefined));

  const can = (section: string, action: string): boolean => {
    if (isAdmin) return true;
    return hasPermission(permissions, section, action);
  };

  return (
    <PermissionsContext.Provider value={{ role: roleData || null, permissions, loading, can, isAdmin }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);
