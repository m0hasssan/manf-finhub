import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2 } from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";
import { useTrialBalance } from "@/hooks/useTrialBalance";

const BalanceSheet = () => {
  const { data: trialBalanceData = [], isLoading } = useTrialBalance();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
    }).format(amount);
  };

  // Categorize accounts
  const assetAccounts = trialBalanceData.filter((r) => r.type === "asset");
  const liabilityAccounts = trialBalanceData.filter((r) => r.type === "liability");
  const equityAccounts = trialBalanceData.filter((r) => r.type === "equity");
  const revenueAccounts = trialBalanceData.filter((r) => r.type === "revenue");
  const expenseAccounts = trialBalanceData.filter((r) => r.type === "expense");

  const getBalance = (r: typeof trialBalanceData[0]) => {
    if (r.type === "asset" || r.type === "expense") return r.debitClosing - r.creditClosing;
    return r.creditClosing - r.debitClosing;
  };

  const totalAssets = assetAccounts.reduce((s, r) => s + getBalance(r), 0);
  const totalLiabilities = liabilityAccounts.reduce((s, r) => s + getBalance(r), 0);
  const totalEquity = equityAccounts.reduce((s, r) => s + getBalance(r), 0);
  const netIncome = revenueAccounts.reduce((s, r) => s + getBalance(r), 0) - expenseAccounts.reduce((s, r) => s + getBalance(r), 0);
  const totalEquityWithIncome = totalEquity + netIncome;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquityWithIncome;

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              الميزانية العمومية
            </h1>
            <p className="text-muted-foreground">بيانات فعلية من جميع الحركات المالية المعتمدة</p>
          </div>
          <Button variant="outline" className="gap-2" disabled={isLoading} onClick={() => {
            const headers = ["البند", "المبلغ"];
            const rows: (string | number)[][] = [];
            rows.push(["--- الأصول ---", ""]);
            assetAccounts.forEach((r) => rows.push([`${r.code} - ${r.name}`, getBalance(r)]));
            rows.push(["إجمالي الأصول", totalAssets]);
            rows.push(["", ""]);
            rows.push(["--- الخصوم ---", ""]);
            liabilityAccounts.forEach((r) => rows.push([`${r.code} - ${r.name}`, getBalance(r)]));
            rows.push(["إجمالي الخصوم", totalLiabilities]);
            rows.push(["", ""]);
            rows.push(["--- حقوق الملكية ---", ""]);
            equityAccounts.forEach((r) => rows.push([`${r.code} - ${r.name}`, getBalance(r)]));
            rows.push(["صافي ربح الفترة", netIncome]);
            rows.push(["إجمالي حقوق الملكية", totalEquityWithIncome]);
            rows.push(["", ""]);
            rows.push(["إجمالي الخصوم وحقوق الملكية", totalLiabilitiesAndEquity]);
            exportToExcel(headers, rows, "الميزانية_العمومية", { title: "الميزانية العمومية", subtitle: `تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")}`, showTotalsRow: false });
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Assets */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-bold mb-4 text-primary">الأصول</h2>
                <div className="space-y-3">
                  {assetAccounts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">لا توجد أصول مسجلة</p>
                  ) : (
                    assetAccounts.map((r) => (
                      <div key={r.code} className="flex justify-between pr-4">
                        <span>{r.code} - {r.name}</span>
                        <span>{formatCurrency(getBalance(r))}</span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between font-semibold bg-muted p-2 rounded">
                    <span>إجمالي الأصول</span>
                    <span className="text-primary">{formatCurrency(totalAssets)}</span>
                  </div>
                </div>
              </div>

              {/* Liabilities & Equity */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-bold mb-4 text-danger">الخصوم وحقوق الملكية</h2>

                {/* Liabilities */}
                <div className="space-y-3">
                  <h3 className="font-semibold border-b pb-2">الخصوم</h3>
                  {liabilityAccounts.length === 0 ? (
                    <p className="text-muted-foreground text-sm pr-4">لا توجد خصوم مسجلة</p>
                  ) : (
                    liabilityAccounts.map((r) => (
                      <div key={r.code} className="flex justify-between pr-4">
                        <span>{r.code} - {r.name}</span>
                        <span>{formatCurrency(getBalance(r))}</span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between font-semibold bg-muted p-2 rounded">
                    <span>إجمالي الخصوم</span>
                    <span>{formatCurrency(totalLiabilities)}</span>
                  </div>
                </div>

                {/* Equity */}
                <div className="space-y-3 mt-6">
                  <h3 className="font-semibold border-b pb-2">حقوق الملكية</h3>
                  {equityAccounts.map((r) => (
                    <div key={r.code} className="flex justify-between pr-4">
                      <span>{r.code} - {r.name}</span>
                      <span>{formatCurrency(getBalance(r))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pr-4">
                    <span>صافي ربح الفترة</span>
                    <span className={netIncome >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(netIncome)}</span>
                  </div>
                  <div className="flex justify-between font-semibold bg-muted p-2 rounded">
                    <span>إجمالي حقوق الملكية</span>
                    <span>{formatCurrency(totalEquityWithIncome)}</span>
                  </div>
                </div>

                {/* Total */}
                <div className="mt-6 p-4 bg-danger-light rounded-lg">
                  <div className="flex justify-between font-bold text-lg">
                    <span>إجمالي الخصوم وحقوق الملكية</span>
                    <span className="text-danger">{formatCurrency(totalLiabilitiesAndEquity)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Balance Check */}
            <div className={`p-4 rounded-xl border ${Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01 ? 'bg-success-light border-success/20' : 'bg-danger-light border-danger/20'}`}>
              <p className={`font-semibold ${Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01 ? 'text-success' : 'text-danger'}`}>
                {Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01
                  ? "✓ الميزانية متوازنة - إجمالي الأصول يساوي إجمالي الخصوم وحقوق الملكية"
                  : `✗ الميزانية غير متوازنة - الفرق: ${formatCurrency(Math.abs(totalAssets - totalLiabilitiesAndEquity))}`}
              </p>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default BalanceSheet;
