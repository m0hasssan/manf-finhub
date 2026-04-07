import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Search, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/exportExcel";

interface InventoryRow {
  code: string;
  name: string;
  unit: string;
  warehouse: string;
  openingQty: number;
  openingValue: number;
  inQty: number;
  inValue: number;
  outQty: number;
  outValue: number;
  closingQty: number;
  closingValue: number;
}

const InventoryTrialBalance = () => {
  const [search, setSearch] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["inventory_trial_balance"],
    queryFn: async () => {
      const [{ data: items }, { data: movements }] = await Promise.all([
        supabase.from("inventory_items").select("*").eq("is_active", true).order("code"),
        supabase.from("inventory_movements").select("*"),
      ]);

      if (!items) return [];

      const movementMap: Record<string, { inQty: number; inValue: number; outQty: number; outValue: number }> = {};

      for (const mov of movements || []) {
        if (!movementMap[mov.item_id]) {
          movementMap[mov.item_id] = { inQty: 0, inValue: 0, outQty: 0, outValue: 0 };
        }
        const m = movementMap[mov.item_id];
        if (mov.type === "in") {
          m.inQty += Number(mov.quantity);
          m.inValue += Number(mov.total);
        } else {
          m.outQty += Number(mov.quantity);
          m.outValue += Number(mov.total);
        }
      }

      const result: InventoryRow[] = items.map((item) => {
        const mov = movementMap[item.id] || { inQty: 0, inValue: 0, outQty: 0, outValue: 0 };
        const costPrice = Number(item.cost_price || 0);
        const openingQty = Number((item as any).opening_stock || 0);
        const openingValue = openingQty * costPrice;
        const closingQty = openingQty + mov.inQty - mov.outQty;
        const closingValue = closingQty * costPrice;

        return {
          code: item.code,
          name: item.name,
          unit: item.unit,
          warehouse: item.warehouse || "المخزن الرئيسي",
          openingQty,
          openingValue,
          inQty: mov.inQty,
          inValue: mov.inValue,
          outQty: mov.outQty,
          outValue: mov.outValue,
          closingQty,
          closingValue,
        };
      });

      return result;
    },
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(n);
  const formatQty = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

  const filtered = (rows || []).filter(
    (r) => r.name.includes(search) || r.code.includes(search)
  );

  const totals = filtered.reduce(
    (acc, r) => ({
      openingValue: acc.openingValue + r.openingValue,
      inValue: acc.inValue + r.inValue,
      outValue: acc.outValue + r.outValue,
      closingValue: acc.closingValue + r.closingValue,
    }),
    { openingValue: 0, inValue: 0, outValue: 0, closingValue: 0 }
  );

  const handleExport = () => {
    const headers = [
      "الكود", "الصنف", "الوحدة", "المخزن",
      "كمية افتتاحي", "قيمة افتتاحي",
      "كمية وارد", "قيمة وارد",
      "كمية صادر", "قيمة صادر",
      "كمية ختامي", "قيمة ختامي",
    ];
    const data = filtered.map((r) => [
      r.code, r.name, r.unit, r.warehouse,
      r.openingQty, r.openingValue,
      r.inQty, r.inValue,
      r.outQty, r.outValue,
      r.closingQty, r.closingValue,
    ]);
    data.push(["", "الإجمالي", "", "", "", totals.openingValue, "", totals.inValue, "", totals.outValue, "", totals.closingValue]);
    exportToExcel(headers, data, "ميزان_مراجعة_المخزون", {
      title: "ميزان مراجعة المخزون",
      subtitle: `تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")}`,
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" />
              ميزان مراجعة المخزون
            </h1>
            <p className="text-muted-foreground">عرض حركات المخزون كمية وقيمة لكل صنف</p>
          </div>
          {filtered.length > 0 && (
            <Button variant="outline" className="gap-2" onClick={handleExport}>
              <Download className="w-4 h-4" />
              تصدير Excel
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">قيمة المخزون الافتتاحي</p>
            <p className="text-xl font-bold">{formatCurrency(totals.openingValue)}</p>
          </div>
          <div className="stat-card stat-card-success">
            <p className="text-sm text-muted-foreground">إجمالي الوارد</p>
            <p className="text-xl font-bold text-success">{formatCurrency(totals.inValue)}</p>
          </div>
          <div className="stat-card stat-card-warning">
            <p className="text-sm text-muted-foreground">إجمالي الصادر</p>
            <p className="text-xl font-bold text-warning">{formatCurrency(totals.outValue)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">قيمة المخزون الختامي</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(totals.closingValue)}</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الكود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>

        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead rowSpan={2}>الكود</TableHead>
                  <TableHead rowSpan={2}>الصنف</TableHead>
                  <TableHead rowSpan={2}>الوحدة</TableHead>
                  <TableHead rowSpan={2}>المخزن</TableHead>
                  <TableHead colSpan={2} className="text-center border-x border-border">الرصيد الافتتاحي</TableHead>
                  <TableHead colSpan={2} className="text-center border-x border-border">الوارد</TableHead>
                  <TableHead colSpan={2} className="text-center border-x border-border">الصادر</TableHead>
                  <TableHead colSpan={2} className="text-center border-x border-border">الرصيد الختامي</TableHead>
                </TableRow>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-center">كمية</TableHead>
                  <TableHead className="text-center">قيمة</TableHead>
                  <TableHead className="text-center">كمية</TableHead>
                  <TableHead className="text-center">قيمة</TableHead>
                  <TableHead className="text-center">كمية</TableHead>
                  <TableHead className="text-center">قيمة</TableHead>
                  <TableHead className="text-center">كمية</TableHead>
                  <TableHead className="text-center">قيمة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      لا توجد أصناف
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filtered.map((row) => (
                      <TableRow key={row.code}>
                        <TableCell className="font-mono text-sm">{row.code}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.unit}</TableCell>
                        <TableCell className="text-sm">{row.warehouse}</TableCell>
                        <TableCell className="text-center">{formatQty(row.openingQty)}</TableCell>
                        <TableCell className="text-center text-sm">{formatCurrency(row.openingValue)}</TableCell>
                        <TableCell className="text-center font-semibold text-success">{row.inQty > 0 ? formatQty(row.inQty) : "-"}</TableCell>
                        <TableCell className="text-center text-sm text-success">{row.inValue > 0 ? formatCurrency(row.inValue) : "-"}</TableCell>
                        <TableCell className="text-center font-semibold text-destructive">{row.outQty > 0 ? formatQty(row.outQty) : "-"}</TableCell>
                        <TableCell className="text-center text-sm text-destructive">{row.outValue > 0 ? formatCurrency(row.outValue) : "-"}</TableCell>
                        <TableCell className="text-center font-bold">{formatQty(row.closingQty)}</TableCell>
                        <TableCell className="text-center font-bold text-primary">{formatCurrency(row.closingValue)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={4} className="text-center">الإجمالي</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center">{formatCurrency(totals.openingValue)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center text-success">{formatCurrency(totals.inValue)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center text-destructive">{formatCurrency(totals.outValue)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center text-primary">{formatCurrency(totals.closingValue)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default InventoryTrialBalance;
