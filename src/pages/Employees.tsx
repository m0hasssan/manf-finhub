import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Users2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useLogAction } from "@/hooks/useActionLog";
import { usePermissions } from "@/hooks/usePermissions";

type Employee = Tables<"employees">;
type Account = Tables<"accounts">;

const Employees = () => {
  const logAction = useLogAction();
  const { can } = usePermissions();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<Employee | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", department: "", job_title: "", phone: "", account_id: "" });

  const fetchData = async () => {
    setLoading(true);
    const [empRes, accRes] = await Promise.all([
      supabase.from("employees").select("*").order("code"),
      supabase.from("accounts").select("*").eq("is_active", true).order("code"),
    ]);
    setEmployees(empRes.data || []);
    setAccounts(accRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const leafAccounts = accounts.filter((a) => !accounts.some((b) => b.parent_id === a.id));

  const openNew = () => {
    const nextCode = `EMP-${String((employees.length || 0) + 1).padStart(3, "0")}`;
    setForm({ name: "", code: nextCode, department: "", job_title: "", phone: "", account_id: "" });
    setEditData(null);
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setForm({
      name: emp.name,
      code: emp.code,
      department: emp.department || "",
      job_title: emp.job_title || "",
      phone: emp.phone || "",
      account_id: emp.account_id || "",
    });
    setEditData(emp);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code || !form.account_id) {
      toast.error("يرجى ملء الاسم والكود والحساب");
      return;
    }

    if (editData) {
      const { error } = await supabase.from("employees").update({
        name: form.name, code: form.code, department: form.department || null,
        job_title: form.job_title || null, phone: form.phone || null, account_id: form.account_id,
      }).eq("id", editData.id);
      if (error) { toast.error(error.message); return; }
      logAction.mutate({ action: "update", entity_type: "employee", entity_id: editData.id, entity_name: form.name });
      toast.success("تم تحديث الموظف");
    } else {
      const { data: inserted, error } = await supabase.from("employees").insert({
        name: form.name, code: form.code, department: form.department || null,
        job_title: form.job_title || null, phone: form.phone || null, account_id: form.account_id,
      }).select("id").single();
      if (error) { toast.error(error.message); return; }
      logAction.mutate({ action: "create", entity_type: "employee", entity_id: inserted?.id, entity_name: form.name });
      toast.success("تم إضافة الموظف");
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const emp = employees.find(e => e.id === deleteId);
    const { error } = await supabase.from("employees").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else {
      logAction.mutate({ action: "delete", entity_type: "employee", entity_id: deleteId, entity_name: emp?.name });
      toast.success("تم حذف الموظف"); fetchData();
    }
    setDeleteId(null);
  };

  const filtered = employees.filter((e) =>
    e.name.includes(searchQuery) || e.code.includes(searchQuery) || (e.department || "").includes(searchQuery)
  );

  const getAccountName = (id: string | null) => {
    if (!id) return "-";
    const acc = accounts.find((a) => a.id === id);
    return acc ? `${acc.code} - ${acc.name}` : "-";
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users2 className="w-6 h-6 text-primary" />
              الموظفين
            </h1>
            <p className="text-muted-foreground">إدارة بيانات الموظفين وربطهم بشجرة الحسابات</p>
          </div>
          {can("employees", "create") && (
            <Button className="gap-2" onClick={openNew}>
              <Plus className="w-4 h-4" />
              إضافة موظف
            </Button>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>القسم</TableHead>
                <TableHead>الوظيفة</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>الحساب</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا يوجد موظفين</TableCell></TableRow>
              ) : (
                filtered.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono">{emp.code}</TableCell>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.department || "-"}</TableCell>
                    <TableCell>{emp.job_title || "-"}</TableCell>
                    <TableCell>{emp.phone || "-"}</TableCell>
                    <TableCell className="text-xs">{getAccountName(emp.account_id)}</TableCell>
                    <TableCell>
                      <Badge className={emp.is_active ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                        {emp.is_active ? "نشط" : "غير نشط"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                         <DropdownMenuContent align="end">
                          {can("employees", "edit") && (
                            <DropdownMenuItem onClick={() => openEdit(emp)}>
                              <Pencil className="w-4 h-4 ml-2" /> تعديل
                            </DropdownMenuItem>
                          )}
                          {can("employees", "delete") && (
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(emp.id)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editData ? "تعديل موظف" : "إضافة موظف جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الكود *</Label>
                <Input value={form.code} readOnly disabled className="bg-muted font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>القسم</Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الوظيفة</Label>
                <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>الهاتف</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الحساب في شجرة الحسابات *</Label>
              <SearchableSelect
                value={form.account_id}
                onValueChange={(v) => setForm({ ...form, account_id: v })}
                options={leafAccounts.map((acc) => ({ value: acc.id, label: `${acc.code} - ${acc.name}` }))}
                placeholder="اختر الحساب"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button onClick={handleSave}>{editData ? "حفظ التعديلات" : "إضافة"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا الموظف؟</AlertDialogDescription>
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

export default Employees;
