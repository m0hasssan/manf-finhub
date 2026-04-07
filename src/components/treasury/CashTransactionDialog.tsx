import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLogAction } from "@/hooks/useActionLog";

interface CashTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "receipt" | "payment";
  editData?: any;
}

export function CashTransactionDialog({ open, onOpenChange, type, editData }: CashTransactionDialogProps) {
  const queryClient = useQueryClient();
  const logAction = useLogAction();
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [partyType, setPartyType] = useState<"customer" | "supplier" | "expense">(
    type === "receipt" ? "customer" : "supplier"
  );
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const isEdit = !!editData;

  useEffect(() => {
    if (open && editData) {
      setAmount(String(editData.amount));
      setDescription(editData.description || "");
      setNotes(editData.notes || "");
      setPaymentMethod(editData.payment_method || "cash");
      setDate(editData.date || new Date().toISOString().split("T")[0]);
      if (editData.customer_id) {
        setPartyType("customer");
        setCustomerId(editData.customer_id);
      } else if (editData.supplier_id) {
        setPartyType("supplier");
        setSupplierId(editData.supplier_id);
      } else if (editData.account_id) {
        setPartyType("expense");
        setExpenseAccountId(editData.account_id);
      }
    } else if (open && !editData) {
      resetForm();
    }
  }, [open, editData]);

  const { data: customers } = useQuery({
    queryKey: ["customers_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, code").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name, code").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: expenseAccounts } = useQuery({
    queryKey: ["expense_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, name, code").eq("type", "expense").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const resetForm = () => {
    setAmount("");
    setDescription("");
    setNotes("");
    setPaymentMethod("cash");
    setPartyType(type === "receipt" ? "customer" : "supplier");
    setCustomerId("");
    setSupplierId("");
    setExpenseAccountId("");
    setDate(new Date().toISOString().split("T")[0]);
  };

  const generateReference = () => {
    const prefix = type === "receipt" ? "RV" : "PV";
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["customers_full"] });
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    queryClient.invalidateQueries({ queryKey: ["suppliers_full"] });
    queryClient.invalidateQueries({ queryKey: ["account_statement"] });
  };

  const handleSubmit = async () => {
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    if (!description.trim()) {
      toast.error("يرجى إدخال بيان العملية");
      return;
    }

    if (type === "receipt" && partyType === "customer" && !customerId) {
      toast.error("يرجى اختيار العميل");
      return;
    }
    if (type === "payment" && partyType === "supplier" && !supplierId) {
      toast.error("يرجى اختيار المورد");
      return;
    }
    if (type === "payment" && partyType === "expense" && !expenseAccountId) {
      toast.error("يرجى اختيار حساب المصروفات");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const { error } = await supabase.from("cash_transactions").update({
          amount: amountNum,
          description,
          notes,
          date,
          payment_method: paymentMethod,
          customer_id: partyType === "customer" ? customerId : null,
          supplier_id: partyType === "supplier" ? supplierId : null,
          account_id: partyType === "expense" ? expenseAccountId : null,
        }).eq("id", editData.id);
        if (error) throw error;
        logAction.mutate({ action: "update", entity_type: "cash_transaction", entity_id: editData.id, entity_name: description, details: `${type === "receipt" ? "سند قبض" : "سند صرف"}` });
        invalidateAll();
        toast.success("تم تعديل الحركة بنجاح");
      } else {
        if (type === "payment") {
          const { data: allTxns } = await supabase.from("cash_transactions").select("type, amount");
          const totalReceipts = (allTxns || []).filter((t) => t.type === "receipt").reduce((s, t) => s + Number(t.amount), 0);
          const totalPayments = (allTxns || []).filter((t) => t.type === "payment").reduce((s, t) => s + Number(t.amount), 0);
          const currentBalance = totalReceipts - totalPayments;
          if (amountNum > currentBalance) {
            toast.error(`الرصيد غير كافي لإتمام العملية. رصيد الصندوق الحالي: ${new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(currentBalance)}`);
            setSaving(false);
            return;
          }
        }

        const reference = generateReference();
        const txn: any = {
          type,
          amount: amountNum,
          description,
          notes,
          reference,
          date,
          payment_method: paymentMethod,
          customer_id: partyType === "customer" ? customerId : null,
          supplier_id: partyType === "supplier" ? supplierId : null,
          account_id: partyType === "expense" ? expenseAccountId : null,
        };

        const { data: inserted, error } = await supabase.from("cash_transactions").insert(txn).select("id").single();
        if (error) throw error;
        logAction.mutate({ action: "create", entity_type: "cash_transaction", entity_id: inserted?.id, entity_name: description, details: `${type === "receipt" ? "سند قبض" : "سند صرف"} - ${reference}` });
        invalidateAll();
        toast.success(type === "receipt" ? "تم تسجيل سند القبض بنجاح" : "تم تسجيل سند الصرف بنجاح");
      }

      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("حدث خطأ: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const customerOptions = (customers || []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }));
  const supplierOptions = (suppliers || []).map((s) => ({ value: s.id, label: `${s.code} - ${s.name}` }));
  const expenseOptions = (expenseAccounts || []).map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "تعديل الحركة" : type === "receipt" ? "سند قبض جديد" : "سند صرف جديد"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>المبلغ (جنيه)</Label>
              <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>نوع الطرف</Label>
            <Select value={partyType} onValueChange={(v) => { setPartyType(v as any); setCustomerId(""); setSupplierId(""); setExpenseAccountId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {type === "receipt" ? (
                  <SelectItem value="customer">عميل</SelectItem>
                ) : (
                  <>
                    <SelectItem value="supplier">مورد</SelectItem>
                    <SelectItem value="expense">مصروفات</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {partyType === "customer" && (
            <div className="space-y-2">
              <Label>العميل</Label>
              <SearchableSelect value={customerId} onValueChange={setCustomerId} options={customerOptions} placeholder="اختر العميل..." />
            </div>
          )}

          {partyType === "supplier" && (
            <div className="space-y-2">
              <Label>المورد</Label>
              <SearchableSelect value={supplierId} onValueChange={setSupplierId} options={supplierOptions} placeholder="اختر المورد..." />
            </div>
          )}

          {partyType === "expense" && (
            <div className="space-y-2">
              <Label>حساب المصروفات</Label>
              <SearchableSelect value={expenseAccountId} onValueChange={setExpenseAccountId} options={expenseOptions} placeholder="اختر حساب المصروفات..." />
            </div>
          )}

          <div className="space-y-2">
            <Label>طريقة الدفع</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">نقداً</SelectItem>
                <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                <SelectItem value="check">شيك</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>البيان</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف العملية..." />
          </div>

          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات إضافية..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            {isEdit ? "حفظ التعديلات" : type === "receipt" ? "تسجيل سند القبض" : "تسجيل سند الصرف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
