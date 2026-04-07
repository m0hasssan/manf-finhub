import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Package, Plus, Search, Loader2, Upload, Download, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";
import { ImportExcelDialog } from "@/components/ImportExcelDialog";
import { Badge } from "@/components/ui/badge";
import { useInventoryItemsFull, useDeleteInventoryItem } from "@/hooks/useInventory";
import { InventoryItemDialog } from "@/components/inventory/InventoryItemDialog";
import type { Tables } from "@/integrations/supabase/types";
import { usePermissions } from "@/hooks/usePermissions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type SortKey = "code" | "name" | "unit" | "category" | "warehouse" | "cost_price" | "sell_price" | "current_stock" | "min_stock" | "account_name";
type SortDir = "asc" | "desc";

const InventoryItems = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editItem, setEditItem] = useState<Tables<"inventory_items"> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: items, isLoading } = useInventoryItemsFull();
  const deleteItem = useDeleteInventoryItem();
  const { can } = usePermissions();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);

  const categories = useMemo(() => [...new Set(items?.map(i => i.category).filter(Boolean) || [])], [items]);
  const warehouses = useMemo(() => [...new Set(items?.map(i => i.warehouse).filter(Boolean) || [])], [items]);
  const accountNames = useMemo(() => {
    const names = items?.map(i => (i as any).accounts?.name).filter(Boolean) || [];
    return [...new Set(names)] as string[];
  }, [items]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const filtered = useMemo(() => {
    let result = items?.filter((item) =>
      item.name.includes(searchQuery) || item.code.includes(searchQuery) || (item.category || "").includes(searchQuery)
    ) || [];

    if (categoryFilter !== "all") result = result.filter(i => i.category === categoryFilter);
    if (warehouseFilter !== "all") result = result.filter(i => i.warehouse === warehouseFilter);
    if (statusFilter === "active") result = result.filter(i => i.is_active);
    if (statusFilter === "inactive") result = result.filter(i => !i.is_active);
    if (stockFilter === "low") result = result.filter(i => (i.current_stock || 0) <= (i.min_stock || 0) && i.is_active);
    if (stockFilter === "ok") result = result.filter(i => (i.current_stock || 0) > (i.min_stock || 0));
    if (accountFilter === "linked") result = result.filter(i => (i as any).accounts?.code);
    if (accountFilter === "unlinked") result = result.filter(i => !(i as any).accounts?.code);
    if (accountFilter !== "all" && accountFilter !== "linked" && accountFilter !== "unlinked") {
      result = result.filter(i => (i as any).accounts?.name === accountFilter);
    }

    if (sortKey) {
      result = [...result].sort((a, b) => {
        let av: any, bv: any;
        if (sortKey === "account_name") {
          av = (a as any).accounts?.code || "";
          bv = (b as any).accounts?.code || "";
        } else {
          av = a[sortKey] ?? "";
          bv = b[sortKey] ?? "";
        }
        if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
        return sortDir === "asc" ? String(av).localeCompare(String(bv), "ar") : String(bv).localeCompare(String(av), "ar");
      });
    }

    return result;
  }, [items, searchQuery, categoryFilter, warehouseFilter, statusFilter, stockFilter, accountFilter, sortKey, sortDir]);

  const handleDelete = () => {
    if (!deleteId) return;
    deleteItem.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" />
              إدارة المخزون
            </h1>
            <p className="text-muted-foreground">إدارة الأصناف والمنتجات في المخزون</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => {
              const headers = ["الكود", "الاسم", "الوحدة", "الفئة", "المخزن", "سعر التكلفة", "سعر البيع", "الرصيد", "الحد الأدنى", "حساب الشجرة"];
              const rows = filtered.map(item => [
                item.code,
                item.name,
                item.unit,
                item.category || "-",
                item.warehouse || "-",
                item.cost_price || 0,
                item.sell_price || 0,
                item.current_stock || 0,
                item.min_stock || 0,
                (item as any).accounts?.code ? `${(item as any).accounts.code} - ${(item as any).accounts.name}` : "غير مربوط",
              ]);
              exportToExcel(headers, rows, "أصناف_المخزون", {
                title: "تقرير أصناف المخزون",
                subtitle: `عدد الأصناف: ${filtered.length}`,
                showTotalsRow: false,
              });
            }}>
              <Download className="w-4 h-4" />
              تصدير Excel
            </Button>
            {can("inventory_items", "create") && (
              <>
                <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
                  <Upload className="w-4 h-4" />
                  استيراد من Excel
                </Button>
                <Button className="gap-2" onClick={() => { setEditItem(null); setDialogOpen(true); }}>
                  <Plus className="w-4 h-4" />
                  إضافة صنف
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">إجمالي الأصناف</p>
            <p className="text-2xl font-bold">{items?.length || 0}</p>
          </div>
          <div className="stat-card stat-card-success">
            <p className="text-sm text-muted-foreground">أصناف نشطة</p>
            <p className="text-2xl font-bold text-success">{items?.filter(i => i.is_active).length || 0}</p>
          </div>
          <div className="stat-card stat-card-danger">
            <p className="text-sm text-muted-foreground">مخزون منخفض</p>
            <p className="text-2xl font-bold text-danger">
              {items?.filter(i => (i.current_stock || 0) <= (i.min_stock || 0) && i.is_active).length || 0}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">إجمالي قيمة المخزون</p>
            <p className="text-2xl font-bold">
              {formatCurrency(items?.reduce((s, i) => s + (i.current_stock || 0) * (i.cost_price || 0), 0) || 0)}
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالكود أو الاسم أو الفئة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="الفئة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفئات</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c!}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="المخزن" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المخازن</SelectItem>
                  {warehouses.map(w => <SelectItem key={w} value={w!}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="المخزون" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="low">مخزون منخفض</SelectItem>
                  <SelectItem value="ok">مخزون كافي</SelectItem>
                </SelectContent>
              </Select>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="حساب الشجرة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحسابات</SelectItem>
                  <SelectItem value="linked">مربوط</SelectItem>
                  <SelectItem value="unlinked">غير مربوط</SelectItem>
                  {accountNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-sm text-muted-foreground">
            عدد الأصناف: <span className="font-bold text-foreground">{filtered.length}</span>
            {filtered.length !== (items?.length || 0) && (
              <span> من إجمالي {items?.length || 0}</span>
            )}
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
               <TableRow>
                  {([["code","الكود"],["name","الاسم"],["unit","الوحدة"],["category","الفئة"],["warehouse","المخزن"],["cost_price","سعر التكلفة"],["sell_price","سعر البيع"],["current_stock","الرصيد"],["min_stock","الحد الأدنى"],["account_name","حساب الشجرة"]] as [SortKey, string][]).map(([key, label]) => (
                    <TableHead key={key} className="cursor-pointer select-none" onClick={() => handleSort(key)}>
                      <span className="flex items-center gap-1">{label} <SortIcon col={key} /></span>
                    </TableHead>
                  ))}
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      لا توجد أصناف
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.code}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{item.category || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{item.warehouse || "-"}</TableCell>
                      <TableCell>{formatCurrency(item.cost_price || 0)}</TableCell>
                      <TableCell>{formatCurrency(item.sell_price || 0)}</TableCell>
                      <TableCell>
                        <Badge variant={
                          (item.current_stock || 0) <= (item.min_stock || 0)
                            ? "destructive"
                            : "default"
                        }>
                          {item.current_stock || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.min_stock || 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(item as any).accounts?.code ? `${(item as any).accounts.code} - ${(item as any).accounts.name}` : (
                          <Badge variant="destructive" className="text-xs">غير مربوط</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {can("inventory_items", "edit") && (
                            <Button size="icon" variant="ghost" onClick={() => { setEditItem(item); setDialogOpen(true); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {can("inventory_items", "delete") && (
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(item.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <InventoryItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editItem={editItem}
      />
      <ImportExcelDialog open={importOpen} onOpenChange={setImportOpen} type="inventory" />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا الصنف؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default InventoryItems;
