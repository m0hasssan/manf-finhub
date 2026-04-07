import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Scale, Download, Loader2, Eye, ExternalLink } from "lucide-react";
import { useTrialBalance } from "@/hooks/useTrialBalance";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/exportExcel";

interface AccountDetail {
  date: string;
  description: string;
  debit: number;
  credit: number;
  source: string;
  referenceType?: string | null;
  referenceId?: string | null;
  journalEntryId?: string | null;
  entryNumber?: string;
  currency?: string;
  exchangeRate?: number;
}

const TrialBalance = () => {
  const navigate = useNavigate();
  const { data: allTrialBalanceData = [], isLoading } = useTrialBalance();

  // Show only leaf accounts (no children)
  const trialBalanceData = allTrialBalanceData.filter(
    (row) => !allTrialBalanceData.some(
      (other) => other.code !== row.code && other.code.startsWith(row.code) && other.code.length > row.code.length
    )
  );
  const [selectedAccount, setSelectedAccount] = useState<{ code: string; name: string } | null>(null);

  const { data: accountDetails = [], isLoading: detailsLoading } = useQuery({
    queryKey: ["account_details", selectedAccount?.code],
    enabled: !!selectedAccount,
    queryFn: async () => {
      if (!selectedAccount) return [];

      const code = selectedAccount.code;
      const details: AccountDetail[] = [];

      // Get the account from DB
      const { data: account } = await supabase
        .from("accounts")
        .select("id, opening_balance_debit, opening_balance_credit, exchange_rate, currency")
        .eq("code", code)
        .single();

      if (!account) return [];
      const accCurrency = (account as any).currency || "EGP";
      const accRate = Number(account.exchange_rate) || 1;

      // Add opening balance debit if non-zero
      const obDebit = Number((account as any).opening_balance_debit || 0);
      const obCredit = Number((account as any).opening_balance_credit || 0);
      if (obDebit !== 0 || obCredit !== 0) {
        const isForeignOB = accCurrency !== "EGP";
        details.push({
          date: "-",
          description: "رصيد افتتاحي",
          debit: isForeignOB ? obDebit * accRate : obDebit,
          credit: isForeignOB ? obCredit * accRate : obCredit,
          source: "رصيد افتتاحي",
          currency: accCurrency,
          exchangeRate: accRate,
        });
      }

      // Check for linked parties (customers/suppliers/employees) opening balances
      const [{ data: customers }, { data: suppliers }] = await Promise.all([
        supabase.from("customers").select("name, opening_balance").eq("account_id", account.id),
        supabase.from("suppliers").select("name, opening_balance").eq("account_id", account.id),
      ]);

      for (const c of customers || []) {
        const cob = Number(c.opening_balance || 0);
        if (cob !== 0) {
          // opening_balance is already stored in EGP, no conversion needed
          const egpDebit = cob > 0 ? cob : 0;
          const egpCredit = cob < 0 ? Math.abs(cob) : 0;
          details.push({
            date: "-",
            description: `رصيد افتتاحي - ${c.name}`,
            debit: egpDebit,
            credit: egpCredit,
            source: "رصيد افتتاحي",
            currency: accCurrency,
            exchangeRate: accRate,
          });
        }
      }
      for (const s of suppliers || []) {
        const sob = Number(s.opening_balance || 0);
        if (sob !== 0) {
          // opening_balance is already stored in EGP, no conversion needed
          const egpDebit = sob > 0 ? sob : 0;
          const egpCredit = sob < 0 ? Math.abs(sob) : 0;
          details.push({
            date: "-",
            description: `رصيد افتتاحي - ${s.name}`,
            debit: egpDebit,
            credit: egpCredit,
            source: "رصيد افتتاحي",
            currency: accCurrency,
            exchangeRate: accRate,
          });
        }
      }

      // Fetch ALL journal entry lines for this account
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select("debit, credit, description, journal_entry_id, journal_entries!inner(id, number, date, description, reference_type, reference_id, status, currency, exchange_rate)")
        .eq("account_id", account.id);

      for (const line of lines || []) {
        const je = (line as any).journal_entries;
        if (!je || je.status !== "posted") continue;
        
        let source = "قيد يومية";
        const refType = je.reference_type;
        if (refType === "sales_invoice") source = "فاتورة مبيعات";
        else if (refType === "purchase_invoice") source = "فاتورة مشتريات";
        else if (refType === "cash_receipt") source = "سند قبض";
        else if (refType === "cash_payment") source = "سند صرف";
        else if (refType === "custody") source = "عهدة";
        else if (refType === "custody_settlement") source = "تسوية عهدة";
        else if (refType === "check") source = "شيك";
        else if (refType === "inventory_movement") source = "حركة مخزون";

        details.push({
          date: je.date,
          description: line.description || je.description || `قيد ${je.number}`,
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
          source,
          referenceType: je.reference_type,
          referenceId: je.reference_id,
          journalEntryId: je.id,
          entryNumber: je.number,
          currency: je.currency || "EGP",
          exchangeRate: Number(je.exchange_rate) || 1,
        });
      }

      // Also fetch cash transactions directly linked to this account
      const { data: cashTxns } = await supabase
        .from("cash_transactions")
        .select("*, customers(name), suppliers(name)")
        .eq("account_id", account.id);

      // Only add cash txns if no journal entries cover them (avoid duplicates)
      const hasJournalLines = (lines || []).length > 0;
      if (!hasJournalLines) {
        for (const txn of cashTxns || []) {
          const partyName = (txn as any).customers?.name || (txn as any).suppliers?.name || "";
          details.push({
            date: txn.date,
            description: `${txn.type === "receipt" ? "سند قبض" : "سند صرف"} ${txn.reference} - ${txn.description}${partyName ? ` (${partyName})` : ""}`,
            debit: txn.type === "receipt" ? 0 : Number(txn.amount),
            credit: txn.type === "receipt" ? Number(txn.amount) : 0,
            source: txn.type === "receipt" ? "سند قبض" : "سند صرف",
          });
        }
      }

      // Sort by date descending
      details.sort((a, b) => {
        if (a.date === "-") return -1;
        if (b.date === "-") return 1;
        return a.date.localeCompare(b.date);
      });

      return details;
    },
  });

  const formatCurrency = (amount: number) => {
    if (amount === 0) return "-";
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
    }).format(amount);
  };

  const formatFC = (amount: number, currency: string) => {
    if (amount === 0) return "-";
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (dateStr === "-") return "رصيد افتتاحي";
    return new Date(dateStr).toLocaleDateString("ar-EG");
  };

  const handleSourceClick = (detail: AccountDetail) => {
    const { referenceType, referenceId } = detail;
    if (!referenceType || !referenceId) {
      // For manual journal entries, navigate to journal page
      if (detail.journalEntryId) {
        navigate("/reports/journal");
      }
      return;
    }
    switch (referenceType) {
      case "sales_invoice":
        navigate("/invoices/confirmed-sales");
        break;
      case "purchase_invoice":
        navigate("/invoices/confirmed-purchases");
        break;
      case "cash_receipt":
      case "cash_payment":
        navigate("/treasury/cash");
        break;
      case "custody":
      case "custody_settlement":
        navigate("/custody");
        break;
      case "check":
        navigate("/treasury/checks");
        break;
      case "inventory_movement":
        navigate("/inventory/movements");
        break;
      default:
        navigate("/reports/journal");
    }
  };

  const isClickableSource = (detail: AccountDetail) => {
    return !!detail.referenceType || !!detail.journalEntryId;
  };

  const totals = trialBalanceData.reduce(
    (acc, row) => ({
      debitOpening: acc.debitOpening + row.debitOpening,
      creditOpening: acc.creditOpening + row.creditOpening,
      debitMovement: acc.debitMovement + row.debitMovement,
      creditMovement: acc.creditMovement + row.creditMovement,
      debitClosing: acc.debitClosing + row.debitClosing,
      creditClosing: acc.creditClosing + row.creditClosing,
    }),
    { debitOpening: 0, creditOpening: 0, debitMovement: 0, creditMovement: 0, debitClosing: 0, creditClosing: 0 }
  );

  const detailTotals = accountDetails.reduce(
    (acc, d) => {
      const isForeign = d.currency && d.currency !== "EGP";
      const fcDebit = isForeign && d.debit > 0 ? d.debit / (d.exchangeRate || 1) : 0;
      const fcCredit = isForeign && d.credit > 0 ? d.credit / (d.exchangeRate || 1) : 0;
      return {
        debit: acc.debit + d.debit,
        credit: acc.credit + d.credit,
        fcDebit: acc.fcDebit + fcDebit,
        fcCredit: acc.fcCredit + fcCredit,
      };
    },
    { debit: 0, credit: 0, fcDebit: 0, fcCredit: 0 }
  );
  const detailForeignCurrency = accountDetails.find(d => d.currency && d.currency !== "EGP")?.currency || "USD";

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="w-6 h-6 text-primary" />
              ميزان المراجعة
            </h1>
            <p className="text-muted-foreground">بيانات فعلية من جميع الحركات المالية - اضغط على أي حساب لعرض التفاصيل</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => {
            const headers = ["الكود", "اسم الحساب", "العملة", "المعامل", "مدين أول المدة (ج.م)", "دائن أول المدة (ج.م)", "مدين أول المدة (عملة)", "دائن أول المدة (عملة)", "مدين الحركة (ج.م)", "دائن الحركة (ج.م)", "مدين الحركة (عملة)", "دائن الحركة (عملة)", "مدين آخر المدة (ج.م)", "دائن آخر المدة (ج.م)", "مدين آخر المدة (عملة)", "دائن آخر المدة (عملة)"];
            const rows = trialBalanceData.map((r) => [r.code, r.name, r.currency, r.exchangeRate > 1 ? r.exchangeRate : "", r.debitOpening, r.creditOpening, r.fcDebitOpening || "", r.fcCreditOpening || "", r.debitMovement, r.creditMovement, r.fcDebitMovement || "", r.fcCreditMovement || "", r.debitClosing, r.creditClosing, r.fcDebitClosing || "", r.fcCreditClosing || ""]);
            rows.push(["", "الإجمالي", "", "", totals.debitOpening, totals.creditOpening, "", "", totals.debitMovement, totals.creditMovement, "", "", totals.debitClosing, totals.creditClosing, "", ""]);
            exportToExcel(headers, rows, "ميزان_المراجعة", { title: "ميزان المراجعة", subtitle: `تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")}` });
          }}>
            <Download className="w-4 h-4" />
            تصدير Excel
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="mr-3 text-muted-foreground">جاري تحميل البيانات...</span>
          </div>
        ) : trialBalanceData.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد بيانات</h3>
            <p className="text-muted-foreground">لم يتم العثور على حسابات بها حركات.</p>
          </div>
        ) : (
          <>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead rowSpan={2} className="border-l">الكود</TableHead>
                    <TableHead rowSpan={2} className="border-l">اسم الحساب</TableHead>
                    <TableHead rowSpan={2} className="border-l text-center">العملة</TableHead>
                    <TableHead rowSpan={2} className="border-l text-center">المعامل</TableHead>
                    <TableHead colSpan={2} className="text-center border-l">رصيد أول المدة (ج.م)</TableHead>
                    <TableHead colSpan={2} className="text-center border-l">رصيد أول المدة (عملة)</TableHead>
                    <TableHead colSpan={2} className="text-center border-l">الحركة (ج.م)</TableHead>
                    <TableHead colSpan={2} className="text-center border-l">الحركة (عملة)</TableHead>
                    <TableHead colSpan={2} className="text-center border-l">رصيد آخر المدة (ج.م)</TableHead>
                    <TableHead colSpan={2} className="text-center border-l">رصيد آخر المدة (عملة)</TableHead>
                    <TableHead rowSpan={2} className="text-center border-l">الرصيد (عملة)</TableHead>
                    <TableHead rowSpan={2} className="text-center w-16">عرض</TableHead>
                  </TableRow>
                  <TableRow className="bg-muted">
                    <TableHead className="text-center border-l">مدين</TableHead>
                    <TableHead className="text-center border-l">دائن</TableHead>
                    <TableHead className="text-center border-l">مدين</TableHead>
                    <TableHead className="text-center border-l">دائن</TableHead>
                    <TableHead className="text-center border-l">مدين</TableHead>
                    <TableHead className="text-center border-l">دائن</TableHead>
                    <TableHead className="text-center border-l">مدين</TableHead>
                    <TableHead className="text-center border-l">دائن</TableHead>
                    <TableHead className="text-center border-l">مدين</TableHead>
                    <TableHead className="text-center border-l">دائن</TableHead>
                    <TableHead className="text-center border-l">مدين</TableHead>
                    <TableHead className="text-center border-l">دائن</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialBalanceData.map((row) => (
                    <TableRow
                      key={row.code}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedAccount({ code: row.code, name: row.name })}
                    >
                      <TableCell className="font-mono border-l">{row.code}</TableCell>
                      <TableCell className="border-l">{row.name}</TableCell>
                      <TableCell className="text-center border-l text-xs">{row.currency}</TableCell>
                      <TableCell className="text-center border-l text-xs">{row.exchangeRate > 1 ? row.exchangeRate : "-"}</TableCell>
                      <TableCell className="text-center border-l">{formatCurrency(row.debitOpening)}</TableCell>
                      <TableCell className="text-center border-l">{formatCurrency(row.creditOpening)}</TableCell>
                      <TableCell className="text-center border-l">{row.fcDebitOpening ? formatFC(row.fcDebitOpening, row.currency) : "-"}</TableCell>
                      <TableCell className="text-center border-l">{row.fcCreditOpening ? formatFC(row.fcCreditOpening, row.currency) : "-"}</TableCell>
                      <TableCell className="text-center border-l">{formatCurrency(row.debitMovement)}</TableCell>
                      <TableCell className="text-center border-l">{formatCurrency(row.creditMovement)}</TableCell>
                      <TableCell className="text-center border-l">{row.fcDebitMovement ? formatFC(row.fcDebitMovement, row.currency) : "-"}</TableCell>
                      <TableCell className="text-center border-l">{row.fcCreditMovement ? formatFC(row.fcCreditMovement, row.currency) : "-"}</TableCell>
                      <TableCell className="text-center border-l font-semibold">{formatCurrency(row.debitClosing)}</TableCell>
                      <TableCell className="text-center border-l font-semibold">{formatCurrency(row.creditClosing)}</TableCell>
                      <TableCell className="text-center border-l font-semibold">{row.fcDebitClosing ? formatFC(row.fcDebitClosing, row.currency) : "-"}</TableCell>
                      <TableCell className="text-center border-l font-semibold">{row.fcCreditClosing ? formatFC(row.fcCreditClosing, row.currency) : "-"}</TableCell>
                      <TableCell className="text-center border-l font-bold text-primary">
                        {(row.fcDebitClosing || row.fcCreditClosing) ? formatFC(Math.abs((row.fcDebitClosing || 0) - (row.fcCreditClosing || 0)), row.currency) : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="w-4 h-4 text-primary" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/5 font-bold">
                    <TableCell colSpan={4} className="border-l">الإجمالي</TableCell>
                    <TableCell className="text-center border-l">{formatCurrency(totals.debitOpening)}</TableCell>
                    <TableCell className="text-center border-l">{formatCurrency(totals.creditOpening)}</TableCell>
                    <TableCell className="text-center border-l">-</TableCell>
                    <TableCell className="text-center border-l">-</TableCell>
                    <TableCell className="text-center border-l">{formatCurrency(totals.debitMovement)}</TableCell>
                    <TableCell className="text-center border-l">{formatCurrency(totals.creditMovement)}</TableCell>
                    <TableCell className="text-center border-l">-</TableCell>
                    <TableCell className="text-center border-l">-</TableCell>
                    <TableCell className="text-center border-l text-primary">{formatCurrency(totals.debitClosing)}</TableCell>
                    <TableCell className="text-center border-l text-primary">{formatCurrency(totals.creditClosing)}</TableCell>
                    <TableCell className="text-center border-l">-</TableCell>
                    <TableCell className="text-center border-l">-</TableCell>
                    <TableCell className="text-center border-l">-</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className={`p-4 rounded-xl border ${Math.abs(totals.debitClosing - totals.creditClosing) < 0.01 ? 'bg-success-light border-success/20' : 'bg-danger-light border-danger/20'}`}>
              <p className={`font-semibold ${Math.abs(totals.debitClosing - totals.creditClosing) < 0.01 ? 'text-success' : 'text-danger'}`}>
                {Math.abs(totals.debitClosing - totals.creditClosing) < 0.01
                  ? "✓ الميزان متوازن - إجمالي المدين يساوي إجمالي الدائن"
                  : `✗ الميزان غير متوازن - الفرق: ${formatCurrency(Math.abs(totals.debitClosing - totals.creditClosing))}`}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Account Details Dialog */}
      <Dialog open={!!selectedAccount} onOpenChange={(open) => !open && setSelectedAccount(null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              تفاصيل حساب: {selectedAccount?.name} ({selectedAccount?.code})
            </DialogTitle>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="mr-2 text-muted-foreground">جاري التحميل...</span>
            </div>
          ) : accountDetails.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              لا توجد حركات مسجلة على هذا الحساب
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead>التاريخ</TableHead>
                  <TableHead>رقم القيد</TableHead>
                  <TableHead>البيان</TableHead>
                  <TableHead>المصدر</TableHead>
                  <TableHead className="text-center">العملة</TableHead>
                  <TableHead className="text-center">المعامل</TableHead>
                  <TableHead className="text-center w-28">مدين (ج.م)</TableHead>
                  <TableHead className="text-center w-28">دائن (ج.م)</TableHead>
                  <TableHead className="text-center w-28">الرصيد (ج.م)</TableHead>
                  <TableHead className="text-center w-28">مدين (عملة)</TableHead>
                  <TableHead className="text-center w-28">دائن (عملة)</TableHead>
                  <TableHead className="text-center w-28">الرصيد (عملة)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  let runningBalance = 0;
                  let runningFCBalance = 0;
                  // Determine account type for balance direction
                  const accountRow = trialBalanceData.find(r => r.code === selectedAccount?.code);
                  const isDebitNature = accountRow ? (accountRow.type === "asset" || accountRow.type === "expense") : true;
                  const hasForeign = accountDetails.some(d => d.currency && d.currency !== "EGP" && (d.exchangeRate || 1) > 1);
                  const foreignCurrency = accountDetails.find(d => d.currency && d.currency !== "EGP")?.currency || "USD";

                  return accountDetails.map((detail, idx) => {
                    const isForeign = detail.currency && detail.currency !== "EGP" && (detail.exchangeRate || 1) > 1;
                    const fcDebit = isForeign && detail.debit > 0 ? detail.debit / (detail.exchangeRate || 1) : 0;
                    const fcCredit = isForeign && detail.credit > 0 ? detail.credit / (detail.exchangeRate || 1) : 0;

                    if (isDebitNature) {
                      runningBalance += detail.debit - detail.credit;
                      runningFCBalance += fcDebit - fcCredit;
                    } else {
                      runningBalance += detail.credit - detail.debit;
                      runningFCBalance += fcCredit - fcDebit;
                    }

                    return (
                      <TableRow key={idx}>
                        <TableCell className="text-sm">{formatDate(detail.date)}</TableCell>
                        <TableCell className="text-sm font-mono">{detail.entryNumber || "-"}</TableCell>
                        <TableCell>{detail.description}</TableCell>
                        <TableCell>
                          {isClickableSource(detail) ? (
                            <button
                              onClick={() => handleSourceClick(detail)}
                              className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors cursor-pointer"
                            >
                              {detail.source}
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                              {detail.source}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs">{detail.currency || "EGP"}</TableCell>
                        <TableCell className="text-center text-xs">{(detail.exchangeRate || 1) > 1 ? detail.exchangeRate : "-"}</TableCell>
                        <TableCell className="text-center font-semibold">
                          {detail.debit > 0 ? formatCurrency(detail.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {detail.credit > 0 ? formatCurrency(detail.credit) : "-"}
                        </TableCell>
                        <TableCell className={`text-center font-bold ${runningBalance < 0 ? 'text-red-600' : 'text-primary'}`}>
                          {formatCurrency(Math.abs(runningBalance))} {runningBalance < 0 ? (isDebitNature ? 'دائن' : 'مدين') : ''}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {fcDebit > 0 ? formatFC(fcDebit, detail.currency || "USD") : "-"}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {fcCredit > 0 ? formatFC(fcCredit, detail.currency || "USD") : "-"}
                        </TableCell>
                        <TableCell className={`text-center font-bold ${runningFCBalance < 0 ? 'text-red-600' : 'text-primary'}`}>
                          {hasForeign && isForeign ? (
                            <>
                              {formatFC(Math.abs(runningFCBalance), foreignCurrency)} {runningFCBalance < 0 ? (isDebitNature ? 'دائن' : 'مدين') : ''}
                            </>
                          ) : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
                <TableRow className="bg-primary/5 font-bold">
                  <TableCell colSpan={6}>الإجمالي</TableCell>
                  <TableCell className="text-center text-primary">{formatCurrency(detailTotals.debit)}</TableCell>
                  <TableCell className="text-center text-primary">{formatCurrency(detailTotals.credit)}</TableCell>
                  <TableCell className="text-center text-primary font-bold">{formatCurrency(Math.abs(detailTotals.debit - detailTotals.credit))}</TableCell>
                  <TableCell className="text-center text-primary">{detailTotals.fcDebit > 0 ? formatFC(detailTotals.fcDebit, detailForeignCurrency) : "-"}</TableCell>
                  <TableCell className="text-center text-primary">{detailTotals.fcCredit > 0 ? formatFC(detailTotals.fcCredit, detailForeignCurrency) : "-"}</TableCell>
                  <TableCell className="text-center text-primary font-bold">{(detailTotals.fcDebit > 0 || detailTotals.fcCredit > 0) ? formatFC(Math.abs(detailTotals.fcDebit - detailTotals.fcCredit), detailForeignCurrency) : "-"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default TrialBalance;
