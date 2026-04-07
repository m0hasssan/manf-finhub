import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface BankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: any;
}

export function BankAccountDialog({ open, onOpenChange, editData }: BankAccountDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", bank_name: "", account_number: "", branch: "",
    currency: "EGP", opening_balance: 0, account_id: "",
  });

  const isEdit = !!editData;

  useEffect(() => {
    if (open && editData) {
      setForm({
        name: editData.name || "", bank_name: editData.bank_name || "",
        account_number: editData.account_number || "", branch: editData.branch || "",
        currency: editData.currency || "EGP",
        opening_balance: Number(editData.opening_balance || 0),
        account_id: editData.account_id || "",
      });
    } else if (open) {
      setForm({ name: "", bank_name: "", account_number: "", branch: "", currency: "EGP", opening_balance: 0, account_id: "" });
    }
  }, [open, editData]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts_for_bank"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, code, name, currency").eq("is_active", true).order("code");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const leafAccounts = accounts.filter((acc) => !accounts.some((a) => a.code.startsWith(acc.code) && a.code !== acc.code && a.code.length > acc.code.length));

  const handleSave = async () => {
    if (!form.name.trim() || !form.bank_name.trim() || !form.account_number.trim()) {
      toast.error("يرجى ملء الحقول المطلوبة"); return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim(), branch: form.branch.trim() || null,
        currency: form.currency, opening_balance: form.opening_balance,
        current_balance: form.opening_balance,
        account_id: form.account_id || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("bank_accounts").update(payload).eq("id", editData.id);
        if (error) throw error;
        toast.success("تم تعديل الحساب البنكي بنجاح");
      } else {
        const { error } = await supabase.from("bank_accounts").insert(payload);
        if (error) throw error;
        toast.success("تم إضافة الحساب البنكي بنجاح");
      }
      queryClient.invalidateQueries({ queryKey: ["bank_accounts"] });
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
          <DialogTitle>{isEdit ? "تعديل حساب بنكي" : "إضافة حساب بنكي جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم الحساب *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>اسم البنك *</Label>
              <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>رقم الحساب *</Label>
              <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الفرع</Label>
              <Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>العملة</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الرصيد الافتتاحي</Label>
              <Input type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>ربط بحساب في شجرة الحسابات</Label>
            <SearchableSelect
              value={form.account_id}
              onValueChange={(v) => setForm({ ...form, account_id: v })}
              options={leafAccounts.map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
              placeholder="اختر الحساب..."
            />
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
