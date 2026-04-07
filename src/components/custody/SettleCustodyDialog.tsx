import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import type { Tables } from "@/integrations/supabase/types";

type Custody = Tables<"custodies">;
type Account = Tables<"accounts">;

interface SettleCustodyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  custodies: Custody[];
}

export function SettleCustodyDialog({ open, onOpenChange, onSuccess, custodies }: SettleCustodyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedCustodyId, setSelectedCustodyId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({
    amount: "",
    description: "",
    receipt_number: "",
    date: new Date().toISOString().split("T")[0],
    account_id: "",
  });

  const activeCustodies = custodies.filter((c) => c.status !== "settled");
  const selectedCustody = custodies.find((c) => c.id === selectedCustodyId);

  useEffect(() => {
    if (open) {
      supabase.from("accounts").select("*").eq("is_active", true).order("code").then(({ data }) => setAccounts(data || []));
    }
    if (!open) {
      setSelectedCustodyId("");
      setForm({ amount: "", description: "", receipt_number: "", date: new Date().toISOString().split("T")[0], account_id: "" });
    }
  }, [open]);

  const leafAccounts = accounts.filter((a) => !accounts.some((b) => b.parent_id === a.id));

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);

  const custodyOptions = activeCustodies.map((c) => ({
    value: c.id,
    label: `${c.number} - ${c.employee_name} (متبقي: ${formatCurrency(c.remaining_amount)})`,
  }));

  const accountOptions = leafAccounts.map((acc) => ({
    value: acc.id,
    label: `${acc.code} - ${acc.name}`,
  }));

  const handleSave = async () => {
    if (!selectedCustodyId || !form.amount || !form.description || !form.account_id) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }

    if (selectedCustody && amount > selectedCustody.remaining_amount) {
      toast.error(`المبلغ أكبر من المتبقي (${formatCurrency(selectedCustody.remaining_amount)})`);
      return;
    }

    setLoading(true);
    try {
      let employeeAccountId: string | null = null;
      if (selectedCustody?.employee_id) {
        const { data: emp } = await supabase.from("employees").select("account_id").eq("id", selectedCustody.employee_id).single();
        employeeAccountId = emp?.account_id || null;
      }

      const journalNumber = `CUS-SET-${Date.now()}`;
      const { data: journalEntry, error: jeError } = await supabase.from("journal_entries").insert({
        number: journalNumber,
        date: form.date,
        description: `تسوية عهدة ${selectedCustody?.number} - ${form.description}`,
        status: "posted",
        total_debit: amount,
        total_credit: amount,
        reference_type: "custody_settlement",
        posted_at: new Date().toISOString(),
      }).select().single();

      if (jeError) throw jeError;

      if (employeeAccountId) {
        const { error: linesError } = await supabase.from("journal_entry_lines").insert([
          {
            journal_entry_id: journalEntry.id,
            account_id: form.account_id,
            debit: amount,
            credit: 0,
            description: `تسوية عهدة ${selectedCustody?.number}`,
          },
          {
            journal_entry_id: journalEntry.id,
            account_id: employeeAccountId,
            debit: 0,
            credit: amount,
            description: `تسوية عهدة ${selectedCustody?.number}`,
          },
        ]);
        if (linesError) throw linesError;
      }

      const { error: settlementError } = await supabase.from("custody_settlements").insert({
        custody_id: selectedCustodyId,
        amount,
        description: form.description,
        receipt_number: form.receipt_number || null,
        date: form.date,
        journal_entry_id: journalEntry.id,
      });
      if (settlementError) throw settlementError;

      const newSettled = (selectedCustody?.settled_amount || 0) + amount;
      const newRemaining = (selectedCustody?.amount || 0) - newSettled;
      const newStatus = newRemaining <= 0 ? "settled" : "partial";

      const { error: updateError } = await supabase
        .from("custodies")
        .update({
          settled_amount: newSettled,
          remaining_amount: Math.max(0, newRemaining),
          status: newStatus,
        })
        .eq("id", selectedCustodyId);
      if (updateError) throw updateError;

      toast.success("تمت التسوية بنجاح");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("خطأ في التسوية: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسوية عهدة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>اختر العهدة *</Label>
            <SearchableSelect
              value={selectedCustodyId}
              onValueChange={setSelectedCustodyId}
              options={custodyOptions}
              placeholder="اختر عهدة للتسوية"
            />
          </div>

          {selectedCustody && (
            <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
              <p>الموظف: <span className="font-medium">{selectedCustody.employee_name}</span></p>
              <p>المبلغ الكلي: <span className="font-medium">{formatCurrency(selectedCustody.amount)}</span></p>
              <p>المسوى: <span className="text-success font-medium">{formatCurrency(selectedCustody.settled_amount)}</span></p>
              <p>المتبقي: <span className="text-destructive font-medium">{formatCurrency(selectedCustody.remaining_amount)}</span></p>
            </div>
          )}

          <div className="space-y-2">
            <Label>حساب التسوية (الطرف المدين) *</Label>
            <SearchableSelect
              value={form.account_id}
              onValueChange={(v) => setForm({ ...form, account_id: v })}
              options={accountOptions}
              placeholder="اختر الحساب"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>مبلغ التسوية *</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>البيان *</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف التسوية" />
          </div>
          <div className="space-y-2">
            <Label>رقم الإيصال</Label>
            <Input value={form.receipt_number} onChange={(e) => setForm({ ...form, receipt_number: e.target.value })} placeholder="اختياري" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={loading}>{loading ? "جاري الحفظ..." : "تسوية"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
