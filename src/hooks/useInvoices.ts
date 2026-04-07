import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLogAction } from "@/hooks/useActionLog";

export interface InvoiceLine {
  item_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_name?: string;
  item_code?: string;
  item_unit?: string;
}

// Sales Invoices
export function useSalesInvoices() {
  return useQuery({
    queryKey: ["sales_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoices")
        .select("*, customers(name, code)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// Purchase Invoices
export function usePurchaseInvoices() {
  return useQuery({
    queryKey: ["purchase_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_invoices")
        .select("*, suppliers(name, code)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// Update sales invoice status
export function useUpdateSalesInvoiceStatus() {
  const queryClient = useQueryClient();
  const logAction = useLogAction();

  return useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string; status: string }) => {
      // Get invoice details first
      const { data: invoice, error: fetchError } = await supabase
        .from("sales_invoices")
        .select("*, sales_invoice_lines(item_id, quantity, unit_price, total)")
        .eq("id", invoiceId)
        .single();
      if (fetchError) throw fetchError;

      // Update status
      const { error } = await supabase
        .from("sales_invoices")
        .update({ status })
        .eq("id", invoiceId);
      if (error) throw error;

      // If approving, apply stock and balance changes
      if (status === "approved" && invoice.status !== "approved") {
        // Subtract stock for each line
        for (const line of (invoice as any).sales_invoice_lines || []) {
          const { data: item } = await supabase
            .from("inventory_items")
            .select("current_stock")
            .eq("id", line.item_id)
            .single();
          if (item) {
            await supabase
              .from("inventory_items")
              .update({ current_stock: (item.current_stock || 0) - line.quantity })
              .eq("id", line.item_id);
          }
        }

      }

      // If rejecting a previously approved invoice, reverse stock changes
      if (status === "rejected" && invoice.status === "approved") {
        for (const line of (invoice as any).sales_invoice_lines || []) {
          const { data: item } = await supabase
            .from("inventory_items")
            .select("current_stock")
            .eq("id", line.item_id)
            .single();
          if (item) {
            await supabase
              .from("inventory_items")
              .update({ current_stock: (item.current_stock || 0) + line.quantity })
              .eq("id", line.item_id);
          }
        }
      }
    },
    onSuccess: (_data, variables) => {
      logAction.mutate({ action: variables.status === "approved" ? "approve" : "update", entity_type: "sales_invoice", entity_id: variables.invoiceId, details: `تغيير الحالة إلى ${variables.status}` });
      queryClient.invalidateQueries({ queryKey: ["sales_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["account_statement"] });
      toast.success("تم تحديث حالة الفاتورة بنجاح");
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });
}

// Update purchase invoice status
export function useUpdatePurchaseInvoiceStatus() {
  const queryClient = useQueryClient();
  const logAction = useLogAction();

  return useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string; status: string }) => {
      const { data: invoice, error: fetchError } = await supabase
        .from("purchase_invoices")
        .select("*, purchase_invoice_lines(item_id, quantity, unit_price, total)")
        .eq("id", invoiceId)
        .single();
      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from("purchase_invoices")
        .update({ status })
        .eq("id", invoiceId);
      if (error) throw error;

      // If approving, apply stock and balance changes
      if (status === "approved" && invoice.status !== "approved") {
        for (const line of (invoice as any).purchase_invoice_lines || []) {
          const { data: item } = await supabase
            .from("inventory_items")
            .select("current_stock")
            .eq("id", line.item_id)
            .single();
          if (item) {
            await supabase
              .from("inventory_items")
              .update({ current_stock: (item.current_stock || 0) + line.quantity })
              .eq("id", line.item_id);
          }
        }

      }

      // If rejecting a previously approved invoice, reverse stock changes
      if (status === "rejected" && invoice.status === "approved") {
        for (const line of (invoice as any).purchase_invoice_lines || []) {
          const { data: item } = await supabase
            .from("inventory_items")
            .select("current_stock")
            .eq("id", line.item_id)
            .single();
          if (item) {
            await supabase
              .from("inventory_items")
              .update({ current_stock: (item.current_stock || 0) - line.quantity })
              .eq("id", line.item_id);
          }
        }
      }
    },
    onSuccess: (_data, variables) => {
      logAction.mutate({ action: variables.status === "approved" ? "approve" : "update", entity_type: "purchase_invoice", entity_id: variables.invoiceId, details: `تغيير الحالة إلى ${variables.status}` });
      queryClient.invalidateQueries({ queryKey: ["purchase_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["account_statement"] });
      toast.success("تم تحديث حالة الفاتورة بنجاح");
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });
}
