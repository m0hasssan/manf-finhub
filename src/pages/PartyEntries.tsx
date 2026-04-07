import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Users, Truck, Loader2, AlertTriangle, MoreHorizontal, Edit, Trash2, Upload } from "lucide-react";
import { ImportPartyEntriesDialog } from "@/components/journal/ImportPartyEntriesDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const CURRENCIES = [
  { code: "EGP", label: "جنيه مصري" },
  { code: "USD", label: "دولار أمريكي" },
  { code: "EUR", label: "يورو" },
  { code: "SAR", label: "ريال سعودي" },
  { code: "AED", label: "درهم إماراتي" },
  { code: "GBP", label: "جنيه إسترليني" },
];

const PartyEntries = () => {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [deleteEntry, setDeleteEntry] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [partyType, setPartyType] = useState<"customer" | "supplier">("customer");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [amount, setAmount] = useState(0);
  const [isDebitParty, setIsDebitParty] = useState(true); // true = party is debited, account is credited

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, code, name, account_id").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, code, name, account_id").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts_for_linking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, code, name, level, currency, exchange_rate").eq("is_active", true).order("code");
      if (error) throw error;
      return data;
    },
  });

  const leafAccounts = accounts.filter((acc) => {
    const hasChildren = accounts.some((a) => a.code.startsWith(acc.code) && a.code !== acc.code && a.code.length > acc.code.length);
    return !hasChildren;
  });

  // Fetch existing party journal entries
  const { data: partyEntries = [], isLoading } = useQuery({
    queryKey: ["party_journal_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*, journal_entry_lines(*, accounts(code, name))")
        .in("reference_type", ["party_customer", "party_supplier"])
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const parties = partyType === "customer" ? customers : suppliers;

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setDescription("");
    setNotes("");
    setCurrency("EGP");
    setExchangeRate(1);
    setSelectedPartyId("");
    setSelectedAccountId("");
    setAmount(0);
    setIsDebitParty(true);
  };

  const handleSave = async () => {
    if (!selectedPartyId || !selectedAccountId || amount <= 0 || !description.trim()) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    setSaving(true);
    try {
      const party = parties.find((p) => p.id === selectedPartyId);
      if (!party?.account_id) {
        toast.error("الطرف غير مرتبط بحساب في شجرة الحسابات");
        setSaving(false);
        return;
      }

      const amountEGP = amount * exchangeRate;

      if (editEntry) {
        // Update existing entry
        const { error: updateError } = await supabase
          .from("journal_entries")
          .update({
            date,
            description,
            notes,
            currency,
            exchange_rate: exchangeRate,
            total_debit: amountEGP,
            total_credit: amountEGP,
            reference_type: partyType === "customer" ? "party_customer" : "party_supplier",
            reference_id: selectedPartyId,
          })
          .eq("id", editEntry.id);
        if (updateError) throw updateError;

        await supabase.from("journal_entry_lines").delete().eq("journal_entry_id", editEntry.id);

        const lineInserts = [
          {
            journal_entry_id: editEntry.id,
            account_id: isDebitParty ? party.account_id : selectedAccountId,
            debit: amountEGP,
            credit: 0,
            description: isDebitParty ? `${party.name}` : null,
          },
          {
            journal_entry_id: editEntry.id,
            account_id: isDebitParty ? selectedAccountId : party.account_id,
            debit: 0,
            credit: amountEGP,
            description: isDebitParty ? null : `${party.name}`,
          },
        ];

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
            total_debit: amountEGP,
            total_credit: amountEGP,
            status: "posted",
            reference_type: partyType === "customer" ? "party_customer" : "party_supplier",
            reference_id: selectedPartyId,
          })
          .select()
          .single();
        if (entryError) throw entryError;

        const lineInserts = [
          {
            journal_entry_id: entry.id,
            account_id: isDebitParty ? party.account_id : selectedAccountId,
            debit: amountEGP,
            credit: 0,
            description: isDebitParty ? `${party.name}` : null,
          },
          {
            journal_entry_id: entry.id,
            account_id: isDebitParty ? selectedAccountId : party.account_id,
            debit: 0,
            credit: amountEGP,
            description: isDebitParty ? null : `${party.name}`,
          },
        ];

        const { error: linesError } = await supabase.from("journal_entry_lines").insert(lineInserts);
        if (linesError) throw linesError;

        toast.success("تم حفظ القيد بنجاح");
      }

      queryClient.invalidateQueries({ queryKey: ["party_journal_entries"] });
      queryClient.invalidateQueries({ queryKey: ["trial_balance"] });
      setDialogOpen(false);
      setEditEntry(null);
      resetForm();
    } catch (error: any) {
      toast.error("خطأ: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteEntry) return;
    setDeleting(true);
    try {
      await supabase.from("journal_entry_lines").delete().eq("journal_entry_id", deleteEntry.id);
      const { error } = await supabase.from("journal_entries").delete().eq("id", deleteEntry.id);
      if (error) throw error;
      toast.success("تم حذف القيد بنجاح");
      queryClient.invalidateQueries({ queryKey: ["party_journal_entries"] });
      queryClient.invalidateQueries({ queryKey: ["trial_balance"] });
    } catch (error: any) {
      toast.error("خطأ في الحذف: " + error.message);
    } finally {
      setDeleting(false);
      setDeleteEntry(null);
    }
  };

  const handleEdit = (entry: any) => {
    // Pre-fill the form with entry data
    setDate(entry.date);
    setDescription(entry.description);
    setNotes(entry.notes || "");
    setCurrency(entry.currency || "EGP");
    setExchangeRate(Number(entry.exchange_rate) || 1);
    setPartyType(entry.reference_type === "party_customer" ? "customer" : "supplier");
    setSelectedPartyId(entry.reference_id || "");
    // Find the lines
    const lines = entry.journal_entry_lines || [];
    const partyAccId = entry.reference_type === "party_customer"
      ? customers.find((c) => c.id === entry.reference_id)?.account_id
      : suppliers.find((s) => s.id === entry.reference_id)?.account_id;
    const partyLine = lines.find((l: any) => l.account_id === partyAccId);
    const counterLine = lines.find((l: any) => l.account_id !== partyAccId);
    if (partyLine && counterLine) {
      const er = Number(entry.exchange_rate) || 1;
      setAmount(er !== 1 ? Math.max(Number(partyLine.debit), Number(partyLine.credit)) / er : Math.max(Number(partyLine.debit), Number(partyLine.credit)));
      setIsDebitParty(Number(partyLine.debit) > 0);
      setSelectedAccountId(counterLine.account_id);
    }
    setEditEntry(entry);
    setDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    if (amount === 0) return "-";
    return new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("ar-EG");

  const filteredEntries = partyEntries.filter((e: any) =>
    e.description?.includes(searchQuery) || e.number?.includes(searchQuery)
  );

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              قيود العملاء والموردين
            </h1>
            <p className="text-muted-foreground">قيود مالية مخصصة للعملاء والموردين بعملات مختلفة</p>
          </div>
          {can("party_entries", "create") && (
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4" />
                استيراد Excel
              </Button>
              <Button className="gap-2" onClick={() => { setEditEntry(null); resetForm(); setDialogOpen(true); }}>
                <Plus className="w-4 h-4" />
                قيد جديد
              </Button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث في القيود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        {/* Entries Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد قيود</h3>
            <p className="text-muted-foreground">ابدأ بإضافة قيد جديد للعملاء أو الموردين</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEntries.map((entry: any) => (
              <div key={entry.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 bg-muted/50 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm bg-primary/10 text-primary px-3 py-1 rounded">{entry.number}</span>
                    <span className="text-muted-foreground">{formatDate(entry.date)}</span>
                    <span className="font-medium">{entry.description}</span>
                    {entry.currency !== "EGP" && (
                      <span className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded">
                        {entry.currency} × {entry.exchange_rate}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${entry.reference_type === "party_customer" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"}`}>
                      {entry.reference_type === "party_customer" ? "عملاء" : "موردين"}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(entry)}>
                          <Edit className="w-4 h-4 ml-2" /> تعديل التفاصيل
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteEntry(entry)}>
                          <Trash2 className="w-4 h-4 ml-2" /> حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الحساب</TableHead>
                      <TableHead className="text-center w-40">مدين</TableHead>
                      <TableHead className="text-center w-40">دائن</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(entry.journal_entry_lines || []).map((line: any) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          {line.accounts?.code} - {line.accounts?.name}
                          {line.description && <span className="text-muted-foreground text-sm mr-2">({line.description})</span>}
                        </TableCell>
                        <TableCell className="text-center font-semibold">{line.debit > 0 ? formatCurrency(line.debit) : "-"}</TableCell>
                        <TableCell className="text-center font-semibold">{line.credit > 0 ? formatCurrency(line.credit) : "-"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-bold">
                      <TableCell>الإجمالي</TableCell>
                      <TableCell className="text-center text-primary">{formatCurrency(entry.total_debit)}</TableCell>
                      <TableCell className="text-center text-primary">{formatCurrency(entry.total_credit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>قيد عملاء / موردين جديد</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Party Type */}
            <Tabs value={partyType} onValueChange={(v) => { setPartyType(v as any); setSelectedPartyId(""); }}>
              <TabsList className="w-full">
                <TabsTrigger value="customer" className="flex-1 gap-2">
                  <Users className="w-4 h-4" /> عميل
                </TabsTrigger>
                <TabsTrigger value="supplier" className="flex-1 gap-2">
                  <Truck className="w-4 h-4" /> مورد
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>التاريخ</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label>{partyType === "customer" ? "العميل" : "المورد"}</Label>
                <SearchableSelect
                  value={selectedPartyId}
                  onValueChange={(id) => {
                    setSelectedPartyId(id);
                    const party = parties.find((p) => p.id === id);
                    if (party?.account_id) {
                      const acc = accounts.find((a) => a.id === party.account_id);
                      if (acc) {
                        setCurrency(acc.currency || "EGP");
                        setExchangeRate(Number(acc.exchange_rate) || 1);
                      }
                    }
                  }}
                  options={parties.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
                  placeholder={partyType === "customer" ? "اختر عميل" : "اختر مورد"}
                />
                {selectedPartyId && (() => {
                  const party = parties.find((p) => p.id === selectedPartyId);
                  const acc = party?.account_id ? accounts.find((a) => a.id === party.account_id) : null;
                  return acc ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      الحساب المرتبط: {acc.code} - {acc.name} ({acc.currency})
                    </p>
                  ) : null;
                })()}
              </div>
            </div>

            <div>
              <Label>الوصف</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف القيد" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>العملة</Label>
                <Select value={currency} onValueChange={(v) => { setCurrency(v); if (v === "EGP") setExchangeRate(1); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>سعر الصرف</Label>
                <Input type="number" step="0.01" min="0.01" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} disabled={currency === "EGP"} />
              </div>
              <div>
                <Label>المبلغ ({currency})</Label>
                <Input type="number" step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} placeholder="0" />
              </div>
            </div>

            {/* Direction */}
            <div>
              <Label>اتجاه القيد</Label>
              <Select value={isDebitParty ? "debit" : "credit"} onValueChange={(v) => setIsDebitParty(v === "debit")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">
                    {partyType === "customer" ? "مدين العميل (عليه)" : "مدين المورد (عليه)"}
                  </SelectItem>
                  <SelectItem value="credit">
                    {partyType === "customer" ? "دائن العميل (له)" : "دائن المورد (له)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Counter Account */}
            <div>
              <Label>الحساب المقابل (من شجرة الحسابات)</Label>
              <SearchableSelect
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
                options={leafAccounts.map((acc) => ({ value: acc.id, label: `${acc.code} - ${acc.name}` }))}
                placeholder="اختر حساب"
              />
            </div>

            <div>
              <Label>ملاحظات</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" rows={2} />
            </div>

            {/* Preview */}
            {amount > 0 && selectedPartyId && selectedAccountId && (
              <div className="border border-border rounded-lg p-4 bg-muted/30">
                <p className="font-semibold mb-2 text-sm">معاينة القيد:</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>الحساب</div>
                  <div className="text-center">مدين</div>
                  <div className="text-center">دائن</div>
                  
                  <div>{isDebitParty ? (parties.find((p) => p.id === selectedPartyId)?.name || "") : (leafAccounts.find((a) => a.id === selectedAccountId)?.name || "")}</div>
                  <div className="text-center font-semibold">{new Intl.NumberFormat("ar-EG").format(amount * exchangeRate)}</div>
                  <div className="text-center">-</div>
                  
                  <div>{isDebitParty ? (leafAccounts.find((a) => a.id === selectedAccountId)?.name || "") : (parties.find((p) => p.id === selectedPartyId)?.name || "")}</div>
                  <div className="text-center">-</div>
                  <div className="text-center font-semibold">{new Intl.NumberFormat("ar-EG").format(amount * exchangeRate)}</div>
                </div>
                {currency !== "EGP" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    المبلغ الأصلي: {amount} {currency} × {exchangeRate} = {new Intl.NumberFormat("ar-EG").format(amount * exchangeRate)} EGP
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDialogOpen(false); setEditEntry(null); resetForm(); }}>إلغاء</Button>
              <Button onClick={handleSave} disabled={saving || amount <= 0} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editEntry ? "حفظ التعديلات" : "حفظ القيد"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEntry} onOpenChange={(open) => !open && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف القيد {deleteEntry?.number}؟ سيتم حذف جميع أسطر القيد وعكس الأثر المالي.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ImportPartyEntriesDialog open={importOpen} onOpenChange={setImportOpen} />
    </MainLayout>
  );
};

export default PartyEntries;
