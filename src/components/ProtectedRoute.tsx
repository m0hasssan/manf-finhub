import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { routePermissionMap } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, user, loading: authLoading } = useAuth();
  const { can, isAdmin, loading: permLoading } = usePermissions();
  const location = useLocation();

  // Check force_password_change
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile_force_pw", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("force_password_change")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
  });

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // Force password change redirect
  if (profile?.force_password_change && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  // Skip permission check for change-password page
  if (location.pathname === "/change-password") {
    return <>{children}</>;
  }

  // Wait for permissions to load before checking access
  if (permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // Check route permission (dashboard is always accessible)
  if (!isAdmin && location.pathname !== "/") {
    const permKey = routePermissionMap[location.pathname];
    if (permKey && !can(permKey, "view")) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
