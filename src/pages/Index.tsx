import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { AccountsChart } from "@/components/dashboard/AccountsChart";
import { RevenueExpensePieChart } from "@/components/dashboard/RevenueExpensePieChart";
import { PendingTasks } from "@/components/dashboard/PendingTasks";
import { useDashboardData } from "@/hooks/useDashboardData";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  CreditCard,
} from "lucide-react";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(amount);

const formatNumber = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

const Dashboard = () => {
  const {
    treasuryBalance,
    totalRevenue,
    totalExpenses,
    customerCount,
    inventoryData,
    checksData,
    recentTransactions,
    monthlyData,
    pendingTasks,
  } = useDashboardData();

  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground">نظرة عامة على الوضع المالي للمؤسسة</p>
        </div>

        {/* KPI Cards - responsive grid with proper overflow handling */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            title="رصيد الخزينة"
            value={formatCurrency(treasuryBalance)}
            icon={Wallet}
            variant="success"
          />
          <StatCard
            title="إجمالي الإيرادات"
            value={formatCurrency(totalRevenue)}
            icon={TrendingUp}
            variant="success"
          />
          <StatCard
            title="إجمالي المصروفات"
            value={formatCurrency(totalExpenses)}
            icon={TrendingDown}
            variant="danger"
          />
          <StatCard
            title="العملاء"
            value={formatNumber(customerCount)}
            icon={Users}
          />
          <StatCard
            title="أصناف المخزون"
            value={formatNumber(inventoryData.total)}
            change={inventoryData.lowStock > 0 ? `${formatNumber(inventoryData.lowStock)} منخفض` : undefined}
            changeType="negative"
            icon={Package}
            variant={inventoryData.lowStock > 0 ? "warning" : "default"}
          />
          <StatCard
            title="شيكات معلقة"
            value={formatNumber(checksData.count)}
            change={checksData.total > 0 ? formatCurrency(checksData.total) : undefined}
            changeType="neutral"
            icon={CreditCard}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <AccountsChart data={monthlyData} />
          </div>
          <div>
            <RevenueExpensePieChart totalRevenue={totalRevenue} totalExpenses={totalExpenses} />
          </div>
        </div>

        {/* Quick Actions + Recent + Pending */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <RecentTransactions transactions={recentTransactions} />
          <PendingTasks tasks={pendingTasks} />
          <QuickActions />
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
