import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Package, ArrowUpRight, ArrowDownLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { useInventoryMovements } from "@/hooks/useInventory";

const Inventory = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: movements, isLoading } = useInventoryMovements(typeFilter);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("ar-EG");

  const filtered = movements?.filter((m) => {
    const itemName = m.inventory_items?.name || "";
    const partyName = (m.type === "out" ? m.customers?.name : m.suppliers?.name) || "";
    return itemName.includes(searchQuery) || m.reference.includes(searchQuery) || partyName.includes(searchQuery);
  }) || [];

  const totalIn = movements?.filter((m) => m.type === "in").reduce((s, m) => s + Number(m.total), 0) || 0;
  const totalOut = movements?.filter((m) => m.type === "out").reduce((s, m) => s + Number(m.total), 0) || 0;

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            حركة المخازن
          </h1>
          <p className="text-muted-foreground">عرض الحركات المعتمدة فقط - مصدر الحقيقة لشجرة الحسابات</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">إجمالي الحركات</p>
            <p className="text-2xl font-bold">{movements?.length || 0}</p>
          </div>
          <div className="stat-card stat-card-success">
            <p className="text-sm text-muted-foreground">إجمالي الوارد</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(totalIn)}</p>
          </div>
          <div className="stat-card stat-card-danger">
            <p className="text-sm text-muted-foreground">إجمالي المنصرف</p>
            <p className="text-2xl font-bold text-danger">{formatCurrency(totalOut)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">صافي الحركة</p>
            <p className={`text-2xl font-bold ${totalIn - totalOut >= 0 ? "text-success" : "text-danger"}`}>
              {formatCurrency(totalIn - totalOut)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالصنف أو المرجع أو الطرف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="نوع الحركة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحركات</SelectItem>
                <SelectItem value="in">وارد</SelectItem>
                <SelectItem value="out">منصرف</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المرجع</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الصنف</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>سعر الوحدة</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>المخزن</TableHead>
                  <TableHead>الطرف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      لا توجد حركات مخازن معتمدة
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{formatDate(movement.date)}</TableCell>
                      <TableCell className="font-mono">{movement.reference}</TableCell>
                      <TableCell>
                        <Badge className={movement.type === "in" ? "bg-success text-success-foreground" : "bg-danger text-danger-foreground"}>
                          {movement.type === "in" ? (
                            <span className="flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" />وارد</span>
                          ) : (
                            <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />منصرف</span>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{movement.inventory_items?.name}</TableCell>
                      <TableCell>{movement.quantity}</TableCell>
                      <TableCell>{formatCurrency(Number(movement.unit_price))}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(Number(movement.total))}</TableCell>
                      <TableCell className="text-muted-foreground">{movement.warehouse}</TableCell>
                      <TableCell>
                        {movement.type === "out" ? movement.customers?.name : movement.suppliers?.name}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Inventory;
