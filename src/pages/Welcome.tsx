import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutDashboard } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Welcome = () => {
  const { user } = useAuth();
  const { can, isAdmin } = usePermissions();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile_welcome", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
  });

  const displayName = profile?.full_name || user?.email || "مستخدم";
  const canSeeDashboard = isAdmin || can("dashboard", "view");

  return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-[70vh] animate-fade-in">
        <Card className="w-full max-w-lg text-center border-none shadow-none bg-transparent">
          <CardContent className="space-y-6 pt-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <LayoutDashboard className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">
                مرحباً، {displayName}
              </h1>
              <p className="text-lg text-muted-foreground">
                أهلاً بك في نظام المحاسبة
              </p>
            </div>
            <p className="text-muted-foreground text-sm">
              استخدم القائمة الجانبية للتنقل بين الأقسام المتاحة لك
            </p>
            {canSeeDashboard && (
              <Button onClick={() => navigate("/dashboard")} className="mt-4">
                <LayoutDashboard className="w-4 h-4 ml-2" />
                الذهاب إلى لوحة التحكم
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Welcome;
