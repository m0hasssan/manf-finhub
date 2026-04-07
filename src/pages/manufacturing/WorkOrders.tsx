import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Eye, CheckCircle, Factory, Weight, TrendingDown, DollarSign } from "lucide-react";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkOrderDialog } from "@/components/manufacturing/WorkOrderDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  draft: "secondary",
  in_progress: "default",
  completed: "default",
  cancelled: "destructive",
};

export default function WorkOrders() {
  const { workOrders, isLoading, deleteWorkOrder, completeWorkOrder } = useWorkOrders();
  const { can, isAdmin } = usePermissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const canCreate = isAdmin || can("manufacturing_orders", "create");
  const canEdit = isAdmin || can("manufacturing_orders", "edit");
  const canDelete = isAdmin || can("manufacturing_orders", "delete");
  const canApprove = isAdmin || can("manufacturing_orders", "approve");

  const filtered = workOrders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search && !o.product_name.includes(search) && !o.number.includes(search)) return false;
    return true;
  });

  const stats = {
    total: workOrders.length,
    active: workOrders.filter((o) => o.status === "in_progress").length,
    totalLoss: workOrders.reduce((s, o) => s + (o.total_loss_weight || 0), 0),
    totalCost: workOrders.reduce((s, o) => s + (o.total_cost || 0), 0),
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">أوامر التشغيل</h1>
            <p className="text-muted-foreground">إدارة أوامر تشغيل وتصنيع الذهب</p>
          </div>
          {canCreate && (
            <Button onClick={() => { setEditingOrder(null); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 ml-2" />
              أمر تشغيل جديد
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Factory className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الأوامر</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Weight className="w-8 h-8 text-amber-500" />
                <div>
                  <p className="text-sm text-muted-foreground">أوامر قيد التنفيذ</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingDown className="w-8 h-8 text-destructive" />
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الفاقد (جم)</p>
                  <p className="text-2xl font-bold">{stats.totalLoss.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي التكاليف</p>
                  <p className="text-2xl font-bold">{stats.totalCost.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 flex-wrap">
              <Input
                placeholder="بحث بالاسم أو الرقم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="draft">مسودة</SelectItem>
                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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
                  <TableHead>وزن المدخلات (جم)</TableHead>
                  <TableHead>وزن المخرجات (جم)</TableHead>
                  <TableHead>الفاقد (جم)</TableHead>
                  <TableHead>التكلفة الإجمالية</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">لا توجد أوامر تشغيل</TableCell></TableRow>
                ) : (
                  filtered.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono">{order.number}</TableCell>
                      <TableCell>{order.date}</TableCell>
                      <TableCell className="font-medium">{order.product_name}</TableCell>
                      <TableCell>{order.target_karat} قيراط</TableCell>
                      <TableCell>{order.total_gold_input_weight.toFixed(2)}</TableCell>
                      <TableCell>{order.total_output_weight.toFixed(2)}</TableCell>
                      <TableCell className="text-destructive">{order.total_loss_weight.toFixed(2)}</TableCell>
                      <TableCell>{order.total_cost.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[order.status] as any}>{statusLabels[order.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {canEdit && order.status === "draft" && (
                            <Button size="sm" variant="ghost" onClick={() => { setEditingOrder(order.id); setDialogOpen(true); }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          {canApprove && order.status === "draft" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-green-600">
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>اعتماد أمر التشغيل؟</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    سيتم إنشاء قيد محاسبي تلقائي بتكلفة {order.total_cost.toLocaleString()} جنيه
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => completeWorkOrder.mutate(order.id)}>اعتماد</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {canDelete && order.status === "draft" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>حذف أمر التشغيل؟</AlertDialogTitle>
                                  <AlertDialogDescription>هل أنت متأكد من حذف أمر التشغيل {order.number}؟</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteWorkOrder.mutate(order.id)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {order.status !== "draft" && (
                            <Button size="sm" variant="ghost" onClick={() => { setEditingOrder(order.id); setDialogOpen(true); }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <WorkOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingOrderId={editingOrder}
      />
    </MainLayout>
  );
}
