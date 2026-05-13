import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronDown, Plus, Search, FolderTree, Pencil, Trash2, FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AccountLedger } from "@/components/AccountLedger";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useLogAction } from "@/hooks/useActionLog";
import { usePermissions } from "@/hooks/usePermissions";

type AccountRow = Tables<"accounts">;

interface TreeAccount extends AccountRow {
  children: TreeAccount[];
}

const typeColors: Record<string, string> = {
  asset: "text-primary",
  liability: "text-danger",
  equity: "text-chart-5",
  revenue: "text-success",
  expense: "text-warning",
};

const typeLabels: Record<string, string> = {
  asset: "أصول",
  liability: "خصوم",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};

const typeOptions = [
  { value: "asset", label: "أصول" },
  { value: "liability", label: "خصوم" },
  { value: "equity", label: "حقوق ملكية" },
  { value: "revenue", label: "إيرادات" },
  { value: "expense", label: "مصروفات" },
] as const;

function buildTree(accounts: AccountRow[]): TreeAccount[] {
  const map = new Map<string, TreeAccount>();
  accounts.forEach((a) => map.set(a.id, { ...a, children: [] }));
  const roots: TreeAccount[] = [];
  accounts.forEach((a) => {
    const node = map.get(a.id)!;
    if (a.parent_id && map.has(a.parent_id)) {
      map.get(a.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  // Sort by code
  const sortTree = (nodes: TreeAccount[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);
  return roots;
}

const statementInfo: Record<string, { label: string; path: string; color: string }> = {
  asset: { label: "الميزانية", path: "/reports/balance-sheet", color: "bg-primary/10 text-primary hover:bg-primary/20" },
  liability: { label: "الميزانية", path: "/reports/balance-sheet", color: "bg-danger/10 text-danger hover:bg-danger/20" },
  equity: { label: "الميزانية", path: "/reports/balance-sheet", color: "bg-chart-5/10 text-chart-5 hover:bg-chart-5/20" },
  revenue: { label: "قائمة الدخل", path: "/reports/income-statement", color: "bg-success/10 text-success hover:bg-success/20" },
  expense: { label: "قائمة الدخل", path: "/reports/income-statement", color: "bg-warning/10 text-warning hover:bg-warning/20" },
};

function AccountNode({
  account,
  expandedIds,
  toggleExpand,
  onAddChild,
  onEdit,
  onDelete,
  onLedger,
  onNavigate,
  canCreate,
  canEdit,
  canDelete,
}: {
  account: TreeAccount;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onAddChild: (parent: TreeAccount) => void;
  onEdit: (account: TreeAccount) => void;
  onDelete: (account: TreeAccount) => void;
  onLedger: (account: TreeAccount) => void;
  onNavigate: (path: string) => void;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const isExpanded = expandedIds.has(account.id);
  const hasChildren = account.children.length > 0;
  const levelClass = `tree-item-level-${account.level}`;

  return (
    <>
      <div className={`tree-item ${levelClass} group`}>
        <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => hasChildren && toggleExpand(account.id)}>
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          ) : (
            <div className="w-4" />
          )}
          <span className="text-muted-foreground text-sm font-mono">{account.code}</span>
          <span className={typeColors[account.type] || ""}>{account.name}</span>
          {(Number((account as any).opening_balance_debit) !== 0 || Number((account as any).opening_balance_credit) !== 0) && (
            <span className="text-xs font-mono text-muted-foreground">
              (افتتاحي: {Number((account as any).opening_balance_debit) !== 0 ? `مدين ${Number((account as any).opening_balance_debit).toLocaleString("ar-EG")}` : ""}{Number((account as any).opening_balance_debit) !== 0 && Number((account as any).opening_balance_credit) !== 0 ? " / " : ""}{Number((account as any).opening_balance_credit) !== 0 ? `دائن ${Number((account as any).opening_balance_credit).toLocaleString("ar-EG")}` : ""} {account.currency || "EGP"})
            </span>
          )}
          {account.currency !== "EGP" && (
            <span className="text-xs text-muted-foreground">({account.currency})</span>
          )}
          {statementInfo[account.type] && (
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-5 cursor-pointer border-0 ${statementInfo[account.type].color}`}
              onClick={(e) => { e.stopPropagation(); onNavigate(statementInfo[account.type].path); }}
            >
              {statementInfo[account.type].label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canCreate && account.level < 5 && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
              onClick={(e) => { e.stopPropagation(); onAddChild(account); }}>
              <Plus className="w-3 h-3" /> فرعي
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
            onClick={(e) => { e.stopPropagation(); onNavigate("/reports/trial-balance"); }}>
            ميزان
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
            onClick={(e) => { e.stopPropagation(); onLedger(account); }}>
            <FileText className="w-3 h-3" /> كشف
          </Button>
          {canEdit && (
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onEdit(account); }}>
              <Pencil className="w-3 h-3" />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(account); }}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div className="animate-fade-in">
          {account.children.map((child) => (
            <AccountNode key={child.id} account={child} expandedIds={expandedIds} toggleExpand={toggleExpand} onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} onLedger={onLedger} onNavigate={onNavigate} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
          ))}
        </div>
      )}
    </>
  );
}
const ChartOfAccounts = () => {
  const navigate = useNavigate();
  const logAction = useLogAction();
  const { can } = usePermissions();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TreeAccount | null>(null);
  const [parentAccount, setParentAccount] = useState<TreeAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TreeAccount | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [ledgerAccount, setLedgerAccount] = useState<TreeAccount | null>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "asset" as string, description: "", currency: "EGP", exchange_rate: "1", opening_balance_debit: "0", opening_balance_credit: "0" });

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("accounts").select("*").order("code");
    setAccounts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const tree = buildTree(accounts);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(accounts.map((a) => a.id)));
  };

  const collapseAll = () => setExpandedIds(new Set());

  const getNextChildCode = (parentCode: string, siblings: TreeAccount[]) => {
    const usedSuffixes = new Set(siblings.map((c) => c.code.slice(parentCode.length)));
    for (let i = 1; i <= 500; i++) {
      const suffix = String(i).padStart(5, "0");
      if (!usedSuffixes.has(suffix)) return parentCode + suffix;
    }
    return parentCode + String(siblings.length + 1).padStart(3, "0");
  };

  const openAddRoot = () => {
    setParentAccount(null);
    setEditingAccount(null);
    const usedCodes = new Set(tree.map((r) => r.code));
    let nextCode = "1";
    for (let i = 1; i <= 500; i++) {
      const code = String(i).padStart(3, "0");
      if (!usedCodes.has(code)) { nextCode = code; break; }
    }
    setForm({ code: nextCode, name: "", type: "asset", description: "", currency: "EGP", exchange_rate: "1", opening_balance_debit: "0", opening_balance_credit: "0" });
    setDialogOpen(true);
  };

  const openAddChild = (parent: TreeAccount) => {
    setParentAccount(parent);
    setEditingAccount(null);
    if (parent.children.length >= 500) {
      toast.error("لا يمكن إضافة أكثر من 500 حساب فرعي لكل حساب");
      return;
    }
    const nextCode = getNextChildCode(parent.code, parent.children);
    setForm({ code: nextCode, name: "", type: parent.type, description: "", currency: "EGP", exchange_rate: "1", opening_balance_debit: "0", opening_balance_credit: "0" });
    setDialogOpen(true);
  };

  const openEdit = (account: TreeAccount) => {
    setEditingAccount(account);
    setParentAccount(null);
    setForm({
      code: account.code,
      name: account.name,
      type: account.type,
      description: account.description || "",
      currency: account.currency || "EGP",
      exchange_rate: String(account.exchange_rate ?? 1),
      opening_balance_debit: String((account as any).opening_balance_debit ?? 0),
      opening_balance_credit: String((account as any).opening_balance_credit ?? 0),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (account: TreeAccount) => {
    // Check for children
    if (account.children.length > 0) {
      setDeleteError("لا يمكن حذف حساب يحتوي على حسابات فرعية");
      setDeleteTarget(account);
      return;
    }

    // Check for journal entry lines referencing this account
    const { count } = await supabase
      .from("journal_entry_lines")
      .select("id", { count: "exact", head: true })
      .eq("account_id", account.id);

    if (count && count > 0) {
      setDeleteError(`لا يمكن حذف هذا الحساب لأن عليه ${count} حركة مالية`);
      setDeleteTarget(account);
      return;
    }

    setDeleteError("");
    setDeleteTarget(account);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteError) return;
    const { error } = await supabase.from("accounts").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("خطأ في الحذف: " + error.message);
    } else {
      logAction.mutate({ action: "delete", entity_type: "account", entity_id: deleteTarget.id, entity_name: `${deleteTarget.code} - ${deleteTarget.name}` });
      toast.success("تم حذف الحساب");
      fetchAccounts();
    }
    setDeleteTarget(null);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast.error("يرجى ملء الكود والاسم");
      return;
    }

    // Check duplicate code (exclude self when editing)
    if (accounts.some((a) => a.code === form.code && a.id !== editingAccount?.id)) {
      toast.error("كود الحساب موجود بالفعل");
      return;
    }

    if (editingAccount) {
      const { error } = await supabase.from("accounts").update({
        code: form.code,
        name: form.name,
        type: form.type as any,
        description: form.description || null,
        currency: form.currency,
        exchange_rate: parseFloat(form.exchange_rate) || 1,
        opening_balance_debit: parseFloat(form.opening_balance_debit) || 0,
        opening_balance_credit: parseFloat(form.opening_balance_credit) || 0,
      }).eq("id", editingAccount.id);

      if (error) { toast.error("خطأ: " + error.message); return; }
      logAction.mutate({ action: "update", entity_type: "account", entity_id: editingAccount.id, entity_name: `${form.code} - ${form.name}` });
      toast.success("تم تحديث الحساب");
    } else {
      const level = parentAccount ? parentAccount.level + 1 : 1;
      if (level > 5) { toast.error("لا يمكن إضافة أكثر من 5 مستويات"); return; }

      const { data: inserted, error } = await supabase.from("accounts").insert({
        code: form.code,
        name: form.name,
        type: form.type as any,
        level,
        parent_id: parentAccount?.id || null,
        description: form.description || null,
        currency: form.currency,
        exchange_rate: parseFloat(form.exchange_rate) || 1,
        opening_balance_debit: parseFloat(form.opening_balance_debit) || 0,
        opening_balance_credit: parseFloat(form.opening_balance_credit) || 0,
      }).select("id").single();

      if (error) { toast.error("خطأ: " + error.message); return; }
      logAction.mutate({ action: "create", entity_type: "account", entity_id: inserted?.id, entity_name: `${form.code} - ${form.name}` });
      toast.success("تم إضافة الحساب بنجاح");

      if (parentAccount) {
        setExpandedIds((prev) => new Set([...prev, parentAccount.id]));
      }
    }

    setDialogOpen(false);
    fetchAccounts();
  };

  // Filter logic: show matching accounts and their ancestors
  const filteredTree = searchQuery
    ? (() => {
        const matchIds = new Set<string>();
        const ancestorIds = new Set<string>();
        const parentMap = new Map<string, string>();
        accounts.forEach((a) => { if (a.parent_id) parentMap.set(a.id, a.parent_id); });

        accounts.forEach((a) => {
          if (a.name.includes(searchQuery) || a.code.includes(searchQuery)) {
            matchIds.add(a.id);
            let pid = a.parent_id;
            while (pid) { ancestorIds.add(pid); pid = parentMap.get(pid) || null; }
          }
        });

        const filterTree = (nodes: TreeAccount[]): TreeAccount[] =>
          nodes
            .filter((n) => matchIds.has(n.id) || ancestorIds.has(n.id))
            .map((n) => ({ ...n, children: filterTree(n.children) }));

        return filterTree(tree);
      })()
    : tree;

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderTree className="w-6 h-6 text-primary" />
              شجرة الحسابات
            </h1>
            <p className="text-muted-foreground">إدارة دليل الحسابات بـ ٥ مستويات</p>
          </div>
          {can("chart_of_accounts", "create") && (
            <Button className="gap-2" onClick={openAddRoot}>
              <Plus className="w-4 h-4" />
              إضافة حساب رئيسي
            </Button>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث في الحسابات..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
            </div>
            <Button variant="outline" onClick={expandAll}>توسيع الكل</Button>
            <Button variant="outline" onClick={collapseAll}>طي الكل</Button>
          </div>
          <div className="flex gap-6 mt-4 pt-4 border-t border-border">
            {Object.entries(typeLabels).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${(typeColors[key] || "").replace("text-", "bg-")}`} />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <span className="font-semibold">اسم الحساب</span>
            <span className="font-semibold text-sm text-muted-foreground">{accounts.length} حساب</span>
          </div>
          <div className="p-2">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>
            ) : filteredTree.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">لا توجد حسابات - أضف حساب رئيسي للبدء</p>
            ) : (
              filteredTree.map((account) => (
                <AccountNode key={account.id} account={account} expandedIds={expandedIds} toggleExpand={toggleExpand} onAddChild={openAddChild} onEdit={openEdit} onDelete={handleDelete} onLedger={setLedgerAccount} onNavigate={(path) => navigate(path)} canCreate={can("chart_of_accounts", "create")} canEdit={can("chart_of_accounts", "edit")} canDelete={can("chart_of_accounts", "delete")} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Account Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingAccount
                ? `تعديل حساب: ${editingAccount.code} - ${editingAccount.name}`
                : parentAccount
                  ? `إضافة حساب فرعي تحت: ${parentAccount.code} - ${parentAccount.name}`
                  : "إضافة حساب رئيسي"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {parentAccount && (
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p>المستوى الأب: <span className="font-medium">{parentAccount.level}</span></p>
                <p>المستوى الجديد: <span className="font-medium">{parentAccount.level + 1}</span></p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>كود الحساب *</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="مثال: 1111" className="font-mono" disabled={!editingAccount} />
              </div>
              <div className="space-y-2">
                <Label>نوع الحساب *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>اسم الحساب *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الحساب" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>العملة</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v, exchange_rate: v === "EGP" ? "1" : form.exchange_rate })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EGP">جنيه مصري (EGP)</SelectItem>
                    <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                    <SelectItem value="EUR">يورو (EUR)</SelectItem>
                    <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                    <SelectItem value="AED">درهم إماراتي (AED)</SelectItem>
                    <SelectItem value="GBP">جنيه إسترليني (GBP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>معامل التغيير</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.exchange_rate}
                  onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })}
                  placeholder="1.00"
                  disabled={form.currency === "EGP"}
                />
              </div>
            </div>
            {form.currency !== "EGP" && (
              <p className="text-xs text-muted-foreground">
                1 {form.currency} = {form.exchange_rate || "0"} جنيه مصري
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الرصيد الافتتاحي مدين</Label>
                <Input type="number" step="0.01" value={form.opening_balance_debit} onChange={(e) => setForm({ ...form, opening_balance_debit: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>الرصيد الافتتاحي دائن</Label>
                <Input type="number" step="0.01" value={form.opening_balance_credit} onChange={(e) => setForm({ ...form, opening_balance_credit: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف اختياري" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button onClick={handleSave}>{editingAccount ? "حفظ التعديلات" : "إضافة الحساب"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteError ? "لا يمكن الحذف" : "تأكيد الحذف"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteError || `هل أنت متأكد من حذف الحساب "${deleteTarget?.code} - ${deleteTarget?.name}"؟`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إغلاق</AlertDialogCancel>
            {!deleteError && (
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {ledgerAccount && (
        <AccountLedger
          open={!!ledgerAccount}
          onOpenChange={(o) => !o && setLedgerAccount(null)}
          accountId={ledgerAccount.id}
          accountName={ledgerAccount.name}
          accountCode={ledgerAccount.code}
        />
      )}
    </MainLayout>
  );
};

export default ChartOfAccounts;
