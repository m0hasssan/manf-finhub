import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface RevenueExpensePieChartProps {
  totalRevenue: number;
  totalExpenses: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(amount);

export function RevenueExpensePieChart({ totalRevenue, totalExpenses }: RevenueExpensePieChartProps) {
  const data = [
    { name: "الإيرادات", value: totalRevenue },
    { name: "المصروفات", value: totalExpenses },
  ];

  const COLORS = ["hsl(var(--success))", "hsl(var(--danger))"];
  const hasData = totalRevenue > 0 || totalExpenses > 0;
  const netProfit = totalRevenue - totalExpenses;

  return (
    <div className="bg-card rounded-xl border border-border p-4 h-full">
      <h3 className="font-semibold mb-2 text-sm">ملخص الأرباح</h3>
      {!hasData ? (
        <div className="flex items-center justify-center h-[280px] text-muted-foreground">
          <p className="text-sm">لا توجد بيانات</p>
        </div>
      ) : (
        <>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    direction: "rtl",
                    fontSize: 12,
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">الإيرادات</span>
              <span className="font-semibold text-success">{formatCurrency(totalRevenue)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">المصروفات</span>
              <span className="font-semibold text-danger">{formatCurrency(totalExpenses)}</span>
            </div>
            <div className="border-t border-border pt-2 flex items-center justify-between text-xs">
              <span className="font-medium">صافي الربح</span>
              <span className={`font-bold ${netProfit >= 0 ? "text-success" : "text-danger"}`}>
                {formatCurrency(netProfit)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
