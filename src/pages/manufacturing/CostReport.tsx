import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { exportToExcel } from "@/lib/exportExcel";

export default function CostReport() {
  const { workOrders, isLoading } = useWorkOrders();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const completed = workOrders
    .filter((o) => o.status === "completed")
    .filter((o) => {
      if (fromDate && o.date < fromDate) return false;
      if (toDate && o.date > toDate) return false;
      return true;
    });

  const totals = {
    materialCost: completed.reduce((s, o) => s + o.material_cost, 0),
    laborCost: completed.reduce((s, o) => s + o.labor_cost, 0),
    overheadCost: completed.reduce((s, o) => s + o.overhead_cost, 0),
    totalCost: completed.reduce((s, o) => s + o.total_cost, 0),
    totalLoss: completed.reduce((s, o) => s + o.total_loss_weight, 0),
    totalInput: completed.reduce((s, o) => s + o.total_gold_input_weight, 0),
    totalOutput: completed.reduce((s, o) => s + o.total_output_weight, 0),
  };

  const avgLoss = totals.totalInput > 0 ? (totals.totalLoss / totals.totalInput) * 100 : 0;

  const handleExport = () => {
    const rows = completed.map((o) => ({
      "رقم الأمر": o.number,
      "التاريخ": o.date,
      "المنتج": o.product_name,
      "العيار": o.target_karat,
      "وزن المدخلات": o.total_gold_input_weight,
      "وزن المخرجات": o.total_output_weight,
      "الفاقد": o.total_loss_weight,
      "نسبة الفاقد %": o.loss_percentage.toFixed(1),
      "تكلفة المواد": o.material_cost,
      "المصنعية": o.labor_cost,
      "تكاليف إضافية": o.overhead_cost,
      "التكلفة الإجمالية": o.total_cost,
    }));
    const headers = Object.keys(rows[0] || {});
    const dataRows = rows.map((r) => Object.values(r) as (string | number)[]);
    exportToExcel(headers, dataRows, "تقرير_تكاليف_التصنيع");
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">تقرير التكاليف</h1>
            <p className="text-muted-foreground">تحليل تكاليف أوامر التشغيل المكتملة</p>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={completed.length === 0}>
            <Download className="w-4 h-4 ml-2" />
            تصدير Excel
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div>
                <label className="text-sm text-muted-foreground">من تاريخ</label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">إلى تاريخ</label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">إجمالي تكلفة المواد</p>
              <p className="text-xl font-bold">{totals.materialCost.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">إجمالي المصنعية</p>
              <p className="text-xl font-bold">{totals.laborCost.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">إجمالي التكاليف</p>
              <p className="text-xl font-bold text-primary">{totals.totalCost.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">متوسط نسبة الفاقد</p>
              <p className="text-xl font-bold text-destructive">{avgLoss.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الأمر</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المنتج</TableHead>
                  <TableHead>العيار</TableHead>
                  <TableHead>وزن المدخلات</TableHead>
                  <TableHead>وزن المخرجات</TableHead>
                  <TableHead>الفاقد</TableHead>
                  <TableHead>نسبة الفاقد</TableHead>
                  <TableHead>تكلفة المواد</TableHead>
                  <TableHead>المصنعية</TableHead>
                  <TableHead>التكلفة الإجمالية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completed.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">لا توجد أوامر مكتملة</TableCell></TableRow>
                ) : (
                  completed.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono">{o.number}</TableCell>
                      <TableCell>{o.date}</TableCell>
                      <TableCell>{o.product_name}</TableCell>
                      <TableCell>{o.target_karat}</TableCell>
                      <TableCell>{o.total_gold_input_weight.toFixed(2)}</TableCell>
                      <TableCell>{o.total_output_weight.toFixed(2)}</TableCell>
                      <TableCell className="text-destructive">{o.total_loss_weight.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={o.loss_percentage > 5 ? "destructive" : "secondary"}>
                          {o.loss_percentage.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{o.material_cost.toLocaleString()}</TableCell>
                      <TableCell>{o.labor_cost.toLocaleString()}</TableCell>
                      <TableCell className="font-bold">{o.total_cost.toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
                {completed.length > 0 && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4}>الإجمالي</TableCell>
                    <TableCell>{totals.totalInput.toFixed(2)}</TableCell>
                    <TableCell>{totals.totalOutput.toFixed(2)}</TableCell>
                    <TableCell className="text-destructive">{totals.totalLoss.toFixed(2)}</TableCell>
                    <TableCell>{avgLoss.toFixed(1)}%</TableCell>
                    <TableCell>{totals.materialCost.toLocaleString()}</TableCell>
                    <TableCell>{totals.laborCost.toLocaleString()}</TableCell>
                    <TableCell>{totals.totalCost.toLocaleString()}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
