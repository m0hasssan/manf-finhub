import { useState } from "react";
import { JournalEntryDialog } from "@/components/journal/JournalEntryDialog";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Loader2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/exportExcel";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface LedgerEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  debitForeign: number;
  creditForeign: number;
  reference: string;
  source: string;
  exchangeRate: number;
  currency: string;
  journalEntryId: string | null;
}

const AccountLedgerReport = () => {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [viewJournalEntry, setViewJournalEntry] = useState<any>(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ["all_accounts_for_ledger"],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("id, code, name, currency, exchange_rate, opening_balance_debit, opening_balance_credit, type")
        .eq("is_active", true)
        .order("code");
      return data || [];
    },
  });

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const accountCurrency = selectedAccount?.currency || "EGP";
  const accountRate = Number(selectedAccount?.exchange_rate) || 1;
  const isForeign = accountCurrency !== "EGP";

  const { data: ledgerData, isLoading: loadingEntries } = useQuery({
    queryKey: ["account_ledger_report", selectedAccountId],
    enabled: !!selectedAccountId,
    queryFn: async () => {
      const results: LedgerEntry[] = [];
      const acc = accounts.find(a => a.id === selectedAccountId);
      if (!acc) return { entries: results };

      const curr = acc.currency || "EGP";
      const rate = Number(acc.exchange_rate) || 1;
      const foreign = curr !== "EGP";

      // Opening balance
      const obDebit = Number(acc.opening_balance_debit) || 0;
      const obCredit = Number(acc.opening_balance_credit) || 0;
      if (obDebit > 0 || obCredit > 0) {
        results.push({
          date: "0001-01-01",
          description: "رصيد افتتاحي",
          debit: obDebit,
          credit: obCredit,
          debitForeign: foreign ? obDebit / rate : obDebit,
          creditForeign: foreign ? obCredit / rate : obCredit,
          reference: "-",
          source: "رصيد افتتاحي",
          exchangeRate: rate,
          currency: curr,
          journalEntryId: null,
        });
      }

      // Journal entry lines
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select("debit, credit, description, journal_entry_id")
        .eq("account_id", selectedAccountId);

      if (lines && lines.length > 0) {
        const jeIds = [...new Set(lines.map(l => l.journal_entry_id))];
        const allEntries: any[] = [];
        for (let i = 0; i < jeIds.length; i += 50) {
          const batch = jeIds.slice(i, i + 50);
          const { data: jes } = await supabase
            .from("journal_entries")
            .select("id, date, number, description, status, reference_type, currency, exchange_rate")
            .in("id", batch)
            .eq("status", "posted");
          if (jes) allEntries.push(...jes);
        }

        const jeMap = new Map(allEntries.map(je => [je.id, je]));

        for (const line of lines) {
          const je = jeMap.get(line.journal_entry_id);
          if (!je) continue;

          let source = "قيد يومية";
          switch (je.reference_type) {
            case "cash_receipt": source = "سند قبض"; break;
            case "cash_payment": source = "سند صرف"; break;
            case "sales_invoice": source = "فاتورة بيع"; break;
            case "purchase_invoice": source = "فاتورة شراء"; break;
            case "inventory_in": source = "إدخال مخزن"; break;
            case "inventory_out": source = "إخراج مخزن"; break;
            case "party_customer": source = "قيد عميل"; break;
            case "party_supplier": source = "قيد مورد"; break;
            case "custody": source = "عهدة"; break;
            case "settlement": source = "تسوية عهدة"; break;
          }

          const d = Number(line.debit) || 0;
          const c = Number(line.credit) || 0;
          const jeRate = Number(je.exchange_rate) || 1;

          results.push({
            date: je.date,
            description: line.description || je.description,
            debit: d,
            credit: c,
            debitForeign: foreign ? d / jeRate : d,
            creditForeign: foreign ? c / jeRate : c,
            reference: je.number,
            source,
            exchangeRate: jeRate,
            currency: je.currency || "EGP",
            journalEntryId: je.id,
          });
        }
      }

      results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return { entries: results };
    },
  });

  const entries = ledgerData?.entries || [];

  const formatEGP = (amount: number) =>
    amount === 0 ? "-" : new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);
  const formatCurr = (amount: number, curr: string) =>
    amount === 0 ? "-" : new Intl.NumberFormat("ar-EG", { style: "currency", currency: curr }).format(amount);
  const formatDate = (dateStr: string) =>
    dateStr === "0001-01-01" ? "-" : new Date(dateStr).toLocaleDateString("ar-EG");

  let runEGP = 0, runF = 0;
  const entriesWithBalance = entries.map(entry => {
    runEGP += entry.debit - entry.credit;
    runF += entry.debitForeign - entry.creditForeign;
    return { ...entry, balanceEGP: runEGP, balanceForeign: runF };
  });

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const totalDebitF = entries.reduce((s, e) => s + e.debitForeign, 0);
  const totalCreditF = entries.reduce((s, e) => s + e.creditForeign, 0);

  const handleExport = () => {
    if (!selectedAccount) return;
    const headers = isForeign
      ? ["التاريخ", "البيان", "المرجع", "النوع", "المعامل", `مدين (${accountCurrency})`, `دائن (${accountCurrency})`, `الرصيد (${accountCurrency})`, "مدين (ج.م)", "دائن (ج.م)", "الرصيد (ج.م)"]
      : ["التاريخ", "البيان", "المرجع", "النوع", "المعامل", "مدين", "دائن", "الرصيد"];
    const rows = entriesWithBalance.map(e => {
      const dateStr = e.source === "رصيد افتتاحي" ? "-" : formatDate(e.date);
      if (isForeign) {
        return [dateStr, e.description, e.reference, e.source, e.exchangeRate, e.debitForeign, e.creditForeign, e.balanceForeign, e.debit, e.credit, e.balanceEGP];
      }
      return [dateStr, e.description, e.reference, e.source, e.exchangeRate, e.debit || 0, e.credit || 0, e.balanceEGP];
    });
    if (isForeign) {
      rows.push(["", "الإجمالي", "", "", "", totalDebitF, totalCreditF, totalDebitF - totalCreditF, totalDebit, totalCredit, totalDebit - totalCredit]);
    } else {
      rows.push(["", "الإجمالي", "", "", "", totalDebit, totalCredit, totalDebit - totalCredit]);
    }
    exportToExcel(headers, rows, `كشف_حساب_${selectedAccount.code}_${selectedAccount.name}`, {
      title: `كشف حساب تحليلي: ${selectedAccount.code} - ${selectedAccount.name}`,
      subtitle: `العملة: ${accountCurrency} | تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")}`,
    });
  };

  const accountOptions = accounts.map(a => ({
    value: a.id,
    label: `${a.code} - ${a.name}${a.currency !== "EGP" ? ` (${a.currency})` : ""}`,
  }));

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              كشف حساب تحليلي
            </h1>
            <p className="text-muted-foreground">استعراض كافة الحركات المالية لأي حساب في شجرة الحسابات</p>
          </div>
          {entriesWithBalance.length > 0 && (
            <Button variant="outline" className="gap-2" onClick={handleExport}>
              <Download className="w-4 h-4" />
              تصدير Excel
            </Button>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <label className="block text-sm font-medium mb-2">اختر الحساب</label>
          <div className="max-w-md">
            <SearchableSelect
              options={accountOptions}
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
              placeholder="ابحث واختر حساب..."
            />
          </div>
          {selectedAccount && (
            <div className="flex items-center gap-3 mt-3">
              <Badge variant="outline">{selectedAccount.code}</Badge>
              <span className="font-semibold">{selectedAccount.name}</span>
              <Badge variant="secondary">{selectedAccount.currency}</Badge>
              {isForeign && (
                <Badge variant="outline">المعامل: {selectedAccount.exchange_rate}</Badge>
              )}
            </div>
          )}
        </div>

        {!selectedAccountId ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">اختر حساب لعرض كشف الحساب</h3>
            <p className="text-muted-foreground">استخدم مربع البحث أعلاه لاختيار أي حساب من شجرة الحسابات</p>
          </div>
        ) : loadingEntries ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="mr-3 text-muted-foreground">جاري تحميل البيانات...</span>
          </div>
        ) : entriesWithBalance.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد حركات</h3>
            <p className="text-muted-foreground">لم يتم العثور على حركات مالية لهذا الحساب</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-2 bg-card rounded-lg border border-border text-sm text-muted-foreground">
              عدد الحركات: <span className="font-bold text-foreground">{entriesWithBalance.length}</span>
              {" | "}
              صافي الرصيد: <span className="font-bold text-primary">
                {isForeign
                  ? formatCurr(totalDebitF - totalCreditF, accountCurrency)
                  : formatEGP(totalDebit - totalCredit)}
              </span>
              {isForeign && (
                <span className="text-muted-foreground mr-2">({formatEGP(totalDebit - totalCredit)})</span>
              )}
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead>التاريخ</TableHead>
                    <TableHead>البيان</TableHead>
                    <TableHead>المرجع</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead className="text-center">العملة</TableHead>
                    <TableHead className="text-center">المعامل</TableHead>
                    {isForeign ? (
                      <>
                        <TableHead className="text-center">مدين ({accountCurrency})</TableHead>
                        <TableHead className="text-center">دائن ({accountCurrency})</TableHead>
                        <TableHead className="text-center">الرصيد ({accountCurrency})</TableHead>
                        <TableHead className="text-center">مدين (ج.م)</TableHead>
                        <TableHead className="text-center">دائن (ج.م)</TableHead>
                        <TableHead className="text-center">الرصيد (ج.م)</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="text-center">مدين</TableHead>
                        <TableHead className="text-center">دائن</TableHead>
                        <TableHead className="text-center">الرصيد</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entriesWithBalance.map((entry, i) => (
                    <TableRow key={i} className="hover:bg-muted/50">
                      <TableCell className="whitespace-nowrap">{formatDate(entry.date)}</TableCell>
                      <TableCell className="text-sm">{entry.description}</TableCell>
                      <TableCell className="font-mono text-sm">{entry.reference}</TableCell>
                      <TableCell>
                        {entry.journalEntryId ? (
                          <Badge
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                            onClick={async () => {
                              const { data } = await supabase
                                .from("journal_entries")
                                .select("*, journal_entry_lines(*, accounts(code, name))")
                                .eq("id", entry.journalEntryId!)
                                .single();
                              if (data) setViewJournalEntry(data);
                            }}
                          >
                            {entry.source}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">{entry.source}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">{entry.currency}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono">{entry.exchangeRate}</TableCell>
                      {isForeign ? (
                        <>
                          <TableCell className={`text-center ${entry.debitForeign > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                            {entry.debitForeign > 0 ? formatCurr(entry.debitForeign, accountCurrency) : "-"}
                          </TableCell>
                          <TableCell className={`text-center ${entry.creditForeign > 0 ? "font-semibold text-green-600" : "text-muted-foreground"}`}>
                            {entry.creditForeign > 0 ? formatCurr(entry.creditForeign, accountCurrency) : "-"}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {formatCurr(entry.balanceForeign, accountCurrency)}
                          </TableCell>
                          <TableCell className={`text-center text-xs ${entry.debit > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {entry.debit > 0 ? formatEGP(entry.debit) : "-"}
                          </TableCell>
                          <TableCell className={`text-center text-xs ${entry.credit > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                            {entry.credit > 0 ? formatEGP(entry.credit) : "-"}
                          </TableCell>
                          <TableCell className="text-center font-bold text-xs">
                            {formatEGP(entry.balanceEGP)}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className={`text-center ${entry.debit > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                            {entry.debit > 0 ? formatEGP(entry.debit) : "-"}
                          </TableCell>
                          <TableCell className={`text-center ${entry.credit > 0 ? "font-semibold text-green-600" : "text-muted-foreground"}`}>
                            {entry.credit > 0 ? formatEGP(entry.credit) : "-"}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {formatEGP(entry.balanceEGP)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/5 font-bold">
                    <TableCell colSpan={4} className="text-center">الإجمالي</TableCell>
                    <TableCell></TableCell>
                    {isForeign ? (
                      <>
                        <TableCell></TableCell>
                        <TableCell className="text-center text-destructive">{formatCurr(totalDebitF, accountCurrency)}</TableCell>
                        <TableCell className="text-center text-green-600">{formatCurr(totalCreditF, accountCurrency)}</TableCell>
                        <TableCell className="text-center text-primary text-lg">{formatCurr(totalDebitF - totalCreditF, accountCurrency)}</TableCell>
                        <TableCell className="text-center text-destructive text-xs">{formatEGP(totalDebit)}</TableCell>
                        <TableCell className="text-center text-green-600 text-xs">{formatEGP(totalCredit)}</TableCell>
                        <TableCell className="text-center text-primary">{formatEGP(totalDebit - totalCredit)}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-center text-destructive">{formatEGP(totalDebit)}</TableCell>
                        <TableCell className="text-center text-green-600">{formatEGP(totalCredit)}</TableCell>
                        <TableCell className="text-center text-primary text-lg">{formatEGP(totalDebit - totalCredit)}</TableCell>
                      </>
                    )}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {viewJournalEntry && (
        <JournalEntryDialog
          open={!!viewJournalEntry}
          onOpenChange={(o) => { if (!o) setViewJournalEntry(null); }}
          editData={viewJournalEntry}
          readOnly
        />
      )}
    </MainLayout>
  );
};

export default AccountLedgerReport;