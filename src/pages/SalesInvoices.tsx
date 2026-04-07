import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Receipt, Loader2, Search, Edit, ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSalesInvoices, useUpdateSalesInvoiceStatus } from "@/hooks/useInvoices";
import { useIsAdmin } from "@/hooks/useUserRole";
import { EditInvoiceDialog } from "@/components/inventory/EditInvoiceDialog";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "معلقة", variant: "secondary" },
  approved: { label: "مقبولة", variant: "default" },
  rejected: { label: "مرفوضة", variant: "destructive" },
};

type SortField = "date" | "number" | "customer" | "subtotal" | "total" | "status";
type SortDir = "asc" | "desc";

const SalesInvoices = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editInvoice, setEditInvoice] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: invoices, isLoading } = useSalesInvoices();
  const updateStatus = useUpdateSalesInvoiceStatus();
  const isAdmin = useIsAdmin();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("ar-EG");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const processed = useMemo(() => {
    let result = invoices || [];

    // Text search
    if (searchQuery) {
      result = result.filter((inv) =>
        inv.number.includes(searchQuery) ||
        (inv.customers as any)?.name?.includes(searchQuery) ||
        String(inv.total).includes(searchQuery)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((inv) => inv.status === statusFilter);
    }

    // Date range filter
    if (dateFrom) {
      result = result.filter((inv) => inv.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((inv) => inv.date <= dateTo);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp = a.date.localeCompare(b.date);
          break;
        case "number":
          cmp = a.number.localeCompare(b.number);
          break;
        case "customer":
          cmp = ((a.customers as any)?.name || "").localeCompare((b.customers as any)?.name || "");
          break;
        case "subtotal":
          cmp = Number(a.subtotal) - Number(b.subtotal);
          break;
        case "total":
          cmp = Number(a.total) - Number(b.total);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [invoices, searchQuery, statusFilter, dateFrom, dateTo, sortField, sortDir]);

  const totalAmount = invoices?.reduce((s, inv) => s + Number(inv.total), 0) || 0;
  const approvedCount = invoices?.filter((inv) => inv.status === "approved").length || 0;
  const pendingCount = invoices?.filter((inv) => inv.status === "pending").length || 0;

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="w-6 h-6 text-primary" />
              فواتير البيع
            </h1>
            <p className="text-muted-foreground">يتم إنشاء فواتير البيع تلقائياً من حركة المخازن (إذن الصرف)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">عدد الفواتير</p>
            <p className="text-2xl font-bold">{invoices?.length || 0}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">معلقة</p>
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">مقبولة</p>
            <p className="text-2xl font-bold text-success">{approvedCount}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالرقم أو العميل أو المبلغ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="حالة الفاتورة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">معلقة</SelectItem>
                <SelectItem value="approved">مقبولة</SelectItem>
                <SelectItem value="rejected">مرفوضة</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="من تاريخ"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="إلى تاريخ"
            />
          </div>
          {(searchQuery || statusFilter !== "all" || dateFrom || dateTo) && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">عدد النتائج: {processed.length}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearchQuery(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); }}
              >
                مسح الفلتر
              </Button>
            </div>
          )}
        </div>

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
                  <TableHead>الضريبة</TableHead>
                  <TableHead>الخصم</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("total")}>
                    <span className="flex items-center gap-1">الإجمالي <SortIcon field="total" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")}>
                    <span className="flex items-center gap-1">الحالة <SortIcon field="status" /></span>
                  </TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد فواتير بيع</TableCell>
                  </TableRow>
                ) : (
                  processed.map((inv) => {
                    const st = statusMap[inv.status] || statusMap.pending;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell>{formatDate(inv.date)}</TableCell>
                        <TableCell className="font-mono">{inv.number}</TableCell>
                        <TableCell>{(inv.customers as any)?.name}</TableCell>
                        <TableCell>{formatCurrency(Number(inv.subtotal))}</TableCell>
                        <TableCell>{formatCurrency(Number(inv.tax_amount))}</TableCell>
                        <TableCell>{formatCurrency(Number(inv.discount))}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(Number(inv.total))}</TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="gap-2" onClick={() => setEditInvoice(inv)}>
                            <Edit className="w-4 h-4" />
                            تعديل
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <EditInvoiceDialog
        open={!!editInvoice}
        onOpenChange={(open) => !open && setEditInvoice(null)}
        invoice={editInvoice}
        type="sales"
        onStatusChange={(id, status) => updateStatus.mutate({ invoiceId: id, status })}
        isAdmin={isAdmin}
      />
    </MainLayout>
  );
};

export default SalesInvoices;
