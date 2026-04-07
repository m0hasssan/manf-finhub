import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Receipt, Loader2, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDeleteSalesInvoice } from "@/hooks/useDeleteInvoice";
import { usePermissions } from "@/hooks/usePermissions";

type SortField = "date" | "number" | "customer" | "subtotal" | "total";
type SortDir = "asc" | "desc";

const ConfirmedSalesInvoices = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { can } = usePermissions();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["confirmed_sales_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoices")
        .select("*, customers(name)")
        .eq("status", "accepted")
        .order("date", { ascending: false });
      if (error) throw error;

      const withLines = await Promise.all(
        (data || []).map(async (inv) => {
          const { data: lines } = await supabase
            .from("sales_invoice_lines")
            .select("*, inventory_items(name)")
            .eq("invoice_id", inv.id);
          return {
            ...inv,
            lines: (lines || []).map((l: any) => ({
              item_name: l.inventory_items?.name || "صنف",
              quantity: l.quantity,
              unit_price: l.unit_price,
              total: l.total,
            })),
          };
        })
      );
      return withLines;
    },
  });

  const deleteMutation = useDeleteSalesInvoice();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);
  const formatDate = (d: string) => new Date(d).toLocaleDateString("ar-EG");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const processed = useMemo(() => {
    let result = invoices || [];
    if (searchQuery) {
      result = result.filter((inv) =>
        inv.number.includes(searchQuery) ||
        (inv.customers as any)?.name?.includes(searchQuery) ||
        String(inv.total).includes(searchQuery)
      );
    }
    if (dateFrom) result = result.filter((inv) => inv.date >= dateFrom);
    if (dateTo) result = result.filter((inv) => inv.date <= dateTo);

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date": cmp = a.date.localeCompare(b.date); break;
        case "number": cmp = a.number.localeCompare(b.number); break;
        case "customer": cmp = ((a.customers as any)?.name || "").localeCompare((b.customers as any)?.name || ""); break;
        case "subtotal": cmp = Number(a.subtotal) - Number(b.subtotal); break;
        case "total": cmp = Number(a.total) - Number(b.total); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [invoices, searchQuery, dateFrom, dateTo, sortField, sortDir]);

  const totalAmount = invoices?.reduce((s, inv) => s + Number(inv.total), 0) || 0;
  const totalDiscount = invoices?.reduce((s, inv) => s + Number(inv.discount), 0) || 0;
  const totalTax = invoices?.reduce((s, inv) => s + Number(inv.tax_amount), 0) || 0;
  const totalSubtotal = invoices?.reduce((s, inv) => s + Number(inv.subtotal), 0) || 0;

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" />
            فواتير البيع المؤكدة
          </h1>
          <p className="text-muted-foreground">عرض جميع فواتير البيع التي تم تأكيدها</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">عدد الفواتير</p>
            <p className="text-2xl font-bold">{invoices?.length || 0}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">المجموع الفرعي</p>
            <p className="text-2xl font-bold">{formatCurrency(totalSubtotal)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">إجمالي الخصومات</p>
            <p className="text-2xl font-bold text-warning">{formatCurrency(totalDiscount)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">إجمالي الضرائب</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalTax)}</p>
          </div>
          <div className="stat-card stat-card-success">
            <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="w-4 h-4" />
            فلتر وبحث
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
            </div>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          {(searchQuery || dateFrom || dateTo) && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">عدد النتائج: {processed.length}</span>
              <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setDateFrom(""); setDateTo(""); }}>مسح الفلتر</Button>
            </div>
          )}
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
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("date")}>
                    <span className="flex items-center gap-1">التاريخ <SortIcon field="date" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("number")}>
                    <span className="flex items-center gap-1">رقم الفاتورة <SortIcon field="number" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("customer")}>
                    <span className="flex items-center gap-1">العميل <SortIcon field="customer" /></span>
                  </TableHead>
                   <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("subtotal")}>
                     <span className="flex items-center gap-1">المجموع <SortIcon field="subtotal" /></span>
                   </TableHead>
                   <TableHead>الأصناف</TableHead>
                   <TableHead>الضريبة</TableHead>
                   <TableHead>الخصم</TableHead>
                   <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("total")}>
                     <span className="flex items-center gap-1">الإجمالي <SortIcon field="total" /></span>
                   </TableHead>
                   <TableHead>الحالة</TableHead>
                   <TableHead className="w-16">حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {processed.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">لا توجد فواتير مؤكدة</TableCell>
                   </TableRow>
                ) : (
                  processed.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{formatDate(inv.date)}</TableCell>
                      <TableCell className="font-mono">{inv.number}</TableCell>
                      <TableCell>{(inv.customers as any)?.name}</TableCell>
                       <TableCell>{formatCurrency(Number(inv.subtotal))}</TableCell>
                       <TableCell>
                         <div className="space-y-1">
                           {(inv as any).lines?.map((line: any, i: number) => (
                             <div key={i} className="text-xs">
                               <span className="font-medium">{line.item_name}</span>
                               <span className="text-muted-foreground"> × {line.quantity}</span>
                             </div>
                           ))}
                         </div>
                       </TableCell>
                       <TableCell>{formatCurrency(Number(inv.tax_amount))}</TableCell>
                       <TableCell>{formatCurrency(Number(inv.discount))}</TableCell>
                       <TableCell className="font-semibold">{formatCurrency(Number(inv.total))}</TableCell>
                       <TableCell><Badge className="bg-success text-success-foreground">مؤكدة</Badge></TableCell>
                       <TableCell>
                         {can("invoices_confirmed_sales", "delete") && (
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                 <Trash2 className="w-4 h-4" />
                               </Button>
                             </AlertDialogTrigger>
                             <AlertDialogContent>
                               <AlertDialogHeader>
                                 <AlertDialogTitle>حذف الفاتورة {inv.number}؟</AlertDialogTitle>
                                 <AlertDialogDescription>
                                   سيتم حذف الفاتورة نهائياً وإرجاع كميات المخزون وحذف القيود المحاسبية المرتبطة. هذا الإجراء لا يمكن التراجع عنه.
                                 </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter>
                                 <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                 <AlertDialogAction
                                   className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                   onClick={() => deleteMutation.mutate(inv.id)}
                                 >
                                   حذف نهائي
                                 </AlertDialogAction>
                               </AlertDialogFooter>
                             </AlertDialogContent>
                           </AlertDialog>
                         )}
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

export default ConfirmedSalesInvoices;
