import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Loader2, Search, Users, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/exportExcel";

interface Party {
  id: string;
  code: string;
  name: string;
  type: "customer" | "supplier";
  account_id: string | null;
  opening_balance: number;
}

interface StatementEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  debitForeign: number;
  creditForeign: number;
  source: string;
  reference: string;
  entryRate: number;
}

const PartyStatement = () => {
  const [search, setSearch] = useState("");
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);

  // Fetch all parties for search
  const { data: allParties = [] } = useQuery({
    queryKey: ["all_parties_list"],
    queryFn: async () => {
      const [{ data: customers }, { data: suppliers }] = await Promise.all([
        supabase.from("customers").select("id, code, name, account_id, opening_balance").eq("is_active", true),
        supabase.from("suppliers").select("id, code, name, account_id, opening_balance").eq("is_active", true),
      ]);
      const result: Party[] = [];
      (customers || []).forEach(c => result.push({ ...c, type: "customer", opening_balance: Number(c.opening_balance || 0) }));
      (suppliers || []).forEach(s => result.push({ ...s, type: "supplier", opening_balance: Number(s.opening_balance || 0) }));
      return result.sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const searchResults = search.length >= 1
    ? allParties.filter(p => p.name.includes(search) || p.code.includes(search))
    : [];

  // Fetch statement for selected party
  const { data: statementData, isLoading: stmtLoading } = useQuery({
    queryKey: ["party_statement_page", selectedParty?.id, selectedParty?.type],
    enabled: !!selectedParty,
    queryFn: async () => {
      if (!selectedParty) return null;

      let accountCurrency = "EGP";
      let accountExchangeRate = 1;

      if (selectedParty.account_id) {
        const { data: accData } = await supabase
          .from("accounts")
          .select("currency, exchange_rate")
          .eq("id", selectedParty.account_id)
          .single();
        if (accData) {
          accountCurrency = accData.currency;
          accountExchangeRate = Number(accData.exchange_rate) || 1;
        }
      }

      const entries: StatementEntry[] = [];
      const isForeign = accountCurrency !== "EGP";
      const rate = accountExchangeRate;

      // Opening balance
      const ob = selectedParty.opening_balance;
      if (ob !== 0) {
        const abs = Math.abs(ob);
        if (selectedParty.type === "customer") {
          entries.push({
            date: "0001-01-01",
            description: "رصيد افتتاحي",
            debit: ob > 0 ? abs : 0, credit: ob < 0 ? abs : 0,
            debitForeign: ob > 0 ? (isForeign ? abs / rate : abs) : 0,
            creditForeign: ob < 0 ? (isForeign ? abs / rate : abs) : 0,
            source: "رصيد افتتاحي", reference: "-", entryRate: rate,
          });
        } else {
          entries.push({
            date: "0001-01-01",
            description: "رصيد افتتاحي",
            debit: ob < 0 ? abs : 0, credit: ob > 0 ? abs : 0,
            debitForeign: ob < 0 ? (isForeign ? abs / rate : abs) : 0,
            creditForeign: ob > 0 ? (isForeign ? abs / rate : abs) : 0,
            source: "رصيد افتتاحي", reference: "-", entryRate: rate,
          });
        }
      }

      if (selectedParty.type === "customer") {
        // Sales invoices - total is in original currency, use invoice's own exchange_rate
        const { data: sales } = await supabase
          .from("sales_invoices")
          .select("date, number, total, exchange_rate")
          .eq("customer_id", selectedParty.id)
          .eq("status", "accepted")
          .order("date");
        for (const inv of sales || []) {
          const t = Number(inv.total);
          const invRate = Number((inv as any).exchange_rate) || 1;
          entries.push({
            date: inv.date, description: `فاتورة بيع رقم ${inv.number}`,
            debit: isForeign ? t * invRate : t, credit: 0,
            debitForeign: t, creditForeign: 0,
            source: "فاتورة بيع", reference: inv.number, entryRate: invRate,
          });
        }

        // Cash receipts - amounts are in EGP
        const { data: receipts } = await supabase
          .from("cash_transactions")
          .select("date, reference, amount, description")
          .eq("customer_id", selectedParty.id)
          .eq("type", "receipt")
          .order("date");
        for (const tx of receipts || []) {
          const a = Number(tx.amount);
          entries.push({
            date: tx.date, description: tx.description || `سند قبض ${tx.reference}`,
            debit: 0, credit: a,
            debitForeign: 0, creditForeign: isForeign ? a / rate : a,
            source: "سند قبض", reference: tx.reference, entryRate: rate,
          });
        }

        // Party journal entries - amounts are in EGP
        const { data: jes } = await supabase
          .from("journal_entries")
          .select("date, number, description, currency, exchange_rate, journal_entry_lines(debit, credit, account_id)")
          .eq("reference_type", "party_customer")
          .eq("reference_id", selectedParty.id)
          .eq("status", "posted")
          .order("date");
        for (const je of jes || []) {
          if (selectedParty.account_id) {
            const line = (je.journal_entry_lines as any[])?.find(l => l.account_id === selectedParty.account_id);
            if (line) {
              const d = Number(line.debit || 0), c = Number(line.credit || 0);
              const jeRate = Number(je.exchange_rate) || 1;
              const jeCurr = je.currency || "EGP";
              entries.push({
                date: je.date, description: `قيد يومية ${je.number} - ${je.description}`,
                debit: d, credit: c,
                debitForeign: jeCurr !== "EGP" ? d / jeRate : d,
                creditForeign: jeCurr !== "EGP" ? c / jeRate : c,
                source: "قيد أطراف", reference: je.number, entryRate: jeRate,
              });
            }
          }
        }
      } else {
        // Purchase invoices - total is in original currency, use invoice's own exchange_rate
        const { data: purchases } = await supabase
          .from("purchase_invoices")
          .select("date, number, total, exchange_rate")
          .eq("supplier_id", selectedParty.id)
          .eq("status", "accepted")
          .order("date");
        for (const inv of purchases || []) {
          const t = Number(inv.total);
          const invRate = Number((inv as any).exchange_rate) || 1;
          entries.push({
            date: inv.date, description: `فاتورة شراء رقم ${inv.number}`,
            debit: 0, credit: isForeign ? t * invRate : t,
            debitForeign: 0, creditForeign: t,
            source: "فاتورة شراء", reference: inv.number, entryRate: invRate,
          });
        }

        // Cash payments - amounts are in EGP
        const { data: payments } = await supabase
          .from("cash_transactions")
          .select("date, reference, amount, description")
          .eq("supplier_id", selectedParty.id)
          .eq("type", "payment")
          .order("date");
        for (const tx of payments || []) {
          const a = Number(tx.amount);
          entries.push({
            date: tx.date, description: tx.description || `سند صرف ${tx.reference}`,
            debit: a, credit: 0,
            debitForeign: isForeign ? a / rate : a, creditForeign: 0,
            source: "سند صرف", reference: tx.reference, entryRate: rate,
          });
        }

        // Party journal entries - amounts are in EGP
        const { data: jes } = await supabase
          .from("journal_entries")
          .select("date, number, description, currency, exchange_rate, journal_entry_lines(debit, credit, account_id)")
          .eq("reference_type", "party_supplier")
          .eq("reference_id", selectedParty.id)
          .eq("status", "posted")
          .order("date");
        for (const je of jes || []) {
          if (selectedParty.account_id) {
            const line = (je.journal_entry_lines as any[])?.find(l => l.account_id === selectedParty.account_id);
            if (line) {
              const d = Number(line.debit || 0), c = Number(line.credit || 0);
              const jeRate = Number(je.exchange_rate) || 1;
              const jeCurr = je.currency || "EGP";
              entries.push({
                date: je.date, description: `قيد يومية ${je.number} - ${je.description}`,
                debit: d, credit: c,
                debitForeign: jeCurr !== "EGP" ? d / jeRate : d,
                creditForeign: jeCurr !== "EGP" ? c / jeRate : c,
                source: "قيد أطراف", reference: je.number, entryRate: jeRate,
              });
            }
          }
        }
      }

      entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return { entries, accountCurrency, accountExchangeRate };
    },
  });

  const entries = statementData?.entries || [];
  const currency = statementData?.accountCurrency || "EGP";
  const rate = statementData?.accountExchangeRate || 1;
  const isMultiCurrency = currency !== "EGP";

  // Running balance
  let runEGP = 0, runForeign = 0;
  const withBalance = entries.map(e => {
    runEGP += e.debit - e.credit;
    runForeign += e.debitForeign - e.creditForeign;
    return { ...e, balanceEGP: runEGP, balanceForeign: runForeign };
  });

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const totalDebitF = entries.reduce((s, e) => s + e.debitForeign, 0);
  const totalCreditF = entries.reduce((s, e) => s + e.creditForeign, 0);

  const formatEGP = (n: number) => n === 0 ? "-" : new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(n);
  const formatF = (n: number, c: string) => n === 0 ? "-" : new Intl.NumberFormat("ar-EG", { style: "currency", currency: c }).format(n);
  const formatDate = (d: string) => d === "0001-01-01" ? "رصيد افتتاحي" : new Date(d).toLocaleDateString("ar-EG");

  const handleExport = () => {
    if (!selectedParty) return;
    const headers = isMultiCurrency
      ? ["التاريخ", "البيان", "النوع", `مدين (${currency})`, `دائن (${currency})`, `الرصيد (${currency})`, "المعامل", "مدين (ج.م)", "دائن (ج.م)", "الرصيد (ج.م)"]
      : ["التاريخ", "البيان", "النوع", "مدين (ج.م)", "دائن (ج.م)", "الرصيد (ج.م)"];
    const rows = withBalance.map(e => {
      const dateStr = e.source === "رصيد افتتاحي" ? "-" : formatDate(e.date);
      if (isMultiCurrency) {
        return [dateStr, e.description, e.source, e.debitForeign, e.creditForeign, e.balanceForeign, e.entryRate, e.debit, e.credit, e.balanceEGP];
      }
      return [dateStr, e.description, e.source, e.debit, e.credit, e.balanceEGP];
    });
    if (isMultiCurrency) {
      rows.push(["", "الإجمالي", "", totalDebitF, totalCreditF, totalDebitF - totalCreditF, "", totalDebit, totalCredit, totalDebit - totalCredit]);
    } else {
      rows.push(["", "الإجمالي", "", totalDebit, totalCredit, totalDebit - totalCredit]);
    }
    exportToExcel(headers, rows, `كشف_حساب_${selectedParty.name}`, {
      title: `كشف حساب تحليلي: ${selectedParty.name}`,
      subtitle: `النوع: ${selectedParty.type === "customer" ? "عميل" : "مورد"} | العملة: ${currency} | تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")}`,
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            كشف حساب تحليلي - عميل / مورد
          </h1>
          <p className="text-muted-foreground">ابحث باسم العميل أو المورد لعرض كشف حسابه التفصيلي بجميع الحركات</p>
        </div>

        {/* Search */}
        <div className="relative max-w-lg">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="اكتب اسم العميل أو المورد..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (!e.target.value) setSelectedParty(null); }}
            className="pr-10"
          />
          {search.length >= 1 && !selectedParty && searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map(p => (
                <button
                  key={`${p.type}-${p.id}`}
                  className="w-full px-4 py-3 text-right hover:bg-muted/50 flex items-center justify-between transition-colors"
                  onClick={() => { setSelectedParty(p); setSearch(p.name); }}
                >
                  <span className="flex items-center gap-2">
                    {p.type === "customer" ? <Users className="w-4 h-4 text-primary" /> : <Truck className="w-4 h-4 text-secondary-foreground" />}
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">({p.code})</span>
                  </span>
                  <Badge variant={p.type === "customer" ? "default" : "secondary"} className="text-xs">
                    {p.type === "customer" ? "عميل" : "مورد"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
          {search.length >= 1 && !selectedParty && searchResults.length === 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
              لا توجد نتائج
            </div>
          )}
        </div>

        {/* Statement */}
        {selectedParty && (
          <div className="space-y-4">
            {/* Party info bar */}
            <div className="flex items-center justify-between flex-wrap gap-3 bg-card rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <Badge variant={selectedParty.type === "customer" ? "default" : "secondary"}>
                  {selectedParty.type === "customer" ? "عميل" : "مورد"}
                </Badge>
                <span className="font-bold text-lg">{selectedParty.name}</span>
                <span className="text-muted-foreground text-sm">({selectedParty.code})</span>
                {isMultiCurrency && (
                  <>
                    <Badge variant="outline">العملة: {currency}</Badge>
                    <Badge variant="outline">المعامل: {rate}</Badge>
                  </>
                )}
              </div>
              {withBalance.length > 0 && (
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
                  <Download className="w-4 h-4" />
                  تصدير Excel
                </Button>
              )}
            </div>

            {stmtLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : withBalance.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
                لا توجد حركات مالية لهذا الحساب
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead>التاريخ</TableHead>
                      <TableHead>البيان</TableHead>
                      <TableHead>النوع</TableHead>
                      {isMultiCurrency && (
                        <>
                          <TableHead className="text-center">مدين ({currency})</TableHead>
                          <TableHead className="text-center">دائن ({currency})</TableHead>
                          <TableHead className="text-center">الرصيد ({currency})</TableHead>
                          <TableHead className="text-center">المعامل</TableHead>
                        </>
                      )}
                      <TableHead className="text-center">مدين (ج.م)</TableHead>
                      <TableHead className="text-center">دائن (ج.م)</TableHead>
                      <TableHead className="text-center">الرصيد (ج.م)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withBalance.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(e.date)}</TableCell>
                        <TableCell className="text-sm">{e.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{e.source}</Badge>
                        </TableCell>
                        {isMultiCurrency && (
                          <>
                            <TableCell className={`text-center ${e.debitForeign > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                              {e.debitForeign > 0 ? formatF(e.debitForeign, currency) : "-"}
                            </TableCell>
                            <TableCell className={`text-center ${e.creditForeign > 0 ? "font-semibold text-green-600" : "text-muted-foreground"}`}>
                              {e.creditForeign > 0 ? formatF(e.creditForeign, currency) : "-"}
                            </TableCell>
                            <TableCell className="text-center font-bold">{formatF(e.balanceForeign, currency)}</TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">{e.entryRate}</TableCell>
                          </>
                        )}
                        <TableCell className={`text-center ${e.debit > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                          {e.debit > 0 ? formatEGP(e.debit) : "-"}
                        </TableCell>
                        <TableCell className={`text-center ${e.credit > 0 ? "font-semibold text-green-600" : "text-muted-foreground"}`}>
                          {e.credit > 0 ? formatEGP(e.credit) : "-"}
                        </TableCell>
                        <TableCell className="text-center font-bold">{formatEGP(e.balanceEGP)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-primary/5 font-bold">
                      <TableCell colSpan={3} className="text-center">الإجمالي</TableCell>
                      {isMultiCurrency && (
                        <>
                          <TableCell className="text-center text-destructive">{formatF(totalDebitF, currency)}</TableCell>
                          <TableCell className="text-center text-green-600">{formatF(totalCreditF, currency)}</TableCell>
                          <TableCell className="text-center text-primary text-lg">{formatF(totalDebitF - totalCreditF, currency)}</TableCell>
                          <TableCell />
                        </>
                      )}
                      <TableCell className="text-center text-destructive">{formatEGP(totalDebit)}</TableCell>
                      <TableCell className="text-center text-green-600">{formatEGP(totalCredit)}</TableCell>
                      <TableCell className="text-center text-primary text-lg">{formatEGP(totalDebit - totalCredit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default PartyStatement;
