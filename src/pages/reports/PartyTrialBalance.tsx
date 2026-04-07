import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Scale, Download, Loader2, Search, Users, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/exportExcel";

interface PartyBalance {
  id: string;
  code: string;
  name: string;
  type: "customer" | "supplier";
  currency: string;
  exchangeRate: number;
  debitOpeningEGP: number;
  creditOpeningEGP: number;
  debitMovementEGP: number;
  creditMovementEGP: number;
  debitClosingEGP: number;
  creditClosingEGP: number;
  debitOpeningForeign: number;
  creditOpeningForeign: number;
  debitMovementForeign: number;
  creditMovementForeign: number;
  debitClosingForeign: number;
  creditClosingForeign: number;
}

const PartyTrialBalance = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "customer" | "supplier">("all");

  const { data: parties = [], isLoading } = useQuery({
    queryKey: ["party_trial_balance"],
    queryFn: async () => {
      const [
        { data: customers },
        { data: suppliers },
        { data: accounts },
        { data: salesInvoices },
        { data: purchaseInvoices },
        { data: cashReceipts },
        { data: cashPayments },
        { data: customerJournalEntries },
        { data: supplierJournalEntries },
      ] = await Promise.all([
        supabase.from("customers").select("id, code, name, opening_balance, account_id").eq("is_active", true),
        supabase.from("suppliers").select("id, code, name, opening_balance, account_id").eq("is_active", true),
        supabase.from("accounts").select("id, currency, exchange_rate"),
        supabase.from("sales_invoices").select("customer_id, total, exchange_rate").eq("status", "accepted"),
        supabase.from("purchase_invoices").select("supplier_id, total, exchange_rate").eq("status", "accepted"),
        supabase.from("cash_transactions").select("customer_id, amount").eq("type", "receipt"),
        supabase.from("cash_transactions").select("supplier_id, amount").eq("type", "payment"),
        supabase.from("journal_entries")
          .select("reference_id, currency, exchange_rate, journal_entry_lines(debit, credit, account_id)")
          .eq("reference_type", "party_customer")
          .eq("status", "posted"),
        supabase.from("journal_entries")
          .select("reference_id, currency, exchange_rate, journal_entry_lines(debit, credit, account_id)")
          .eq("reference_type", "party_supplier")
          .eq("status", "posted"),
      ]);

      const accountMap = new Map((accounts || []).map(a => [a.id, a]));
      const customerSalesMap = new Map<string, any[]>();
      const supplierPurchaseMap = new Map<string, any[]>();
      const customerReceiptsMap = new Map<string, any[]>();
      const supplierPaymentsMap = new Map<string, any[]>();
      const customerJEsMap = new Map<string, any[]>();
      const supplierJEsMap = new Map<string, any[]>();

      for (const inv of salesInvoices || []) {
        if (!inv.customer_id) continue;
        if (!customerSalesMap.has(inv.customer_id)) customerSalesMap.set(inv.customer_id, []);
        customerSalesMap.get(inv.customer_id)!.push(inv);
      }

      for (const inv of purchaseInvoices || []) {
        if (!inv.supplier_id) continue;
        if (!supplierPurchaseMap.has(inv.supplier_id)) supplierPurchaseMap.set(inv.supplier_id, []);
        supplierPurchaseMap.get(inv.supplier_id)!.push(inv);
      }

      for (const tx of cashReceipts || []) {
        if (!tx.customer_id) continue;
        if (!customerReceiptsMap.has(tx.customer_id)) customerReceiptsMap.set(tx.customer_id, []);
        customerReceiptsMap.get(tx.customer_id)!.push(tx);
      }

      for (const tx of cashPayments || []) {
        if (!tx.supplier_id) continue;
        if (!supplierPaymentsMap.has(tx.supplier_id)) supplierPaymentsMap.set(tx.supplier_id, []);
        supplierPaymentsMap.get(tx.supplier_id)!.push(tx);
      }

      for (const je of customerJournalEntries || []) {
        if (!je.reference_id) continue;
        if (!customerJEsMap.has(je.reference_id)) customerJEsMap.set(je.reference_id, []);
        customerJEsMap.get(je.reference_id)!.push(je);
      }

      for (const je of supplierJournalEntries || []) {
        if (!je.reference_id) continue;
        if (!supplierJEsMap.has(je.reference_id)) supplierJEsMap.set(je.reference_id, []);
        supplierJEsMap.get(je.reference_id)!.push(je);
      }

      const results: PartyBalance[] = [];

      for (const c of customers || []) {
        const acc = c.account_id ? accountMap.get(c.account_id) : null;
        const currency = acc?.currency || "EGP";
        const rate = Number(acc?.exchange_rate) || 1;
        const isForeign = currency !== "EGP";

        const openingBalance = Number(c.opening_balance || 0);
        const debitOpeningEGP = openingBalance > 0 ? openingBalance : 0;
        const creditOpeningEGP = openingBalance < 0 ? Math.abs(openingBalance) : 0;

        let debitMovementEGP = 0;
        let creditMovementEGP = 0;
        let debitMovementForeign = 0;
        let creditMovementForeign = 0;

        for (const inv of customerSalesMap.get(c.id) || []) {
          const t = Number(inv.total || 0);
          const invRate = Number((inv as any).exchange_rate) || 1;
          debitMovementEGP += isForeign ? t * invRate : t;
          debitMovementForeign += isForeign ? t : 0;
        }

        for (const tx of customerReceiptsMap.get(c.id) || []) {
          const a = Number(tx.amount || 0);
          creditMovementEGP += a;
          creditMovementForeign += isForeign ? a / rate : 0;
        }

        for (const je of customerJEsMap.get(c.id) || []) {
          if (!c.account_id) continue;
          const line = (je.journal_entry_lines as any[])?.find(l => l.account_id === c.account_id);
          if (!line) continue;
          const d = Number(line.debit || 0);
          const cr = Number(line.credit || 0);
          const jeRate = Number((je as any).exchange_rate) || 1;
          const jeCurr = (je as any).currency || "EGP";

          debitMovementEGP += d;
          creditMovementEGP += cr;
          if (isForeign) {
            debitMovementForeign += jeCurr !== "EGP" ? d / jeRate : d;
            creditMovementForeign += jeCurr !== "EGP" ? cr / jeRate : cr;
          }
        }

        const netClosing = debitOpeningEGP - creditOpeningEGP + debitMovementEGP - creditMovementEGP;
        const debitOpeningForeign = isForeign ? debitOpeningEGP / rate : 0;
        const creditOpeningForeign = isForeign ? creditOpeningEGP / rate : 0;
        const netClosingForeign = debitOpeningForeign - creditOpeningForeign + debitMovementForeign - creditMovementForeign;

        results.push({
          id: c.id,
          code: c.code,
          name: c.name,
          type: "customer",
          currency,
          exchangeRate: rate,
          debitOpeningEGP,
          creditOpeningEGP,
          debitMovementEGP,
          creditMovementEGP,
          debitClosingEGP: netClosing >= 0 ? netClosing : 0,
          creditClosingEGP: netClosing < 0 ? Math.abs(netClosing) : 0,
          debitOpeningForeign,
          creditOpeningForeign,
          debitMovementForeign,
          creditMovementForeign,
          debitClosingForeign: isForeign ? (netClosingForeign >= 0 ? netClosingForeign : 0) : 0,
          creditClosingForeign: isForeign ? (netClosingForeign < 0 ? Math.abs(netClosingForeign) : 0) : 0,
        });
      }

      for (const s of suppliers || []) {
        const acc = s.account_id ? accountMap.get(s.account_id) : null;
        const currency = acc?.currency || "EGP";
        const rate = Number(acc?.exchange_rate) || 1;
        const isForeign = currency !== "EGP";

        const openingBalance = Number(s.opening_balance || 0);
        const creditOpeningEGP = openingBalance > 0 ? openingBalance : 0;
        const debitOpeningEGP = openingBalance < 0 ? Math.abs(openingBalance) : 0;

        let debitMovementEGP = 0;
        let creditMovementEGP = 0;
        let debitMovementForeign = 0;
        let creditMovementForeign = 0;

        for (const inv of supplierPurchaseMap.get(s.id) || []) {
          const t = Number(inv.total || 0);
          const invRate = Number((inv as any).exchange_rate) || 1;
          creditMovementEGP += isForeign ? t * invRate : t;
          creditMovementForeign += isForeign ? t : 0;
        }

        for (const tx of supplierPaymentsMap.get(s.id) || []) {
          const a = Number(tx.amount || 0);
          debitMovementEGP += a;
          debitMovementForeign += isForeign ? a / rate : 0;
        }

        for (const je of supplierJEsMap.get(s.id) || []) {
          if (!s.account_id) continue;
          const line = (je.journal_entry_lines as any[])?.find(l => l.account_id === s.account_id);
          if (!line) continue;
          const d = Number(line.debit || 0);
          const cr = Number(line.credit || 0);
          const jeRate = Number((je as any).exchange_rate) || 1;
          const jeCurr = (je as any).currency || "EGP";

          debitMovementEGP += d;
          creditMovementEGP += cr;
          if (isForeign) {
            debitMovementForeign += jeCurr !== "EGP" ? d / jeRate : d;
            creditMovementForeign += jeCurr !== "EGP" ? cr / jeRate : cr;
          }
        }

        const netClosing = creditOpeningEGP - debitOpeningEGP + creditMovementEGP - debitMovementEGP;
        const debitOpeningForeign = isForeign ? debitOpeningEGP / rate : 0;
        const creditOpeningForeign = isForeign ? creditOpeningEGP / rate : 0;
        const netClosingForeign = creditOpeningForeign - debitOpeningForeign + creditMovementForeign - debitMovementForeign;

        results.push({
          id: s.id,
          code: s.code,
          name: s.name,
          type: "supplier",
          currency,
          exchangeRate: rate,
          debitOpeningEGP,
          creditOpeningEGP,
          debitMovementEGP,
          creditMovementEGP,
          debitClosingEGP: netClosing < 0 ? Math.abs(netClosing) : 0,
          creditClosingEGP: netClosing >= 0 ? netClosing : 0,
          debitOpeningForeign,
          creditOpeningForeign,
          debitMovementForeign,
          creditMovementForeign,
          debitClosingForeign: isForeign ? (netClosingForeign < 0 ? Math.abs(netClosingForeign) : 0) : 0,
          creditClosingForeign: isForeign ? (netClosingForeign >= 0 ? netClosingForeign : 0) : 0,
        });
      }

      results.sort((a, b) => a.code.localeCompare(b.code));
      return results;
    },
  });

  const filtered = parties.filter(p => {
    if (filter !== "all" && p.type !== filter) return false;
    if (search && !p.name.includes(search) && !p.code.includes(search)) return false;
    return true;
  });

  const totals = filtered.reduce(
    (acc, r) => ({
      debitOpening: acc.debitOpening + r.debitOpeningEGP,
      creditOpening: acc.creditOpening + r.creditOpeningEGP,
      debitMovement: acc.debitMovement + r.debitMovementEGP,
      creditMovement: acc.creditMovement + r.creditMovementEGP,
      debitClosing: acc.debitClosing + r.debitClosingEGP,
      creditClosing: acc.creditClosing + r.creditClosingEGP,
    }),
    { debitOpening: 0, creditOpening: 0, debitMovement: 0, creditMovement: 0, debitClosing: 0, creditClosing: 0 }
  );

  const formatCurrency = (amount: number) => {
    if (amount === 0) return "-";
    return new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);
  };

  const formatForeign = (amount: number, currency: string) => {
    if (amount === 0) return "-";
    return new Intl.NumberFormat("ar-EG", { style: "currency", currency }).format(amount);
  };

  const handleExport = () => {
    const headers = ["الكود", "الاسم", "النوع", "العملة", "المعامل",
      "مدين أول المدة", "دائن أول المدة",
      "مدين الحركة", "دائن الحركة",
      "مدين آخر المدة", "دائن آخر المدة",
      "مدين أول المدة (بالعملة)", "دائن أول المدة (بالعملة)",
      "مدين الحركة (بالعملة)", "دائن الحركة (بالعملة)",
      "مدين آخر المدة (بالعملة)", "دائن آخر المدة (بالعملة)",
    ];
    const rows = filtered.map(r => [
      r.code, r.name,
      r.type === "customer" ? "عميل" : "مورد",
      r.currency, r.exchangeRate,
      r.debitOpeningEGP, r.creditOpeningEGP,
      r.debitMovementEGP, r.creditMovementEGP,
      r.debitClosingEGP, r.creditClosingEGP,
      r.debitOpeningForeign, r.creditOpeningForeign,
      r.debitMovementForeign, r.creditMovementForeign,
      r.debitClosingForeign, r.creditClosingForeign,
    ]);
    rows.push(["", "الإجمالي", "", "", "",
      totals.debitOpening, totals.creditOpening,
      totals.debitMovement, totals.creditMovement,
      totals.debitClosing, totals.creditClosing,
      "", "", "", "", "", "",
    ]);
    exportToExcel(headers, rows, "ميزان_مراجعة_الأطراف", {
      title: "ميزان مراجعة العملاء والموردين",
      subtitle: `تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")} | عدد الأطراف: ${filtered.length}`,
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="w-6 h-6 text-primary" />
              ميزان مراجعة العملاء والموردين
            </h1>
            <p className="text-muted-foreground">ميزان مراجعة تفصيلي لجميع حركات العملاء والموردين</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" />
            تصدير Excel
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الكود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
              الكل ({parties.length})
            </Button>
            <Button variant={filter === "customer" ? "default" : "outline"} size="sm" onClick={() => setFilter("customer")} className="gap-1">
              <Users className="w-4 h-4" />
              العملاء ({parties.filter(p => p.type === "customer").length})
            </Button>
            <Button variant={filter === "supplier" ? "default" : "outline"} size="sm" onClick={() => setFilter("supplier")} className="gap-1">
              <Truck className="w-4 h-4" />
              الموردين ({parties.filter(p => p.type === "supplier").length})
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="mr-3 text-muted-foreground">جاري تحميل البيانات...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد بيانات</h3>
            <p className="text-muted-foreground">لم يتم العثور على عملاء أو موردين.</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="px-4 py-2 bg-card rounded-lg border border-border text-sm text-muted-foreground">
              عدد الأطراف: <span className="font-bold text-foreground">{filtered.length}</span>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead rowSpan={2} className="border-l">الكود</TableHead>
                    <TableHead rowSpan={2} className="border-l">الاسم</TableHead>
                    <TableHead rowSpan={2} className="border-l text-center">النوع</TableHead>
                    <TableHead rowSpan={2} className="border-l text-center">العملة</TableHead>
                    <TableHead rowSpan={2} className="border-l text-center">المعامل</TableHead>
                    <TableHead colSpan={2} className="text-center border-l">رصيد أول المدة (بالعملة)</TableHead>
                    <TableHead colSpan={2} className="text-center border-l">الحركة (بالعملة)</TableHead>
                    <TableHead colSpan={2} className="text-center border-l">رصيد آخر المدة (بالعملة)</TableHead>
                    <TableHead colSpan={2} className="text-center border-l">رصيد أول المدة (ج.م)</TableHead>
                    <TableHead colSpan={2} className="text-center border-l">الحركة (ج.م)</TableHead>
                    <TableHead colSpan={2} className="text-center">رصيد آخر المدة (ج.م)</TableHead>
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
                    <TableHead className="text-center">دائن</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const isForeign = row.currency !== "EGP";
                    return (
                      <TableRow key={`${row.type}-${row.id}`} className="hover:bg-muted/50">
                        <TableCell className="font-mono border-l">{row.code}</TableCell>
                        <TableCell className="border-l">{row.name}</TableCell>
                        <TableCell className="text-center border-l">
                          <Badge variant={row.type === "customer" ? "default" : "secondary"} className="text-xs">
                            {row.type === "customer" ? "عميل" : "مورد"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center border-l text-xs">{row.currency}</TableCell>
                        <TableCell className="text-center border-l text-xs">{isForeign ? row.exchangeRate : "-"}</TableCell>
                        {/* Foreign columns */}
                        <TableCell className="text-center border-l">{isForeign ? formatForeign(row.debitOpeningForeign, row.currency) : "-"}</TableCell>
                        <TableCell className="text-center border-l">{isForeign ? formatForeign(row.creditOpeningForeign, row.currency) : "-"}</TableCell>
                        <TableCell className="text-center border-l">{isForeign ? formatForeign(row.debitMovementForeign, row.currency) : "-"}</TableCell>
                        <TableCell className="text-center border-l">{isForeign ? formatForeign(row.creditMovementForeign, row.currency) : "-"}</TableCell>
                        <TableCell className="text-center border-l">{isForeign ? formatForeign(row.debitClosingForeign, row.currency) : "-"}</TableCell>
                        <TableCell className="text-center border-l">{isForeign ? formatForeign(row.creditClosingForeign, row.currency) : "-"}</TableCell>
                        {/* EGP columns */}
                        <TableCell className="text-center border-l">{formatCurrency(row.debitOpeningEGP)}</TableCell>
                        <TableCell className="text-center border-l">{formatCurrency(row.creditOpeningEGP)}</TableCell>
                        <TableCell className="text-center border-l">{formatCurrency(row.debitMovementEGP)}</TableCell>
                        <TableCell className="text-center border-l">{formatCurrency(row.creditMovementEGP)}</TableCell>
                        <TableCell className="text-center border-l font-semibold">{formatCurrency(row.debitClosingEGP)}</TableCell>
                        <TableCell className="text-center font-semibold">{formatCurrency(row.creditClosingEGP)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-primary/5 font-bold">
                    <TableCell colSpan={5} className="border-l">الإجمالي</TableCell>
                    <TableCell colSpan={6} className="text-center border-l text-muted-foreground text-xs">-</TableCell>
                    <TableCell className="text-center border-l">{formatCurrency(totals.debitOpening)}</TableCell>
                    <TableCell className="text-center border-l">{formatCurrency(totals.creditOpening)}</TableCell>
                    <TableCell className="text-center border-l">{formatCurrency(totals.debitMovement)}</TableCell>
                    <TableCell className="text-center border-l">{formatCurrency(totals.creditMovement)}</TableCell>
                    <TableCell className="text-center border-l text-primary">{formatCurrency(totals.debitClosing)}</TableCell>
                    <TableCell className="text-center text-primary">{formatCurrency(totals.creditClosing)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default PartyTrialBalance;
