import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useLogAction } from "@/hooks/useActionLog";

export type InventoryMovementWithDetails = Tables<"inventory_movements"> & {
  inventory_items: Pick<Tables<"inventory_items">, "name" | "code" | "unit"> | null;
  customers: Pick<Tables<"customers">, "name"> | null;
  suppliers: Pick<Tables<"suppliers">, "name"> | null;
};

export function useInventoryMovements(typeFilter: string) {
  return useQuery({
    queryKey: ["inventory_movements", typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("inventory_movements")
        .select("*, inventory_items(name, code, unit), customers(name), suppliers(name)")
        .order("date", { ascending: false });

      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter as "in" | "out");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InventoryMovementWithDetails[];
    },
  });
}

export function useInventoryItems() {
  return useQuery({
    queryKey: ["inventory_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useInventoryItemsFull() {
  return useQuery({
    queryKey: ["inventory_items_full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*, accounts(code, name)")
        .order("code");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  const logAction = useLogAction();
  return useMutation({
    mutationFn: async (item: TablesInsert<"inventory_items">) => {
      const { data, error } = await supabase.from("inventory_items").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      logAction.mutate({ action: "create", entity_type: "inventory_item", entity_id: data.id, entity_name: data.name });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_items_full"] });
      toast.success("تم إضافة الصنف بنجاح");
    },
    onError: (error) => toast.error("حدث خطأ: " + error.message),
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  const logAction = useLogAction();
  return useMutation({
    mutationFn: async ({ id, ...item }: { id: string } & Record<string, any>) => {
      const { data, error } = await supabase.from("inventory_items").update(item).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      logAction.mutate({ action: "update", entity_type: "inventory_item", entity_id: data.id, entity_name: data.name });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_items_full"] });
      toast.success("تم تعديل الصنف بنجاح");
    },
    onError: (error) => toast.error("حدث خطأ: " + error.message),
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  const logAction = useLogAction();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (_data, id) => {
      logAction.mutate({ action: "delete", entity_type: "inventory_item", entity_id: id });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_items_full"] });
      toast.success("تم حذف الصنف بنجاح");
    },
    onError: (error) => toast.error("حدث خطأ: " + error.message),
  });
}

export function useCreateMovement() {
  const queryClient = useQueryClient();
  const logAction = useLogAction();

  return useMutation({
    mutationFn: async (movement: TablesInsert<"inventory_movements">) => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .insert(movement)
        .select()
        .single();
      if (error) throw error;

      // Auto-create invoice from movement with PENDING status
      // Stock and balance updates happen only when invoice is approved
      if (movement.type === "in") {
        // Create purchase invoice
        const invoiceNumber = `PO-${movement.reference}`;
        const { data: invoice } = await supabase
          .from("purchase_invoices")
          .insert({
            number: invoiceNumber,
            date: movement.date || new Date().toISOString().split("T")[0],
            supplier_id: movement.supplier_id || null,
            subtotal: movement.total,
            tax_rate: 0,
            tax_amount: 0,
            discount: 0,
            total: movement.total,
            status: "pending",
            notes: `تم إنشاؤها تلقائياً من إذن وارد رقم ${movement.reference}`,
          })
          .select()
          .single();
        if (invoice) {
          await supabase.from("purchase_invoice_lines").insert({
            invoice_id: invoice.id,
            item_id: movement.item_id,
            quantity: movement.quantity,
            unit_price: movement.unit_price,
            total: movement.total,
          });
        }
      } else {
        // Create sales invoice
        const invoiceNumber = `INV-${movement.reference}`;
        const { data: invoice } = await supabase
          .from("sales_invoices")
          .insert({
            number: invoiceNumber,
            date: movement.date || new Date().toISOString().split("T")[0],
            customer_id: movement.customer_id || null,
            subtotal: movement.total,
            tax_rate: 0,
            tax_amount: 0,
            discount: 0,
            total: movement.total,
            status: "pending",
            notes: `تم إنشاؤها تلقائياً من إذن صرف رقم ${movement.reference}`,
          })
          .select()
          .single();
        if (invoice) {
          await supabase.from("sales_invoice_lines").insert({
            invoice_id: invoice.id,
            item_id: movement.item_id,
            quantity: movement.quantity,
            unit_price: movement.unit_price,
            total: movement.total,
          });
        }
      }

      return data;
    },
    onSuccess: (data, variables) => {
      logAction.mutate({ action: "create", entity_type: "inventory_movement", entity_id: data.id, entity_name: variables.reference, details: variables.type === "in" ? "إذن وارد" : "إذن صرف" });
      queryClient.invalidateQueries({ queryKey: ["inventory_movements"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["sales_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_invoices"] });
      toast.success(variables.type === "in" ? "تم إضافة إذن الوارد بنجاح" : "تم إضافة إذن الصرف بنجاح");
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });
}
