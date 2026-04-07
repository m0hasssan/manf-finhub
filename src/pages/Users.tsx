import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users as UsersIcon, Plus, Search, Loader2, Edit, Trash2, Key, ChevronDown, ChevronLeft } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { permissionTree, type PermissionNode, type PermissionsMap } from "@/lib/permissions";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useLogAction } from "@/hooks/useActionLog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  permissions: PermissionsMap;
  created_at: string;
  last_sign_in_at: string | null;
}

function PermissionTreeView({
  nodes,
  permissions,
  setPermissions,
  expanded,
  toggleExpanded,
}: {
  nodes: PermissionNode[];
  permissions: PermissionsMap;
  setPermissions: (p: PermissionsMap) => void;
  expanded: Set<string>;
  toggleExpanded: (key: string) => void;
}) {
  const isChecked = (node: PermissionNode): boolean | "indeterminate" => {
    if (node.actions) {
      const vals = node.actions.map((a) => !!permissions[node.key]?.[a.key]);
      if (vals.every(Boolean)) return true;
      if (vals.some(Boolean)) return "indeterminate";
      return false;
    }
    if (node.children) {
      const childChecks = node.children.map((c) => isChecked(c));
      if (childChecks.every((c) => c === true)) return true;
      if (childChecks.some((c) => c === true || c === "indeterminate")) return "indeterminate";
      return false;
    }
    return false;
  };

  const toggleAll = (node: PermissionNode, value: boolean) => {
    const next = { ...permissions };
    if (node.actions) {
      next[node.key] = {};
      for (const action of node.actions) {
        next[node.key][action.key] = value;
      }
    }
    if (node.children) {
      for (const child of node.children) {
        if (child.actions) {
          next[child.key] = {};
          for (const action of child.actions) {
            next[child.key][action.key] = value;
          }
        }
        if (child.children) {
          for (const grandchild of child.children) {
            if (grandchild.actions) {
              next[grandchild.key] = {};
              for (const action of grandchild.actions) {
                next[grandchild.key][action.key] = value;
              }
            }
          }
        }
      }
    }
    setPermissions(next);
  };

  const toggleAction = (nodeKey: string, actionKey: string, value: boolean) => {
    const next = { ...permissions };
    if (!next[nodeKey]) next[nodeKey] = {};
    next[nodeKey][actionKey] = value;
    setPermissions(next);
  };

  return (
    <div className="space-y-1">
      {nodes.map((node) => {
        const checked = isChecked(node);
        const hasChildren = !!node.children && node.children.length > 0;
        const isExpanded = expanded.has(node.key);

        return (
          <div key={node.key} className="border border-border rounded-lg overflow-hidden">
            <div
              className="flex items-center gap-2 p-2.5 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => (hasChildren || node.actions) && toggleExpanded(node.key)}
            >
              {(hasChildren || node.actions) ? (
                isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : <div className="w-4" />}
              <Checkbox
                checked={checked === true}
                // @ts-ignore
                indeterminate={checked === "indeterminate"}
                onCheckedChange={(v) => {
                  toggleAll(node, !!v);
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="font-medium text-sm">{node.label}</span>
            </div>
            {isExpanded && (
              <div className="pr-8 pb-2 pt-1 space-y-1 animate-fade-in">
                {node.actions && (
                  <div className="flex flex-wrap gap-3 px-2 py-1">
                    {node.actions.map((action) => (
                      <label key={action.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={!!permissions[node.key]?.[action.key]}
                          onCheckedChange={(v) => toggleAction(node.key, action.key, !!v)}
                        />
                        {action.label}
                      </label>
                    ))}
                  </div>
                )}
                {node.children && (
                  <PermissionTreeView
                    nodes={node.children}
                    permissions={permissions}
                    setPermissions={setPermissions}
                    expanded={expanded}
                    toggleExpanded={toggleExpanded}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const UsersPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { can, isAdmin } = usePermissions();
  const logAction = useLogAction();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "customized" as string,
    permissions: {} as PermissionsMap,
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["managed_users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "list" },
      });
      if (error) throw error;
      return data as UserItem[];
    },
  });

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtered = users?.filter((u) =>
    u.full_name?.includes(searchQuery) || u.email?.includes(searchQuery)
  ) || [];

  const resetForm = () => {
    setForm({ full_name: "", email: "", password: "", role: "customized", permissions: {} });
    setEditingUser(null);
    setExpanded(new Set());
  };

  const handleEdit = (u: UserItem) => {
    setEditingUser(u);
    setForm({
      full_name: u.full_name,
      email: u.email,
      password: "",
      role: u.role,
      permissions: u.permissions || {},
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error("الاسم مطلوب"); return; }
    if (!editingUser && (!form.email.trim() || !form.password.trim())) { toast.error("البريد الإلكتروني وكلمة المرور مطلوبان"); return; }
    if (!editingUser && form.password.length < 6) { toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }

    setSaving(true);
    try {
      if (editingUser) {
        const { data, error } = await supabase.functions.invoke("manage-users", {
          body: {
            action: "update",
            user_id: editingUser.id,
            role: form.role,
            permissions: form.role === "customized" ? form.permissions : undefined,
            full_name: form.full_name.trim(),
          },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        logAction.mutate({ action: "update", entity_type: "user", entity_name: form.full_name.trim() });
        toast.success("تم تعديل المستخدم بنجاح");
      } else {
        const { data, error } = await supabase.functions.invoke("manage-users", {
          body: {
            action: "create",
            email: form.email.trim(),
            password: form.password,
            full_name: form.full_name.trim(),
            role: form.role,
            permissions: form.role === "customized" ? form.permissions : undefined,
          },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        logAction.mutate({ action: "create", entity_type: "user", entity_name: form.full_name.trim() });
        toast.success("تم إضافة المستخدم بنجاح");
      }
      queryClient.invalidateQueries({ queryKey: ["managed_users"] });
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error("خطأ: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", user_id: deleteTarget.id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      logAction.mutate({ action: "delete", entity_type: "user", entity_name: deleteTarget.full_name });
      toast.success("تم حذف المستخدم بنجاح");
      queryClient.invalidateQueries({ queryKey: ["managed_users"] });
    } catch (err: any) {
      toast.error("خطأ: " + err.message);
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword.trim()) return;
    if (newPassword.length < 6) { toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "reset_password", user_id: resetTarget.id, new_password: newPassword },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("تم إعادة تعيين كلمة المرور بنجاح");
    } catch (err: any) {
      toast.error("خطأ: " + err.message);
    } finally {
      setSaving(false);
      setResetTarget(null);
      setNewPassword("");
    }
  };

  const roleLabel = (role: string) => {
    if (role === "admin") return "أدمن";
    return "صلاحيات مخصصة";
  };

  if (!isAdmin && !can("users", "view")) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">ليس لديك صلاحية الوصول</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UsersIcon className="w-6 h-6 text-primary" />
              المستخدمين
            </h1>
            <p className="text-muted-foreground">إدارة مستخدمي النظام والصلاحيات</p>
          </div>
          {(isAdmin || can("users", "create")) && (
            <Button className="gap-2" onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="w-4 h-4" />
              إضافة مستخدم
            </Button>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو البريد..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
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
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الصلاحية</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead>آخر دخول</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا يوجد مستخدمين</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell className="text-muted-foreground" dir="ltr">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                          {roleLabel(u.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(u.created_at), "yyyy/MM/dd", { locale: ar })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "yyyy/MM/dd HH:mm", { locale: ar }) : "لم يسجل دخول"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {u.id !== user?.id && (
                            <>
                              {(isAdmin || can("users", "edit")) && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(u)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {(isAdmin || can("users", "edit")) && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setResetTarget(u); setNewPassword(""); }}>
                                  <Key className="w-4 h-4" />
                                </Button>
                              )}
                              {(isAdmin || can("users", "delete")) && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(u)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </>
                          )}
                          {u.id === user?.id && (
                            <span className="text-xs text-muted-foreground">أنت</span>
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

      {/* Add/Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingUser ? "تعديل المستخدم" : "إضافة مستخدم جديد"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-4 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الاسم الكامل *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div>
                  <Label>البريد الإلكتروني *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    disabled={!!editingUser}
                    dir="ltr"
                  />
                </div>
              </div>
              {!editingUser && (
                <div>
                  <Label>كلمة المرور *</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="6 أحرف على الأقل"
                    dir="ltr"
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">سيُطلب من المستخدم تغيير كلمة المرور عند أول تسجيل دخول</p>
                </div>
              )}
              <div>
                <Label>نوع الصلاحية</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">أدمن - كامل الصلاحيات</SelectItem>
                    <SelectItem value="customized">صلاحيات مخصصة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.role === "customized" && (
                <div className="space-y-2">
                  <Label className="text-primary font-semibold">تحديد الصلاحيات</Label>
                  <PermissionTreeView
                    nodes={permissionTree}
                    permissions={form.permissions}
                    setPermissions={(p) => setForm({ ...form, permissions: p })}
                    expanded={expanded}
                    toggleExpanded={toggleExpanded}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              {editingUser ? "حفظ التعديلات" : "إضافة المستخدم"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المستخدم</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المستخدم "{deleteTarget?.full_name}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) { setResetTarget(null); setNewPassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">المستخدم: {resetTarget?.full_name}</p>
            <div>
              <Label>كلمة المرور الجديدة</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} dir="ltr" minLength={6} />
            </div>
            <p className="text-xs text-muted-foreground">سيُطلب من المستخدم تغييرها عند تسجيل الدخول التالي</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetTarget(null)}>إلغاء</Button>
              <Button onClick={handleResetPassword} disabled={saving || !newPassword.trim()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                تعيين
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default UsersPage;
