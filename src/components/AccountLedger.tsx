import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Download, ExternalLink } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/exportExcel";
import { JournalEntryDialog } from "@/components/journal/JournalEntryDialog";

interface AccountLedgerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
  accountCode: string;
}

interface LedgerEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  debitForeign: number;
  creditForeign: number;
  reference: string;
  source: string;
  journalEntryId: string | null;
  exchangeRate: number;
  currency: string;
}

export function AccountLedger({ open, onOpenChange, accountId, accountName, accountCode }: AccountLedgerProps) {
  const [viewJournalEntry, setViewJournalEntry] = useState<any>(null);
  const queryClient = useQueryClient();
  const formatEGP = (amount: number) =>
    amount === 0 ? "-" : new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);
  const formatCurr = (amount: number, curr: string) =>
    amount === 0 ? "-" : new Intl.NumberFormat("ar-EG", { style: "currency", currency: curr }).format(amount);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("ar-EG");

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ["account_ledger", accountId],
    enabled: open && !!accountId,
    queryFn: async () => {
      // Get account currency info
      const { data: accData } = await supabase
        .from("accounts")
        .select("currency, exchange_rate, opening_balance_debit, opening_balance_credit")
        .eq("id", accountId)
        .single();

      const accountCurrency = accData?.currency || "EGP";
      const accountRate = Number(accData?.exchange_rate) || 1;
      const isForeign = accountCurrency !== "EGP";

      const results: LedgerEntry[] = [];

      // Opening balance
      const obDebit = Number(accData?.opening_balance_debit) || 0;
      const obCredit = Number(accData?.opening_balance_credit) || 0;
      if (obDebit > 0 || obCredit > 0) {
        results.push({
          date: "0001-01-01",
          description: "رصيد افتتاحي",
          debit: obDebit,
          credit: obCredit,
          debitForeign: isForeign ? obDebit / accountRate : obDebit,
          creditForeign: isForeign ? obCredit / accountRate : obCredit,
          reference: "-",
          source: "رصيد افتتاحي",
          journalEntryId: null,
          exchangeRate: accountRate,
          currency: accountCurrency,
        });
      }

      // Get all journal entry lines for this account
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select("debit, credit, description, journal_entry_id")
        .eq("account_id", accountId);

      if (lines && lines.length > 0) {
        const jeIds = [...new Set(lines.map((l) => l.journal_entry_id))];
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

        const jeMap = new Map(allEntries.map((je) => [je.id, je]));

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
            debitForeign: isForeign ? d / jeRate : d,
            creditForeign: isForeign ? c / jeRate : c,
            reference: je.number,
            source,
            journalEntryId: je.id,
            exchangeRate: jeRate,
            currency: je.currency || "EGP",
          });
        }
      }

      results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return { entries: results, accountCurrency, accountRate };
    },
  });

  const entries = ledgerData?.entries || [];
  const accountCurrency = ledgerData?.accountCurrency || "EGP";
  const isForeign = accountCurrency !== "EGP";

  // Running balances
  let runEGP = 0, runF = 0;
  const entriesWithBalance = entries.map((entry) => {
    runEGP += entry.debit - entry.credit;
    runF += entry.debitForeign - entry.creditForeign;
    return { ...entry, balanceEGP: runEGP, balanceForeign: runF };
  });

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const totalDebitF = entries.reduce((s, e) => s + e.debitForeign, 0);
  const totalCreditF = entries.reduce((s, e) => s + e.creditForeign, 0);

  const handleExportExcel = () => {
    const headers = isForeign
      ? ["التاريخ", "البيان", "المرجع", "النوع", `مدين (${accountCurrency})`, `دائن (${accountCurrency})`, `الرصيد (${accountCurrency})`, "مدين (ج.م)", "دائن (ج.م)", "الرصيد (ج.م)"]
      : ["التاريخ", "البيان", "المرجع", "النوع", "مدين", "دائن", "الرصيد"];
    const rows = entriesWithBalance.map((e) => {
      const dateStr = e.source === "رصيد افتتاحي" ? "-" : formatDate(e.date);
      if (isForeign) {
        return [dateStr, e.description, e.reference, e.source, e.debitForeign, e.creditForeign, e.balanceForeign, e.debit, e.credit, e.balanceEGP];
      }
      return [dateStr, e.description, e.reference, e.source, e.debit || 0, e.credit || 0, e.balanceEGP];
    });
    if (isForeign) {
      rows.push(["", "الإجمالي", "", "", totalDebitF, totalCreditF, totalDebitF - totalCreditF, totalDebit, totalCredit, totalDebit - totalCredit]);
    } else {
      rows.push(["", "الإجمالي", "", "", totalDebit, totalCredit, totalDebit - totalCredit]);
    }
    exportToExcel(headers, rows, `كشف_حساب_${accountCode}_${accountName}`, {
      title: `كشف حساب تحليلي: ${accountCode} - ${accountName}`,
      subtitle: `العملة: ${accountCurrency} | تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${isForeign ? "max-w-5xl" : "max-w-4xl"} max-h-[85vh] overflow-y-auto`}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              كشف حساب تحليلي: {accountCode} - {accountName}
            </DialogTitle>
            {entriesWithBalance.length > 0 && (
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}>
                <Download className="w-4 h-4" />
                تصدير Excel
              </Button>
            )}
          </div>
          {isForeign && (
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline">العملة: {accountCurrency}</Badge>
              <Badge variant="outline">المعامل: {ledgerData?.accountRate}</Badge>
            </div>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : entriesWithBalance.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            لا توجد حركات مالية لهذا الحساب
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap">
                    {entry.source === "رصيد افتتاحي" ? "-" : formatDate(entry.date)}
                  </TableCell>
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
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={4} className="text-center">الإجمالي</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                {isForeign ? (
                  <>
                    <TableCell className="text-center text-destructive">{formatCurr(totalDebitF, accountCurrency)}</TableCell>
                    <TableCell className="text-center text-green-600">{formatCurr(totalCreditF, accountCurrency)}</TableCell>
                    <TableCell className="text-center text-primary text-lg">{formatCurr(totalDebitF - totalCreditF, accountCurrency)}</TableCell>
                    <TableCell className="text-center text-destructive text-xs">{formatEGP(totalDebit)}</TableCell>
                    <TableCell className="text-center text-green-600 text-xs">{formatEGP(totalCredit)}</TableCell>
                    <TableCell className="text-center text-primary">{formatEGP(totalDebit - totalCredit)}</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="text-center text-destructive">{formatEGP(totalDebit)}</TableCell>
                    <TableCell className="text-center text-green-600">{formatEGP(totalCredit)}</TableCell>
                    <TableCell className="text-center text-primary text-lg">{formatEGP(totalDebit - totalCredit)}</TableCell>
                  </>
                )}
              </TableRow>
            </TableBody>
          </Table>
        )}
      </DialogContent>

      {viewJournalEntry && (
        <JournalEntryDialog
          open={!!viewJournalEntry}
          onOpenChange={(o) => { if (!o) setViewJournalEntry(null); }}
          editData={viewJournalEntry}
          readOnly
        />
      )}
    </Dialog>
  );
}