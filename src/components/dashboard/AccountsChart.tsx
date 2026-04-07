import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ChartData {
  month: string;
  income: number;
  expenses: number;
}

interface AccountsChartProps {
  data: ChartData[];
}

export function AccountsChart({ data }: AccountsChartProps) {
  const hasData = data.length > 0;

  return (
    <div className="bg-card rounded-xl border border-border p-4 h-full">
      <h3 className="font-semibold mb-4 text-sm">الإيرادات والمصروفات الشهرية</h3>
      <div className="h-[280px]">
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">لا توجد بيانات مالية لعرضها بعد</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(value) =>
                  value >= 1000000
                    ? `${(value / 1000000).toFixed(1)}M`
                    : value >= 1000
                    ? `${(value / 1000).toFixed(0)}k`
                    : `${value}`
                }
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={45}
              />
              <Tooltip
                formatter={(value: number) =>
                  new Intl.NumberFormat("ar-EG", {
                    style: "currency",
                    currency: "EGP",
                    maximumFractionDigits: 0,
                  }).format(value)
                }
                labelStyle={{ textAlign: "right", fontWeight: 600, fontSize: 12 }}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  direction: "rtl",
                  fontSize: 12,
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "8px", fontSize: "11px" }}
              />
              <Bar
                dataKey="income"
                name="الإيرادات"
                fill="hsl(var(--success))"
                radius={[4, 4, 0, 0]}
                barSize={18}
              />
              <Bar
                dataKey="expenses"
                name="المصروفات"
                fill="hsl(var(--danger))"
                radius={[4, 4, 0, 0]}
                barSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
