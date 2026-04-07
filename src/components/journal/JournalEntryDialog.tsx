import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, AlertTriangle, Users, Truck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface JournalLine {
  account_id: string;
  debit: number;
  credit: number;
  description: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: any;
  readOnly?: boolean;
}

const CURRENCIES = [
  { code: "EGP", label: "جنيه مصري" },
  { code: "USD", label: "دولار أمريكي" },
  { code: "EUR", label: "يورو" },
  { code: "SAR", label: "ريال سعودي" },
  { code: "AED", label: "درهم إماراتي" },
  { code: "GBP", label: "جنيه إسترليني" },
];

export function JournalEntryDialog({ open, onOpenChange, editData, readOnly = false }: Props) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [lines, setLines] = useState<JournalLine[]>([
    { account_id: "", debit: 0, credit: 0, description: "" },
    { account_id: "", debit: 0, credit: 0, description: "" },
  ]);

  const isEdit = !!editData;

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts_for_linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, code, name, level, currency, exchange_rate")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers_with_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, code, name, account_id").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_with_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, code, name, account_id").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const leafAccounts = accounts.filter((acc) => {
    const hasChildren = accounts.some((a) => a.code.startsWith(acc.code) && a.code !== acc.code && a.code.length > acc.code.length);
    return !hasChildren;
  });

  const handlePartySelect = (partyId: string, type: "customer" | "supplier", lineIdx: number) => {
    const partyList = type === "customer" ? customers : suppliers;
    const party = partyList.find((p) => p.id === partyId);
    if (party?.account_id) {
      updateLine(lineIdx, "account_id", party.account_id);
      // Auto-fill currency from the account
      const acc = accounts.find((a) => a.id === party.account_id);
      if (acc && acc.currency !== "EGP") {
        setCurrency(acc.currency);
        setExchangeRate(Number(acc.exchange_rate) || 1);
      }
    }
  };

  // Populate form when editing
  useEffect(() => {
    if (editData && open) {
      setDate(editData.date || new Date().toISOString().split("T")[0]);
      setDescription(editData.description || "");
      setNotes(editData.notes || "");
      setCurrency(editData.currency || "EGP");
      setExchangeRate(Number(editData.exchange_rate) || 1);
      const er = Number(editData.exchange_rate) || 1;
      if (editData.journal_entry_lines?.length > 0) {
        setLines(editData.journal_entry_lines.map((l: any) => ({
          account_id: l.account_id,
          debit: er !== 1 ? Number(l.debit) / er : Number(l.debit),
          credit: er !== 1 ? Number(l.credit) / er : Number(l.credit),
          description: l.description || "",
        })));
      }
    } else if (!editData && open) {
      resetForm();
    }
  }, [editData, open]);

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const addLine = () => {
    setLines([...lines, { account_id: "", debit: 0, credit: 0, description: "" }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof JournalLine, value: string | number) => {
    const updated = [...lines];
    if (field === "debit" && Number(value) > 0) {
      updated[idx] = { ...updated[idx], [field]: Number(value), credit: 0 };
    } else if (field === "credit" && Number(value) > 0) {
      updated[idx] = { ...updated[idx], [field]: Number(value), debit: 0 };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setLines(updated);
  };

  const formatNum = (amount: number) => {
    if (amount === 0) return "-";
    return new Intl.NumberFormat("ar-EG").format(amount);
  };

  const handleSave = async () => {
    if (!description.trim()) {
      toast.error("يرجى إدخال وصف القيد");
      return;
    }
    if (!isBalanced) {
      toast.error("القيد غير متوازن - يجب أن يتساوى المدين والدائن");
      return;
    }
    const emptyAccounts = lines.filter((l) => !l.account_id);
    if (emptyAccounts.length > 0) {
      toast.error("يرجى اختيار حساب لكل سطر");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        // Update existing entry
        const { error: updateError } = await supabase
          .from("journal_entries")
          .update({
            date,
            description,
            notes,
            currency,
            exchange_rate: exchangeRate,
            total_debit: totalDebit * exchangeRate,
            total_credit: totalCredit * exchangeRate,
          })
          .eq("id", editData.id);
        if (updateError) throw updateError;

        // Delete old lines and insert new
        await supabase.from("journal_entry_lines").delete().eq("journal_entry_id", editData.id);

        const lineInserts = lines
          .filter((l) => l.debit > 0 || l.credit > 0)
          .map((l) => ({
            journal_entry_id: editData.id,
            account_id: l.account_id,
            debit: (Number(l.debit) || 0) * exchangeRate,
            credit: (Number(l.credit) || 0) * exchangeRate,
            description: l.description || null,
          }));

        const { error: linesError } = await supabase.from("journal_entry_lines").insert(lineInserts);
        if (linesError) throw linesError;

        toast.success("تم تعديل القيد بنجاح");
      } else {
        // Create new - number is generated atomically in the database
        const { data: entry, error: entryError } = await supabase
          .from("journal_entries")
          .insert({
            number: "",
            date,
            description,
            notes,
            currency,
            exchange_rate: exchangeRate,
            total_debit: totalDebit * exchangeRate,
            total_credit: totalCredit * exchangeRate,
            status: "posted",
          })
          .select()
          .single();
        if (entryError) throw entryError;

        const lineInserts = lines
          .filter((l) => l.debit > 0 || l.credit > 0)
          .map((l) => ({
            journal_entry_id: entry.id,
            account_id: l.account_id,
            debit: (Number(l.debit) || 0) * exchangeRate,
            credit: (Number(l.credit) || 0) * exchangeRate,
            description: l.description || null,
          }));

        const { error: linesError } = await supabase.from("journal_entry_lines").insert(lineInserts);
        if (linesError) throw linesError;

        toast.success("تم حفظ القيد بنجاح");
      }

      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      queryClient.invalidateQueries({ queryKey: ["party_journal_entries"] });
      queryClient.invalidateQueries({ queryKey: ["trial_balance"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error("خطأ: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setDescription("");
    setNotes("");
    setCurrency("EGP");
    setExchangeRate(1);
    setLines([
      { account_id: "", debit: 0, credit: 0, description: "" },
      { account_id: "", debit: 0, credit: 0, description: "" },
    ]);
  };

  useEffect(() => {
    if (currency === "EGP") setExchangeRate(1);
  }, [currency]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? "عرض القيد" : isEdit ? "تعديل القيد" : "قيد يومية جديد"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>التاريخ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <Label>الوصف</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف القيد" disabled={readOnly} />
            </div>
            <div>
              <Label>العملة</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.label} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>سعر الصرف {currency !== "EGP" && `(1 ${currency} = ? EGP)`}</Label>
              <Input type="number" step="0.01" min="0.01" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} disabled={currency === "EGP" || readOnly} />
            </div>
          </div>

          <div>
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات إضافية (اختياري)" rows={2} disabled={readOnly} />
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-2 p-3 bg-muted text-sm font-semibold">
              <div className="col-span-4">الحساب</div>
              <div className="col-span-2">البيان</div>
              <div className="col-span-2 text-center">مدين ({currency})</div>
              <div className="col-span-2 text-center">دائن ({currency})</div>
              {currency !== "EGP" && <div className="col-span-1 text-center">بالمصري</div>}
              <div className={currency !== "EGP" ? "col-span-1" : "col-span-2"} />
            </div>

            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 p-3 border-t border-border items-center">
                <div className="col-span-4 space-y-1">
                  <div className="flex gap-1">
                    <SearchableSelect
                      value={line.account_id}
                      onValueChange={(v) => updateLine(idx, "account_id", v)}
                      options={leafAccounts.map((acc) => ({ value: acc.id, label: `${acc.code} - ${acc.name}` }))}
                      placeholder="اختر حساب"
                      disabled={readOnly}
                    />
                    {!readOnly && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" title="اختر عميل/مورد">
                            <Users className="w-3.5 h-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="end">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">عميل</p>
                          {customers.map((c) => (
                            <Button key={c.id} variant="ghost" size="sm" className="w-full justify-start text-sm" onClick={() => { handlePartySelect(c.id, "customer", idx); updateLine(idx, "description", c.name); }}>
                              {c.code} - {c.name}
                            </Button>
                          ))}
                          <p className="text-xs font-semibold text-muted-foreground mb-2 mt-3 border-t pt-2">مورد</p>
                          {suppliers.map((s) => (
                            <Button key={s.id} variant="ghost" size="sm" className="w-full justify-start text-sm" onClick={() => { handlePartySelect(s.id, "supplier", idx); updateLine(idx, "description", s.name); }}>
                              {s.code} - {s.name}
                            </Button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <Input className="text-sm" value={line.description} onChange={(e) => updateLine(idx, "description", e.target.value)} placeholder="بيان" disabled={readOnly} />
                </div>
                <div className="col-span-2">
                  <Input type="number" className="text-sm text-center" value={line.debit || ""} onChange={(e) => updateLine(idx, "debit", e.target.value)} placeholder="0" disabled={readOnly} />
                </div>
                <div className="col-span-2">
                  <Input type="number" className="text-sm text-center" value={line.credit || ""} onChange={(e) => updateLine(idx, "credit", e.target.value)} placeholder="0" disabled={readOnly} />
                </div>
                {currency !== "EGP" && (
                  <div className="col-span-1 text-center text-xs text-muted-foreground">
                    {formatNum(((line.debit || 0) + (line.credit || 0)) * exchangeRate)}
                  </div>
                )}
                {!readOnly && (
                  <div className={`${currency !== "EGP" ? "col-span-1" : "col-span-2"} flex justify-end`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLine(idx)} disabled={lines.length <= 2}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            <div className="grid grid-cols-12 gap-2 p-3 border-t-2 border-border bg-muted/50 font-bold">
              <div className="col-span-6">الإجمالي</div>
              <div className="col-span-2 text-center">{formatNum(totalDebit)}</div>
              <div className="col-span-2 text-center">{formatNum(totalCredit)}</div>
              <div className="col-span-2" />
            </div>
          </div>

          {!isBalanced && totalDebit + totalCredit > 0 && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <AlertTriangle className="w-4 h-4" />
              القيد غير متوازن - الفرق: {formatNum(Math.abs(totalDebit - totalCredit))} {currency}
            </div>
          )}

          {currency !== "EGP" && exchangeRate > 0 && (
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              المبلغ بالجنيه المصري: مدين {formatNum(totalDebit * exchangeRate)} / دائن {formatNum(totalCredit * exchangeRate)}
            </div>
          )}

          {readOnly ? (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={addLine} className="gap-2">
                <Plus className="w-4 h-4" /> إضافة سطر
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
                <Button onClick={handleSave} disabled={saving || !isBalanced} className="gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEdit ? "حفظ التعديلات" : "حفظ القيد"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
