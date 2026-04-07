import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface WorkOrderInput {
  id?: string;
  input_type: "gold_raw" | "stones" | "other";
  item_id?: string | null;
  description?: string;
  karat: number;
  weight: number;
  pure_gold_weight: number;
  unit_price: number;
  total_cost: number;
}

export interface WorkOrderStage {
  id?: string;
  stage_order: number;
  stage_name: string;
  status: "pending" | "in_progress" | "completed";
  start_date?: string | null;
  end_date?: string | null;
  input_weight: number;
  output_weight: number;
  loss_weight: number;
  labor_cost: number;
  worker_name?: string;
  notes?: string;
}

export interface WorkOrderOutput {
  id?: string;
  item_id?: string | null;
  product_name: string;
  karat: number;
  weight: number;
  pure_gold_weight: number;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface WorkOrder {
  id: string;
  number: string;
  date: string;
  status: "draft" | "in_progress" | "completed" | "cancelled";
  product_name: string;
  target_karat: number;
  gold_price_per_gram: number;
  total_gold_input_weight: number;
  total_output_weight: number;
  total_loss_weight: number;
  loss_percentage: number;
  material_cost: number;
  labor_cost: number;
  overhead_cost: number;
  total_cost: number;
  journal_entry_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export function useWorkOrders() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const workOrdersQuery = useQuery({
    queryKey: ["gold_work_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gold_work_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as WorkOrder[];
    },
  });

  const getNextNumber = async () => {
    const { data } = await supabase
      .from("gold_work_orders")
      .select("number")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const last = parseInt(data[0].number.replace("WO-", "")) || 0;
      return `WO-${String(last + 1).padStart(4, "0")}`;
    }
    return "WO-0001";
  };

  const createWorkOrder = useMutation({
    mutationFn: async (order: Partial<WorkOrder> & { inputs?: WorkOrderInput[]; stages?: WorkOrderStage[]; outputs?: WorkOrderOutput[] }) => {
      const { inputs, stages, outputs, ...orderData } = order;
      const { data, error } = await supabase
        .from("gold_work_orders")
        .insert({ ...orderData, created_by: user?.id } as any)
        .select()
        .single();
      if (error) throw error;

      const workOrderId = data.id;

      if (inputs && inputs.length > 0) {
        const { error: inputErr } = await supabase
          .from("gold_work_order_inputs")
          .insert(inputs.map((i) => ({ ...i, work_order_id: workOrderId, id: undefined })) as any);
        if (inputErr) throw inputErr;
      }

      if (stages && stages.length > 0) {
        const { error: stageErr } = await supabase
          .from("gold_work_order_stages")
          .insert(stages.map((s) => ({ ...s, work_order_id: workOrderId, id: undefined })) as any);
        if (stageErr) throw stageErr;
      }

      if (outputs && outputs.length > 0) {
        const { error: outputErr } = await supabase
          .from("gold_work_order_outputs")
          .insert(outputs.map((o) => ({ ...o, work_order_id: workOrderId, id: undefined })) as any);
        if (outputErr) throw outputErr;
      }

      // Log action
      if (user) {
        await supabase.from("action_logs").insert({
          user_id: user.id,
          user_name: user.email || "",
          action: "إنشاء",
          entity_type: "أمر تشغيل",
          entity_id: workOrderId,
          entity_name: orderData.product_name,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gold_work_orders"] });
      toast({ title: "تم إنشاء أمر التشغيل بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const updateWorkOrder = useMutation({
    mutationFn: async ({ id, inputs, stages, outputs, ...orderData }: Partial<WorkOrder> & { id: string; inputs?: WorkOrderInput[]; stages?: WorkOrderStage[]; outputs?: WorkOrderOutput[] }) => {
      const { error } = await supabase
        .from("gold_work_orders")
        .update(orderData as any)
        .eq("id", id);
      if (error) throw error;

      // Replace inputs
      if (inputs) {
        await supabase.from("gold_work_order_inputs").delete().eq("work_order_id", id);
        if (inputs.length > 0) {
          const { error: inputErr } = await supabase
            .from("gold_work_order_inputs")
            .insert(inputs.map((i) => ({ ...i, work_order_id: id, id: undefined })) as any);
          if (inputErr) throw inputErr;
        }
      }

      if (stages) {
        await supabase.from("gold_work_order_stages").delete().eq("work_order_id", id);
        if (stages.length > 0) {
          const { error: stageErr } = await supabase
            .from("gold_work_order_stages")
            .insert(stages.map((s) => ({ ...s, work_order_id: id, id: undefined })) as any);
          if (stageErr) throw stageErr;
        }
      }

      if (outputs) {
        await supabase.from("gold_work_order_outputs").delete().eq("work_order_id", id);
        if (outputs.length > 0) {
          const { error: outputErr } = await supabase
            .from("gold_work_order_outputs")
            .insert(outputs.map((o) => ({ ...o, work_order_id: id, id: undefined })) as any);
          if (outputErr) throw outputErr;
        }
      }

      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gold_work_orders"] });
      toast({ title: "تم تحديث أمر التشغيل بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const deleteWorkOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gold_work_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gold_work_orders"] });
      toast({ title: "تم حذف أمر التشغيل" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const completeWorkOrder = useMutation({
    mutationFn: async (id: string) => {
      // Get the work order data
      const { data: wo, error: woErr } = await supabase
        .from("gold_work_orders")
        .select("*")
        .eq("id", id)
        .single();
      if (woErr) throw woErr;

      // Create journal entry
      const { data: lastJournal } = await supabase
        .from("journal_entries")
        .select("number")
        .order("created_at", { ascending: false })
        .limit(1);
      const lastNum = lastJournal && lastJournal.length > 0 ? parseInt(lastJournal[0].number.replace("JE-", "")) || 0 : 0;
      const journalNumber = `JE-${String(lastNum + 1).padStart(4, "0")}`;

      const totalCost = wo.total_cost || 0;

      const { data: journal, error: jeErr } = await supabase
        .from("journal_entries")
        .insert({
          number: journalNumber,
          date: new Date().toISOString().split("T")[0],
          description: `قيد تكاليف أمر تشغيل ${wo.number} - ${wo.product_name}`,
          status: "posted",
          total_debit: totalCost,
          total_credit: totalCost,
          reference_type: "work_order",
          reference_id: id,
          created_by: user?.id,
          posted_by: user?.id,
          posted_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (jeErr) throw jeErr;

      // Update work order status
      const { error: updateErr } = await supabase
        .from("gold_work_orders")
        .update({ status: "completed", journal_entry_id: journal.id } as any)
        .eq("id", id);
      if (updateErr) throw updateErr;

      // Log
      if (user) {
        await supabase.from("action_logs").insert({
          user_id: user.id,
          user_name: user.email || "",
          action: "اعتماد",
          entity_type: "أمر تشغيل",
          entity_id: id,
          entity_name: wo.product_name,
          details: `تكلفة إجمالية: ${totalCost}`,
        });
      }

      return journal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gold_work_orders"] });
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      toast({ title: "تم اعتماد أمر التشغيل وإنشاء القيد المحاسبي" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  return {
    workOrders: workOrdersQuery.data || [],
    isLoading: workOrdersQuery.isLoading,
    getNextNumber,
    createWorkOrder,
    updateWorkOrder,
    deleteWorkOrder,
    completeWorkOrder,
  };
}

export function useWorkOrderDetails(id: string | undefined) {
  const inputsQuery = useQuery({
    queryKey: ["gold_work_order_inputs", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("gold_work_order_inputs")
        .select("*")
        .eq("work_order_id", id)
        .order("created_at");
      if (error) throw error;
      return data as WorkOrderInput[];
    },
    enabled: !!id,
  });

  const stagesQuery = useQuery({
    queryKey: ["gold_work_order_stages", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("gold_work_order_stages")
        .select("*")
        .eq("work_order_id", id)
        .order("stage_order");
      if (error) throw error;
      return data as WorkOrderStage[];
    },
    enabled: !!id,
  });

  const outputsQuery = useQuery({
    queryKey: ["gold_work_order_outputs", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("gold_work_order_outputs")
        .select("*")
        .eq("work_order_id", id)
        .order("created_at");
      if (error) throw error;
      return data as WorkOrderOutput[];
    },
    enabled: !!id,
  });

  return {
    inputs: inputsQuery.data || [],
    stages: stagesQuery.data || [],
    outputs: outputsQuery.data || [],
    isLoading: inputsQuery.isLoading || stagesQuery.isLoading || outputsQuery.isLoading,
  };
}
