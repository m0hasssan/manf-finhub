import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, FileCheck, CheckCircle, AlertCircle, MoreHorizontal, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { NewCustodyDialog } from "@/components/custody/NewCustodyDialog";
import { SettleCustodyDialog } from "@/components/custody/SettleCustodyDialog";
import type { Tables } from "@/integrations/supabase/types";
import { usePermissions } from "@/hooks/usePermissions";

type CustodyRow = Tables<"custodies">;

type SortField = "date" | "amount" | "remaining_amount" | "number";
type SortDir = "asc" | "desc";

const Custody = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [custodies, setCustodies] = useState<CustodyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [editData, setEditData] = useState<CustodyRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { can } = usePermissions();

  const fetchCustodies = async () => {
    setLoading(true);
    const { data } = await supabase.from("custodies").select("*").order("created_at", { ascending: false });
    setCustodies(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCustodies(); }, []);

  const lastCusNum = custodies.length > 0
    ? Math.max(...custodies.map(c => parseInt(c.number?.replace("CUS-", "")) || 0))
    : 0;
  const nextNumber = `CUS-${String(lastCusNum + 1).padStart(3, "0")}`;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("ar-EG");

  const statusColors: Record<string, string> = {
    active: "bg-warning text-warning-foreground",
    partial: "bg-primary text-primary-foreground",
    settled: "bg-success text-success-foreground",
  };
  const statusLabels: Record<string, string> = {
    active: "نشطة",
    partial: "مسواة جزئياً",
    settled: "مسواة",
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    let list = custodies.filter(
      (c) =>
        c.employee_name.includes(searchQuery) ||
        c.number.includes(searchQuery) ||
        (c.department || "").includes(searchQuery) ||
        c.purpose.includes(searchQuery)
    );
    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }
    list.sort((a, b) => {
      let va: any = a[sortField];
      let vb: any = b[sortField];
      if (sortField === "date") { va = new Date(va).getTime(); vb = new Date(vb).getTime(); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [custodies, searchQuery, statusFilter, sortField, sortDir]);

  const totalActive = custodies.filter((c) => c.status === "active").reduce((s, c) => s + c.remaining_amount, 0);
  const totalPartial = custodies.filter((c) => c.status === "partial").reduce((s, c) => s + c.remaining_amount, 0);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("custodies").delete().eq("id", deleteId);
    if (error) {
      toast.error("خطأ في الحذف: " + error.message);
    } else {
      toast.success("تم حذف العهدة");
      fetchCustodies();
    }
    setDeleteId(null);
  };

  const handleEditSave = async (updated: Partial<CustodyRow>) => {
    if (!editData) return;
    const { error } = await supabase.from("custodies").update({
      employee_name: updated.employee_name,
      department: updated.department,
      purpose: updated.purpose,
      notes: updated.notes,
      date: updated.date,
    }).eq("id", editData.id);
    if (error) {
      toast.error("خطأ في التحديث: " + error.message);
    } else {
      toast.success("تم تحديث العهدة");
      fetchCustodies();
    }
    setEditData(null);
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-primary" : "text-muted-foreground/50"}`} />
      </span>
    </TableHead>
  );

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileCheck className="w-6 h-6 text-primary" />
              العهد
            </h1>
            <p className="text-muted-foreground">إدارة العهد وتسوياتها</p>
          </div>
          <div className="flex gap-2">
            {can("custody", "create") && (
              <Button className="gap-2" onClick={() => setNewOpen(true)}>
                <Plus className="w-4 h-4" />
                عهدة جديدة
              </Button>
            )}
            {can("custody", "settle") && (
              <Button variant="outline" className="gap-2" onClick={() => setSettleOpen(true)}>
                <CheckCircle className="w-4 h-4" />
                تسوية عهدة
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">إجمالي العهد</p>
            <p className="text-2xl font-bold">{custodies.length}</p>
          </div>
          <div className="stat-card stat-card-warning">
            <p className="text-sm text-muted-foreground">عهد نشطة</p>
            <p className="text-2xl font-bold">{formatCurrency(totalActive)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">مسواة جزئياً</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalPartial)}</p>
          </div>
          <div className="stat-card stat-card-danger">
            <p className="text-sm text-muted-foreground">إجمالي المعلق</p>
            <p className="text-2xl font-bold text-danger">{formatCurrency(totalActive + totalPartial)}</p>
          </div>
        </div>

        {totalActive + totalPartial > 0 && (
          <div className="bg-warning-light border border-warning/20 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-warning" />
            <p className="text-sm">
              يوجد عهد معلقة بقيمة <span className="font-bold">{formatCurrency(totalActive + totalPartial)}</span> تحتاج إلى تسوية
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-card rounded-xl border border-border p-4 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالموظف أو رقم العهدة أو الغرض..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="active">نشطة</SelectItem>
              <SelectItem value="partial">مسواة جزئياً</SelectItem>
              <SelectItem value="settled">مسواة</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader field="number">رقم العهدة</SortHeader>
                <SortHeader field="date">التاريخ</SortHeader>
                <TableHead>الموظف</TableHead>
                <TableHead>القسم</TableHead>
                <TableHead>الغرض</TableHead>
                <SortHeader field="amount">المبلغ</SortHeader>
                <TableHead>المسوى</TableHead>
                <SortHeader field="remaining_amount">المتبقي</SortHeader>
                <TableHead>الحالة</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">لا توجد عهد</TableCell></TableRow>
              ) : (
                filtered.map((custody) => (
                  <TableRow key={custody.id}>
                    <TableCell className="font-mono">{custody.number}</TableCell>
                    <TableCell>{formatDate(custody.date)}</TableCell>
                    <TableCell className="font-medium">{custody.employee_name}</TableCell>
                    <TableCell>{custody.department}</TableCell>
                    <TableCell className="text-muted-foreground">{custody.purpose}</TableCell>
                    <TableCell>{formatCurrency(custody.amount)}</TableCell>
                    <TableCell className="text-success">{formatCurrency(custody.settled_amount)}</TableCell>
                    <TableCell className={custody.remaining_amount > 0 ? "text-danger font-semibold" : ""}>{formatCurrency(custody.remaining_amount)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[custody.status] || ""}>{statusLabels[custody.status] || custody.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                         <DropdownMenuContent align="end">
                          {can("custody", "edit") && (
                            <DropdownMenuItem onClick={() => setEditData(custody)}>
                              <Pencil className="w-4 h-4 ml-2" /> تعديل
                            </DropdownMenuItem>
                          )}
                          {can("custody", "delete") && (
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(custody.id)}>
                              <Trash2 className="w-4 h-4 ml-2" /> حذف
                            </DropdownMenuItem>
                          )}
                         </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <NewCustodyDialog open={newOpen} onOpenChange={setNewOpen} onSuccess={fetchCustodies} nextNumber={nextNumber} />
      <SettleCustodyDialog open={settleOpen} onOpenChange={setSettleOpen} onSuccess={fetchCustodies} custodies={custodies} />

      {/* Edit Dialog */}
      {editData && (
        <EditCustodyDialog custody={editData} onClose={() => setEditData(null)} onSave={handleEditSave} />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذه العهدة؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

/* Inline edit dialog */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function EditCustodyDialog({ custody, onClose, onSave }: { custody: CustodyRow; onClose: () => void; onSave: (d: Partial<CustodyRow>) => void }) {
  const [form, setForm] = useState({
    employee_name: custody.employee_name,
    department: custody.department || "",
    purpose: custody.purpose,
    notes: custody.notes || "",
    date: custody.date,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle>تعديل العهدة - {custody.number}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم الموظف</Label>
              <Input value={form.employee_name} onChange={(e) => setForm({ ...form, employee_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>القسم</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>التاريخ</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>الغرض</Label>
            <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button onClick={() => onSave(form)}>حفظ التعديلات</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Custody;
