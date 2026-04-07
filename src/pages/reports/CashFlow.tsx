import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Wallet, Download, Loader2 } from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CashFlow = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["cash_flow_report"],
    queryFn: async () => {
      const { data: transactions } = await supabase
        .from("cash_transactions")
        .select("*, customers(name), suppliers(name)")
        .order("date");

      const receipts = (transactions || []).filter((t) => t.type === "receipt");
      const payments = (transactions || []).filter((t) => t.type === "payment");

      const totalReceipts = receipts.reduce((s, t) => s + Number(t.amount), 0);
      const totalPayments = payments.reduce((s, t) => s + Number(t.amount), 0);
      const netCashFlow = totalReceipts - totalPayments;

      return { receipts, payments, totalReceipts, totalPayments, netCashFlow };
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
    }).format(amount);
  };

  const { receipts = [], payments = [], totalReceipts = 0, totalPayments = 0, netCashFlow = 0 } = data || {};

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="w-6 h-6 text-primary" />
              قائمة التدفقات النقدية
            </h1>
            <p className="text-muted-foreground">بيانات فعلية من سندات القبض والصرف</p>
          </div>
          <Button variant="outline" className="gap-2" disabled={isLoading} onClick={() => {
            const headers = ["البند", "المبلغ"];
            const rows: (string | number)[][] = [];
            rows.push(["--- التدفقات الداخلة (سندات القبض) ---", ""]);
            receipts.forEach((r: any) => rows.push([`${r.reference} - ${r.description}`, Number(r.amount)]));
            rows.push(["إجمالي التدفقات الداخلة", totalReceipts]);
            rows.push(["", ""]);
            rows.push(["--- التدفقات الخارجة (سندات الصرف) ---", ""]);
            payments.forEach((p: any) => rows.push([`${p.reference} - ${p.description}`, -Number(p.amount)]));
            rows.push(["إجمالي التدفقات الخارجة", -totalPayments]);
            rows.push(["", ""]);
            rows.push(["صافي التدفقات النقدية", netCashFlow]);
            exportToExcel(headers, rows, "التدفقات_النقدية", { title: "قائمة التدفقات النقدية", subtitle: `تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")}`, showTotalsRow: false });
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
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="stat-card stat-card-success">
                <p className="text-sm text-muted-foreground">إجمالي التدفقات الداخلة</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totalReceipts)}</p>
                <p className="text-xs text-muted-foreground">{receipts.length} سند قبض</p>
              </div>
              <div className="stat-card stat-card-danger">
                <p className="text-sm text-muted-foreground">إجمالي التدفقات الخارجة</p>
                <p className="text-2xl font-bold text-danger">{formatCurrency(totalPayments)}</p>
                <p className="text-xs text-muted-foreground">{payments.length} سند صرف</p>
              </div>
              <div className={`stat-card ${netCashFlow >= 0 ? 'stat-card-success' : 'stat-card-danger'}`}>
                <p className="text-sm text-muted-foreground">صافي التدفقات النقدية</p>
                <p className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-success' : 'text-danger'}`}>
                  {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Receipts */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-lg font-bold mb-4 text-success">التدفقات الداخلة (سندات القبض)</h2>
                {receipts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">لا توجد سندات قبض</p>
                ) : (
                  <div className="space-y-2">
                    {receipts.map((r: any) => (
                      <div key={r.id} className="flex justify-between items-center text-sm border-b border-border pb-2">
                        <div>
                          <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded ml-2">{r.reference}</span>
                          <span>{r.description}</span>
                          {(r as any).customers?.name && <span className="text-muted-foreground text-xs mr-1">({(r as any).customers.name})</span>}
                        </div>
                        <span className="font-semibold text-success">{formatCurrency(Number(r.amount))}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-2">
                      <span>الإجمالي</span>
                      <span className="text-success">{formatCurrency(totalReceipts)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Payments */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-lg font-bold mb-4 text-danger">التدفقات الخارجة (سندات الصرف)</h2>
                {payments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">لا توجد سندات صرف</p>
                ) : (
                  <div className="space-y-2">
                    {payments.map((p: any) => (
                      <div key={p.id} className="flex justify-between items-center text-sm border-b border-border pb-2">
                        <div>
                          <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded ml-2">{p.reference}</span>
                          <span>{p.description}</span>
                          {(p as any).suppliers?.name && <span className="text-muted-foreground text-xs mr-1">({(p as any).suppliers.name})</span>}
                        </div>
                        <span className="font-semibold text-danger">({formatCurrency(Number(p.amount))})</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-2">
                      <span>الإجمالي</span>
                      <span className="text-danger">({formatCurrency(totalPayments)})</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Net Result */}
            <div className={`p-4 rounded-xl border ${netCashFlow >= 0 ? 'bg-success-light border-success/20' : 'bg-danger-light border-danger/20'}`}>
              <div className="flex justify-between font-bold text-lg">
                <span>صافي التدفقات النقدية</span>
                <span className={netCashFlow >= 0 ? 'text-success' : 'text-danger'}>
                  {formatCurrency(netCashFlow)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default CashFlow;
