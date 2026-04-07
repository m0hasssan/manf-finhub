import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/exportExcel";

interface AccountStatementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partyId: string;
  partyName: string;
  type: "customer" | "supplier";
}

interface StatementEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  reference: string;
  source: string;
  currency: string;
  exchange_rate: number;
  debit_foreign: number;
  credit_foreign: number;
}

export function AccountStatement({ open, onOpenChange, partyId, partyName, type }: AccountStatementProps) {
  const formatEGP = (amount: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);
  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency }).format(amount);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("ar-EG");

  const { data: statementData, isLoading } = useQuery({
    queryKey: ["account_statement", type, partyId],
    enabled: open && !!partyId,
    queryFn: async () => {
      // Get party's account info (currency & exchange_rate)
      const table = type === "customer" ? "customers" : "suppliers";
      const { data: partyData } = await supabase
        .from(table)
        .select("account_id, opening_balance")
        .eq("id", partyId)
        .single();

      let accountCurrency = "EGP";
      let accountExchangeRate = 1;

      if (partyData?.account_id) {
        const { data: accData } = await supabase
          .from("accounts")
          .select("currency, exchange_rate")
          .eq("id", partyData.account_id)
          .single();
        if (accData) {
          accountCurrency = accData.currency;
          accountExchangeRate = Number(accData.exchange_rate) || 1;
        }
      }

      const results: StatementEntry[] = [];

      // Add opening balance as first entry
      const openingBalance = Number((partyData as any)?.opening_balance) || 0;
      if (openingBalance !== 0) {
        const absBalance = Math.abs(openingBalance);
        const absBalanceForeign = accountCurrency !== "EGP" && accountExchangeRate > 0 ? absBalance / accountExchangeRate : absBalance;
        let obDebit = 0, obCredit = 0, obDebitF = 0, obCreditF = 0;
        if (type === "customer") {
          if (openingBalance > 0) { obDebit = absBalance; obDebitF = absBalanceForeign; }
          else { obCredit = absBalance; obCreditF = absBalanceForeign; }
        } else {
          if (openingBalance > 0) { obCredit = absBalance; obCreditF = absBalanceForeign; }
          else { obDebit = absBalance; obDebitF = absBalanceForeign; }
        }
        results.push({
          date: "0001-01-01",
          description: "رصيد افتتاحي",
          debit: obDebit, credit: obCredit,
          debit_foreign: obDebitF, credit_foreign: obCreditF,
          reference: "-", source: "رصيد افتتاحي",
          currency: accountCurrency, exchange_rate: accountExchangeRate,
        });
      }

      if (type === "customer") {
        const { data: salesInvoices } = await supabase
          .from("sales_invoices")
          .select("date, number, total")
          .eq("customer_id", partyId)
          .eq("status", "accepted")
          .order("date", { ascending: true });
        salesInvoices?.forEach((inv) => {
          const totalEGP = Number(inv.total);
          const totalForeign = accountCurrency !== "EGP" && accountExchangeRate > 0 ? totalEGP / accountExchangeRate : totalEGP;
          results.push({
            date: inv.date,
            description: `فاتورة بيع رقم ${inv.number}`,
            debit: totalEGP, credit: 0,
            debit_foreign: totalForeign, credit_foreign: 0,
            reference: inv.number, source: "فاتورة بيع",
            currency: accountCurrency, exchange_rate: accountExchangeRate,
          });
        });

        const { data: receipts } = await supabase
          .from("cash_transactions")
          .select("date, reference, amount, description")
          .eq("customer_id", partyId)
          .eq("type", "receipt")
          .order("date", { ascending: true });
        receipts?.forEach((tx) => {
          const amountEGP = Number(tx.amount);
          const amountForeign = accountCurrency !== "EGP" && accountExchangeRate > 0 ? amountEGP / accountExchangeRate : amountEGP;
          results.push({
            date: tx.date,
            description: tx.description || `سند قبض رقم ${tx.reference}`,
            debit: 0, credit: amountEGP,
            debit_foreign: 0, credit_foreign: amountForeign,
            reference: tx.reference, source: "سند قبض",
            currency: accountCurrency, exchange_rate: accountExchangeRate,
          });
        });

        const { data: partyEntries } = await supabase
          .from("journal_entries")
          .select("id, date, number, description, currency, exchange_rate, journal_entry_lines(debit, credit, account_id)")
          .eq("reference_type", "party_customer")
          .eq("reference_id", partyId)
          .eq("status", "posted")
          .order("date", { ascending: true });

        for (const je of partyEntries || []) {
          if (partyData?.account_id) {
            const line = je.journal_entry_lines?.find((l: any) => l.account_id === partyData.account_id);
            if (line) {
              const debitEGP = Number(line.debit) || 0;
              const creditEGP = Number(line.credit) || 0;
              const jeRate = Number(je.exchange_rate) || 1;
              const jeCurrency = je.currency || "EGP";
              const debitForeign = jeCurrency !== "EGP" && jeRate > 0 ? debitEGP / jeRate : debitEGP;
              const creditForeign = jeCurrency !== "EGP" && jeRate > 0 ? creditEGP / jeRate : creditEGP;
              results.push({
                date: je.date,
                description: `قيد يومية ${je.number} - ${je.description}`,
                debit: debitEGP, credit: creditEGP,
                debit_foreign: debitForeign, credit_foreign: creditForeign,
                reference: je.number, source: "قيد أطراف",
                currency: jeCurrency, exchange_rate: jeRate,
              });
            }
          }
        }
      } else {
        const { data: purchaseInvoices } = await supabase
          .from("purchase_invoices")
          .select("date, number, total")
          .eq("supplier_id", partyId)
          .eq("status", "accepted")
          .order("date", { ascending: true });
        purchaseInvoices?.forEach((inv) => {
          const totalEGP = Number(inv.total);
          const totalForeign = accountCurrency !== "EGP" && accountExchangeRate > 0 ? totalEGP / accountExchangeRate : totalEGP;
          results.push({
            date: inv.date,
            description: `فاتورة شراء رقم ${inv.number}`,
            debit: 0, credit: totalEGP,
            debit_foreign: 0, credit_foreign: totalForeign,
            reference: inv.number, source: "فاتورة شراء",
            currency: accountCurrency, exchange_rate: accountExchangeRate,
          });
        });

        const { data: payments } = await supabase
          .from("cash_transactions")
          .select("date, reference, amount, description")
          .eq("supplier_id", partyId)
          .eq("type", "payment")
          .order("date", { ascending: true });
        payments?.forEach((tx) => {
          const amountEGP = Number(tx.amount);
          const amountForeign = accountCurrency !== "EGP" && accountExchangeRate > 0 ? amountEGP / accountExchangeRate : amountEGP;
          results.push({
            date: tx.date,
            description: tx.description || `سند صرف رقم ${tx.reference}`,
            debit: amountEGP, credit: 0,
            debit_foreign: amountForeign, credit_foreign: 0,
            reference: tx.reference, source: "سند صرف",
            currency: accountCurrency, exchange_rate: accountExchangeRate,
          });
        });

        const { data: partyEntries } = await supabase
          .from("journal_entries")
          .select("id, date, number, description, currency, exchange_rate, journal_entry_lines(debit, credit, account_id)")
          .eq("reference_type", "party_supplier")
          .eq("reference_id", partyId)
          .eq("status", "posted")
          .order("date", { ascending: true });

        for (const je of partyEntries || []) {
          if (partyData?.account_id) {
            const line = je.journal_entry_lines?.find((l: any) => l.account_id === partyData.account_id);
            if (line) {
              const debitEGP = Number(line.debit) || 0;
              const creditEGP = Number(line.credit) || 0;
              const jeRate = Number(je.exchange_rate) || 1;
              const jeCurrency = je.currency || "EGP";
              const debitForeign = jeCurrency !== "EGP" && jeRate > 0 ? debitEGP / jeRate : debitEGP;
              const creditForeign = jeCurrency !== "EGP" && jeRate > 0 ? creditEGP / jeRate : creditEGP;
              results.push({
                date: je.date,
                description: `قيد يومية ${je.number} - ${je.description}`,
                debit: debitEGP, credit: creditEGP,
                debit_foreign: debitForeign, credit_foreign: creditForeign,
                reference: je.number, source: "قيد أطراف",
                currency: jeCurrency, exchange_rate: jeRate,
              });
            }
          }
        }
      }

      results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return { entries: results, accountCurrency, accountExchangeRate };
    },
  });

  const entries = statementData?.entries || [];
  const accountCurrency = statementData?.accountCurrency || "EGP";
  const accountExchangeRate = statementData?.accountExchangeRate || 1;
  const isMultiCurrency = accountCurrency !== "EGP";

  // Calculate running balances
  let runningBalanceEGP = 0;
  let runningBalanceForeign = 0;
  const entriesWithBalance = entries.map((entry) => {
    runningBalanceEGP += entry.debit - entry.credit;
    runningBalanceForeign += entry.debit_foreign - entry.credit_foreign;
    return { ...entry, balanceEGP: runningBalanceEGP, balanceForeign: runningBalanceForeign };
  });

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const totalDebitForeign = entries.reduce((s, e) => s + e.debit_foreign, 0);
  const totalCreditForeign = entries.reduce((s, e) => s + e.credit_foreign, 0);

  const handleExportExcel = () => {
    const headers = isMultiCurrency
      ? ["التاريخ", "البيان", "النوع", `مدين (${accountCurrency})`, `دائن (${accountCurrency})`, `الرصيد (${accountCurrency})`, "المعامل", "مدين (ج.م)", "دائن (ج.م)", "الرصيد (ج.م)"]
      : ["التاريخ", "البيان", "النوع", "مدين (ج.م)", "دائن (ج.م)", "الرصيد (ج.م)"];
    const rows = entriesWithBalance.map((e) => {
      const dateStr = e.source === "رصيد افتتاحي" ? "-" : new Date(e.date).toLocaleDateString("ar-EG");
      if (isMultiCurrency) {
        return [dateStr, e.description, e.source, e.debit_foreign || 0, e.credit_foreign || 0, e.balanceForeign, e.exchange_rate, e.debit || 0, e.credit || 0, e.balanceEGP];
      }
      return [dateStr, e.description, e.source, e.debit || 0, e.credit || 0, e.balanceEGP];
    });
    exportToExcel(headers, rows, `كشف_حساب_${partyName}`, { title: `كشف حساب: ${partyName}`, subtitle: `تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")}` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${isMultiCurrency ? "max-w-5xl" : "max-w-3xl"} max-h-[85vh] overflow-y-auto`}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              كشف حساب: {partyName}
            </DialogTitle>
            {entriesWithBalance.length > 0 && (
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}>
                <Download className="w-4 h-4" />
                تصدير Excel
              </Button>
            )}
          </div>
          {isMultiCurrency && (
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className="gap-1">
                العملة: {accountCurrency}
              </Badge>
              <Badge variant="outline" className="gap-1">
                المعامل: {accountExchangeRate}
              </Badge>
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
                <TableHead>النوع</TableHead>
                {isMultiCurrency && (
                  <>
                    <TableHead className="text-center">مدين ({accountCurrency})</TableHead>
                    <TableHead className="text-center">دائن ({accountCurrency})</TableHead>
                    <TableHead className="text-center">الرصيد ({accountCurrency})</TableHead>
                    <TableHead className="text-center">المعامل</TableHead>
                  </>
                )}
                <TableHead className="text-center">مدين (ج.م)</TableHead>
                <TableHead className="text-center">دائن (ج.م)</TableHead>
                <TableHead className="text-center">الرصيد (ج.م)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entriesWithBalance.map((entry, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap">{entry.source === "رصيد افتتاحي" ? "-" : formatDate(entry.date)}</TableCell>
                  <TableCell className="text-sm">{entry.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{entry.source}</Badge>
                  </TableCell>
                  {isMultiCurrency && (
                    <>
                      <TableCell className={`text-center ${entry.debit_foreign > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                        {entry.debit_foreign > 0 ? formatAmount(entry.debit_foreign, accountCurrency) : "-"}
                      </TableCell>
                      <TableCell className={`text-center ${entry.credit_foreign > 0 ? "font-semibold text-green-600" : "text-muted-foreground"}`}>
                        {entry.credit_foreign > 0 ? formatAmount(entry.credit_foreign, accountCurrency) : "-"}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {formatAmount(entry.balanceForeign, accountCurrency)}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground text-xs">
                        {entry.exchange_rate}
                      </TableCell>
                    </>
                  )}
                  <TableCell className={`text-center ${entry.debit > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                    {entry.debit > 0 ? formatEGP(entry.debit) : "-"}
                  </TableCell>
                  <TableCell className={`text-center ${entry.credit > 0 ? "font-semibold text-green-600" : "text-muted-foreground"}`}>
                    {entry.credit > 0 ? formatEGP(entry.credit) : "-"}
                  </TableCell>
                  <TableCell className="text-center font-bold">
                    {formatEGP(entry.balanceEGP)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={3} className="text-center">الإجمالي</TableCell>
                {isMultiCurrency && (
                  <>
                    <TableCell className="text-center text-destructive">{formatAmount(totalDebitForeign, accountCurrency)}</TableCell>
                    <TableCell className="text-center text-green-600">{formatAmount(totalCreditForeign, accountCurrency)}</TableCell>
                    <TableCell className="text-center text-primary text-lg">{formatAmount(totalDebitForeign - totalCreditForeign, accountCurrency)}</TableCell>
                    <TableCell></TableCell>
                  </>
                )}
                <TableCell className="text-center text-destructive">{formatEGP(totalDebit)}</TableCell>
                <TableCell className="text-center text-green-600">{formatEGP(totalCredit)}</TableCell>
                <TableCell className="text-center text-primary text-lg">{formatEGP(totalDebit - totalCredit)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
