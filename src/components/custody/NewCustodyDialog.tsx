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

type Employee = Tables<"employees">;
type Account = Tables<"accounts">;

interface NewCustodyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  nextNumber: string;
}

export function NewCustodyDialog({ open, onOpenChange, onSuccess, nextNumber }: NewCustodyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({
    employee_id: "",
    account_id: "",
    amount: "",
    purpose: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    if (open) {
      supabase.from("employees").select("*").eq("is_active", true).order("name").then(({ data }) => setEmployees(data || []));
      supabase.from("accounts").select("*").eq("is_active", true).order("code").then(({ data }) => setAccounts(data || []));
    }
  }, [open]);

  const selectedEmployee = employees.find((e) => e.id === form.employee_id);
  const leafAccounts = accounts.filter((a) => !accounts.some((b) => b.parent_id === a.id));

  const employeeOptions = employees.map((emp) => ({
    value: emp.id,
    label: `${emp.code} - ${emp.name}${emp.department ? ` (${emp.department})` : ""}`,
  }));

  const accountOptions = leafAccounts.map((acc) => ({
    value: acc.id,
    label: `${acc.code} - ${acc.name}`,
  }));

  const handleSave = async () => {
    if (!form.employee_id || !form.amount || !form.purpose || !form.account_id) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }

    setLoading(true);
    try {
      const employee = employees.find((e) => e.id === form.employee_id);
      if (!employee) throw new Error("الموظف غير موجود");

      const { data: lastJE } = await supabase
        .from("journal_entries")
        .select("number")
        .like("number", "CUS-JE-%")
        .order("number", { ascending: false })
        .limit(1);
      const lastJENum = lastJE && lastJE.length > 0
        ? parseInt(lastJE[0].number.replace("CUS-JE-", "")) || 0
        : 0;
      const journalNumber = `CUS-JE-${String(lastJENum + 1).padStart(4, "0")}`;
      const { data: journalEntry, error: jeError } = await supabase.from("journal_entries").insert({
        number: journalNumber,
        date: form.date,
        description: `صرف عهدة ${nextNumber} - ${employee.name}`,
        status: "posted",
        total_debit: amount,
        total_credit: amount,
        reference_type: "custody",
        posted_at: new Date().toISOString(),
      }).select().single();

      if (jeError) throw jeError;

      const { error: linesError } = await supabase.from("journal_entry_lines").insert([
        {
          journal_entry_id: journalEntry.id,
          account_id: employee.account_id!,
          debit: amount,
          credit: 0,
          description: `عهدة ${nextNumber} - ${employee.name}`,
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: form.account_id,
          debit: 0,
          credit: amount,
          description: `صرف عهدة ${nextNumber}`,
        },
      ]);
      if (linesError) throw linesError;

      const { error } = await supabase.from("custodies").insert({
        number: nextNumber,
        employee_name: employee.name,
        employee_id: form.employee_id,
        account_id: form.account_id,
        department: employee.department || null,
        amount,
        remaining_amount: amount,
        settled_amount: 0,
        purpose: form.purpose,
        date: form.date,
        notes: form.notes || null,
        status: "active",
        journal_entry_id: journalEntry.id,
      });

      if (error) throw error;

      toast.success("تم إنشاء العهدة بنجاح");
      setForm({ employee_id: "", account_id: "", amount: "", purpose: "", date: new Date().toISOString().split("T")[0], notes: "" });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("خطأ في حفظ العهدة: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>عهدة جديدة - {nextNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>الموظف *</Label>
            <SearchableSelect
              value={form.employee_id}
              onValueChange={(v) => setForm({ ...form, employee_id: v })}
              options={employeeOptions}
              placeholder="اختر الموظف"
            />
            {selectedEmployee && !selectedEmployee.account_id && (
              <p className="text-xs text-destructive">⚠️ هذا الموظف غير مربوط بحساب في شجرة الحسابات</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>حساب المصدر (الطرف الدائن) *</Label>
            <SearchableSelect
              value={form.account_id}
              onValueChange={(v) => setForm({ ...form, account_id: v })}
              options={accountOptions}
              placeholder="اختر الحساب"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>المبلغ *</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>الغرض *</Label>
            <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="غرض العهدة" />
          </div>
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات إضافية" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={loading || (!!selectedEmployee && !selectedEmployee.account_id)}>
              {loading ? "جاري الحفظ..." : "حفظ العهدة"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
