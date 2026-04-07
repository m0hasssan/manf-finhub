import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface BadgeCounts {
  [path: string]: number;
}

interface NotificationBadgesContextType {
  badges: BadgeCounts;
  bellSeen: boolean;
  markBellSeen: () => void;
  unseenBellCount: number;
}

const NotificationBadgesContext = createContext<NotificationBadgesContextType>({
  badges: {},
  bellSeen: true,
  markBellSeen: () => {},
  unseenBellCount: 0,
});

// Map entity_type+action to sidebar paths for "create" actions only
const entityToPath: Record<string, string> = {
  customer: "/customers",
  supplier: "/suppliers",
  employee: "/employees",
  inventory_item: "/inventory/items",
  inventory_request: "/inventory/requests",
  inventory_movement: "/inventory/movements",
  sales_invoice: "/invoices/manage",
  purchase_invoice: "/invoices/manage",
};

export function NotificationBadgesProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  
  // Use user's creation date as the minimum baseline for notifications
  const userCreatedAt = user?.created_at || new Date().toISOString();
  
  const [lastSeenTimestamps, setLastSeenTimestamps] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("sidebar-last-seen") || "{}");
    } catch { return {}; }
  });
  const [bellLastSeen, setBellLastSeen] = useState<string>(() => {
    return localStorage.getItem("bell-last-seen") || "";
  });

  // Initialize bellLastSeen to user creation date if not set
  useEffect(() => {
    if (!bellLastSeen && userCreatedAt) {
      const initialTs = userCreatedAt;
      setBellLastSeen(initialTs);
      localStorage.setItem("bell-last-seen", initialTs);
    }
  }, [bellLastSeen, userCreatedAt]);

  // Fetch recent create logs for sidebar badges — exclude current user's own actions
  const { data: recentCreates } = useQuery({
    queryKey: ["notification_badges_creates", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_logs")
        .select("id, action, entity_type, created_at, user_id")
        .eq("action", "create")
        .neq("user_id", user!.id)
        .gte("created_at", userCreatedAt)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  // Fetch total recent logs for bell — exclude current user's own actions
  const { data: recentAll } = useQuery({
    queryKey: ["notification_badges_all", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_logs")
        .select("id, created_at, user_id")
        .neq("user_id", user!.id)
        .gte("created_at", userCreatedAt)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  // Calculate sidebar badges
  const badges: BadgeCounts = {};
  if (recentCreates) {
    for (const log of recentCreates) {
      const path = entityToPath[log.entity_type];
      if (!path) continue;
      const lastSeen = lastSeenTimestamps[path] || userCreatedAt;
      if (log.created_at > lastSeen) {
        badges[path] = (badges[path] || 0) + 1;
      }
    }
  }

  // Calculate bell unseen count — use userCreatedAt as fallback
  const effectiveBellLastSeen = bellLastSeen || userCreatedAt;
  const unseenBellCount = recentAll?.filter(l => l.created_at > effectiveBellLastSeen).length || 0;

  // Mark path as seen when navigating
  useEffect(() => {
    const currentPath = location.pathname;
    const matchedPath = Object.keys(entityToPath).map(k => entityToPath[k]).find(p => currentPath.startsWith(p));
    if (matchedPath && badges[matchedPath]) {
      const now = new Date().toISOString();
      setLastSeenTimestamps(prev => {
        const updated = { ...prev, [matchedPath]: now };
        localStorage.setItem("sidebar-last-seen", JSON.stringify(updated));
        return updated;
      });
    }
  }, [location.pathname]);

  const markBellSeen = useCallback(() => {
    const now = new Date().toISOString();
    setBellLastSeen(now);
    localStorage.setItem("bell-last-seen", now);
  }, []);

  return (
    <NotificationBadgesContext.Provider value={{ badges, bellSeen: unseenBellCount === 0, markBellSeen, unseenBellCount }}>
      {children}
    </NotificationBadgesContext.Provider>
  );
}

export const useNotificationBadges = () => useContext(NotificationBadgesContext);
