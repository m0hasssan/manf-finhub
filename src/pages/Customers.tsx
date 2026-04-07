import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Users, Phone, Mail, MapPin, Loader2, FileText, Plus, MoreHorizontal, Edit, Trash2, AlertTriangle, Upload } from "lucide-react";
import { ImportExcelDialog } from "@/components/ImportExcelDialog";
import { Badge } from "@/components/ui/badge";
import { AccountStatement } from "@/components/AccountStatement";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { useLogAction } from "@/hooks/useActionLog";
import { usePermissions } from "@/hooks/usePermissions";

const Customers = () => {
  const queryClient = useQueryClient();
  const logAction = useLogAction();
  const { can } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [statementOpen, setStatementOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteBlockReason, setDeleteBlockReason] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [form, setForm] = useState({
    code: "", name: "", phone: "", email: "", address: "",
    tax_number: "", notes: "", opening_balance_debit: 0, opening_balance_credit: 0, credit_limit: 0, account_id: "",
  });

  const { data: allCustomers, isLoading } = useQuery({
    queryKey: ["customers_full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts_for_linking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, code, name, currency, exchange_rate").eq("is_active", true).order("code");
      if (error) throw error;
      return data;
    },
  });

  const leafAccounts = accounts.filter((acc) => !accounts.some((a) => a.code.startsWith(acc.code) && a.code !== acc.code && a.code.length > acc.code.length));
  const selectedAccount = accounts.find((a) => a.id === form.account_id);

  const formatCurrency = (amount: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);

  const filtered = allCustomers?.filter((c) => {
    const matchesSearch = c.name.includes(searchQuery) || c.code.includes(searchQuery) || (c.phone || "").includes(searchQuery);
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? c.is_active : !c.is_active);
    return matchesSearch && matchesStatus;
  }) || [];

  const totalBalance = allCustomers?.reduce((sum, c) => sum + (c.opening_balance || 0), 0) || 0;
  const activeCount = allCustomers?.filter((c) => c.is_active).length || 0;

  const generateNextCode = () => {
    if (!allCustomers || allCustomers.length === 0) return "C001";
    const codes = allCustomers.map(c => c.code).filter(c => /^C\d+$/.test(c)).map(c => parseInt(c.slice(1)));
    const max = codes.length > 0 ? Math.max(...codes) : 0;
    return `C${String(max + 1).padStart(3, "0")}`;
  };

  const resetForm = () => {
    setForm({ code: generateNextCode(), name: "", phone: "", email: "", address: "", tax_number: "", notes: "", opening_balance_debit: 0, opening_balance_credit: 0, credit_limit: 0, account_id: "" });
    setEditingId(null);
  };

  const handleEdit = (customer: any) => {
    const acc = accounts.find((a) => a.id === customer.account_id);
    const rate = acc && acc.currency !== "EGP" ? (Number(acc.exchange_rate) || 1) : 1;
    const storedBalance = customer.opening_balance || 0;
    const balanceInCurrency = rate !== 1 ? storedBalance / rate : storedBalance;
    setForm({
      code: customer.code, name: customer.name,
      phone: customer.phone || "", email: customer.email || "",
      address: customer.address || "", tax_number: customer.tax_number || "",
      notes: customer.notes || "",
      opening_balance_debit: balanceInCurrency > 0 ? balanceInCurrency : 0,
      opening_balance_credit: balanceInCurrency < 0 ? Math.abs(balanceInCurrency) : 0,
      credit_limit: rate !== 1 ? (customer.credit_limit || 0) / rate : (customer.credit_limit || 0),
      account_id: customer.account_id || "",
    });
    setEditingId(customer.id);
    setDialogOpen(true);
  };

  const handleDeleteCheck = async (customer: { id: string; name: string }) => {
    // Check for transactions
    const [sales, cash, movements, journals] = await Promise.all([
      supabase.from("sales_invoices").select("id", { count: "exact", head: true }).eq("customer_id", customer.id),
      supabase.from("cash_transactions").select("id", { count: "exact", head: true }).eq("customer_id", customer.id),
      supabase.from("inventory_movements").select("id", { count: "exact", head: true }).eq("customer_id", customer.id),
      supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("reference_type", "party_customer").eq("reference_id", customer.id),
    ]);
    const total = (sales.count || 0) + (cash.count || 0) + (movements.count || 0) + (journals.count || 0);
    if (total > 0) {
      setDeleteBlockReason(`لا يمكن حذف العميل "${customer.name}" لوجود ${total} حركة مرتبطة به`);
    } else {
      setDeleteBlockReason(null);
    }
    setDeleteTarget(customer);
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleteBlockReason) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("customers").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      logAction.mutate({ action: "delete", entity_type: "customer", entity_id: deleteTarget.id, entity_name: deleteTarget.name });
      toast.success("تم حذف العميل بنجاح");
      queryClient.invalidateQueries({ queryKey: ["customers_full"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (error: any) {
      toast.error("خطأ في الحذف: " + error.message);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) { toast.error("الكود والاسم مطلوبان"); return; }
    if (!form.account_id) { toast.error("يجب ربط العميل بحساب في شجرة الحسابات"); return; }
    setSaving(true);
    try {
      const rate = selectedAccount?.currency !== "EGP" ? (Number(selectedAccount?.exchange_rate) || 1) : 1;
      const openingBalance = (form.opening_balance_debit - form.opening_balance_credit) * rate;
      const payload = {
        code: form.code.trim(), name: form.name.trim(),
        phone: form.phone.trim() || null, email: form.email.trim() || null,
        address: form.address.trim() || null, tax_number: form.tax_number.trim() || null,
        notes: form.notes.trim() || null, opening_balance: openingBalance,
        credit_limit: form.credit_limit * rate, account_id: form.account_id,
      };
      if (editingId) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editingId);
        if (error) throw error;
        logAction.mutate({ action: "update", entity_type: "customer", entity_id: editingId, entity_name: form.name.trim() });
        toast.success("تم تعديل العميل بنجاح");
      } else {
        const { data: inserted, error } = await supabase.from("customers").insert(payload).select("id").single();
        if (error) throw error;
        logAction.mutate({ action: "create", entity_type: "customer", entity_id: inserted?.id, entity_name: form.name.trim() });
        toast.success("تم إضافة العميل بنجاح");
      }
      queryClient.invalidateQueries({ queryKey: ["customers_full"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error("خطأ: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              العملاء
            </h1>
            <p className="text-muted-foreground">إدارة حسابات العملاء وكشوف الحساب</p>
          </div>
          <div className="flex gap-2">
            {can("customers", "create") && (
              <>
                <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
                  <Upload className="w-4 h-4" />
                  استيراد Excel
                </Button>
                <Button className="gap-2" onClick={() => { resetForm(); setDialogOpen(true); }}>
                  <Plus className="w-4 h-4" />
                  إضافة عميل
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
            <p className="text-2xl font-bold">{allCustomers?.length || 0}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">العملاء النشطون</p>
            <p className="text-2xl font-bold text-success">{activeCount}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">إجمالي المديونية</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalBalance)}</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث بالاسم أو الكود أو الهاتف..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                  <TableHead>الكود</TableHead>
                  <TableHead>اسم العميل</TableHead>
                  <TableHead>الاتصال</TableHead>
                  <TableHead>العنوان</TableHead>
                  <TableHead>الرصيد</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا يوجد عملاء</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-mono">{customer.code}</TableCell>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {customer.phone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {customer.phone}
                            </div>
                          )}
                          {customer.email && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              {customer.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.address && (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            {customer.address}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={(customer.opening_balance || 0) > 0 ? "amount-positive" : (customer.opening_balance || 0) < 0 ? "amount-negative" : ""}>
                          {formatCurrency(customer.opening_balance || 0)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.is_active ? "default" : "secondary"} className={customer.is_active ? "bg-success" : ""}>
                          {customer.is_active ? "نشط" : "غير نشط"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setSelectedCustomer({ id: customer.id, name: customer.name }); setStatementOpen(true); }}>
                            <FileText className="w-4 h-4" />
                            كشف حساب
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                             <DropdownMenuContent align="end">
                              {can("customers", "edit") && (
                                <DropdownMenuItem onClick={() => handleEdit(customer)}>
                                  <Edit className="w-4 h-4 ml-2" /> تعديل التفاصيل
                                </DropdownMenuItem>
                              )}
                              {can("customers", "delete") && (
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteCheck(customer)}>
                                  <Trash2 className="w-4 h-4 ml-2" /> حذف
                                </DropdownMenuItem>
                              )}
                             </DropdownMenuContent>
                          </DropdownMenu>
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

      {selectedCustomer && (
        <AccountStatement open={statementOpen} onOpenChange={setStatementOpen} partyId={selectedCustomer.id} partyName={selectedCustomer.name} type="customer" />
      )}

      <ImportExcelDialog open={importOpen} onOpenChange={setImportOpen} type="customers" />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>كود العميل *</Label>
                <Input value={form.code} readOnly disabled className="bg-muted font-mono" />
              </div>
              <div>
                <Label>اسم العميل *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="p-4 border border-primary/30 rounded-lg bg-primary/5 space-y-3">
              <Label className="text-primary font-semibold">ربط بحساب في شجرة الحسابات *</Label>
              <SearchableSelect
                value={form.account_id}
                onValueChange={(v) => setForm({ ...form, account_id: v })}
                options={leafAccounts.map((acc) => ({ value: acc.id, label: `${acc.code} - ${acc.name} (${acc.currency})` }))}
                placeholder="اختر الحساب..."
              />
              {selectedAccount && (
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline">العملة: {selectedAccount.currency}</Badge>
                  {selectedAccount.currency !== "EGP" && <Badge variant="outline">المعامل: {selectedAccount.exchange_rate}</Badge>}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>البريد الإلكتروني</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>الرقم الضريبي</Label><Input value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} /></div>
            <div className="p-3 border border-border rounded-lg space-y-2">
              <Label className="font-semibold">الرصيد الافتتاحي ({selectedAccount?.currency || "EGP"})</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">مدين (مستحق على العميل)</Label>
                  <Input type="number" min={0} value={form.opening_balance_debit || ""} onChange={(e) => setForm({ ...form, opening_balance_debit: Number(e.target.value) || 0, opening_balance_credit: 0 })} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">دائن (سلفة من العميل)</Label>
                  <Input type="number" min={0} value={form.opening_balance_credit || ""} onChange={(e) => setForm({ ...form, opening_balance_credit: Number(e.target.value) || 0, opening_balance_debit: 0 })} placeholder="0" />
                </div>
              </div>
            </div>
            <div><Label>حد الائتمان ({selectedAccount?.currency || "EGP"})</Label><Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} /></div>
            <div><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? "حفظ التعديلات" : "حفظ العميل"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteBlockReason ? <AlertTriangle className="w-5 h-5 text-warning" /> : <Trash2 className="w-5 h-5 text-destructive" />}
              {deleteBlockReason ? "لا يمكن الحذف" : "تأكيد الحذف"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlockReason || `هل أنت متأكد من حذف العميل "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            {!deleteBlockReason && (
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "حذف"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Customers;
