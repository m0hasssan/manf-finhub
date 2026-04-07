import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLogAction } from "@/hooks/useActionLog";

export type RequestLine = {
  id: string;
  request_id: string;
  item_id: string;
  quantity: number;
  unit_price: number | null;
  total: number | null;
  inventory_items: { name: string; code: string; unit: string } | null;
};

export type InventoryRequestWithDetails = {
  id: string;
  number: string;
  type: "in" | "out";
  date: string;
  item_id: string;
  quantity: number;
  unit_price: number | null;
  total: number | null;
  warehouse: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  inventory_items: { name: string; code: string; unit: string } | null;
  customers: { name: string } | null;
  suppliers: { name: string } | null;
  inventory_request_lines?: RequestLine[];
};

export function useInventoryRequests(statusFilter?: string) {
  return useQuery({
    queryKey: ["inventory_requests", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("inventory_requests")
        .select("*, inventory_items(name, code, unit), customers(name), suppliers(name), inventory_request_lines(*, inventory_items(name, code, unit))")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InventoryRequestWithDetails[];
    },
  });
}

export function useNextRequestNumber() {
  return useQuery({
    queryKey: ["next_request_number"],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_requests")
        .select("number")
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const lastNum = parseInt(data[0].number.replace("REQ-", ""), 10);
        return `REQ-${String(lastNum + 1).padStart(5, "0")}`;
      }
      return "REQ-00001";
    },
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  const logAction = useLogAction();
  return useMutation({
    mutationFn: async (request: {
      number: string;
      type: "in" | "out";
      warehouse?: string;
      customer_id?: string | null;
      supplier_id?: string | null;
      lines: { item_id: string; quantity: number }[];
    }) => {
      const { lines, ...header } = request;
      // Use first item as the legacy item_id/quantity for backward compat
      const firstLine = lines[0];
      const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);

      const { data, error } = await supabase
        .from("inventory_requests")
        .insert({
          ...header,
          item_id: firstLine.item_id,
          quantity: totalQuantity,
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;

      // Insert lines
      const lineInserts = lines.map(l => ({
        request_id: data.id,
        item_id: l.item_id,
        quantity: l.quantity,
      }));
      const { error: linesError } = await supabase
        .from("inventory_request_lines")
        .insert(lineInserts);
      if (linesError) throw linesError;

      return data;
    },
    onSuccess: (data) => {
      logAction.mutate({ action: "create", entity_type: "inventory_request", entity_id: data.id, entity_name: data.number });
      queryClient.invalidateQueries({ queryKey: ["inventory_requests"] });
      queryClient.invalidateQueries({ queryKey: ["next_request_number"] });
      toast.success("تم إنشاء الطلب بنجاح");
    },
    onError: (error) => toast.error("حدث خطأ: " + error.message),
  });
}

export function useApproveRequest() {
  const queryClient = useQueryClient();
  const logAction = useLogAction();
  return useMutation({
    mutationFn: async ({ id, request, linePrices, exchangeRate = 1 }: {
      id: string;
      request: InventoryRequestWithDetails;
      linePrices: { lineId: string; item_id: string; quantity: number; unit_price: number }[];
      exchangeRate?: number;
    }) => {
      const grandTotal = linePrices.reduce((s, l) => s + l.quantity * l.unit_price, 0);

      // Update each line with price
      for (const lp of linePrices) {
        await supabase
          .from("inventory_request_lines")
          .update({ unit_price: lp.unit_price, total: lp.quantity * lp.unit_price })
          .eq("id", lp.lineId);
      }

      // Update request status
      const { error: updateError } = await supabase
        .from("inventory_requests")
        .update({ status: "approved", unit_price: linePrices[0]?.unit_price, total: grandTotal })
        .eq("id", id);
      if (updateError) throw updateError;

      // Create invoice
      if (request.type === "in") {
        const { data: invoice, error: invErr } = await supabase
          .from("purchase_invoices")
          .insert({
            number: `PO-${request.number}`,
            date: request.date,
            supplier_id: request.supplier_id || null,
            subtotal: grandTotal,
            tax_rate: 0, tax_amount: 0, discount: 0,
            total: grandTotal,
            status: "pending",
            exchange_rate: exchangeRate,
            notes: `تم إنشاؤها من طلب إذن وارد رقم ${request.number}`,
          })
          .select()
          .single();
        if (invErr) throw invErr;

        if (invoice) {
          const invoiceLines = linePrices.map(lp => ({
            invoice_id: invoice.id,
            item_id: lp.item_id,
            quantity: lp.quantity,
            unit_price: lp.unit_price,
            total: lp.quantity * lp.unit_price,
          }));
          await supabase.from("purchase_invoice_lines").insert(invoiceLines);
        }
      } else {
        const { data: invoice, error: invErr } = await supabase
          .from("sales_invoices")
          .insert({
            number: `INV-${request.number}`,
            date: request.date,
            customer_id: request.customer_id || null,
            subtotal: grandTotal,
            tax_rate: 0, tax_amount: 0, discount: 0,
            total: grandTotal,
            status: "pending",
            exchange_rate: exchangeRate,
            notes: `تم إنشاؤها من طلب إذن صرف رقم ${request.number}`,
          })
          .select()
          .single();
        if (invErr) throw invErr;

        if (invoice) {
          const invoiceLines = linePrices.map(lp => ({
            invoice_id: invoice.id,
            item_id: lp.item_id,
            quantity: lp.quantity,
            unit_price: lp.unit_price,
            total: lp.quantity * lp.unit_price,
          }));
          await supabase.from("sales_invoice_lines").insert(invoiceLines);
        }
      }

      return { id };
    },
    onSuccess: (_data, variables) => {
      logAction.mutate({ action: "approve", entity_type: "inventory_request", entity_id: variables.id, entity_name: variables.request.number });
      queryClient.invalidateQueries({ queryKey: ["inventory_requests"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_movements"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["sales_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_invoices"] });
      toast.success("تم اعتماد الطلب بنجاح");
    },
    onError: (error) => toast.error("حدث خطأ: " + error.message),
  });
}

export function useRejectRequest() {
  const queryClient = useQueryClient();
  const logAction = useLogAction();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("inventory_requests")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      logAction.mutate({ action: "reject", entity_type: "inventory_request", entity_id: id as string });
      queryClient.invalidateQueries({ queryKey: ["inventory_requests"] });
      toast.success("تم رفض الطلب");
    },
    onError: (error) => toast.error("حدث خطأ: " + error.message),
  });
}

export function useDeletePendingRequest() {
  const queryClient = useQueryClient();
  const logAction = useLogAction();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("inventory_requests")
        .delete()
        .eq("id", id)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      logAction.mutate({ action: "delete", entity_type: "inventory_request", entity_id: id as string });
      queryClient.invalidateQueries({ queryKey: ["inventory_requests"] });
      toast.success("تم حذف الطلب");
    },
    onError: (error) => toast.error("حدث خطأ: " + error.message),
  });
}
