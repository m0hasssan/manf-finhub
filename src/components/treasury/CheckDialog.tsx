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

interface CheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: any;
}

export function CheckDialog({ open, onOpenChange, editData }: CheckDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    number: "", type: "received" as "received" | "issued",
    party_name: "", bank_name: "", amount: "",
    date: new Date().toISOString().split("T")[0],
    due_date: "", notes: "", customer_id: "", supplier_id: "",
    bank_account_id: "",
  });

  const isEdit = !!editData;

  useEffect(() => {
    if (open && editData) {
      setForm({
        number: editData.number || "", type: editData.type || "received",
        party_name: editData.party_name || "", bank_name: editData.bank_name || "",
        amount: String(editData.amount || ""), date: editData.date || new Date().toISOString().split("T")[0],
        due_date: editData.due_date || "", notes: editData.notes || "",
        customer_id: editData.customer_id || "", supplier_id: editData.supplier_id || "",
        bank_account_id: editData.bank_account_id || "",
      });
    } else if (open) {
      setForm({
        number: "", type: "received", party_name: "", bank_name: "", amount: "",
        date: new Date().toISOString().split("T")[0], due_date: "", notes: "",
        customer_id: "", supplier_id: "", bank_account_id: "",
      });
    }
  }, [open, editData]);

  const { data: customers } = useQuery({
    queryKey: ["customers_active"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, code").eq("is_active", true).order("name");
      return data || [];
    },
    enabled: open,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers_active"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name, code").eq("is_active", true).order("name");
      return data || [];
    },
    enabled: open,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank_accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("bank_accounts").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
    enabled: open,
  });

  const handleSave = async () => {
    if (!form.number.trim() || !form.party_name.trim() || !form.amount || !form.due_date) {
      toast.error("يرجى ملء الحقول المطلوبة (رقم الشيك، الطرف، المبلغ، تاريخ الاستحقاق)");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        number: form.number.trim(), type: form.type,
        party_name: form.party_name.trim(), bank_name: form.bank_name.trim() || null,
        amount: Number(form.amount), date: form.date, due_date: form.due_date,
        notes: form.notes.trim() || null,
        customer_id: form.customer_id || null, supplier_id: form.supplier_id || null,
        bank_account_id: form.bank_account_id || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("checks").update(payload).eq("id", editData.id);
        if (error) throw error;
        toast.success("تم تعديل الشيك بنجاح");
      } else {
        const { error } = await supabase.from("checks").insert(payload);
        if (error) throw error;
        toast.success("تم إضافة الشيك بنجاح");
      }
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("خطأ: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل شيك" : "إضافة شيك جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>رقم الشيك *</Label>
              <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>النوع *</Label>
              <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="received">وارد (مستلم)</SelectItem>
                  <SelectItem value="issued">صادر (محرر)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم الطرف *</Label>
              <Input value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>المبلغ *</Label>
              <Input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>تاريخ الشيك</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الاستحقاق *</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم البنك</Label>
              <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>حساب بنكي</Label>
              <SearchableSelect
                value={form.bank_account_id}
                onValueChange={(v) => setForm({ ...form, bank_account_id: v })}
                options={(bankAccounts || []).map((b) => ({ value: b.id, label: b.name }))}
                placeholder="اختر حساب بنكي..."
              />
            </div>
          </div>
          {form.type === "received" && (
            <div className="space-y-2">
              <Label>العميل</Label>
              <SearchableSelect
                value={form.customer_id}
                onValueChange={(v) => setForm({ ...form, customer_id: v })}
                options={(customers || []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                placeholder="اختر العميل..."
              />
            </div>
          )}
          {form.type === "issued" && (
            <div className="space-y-2">
              <Label>المورد</Label>
              <SearchableSelect
                value={form.supplier_id}
                onValueChange={(v) => setForm({ ...form, supplier_id: v })}
                options={(suppliers || []).map((s) => ({ value: s.id, label: `${s.code} - ${s.name}` }))}
                placeholder="اختر المورد..."
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            {isEdit ? "حفظ التعديلات" : "إضافة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
