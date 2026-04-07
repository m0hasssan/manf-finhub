import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLogAction } from "@/hooks/useActionLog";

export function useDeleteSalesInvoice() {
  const queryClient = useQueryClient();
  const logAction = useLogAction();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      // 1. Get invoice with lines
      const { data: invoice, error: fetchErr } = await supabase
        .from("sales_invoices")
        .select("*, sales_invoice_lines(item_id, quantity)")
        .eq("id", invoiceId)
        .single();
      if (fetchErr) throw fetchErr;
      if (!invoice) throw new Error("الفاتورة غير موجودة");

      // 2. Reverse inventory: add back stock for each line
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

      // 3. Delete inventory movements linked to this invoice
      await supabase
        .from("inventory_movements")
        .delete()
        .eq("reference", invoice.number);

      // 4. Delete journal entries and their lines linked to this invoice
      const { data: journals } = await supabase
        .from("journal_entries")
        .select("id")
        .eq("reference_id", invoiceId);

      for (const je of journals || []) {
        await supabase.from("journal_entry_lines").delete().eq("journal_entry_id", je.id);
        await supabase.from("journal_entries").delete().eq("id", je.id);
      }

      // 5. Delete invoice lines
      await supabase.from("sales_invoice_lines").delete().eq("invoice_id", invoiceId);

      // 6. Delete the invoice itself
      const { error: delErr } = await supabase
        .from("sales_invoices")
        .delete()
        .eq("id", invoiceId);
      if (delErr) throw delErr;
    },
    onSuccess: (_data, invoiceId) => {
      logAction.mutate({ action: "delete", entity_type: "sales_invoice", entity_id: invoiceId, entity_name: "فاتورة بيع" });
      queryClient.invalidateQueries({ queryKey: ["confirmed_sales_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sales_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_movements"] });
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      queryClient.invalidateQueries({ queryKey: ["trial_balance"] });
      toast.success("تم حذف الفاتورة وإرجاع المخزون بنجاح");
    },
    onError: (error) => toast.error("حدث خطأ: " + error.message),
  });
}

export function useDeletePurchaseInvoice() {
  const queryClient = useQueryClient();
  const logAction = useLogAction();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      // 1. Get invoice with lines
      const { data: invoice, error: fetchErr } = await supabase
        .from("purchase_invoices")
        .select("*, purchase_invoice_lines(item_id, quantity)")
        .eq("id", invoiceId)
        .single();
      if (fetchErr) throw fetchErr;
      if (!invoice) throw new Error("الفاتورة غير موجودة");

      // 2. Reverse inventory: subtract stock for each line
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

      // 3. Delete inventory movements linked to this invoice
      await supabase
        .from("inventory_movements")
        .delete()
        .eq("reference", invoice.number);

      // 4. Delete journal entries and their lines linked to this invoice
      const { data: journals } = await supabase
        .from("journal_entries")
        .select("id")
        .eq("reference_id", invoiceId);

      for (const je of journals || []) {
        await supabase.from("journal_entry_lines").delete().eq("journal_entry_id", je.id);
        await supabase.from("journal_entries").delete().eq("id", je.id);
      }

      // 5. Delete invoice lines
      await supabase.from("purchase_invoice_lines").delete().eq("invoice_id", invoiceId);

      // 6. Delete the invoice itself
      const { error: delErr } = await supabase
        .from("purchase_invoices")
        .delete()
        .eq("id", invoiceId);
      if (delErr) throw delErr;
    },
    onSuccess: (_data, invoiceId) => {
      logAction.mutate({ action: "delete", entity_type: "purchase_invoice", entity_id: invoiceId, entity_name: "فاتورة شراء" });
      queryClient.invalidateQueries({ queryKey: ["confirmed_purchase_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_movements"] });
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      queryClient.invalidateQueries({ queryKey: ["trial_balance"] });
      toast.success("تم حذف الفاتورة وإرجاع المخزون بنجاح");
    },
    onError: (error) => toast.error("حدث خطأ: " + error.message),
  });
}
