import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ActionLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: string | null;
  created_at: string;
}

const entityTypeLabels: Record<string, string> = {
  customer: "عميل",
  supplier: "مورد",
  employee: "موظف",
  account: "حساب",
  inventory_item: "صنف مخزون",
  inventory_movement: "حركة مخزون",
  inventory_request: "طلب مخزون",
  sales_invoice: "فاتورة بيع",
  purchase_invoice: "فاتورة شراء",
  cash_transaction: "سند نقدي",
  check: "شيك",
  bank_account: "حساب بنكي",
  custody: "عهدة",
  custody_settlement: "تسوية عهدة",
  journal_entry: "قيد يومية",
};

const actionLabels: Record<string, string> = {
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
  approve: "اعتماد",
  reject: "رفض",
  confirm: "تأكيد",
  settle: "تسوية",
};

export function getActionLabel(action: string) {
  return actionLabels[action] || action;
}

export function getEntityLabel(entityType: string) {
  return entityTypeLabels[entityType] || entityType;
}

export function useRecentLogs(limit = 10) {
  return useQuery({
    queryKey: ["action_logs_recent", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as ActionLog[];
    },
    refetchInterval: 30000,
  });
}

export function useAllLogs() {
  return useQuery({
    queryKey: ["action_logs_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_logs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ActionLog[];
    },
  });
}

export function useLogAction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      action: string;
      entity_type: string;
      entity_id?: string;
      entity_name?: string;
      details?: string;
    }) => {
      if (!user) return;
      const userName =
        user.user_metadata?.full_name || user.email || "مستخدم";
      const { error } = await supabase.from("action_logs").insert({
        user_id: user.id,
        user_name: userName,
        action: params.action,
        entity_type: params.entity_type,
        entity_id: params.entity_id || null,
        entity_name: params.entity_name || null,
        details: params.details || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action_logs_recent"] });
      queryClient.invalidateQueries({ queryKey: ["action_logs_all"] });
    },
  });
}
