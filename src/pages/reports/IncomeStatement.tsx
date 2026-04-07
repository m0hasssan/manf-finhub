import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { TrendingUp, Download, Loader2 } from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";
import { useTrialBalance } from "@/hooks/useTrialBalance";

const IncomeStatement = () => {
  const { data: trialBalanceData = [], isLoading } = useTrialBalance();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
    }).format(amount);
  };

  // Revenue accounts (type = revenue)
  const revenueAccounts = trialBalanceData.filter((r) => r.type === "revenue");
  const totalRevenue = revenueAccounts.reduce((sum, r) => sum + r.creditClosing - r.debitClosing, 0);

  // Expense accounts (type = expense)
  const expenseAccounts = trialBalanceData.filter((r) => r.type === "expense");
  const totalExpenses = expenseAccounts.reduce((sum, r) => sum + r.debitClosing - r.creditClosing, 0);

  const netIncome = totalRevenue - totalExpenses;

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              قائمة الدخل
            </h1>
            <p className="text-muted-foreground">بيانات فعلية من جميع الحركات المالية المعتمدة</p>
          </div>
          <Button variant="outline" className="gap-2" disabled={isLoading} onClick={() => {
            const headers = ["البند", "المبلغ"];
            const rows: (string | number)[][] = [];
            rows.push(["--- الإيرادات ---", ""]);
            revenueAccounts.forEach((r) => {
              rows.push([`${r.code} - ${r.name}`, r.creditClosing - r.debitClosing]);
            });
            rows.push(["إجمالي الإيرادات", totalRevenue]);
            rows.push(["", ""]);
            rows.push(["--- المصروفات ---", ""]);
            expenseAccounts.forEach((r) => {
              rows.push([`${r.code} - ${r.name}`, -(r.debitClosing - r.creditClosing)]);
            });
            rows.push(["إجمالي المصروفات", -totalExpenses]);
            rows.push(["", ""]);
            rows.push(["صافي الربح / (الخسارة)", netIncome]);
            exportToExcel(headers, rows, "قائمة_الدخل", { title: "قائمة الدخل", subtitle: `تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")}`, showTotalsRow: false });
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
          <div className="bg-card rounded-xl border border-border p-6 max-w-2xl">
            {/* Revenue Section */}
            <div className="space-y-3">
              <h3 className="font-bold text-lg border-b pb-2">الإيرادات</h3>
              {revenueAccounts.length === 0 ? (
                <p className="text-muted-foreground text-sm pr-4">لا توجد إيرادات مسجلة</p>
              ) : (
                revenueAccounts.map((r) => (
                  <div key={r.code} className="flex justify-between pr-4">
                    <span>{r.code} - {r.name}</span>
                    <span>{formatCurrency(r.creditClosing - r.debitClosing)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between font-semibold bg-muted p-2 rounded">
                <span>إجمالي الإيرادات</span>
                <span className="text-success">{formatCurrency(totalRevenue)}</span>
              </div>
            </div>

            {/* Expenses Section */}
            <div className="space-y-3 mt-6">
              <h3 className="font-bold text-lg border-b pb-2">المصروفات</h3>
              {expenseAccounts.length === 0 ? (
                <p className="text-muted-foreground text-sm pr-4">لا توجد مصروفات مسجلة</p>
              ) : (
                expenseAccounts.map((r) => (
                  <div key={r.code} className="flex justify-between pr-4">
                    <span>{r.code} - {r.name}</span>
                    <span className="text-danger">({formatCurrency(r.debitClosing - r.creditClosing)})</span>
                  </div>
                ))
              )}
              <div className="flex justify-between font-semibold bg-muted p-2 rounded">
                <span>إجمالي المصروفات</span>
                <span className="text-danger">({formatCurrency(totalExpenses)})</span>
              </div>
            </div>

            {/* Net Income */}
            <div className={`mt-6 p-4 rounded-lg ${netIncome >= 0 ? 'bg-success-light' : 'bg-danger-light'}`}>
              <div className="flex justify-between font-bold text-xl">
                <span>صافي الربح / (الخسارة)</span>
                <span className={netIncome >= 0 ? 'text-success' : 'text-danger'}>
                  {formatCurrency(netIncome)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default IncomeStatement;
