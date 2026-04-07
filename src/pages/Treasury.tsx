import { useState } from "react";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, Wallet, Building2, ArrowDownLeft, ArrowUpRight, CreditCard, Loader2,
  MoreHorizontal, Edit, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CashTransactionDialog } from "@/components/treasury/CashTransactionDialog";
import { useLogAction } from "@/hooks/useActionLog";
import { BankAccountDialog } from "@/components/treasury/BankAccountDialog";
import { CheckDialog } from "@/components/treasury/CheckDialog";
import { usePermissions } from "@/hooks/usePermissions";

const Treasury = () => {
  const queryClient = useQueryClient();
  const logAction = useLogAction();
  const { can } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<any>(null);
  const [deleteTxn, setDeleteTxn] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editBank, setEditBank] = useState<any>(null);
  const [checkDialogOpen, setCheckDialogOpen] = useState(false);
  const [editCheck, setEditCheck] = useState<any>(null);
  const [checkStatusTarget, setCheckStatusTarget] = useState<any>(null);
  const [newCheckStatus, setNewCheckStatus] = useState("");

  const { data: cashTransactions, isLoading: loadingTxns } = useQuery({
    queryKey: ["cash_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_transactions")
        .select("*, customers(name), suppliers(name), accounts(name)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: bankAccounts, isLoading: loadingBanks } = useQuery({
    queryKey: ["bank_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: checks, isLoading: loadingChecks } = useQuery({
    queryKey: ["checks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checks")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("ar-EG");

  const totalReceipts = cashTransactions?.filter((t) => t.type === "receipt").reduce((s, t) => s + Number(t.amount), 0) || 0;
  const totalPayments = cashTransactions?.filter((t) => t.type === "payment").reduce((s, t) => s + Number(t.amount), 0) || 0;
  const cashBalance = totalReceipts - totalPayments;
  const totalBankBalance = bankAccounts?.reduce((sum, acc) => sum + Number(acc.current_balance || 0), 0) || 0;
  const pendingChecks = checks?.filter((c) => c.status === "pending") || [];
  const pendingChecksTotal = pendingChecks.reduce((sum, c) => sum + Number(c.amount), 0);

  const filteredTxns = cashTransactions?.filter((t) =>
    t.description.includes(searchQuery) ||
    t.reference.includes(searchQuery) ||
    (t.customers as any)?.name?.includes(searchQuery) ||
    (t.suppliers as any)?.name?.includes(searchQuery)
  ) || [];

  const getPartyName = (txn: any) => {
    if (txn.customers?.name) return txn.customers.name;
    if (txn.suppliers?.name) return txn.suppliers.name;
    if (txn.accounts?.name) return txn.accounts.name;
    return "-";
  };

  const checkStatusColors: Record<string, string> = {
    pending: "bg-warning text-warning-foreground",
    collected: "bg-success text-success-foreground",
    bounced: "bg-danger text-danger-foreground",
    cashed: "bg-muted text-muted-foreground",
    endorsed: "bg-primary text-primary-foreground",
  };

  const checkStatusLabels: Record<string, string> = {
    pending: "معلق",
    collected: "محصل",
    bounced: "مرتد",
    cashed: "صرف",
    endorsed: "مظهر",
  };

  const handleDelete = async () => {
    if (!deleteTxn) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("cash_transactions").delete().eq("id", deleteTxn.id);
      if (error) throw error;
      logAction.mutate({ action: "delete", entity_type: "cash_transaction", entity_id: deleteTxn.id, entity_name: deleteTxn.description, details: `${deleteTxn.type === "receipt" ? "سند قبض" : "سند صرف"} - ${deleteTxn.reference}` });
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers_full"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers_full"] });
      queryClient.invalidateQueries({ queryKey: ["account_statement"] });
      toast.success("تم حذف الحركة بنجاح");
    } catch (err: any) {
      toast.error("حدث خطأ: " + err.message);
    } finally {
      setDeleting(false);
      setDeleteTxn(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="w-6 h-6 text-primary" />
              الخزينة والبنوك
            </h1>
            <p className="text-muted-foreground">إدارة حركات الخزينة وحسابات البنوك والشيكات</p>
          </div>
          <div className="flex gap-2">
            {can("treasury_cash", "create") && (
              <>
                <Button variant="outline" className="gap-2" onClick={() => setReceiptOpen(true)}>
                  <ArrowDownLeft className="w-4 h-4 text-success" />
                  سند قبض
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setPaymentOpen(true)}>
                  <ArrowUpRight className="w-4 h-4 text-danger" />
                  سند صرف
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card stat-card-success">
            <p className="text-sm text-muted-foreground">رصيد الصندوق</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(cashBalance)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">إجمالي البنوك</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalBankBalance)}</p>
          </div>
          <div className="stat-card stat-card-warning">
            <p className="text-sm text-muted-foreground">شيكات معلقة</p>
            <p className="text-2xl font-bold">{pendingChecks.length} شيك</p>
            <p className="text-sm text-warning">{formatCurrency(pendingChecksTotal)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">إجمالي السيولة</p>
            <p className="text-2xl font-bold">{formatCurrency(cashBalance + totalBankBalance)}</p>
          </div>
        </div>

        <Tabs defaultValue="cash" className="space-y-4">
          <TabsList>
            <TabsTrigger value="cash" className="gap-2">
              <Wallet className="w-4 h-4" />
              حركة الخزينة
            </TabsTrigger>
            <TabsTrigger value="banks" className="gap-2">
              <Building2 className="w-4 h-4" />
              حسابات البنوك
            </TabsTrigger>
            <TabsTrigger value="checks" className="gap-2">
              <CreditCard className="w-4 h-4" />
              الشيكات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cash">
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <div className="relative max-w-md">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث في الحركات..."
                    className="pr-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              {loadingTxns ? (
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
                      <TableHead>البيان</TableHead>
                      <TableHead>الطرف / الحساب</TableHead>
                      <TableHead>طريقة الدفع</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTxns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          لا توجد حركات خزينة
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTxns.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>{formatDate(transaction.date)}</TableCell>
                          <TableCell className="font-mono">{transaction.reference}</TableCell>
                          <TableCell>
                            <Badge className={transaction.type === "receipt" ? "bg-success" : "bg-danger"}>
                              {transaction.type === "receipt" ? "قبض" : "صرف"}
                            </Badge>
                          </TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell>{getPartyName(transaction)}</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {transaction.payment_method === "cash" ? "نقداً" :
                               transaction.payment_method === "bank_transfer" ? "تحويل بنكي" :
                               transaction.payment_method === "check" ? "شيك" : transaction.payment_method}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={transaction.type === "receipt" ? "amount-positive" : "amount-negative"}>
                              {transaction.type === "receipt" ? "+" : "-"}
                              {formatCurrency(Number(transaction.amount))}
                            </span>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {can("treasury_cash", "edit") && (
                                  <DropdownMenuItem className="gap-2" onClick={() => setEditTxn(transaction)}>
                                    <Edit className="w-4 h-4" />
                                    تعديل التفاصيل
                                  </DropdownMenuItem>
                                )}
                                {can("treasury_cash", "delete") && (
                                  <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setDeleteTxn(transaction)}>
                                    <Trash2 className="w-4 h-4" />
                                    حذف
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
              )}
            </div>
          </TabsContent>

          <TabsContent value="banks">
            <div className="flex justify-end mb-4">
            {can("treasury_banks", "create") && (
              <Button className="gap-2" onClick={() => { setEditBank(null); setBankDialogOpen(true); }}>
                <Plus className="w-4 h-4" />
                إضافة حساب بنكي
              </Button>
            )}
            </div>
            {loadingBanks ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(bankAccounts || []).length === 0 ? (
                  <div className="col-span-3 text-center py-8 text-muted-foreground">لا توجد حسابات بنكية</div>
                ) : (
                  bankAccounts?.map((account) => (
                    <div key={account.id} className="bg-card rounded-xl border border-border p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-primary/10 rounded-lg">
                            <Building2 className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{account.name}</h3>
                            <p className="text-sm text-muted-foreground font-mono">{account.account_number}</p>
                          </div>
                        </div>
                        {can("treasury_banks", "edit") && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditBank(account); setBankDialogOpen(true); }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>البنك: {account.bank_name}</p>
                        {account.branch && <p>الفرع: {account.branch}</p>}
                        <p>العملة: {account.currency}</p>
                      </div>
                      <div className="pt-4 border-t border-border mt-3">
                        <p className="text-sm text-muted-foreground">الرصيد الحالي</p>
                        <p className="text-2xl font-bold text-primary">{formatCurrency(Number(account.current_balance || 0))}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="checks">
            <div className="flex justify-end mb-4">
            {can("treasury_checks", "create") && (
              <Button className="gap-2" onClick={() => { setEditCheck(null); setCheckDialogOpen(true); }}>
                <Plus className="w-4 h-4" />
                إضافة شيك
              </Button>
            )}
            </div>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {loadingChecks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الشيك</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الطرف</TableHead>
                      <TableHead>البنك</TableHead>
                      <TableHead>تاريخ الاستحقاق</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(checks || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          لا توجد شيكات
                        </TableCell>
                      </TableRow>
                    ) : (
                      checks?.map((check) => (
                        <TableRow key={check.id}>
                          <TableCell className="font-mono">{check.number}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {check.type === "received" ? "وارد" : "صادر"}
                            </Badge>
                          </TableCell>
                          <TableCell>{check.party_name}</TableCell>
                          <TableCell>{check.bank_name}</TableCell>
                          <TableCell>{formatDate(check.due_date)}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(Number(check.amount))}</TableCell>
                          <TableCell>
                            <Badge className={checkStatusColors[check.status] || ""}>
                              {checkStatusLabels[check.status] || check.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                               <DropdownMenuContent align="end">
                                {can("treasury_checks", "edit") && (
                                  <DropdownMenuItem onClick={() => { setEditCheck(check); setCheckDialogOpen(true); }}>
                                    <Edit className="w-4 h-4 ml-2" /> تعديل
                                  </DropdownMenuItem>
                                )}
                                {can("treasury_checks", "edit") && (
                                  <DropdownMenuItem onClick={() => { setCheckStatusTarget(check); setNewCheckStatus(check.status); }}>
                                    <CreditCard className="w-4 h-4 ml-2" /> تغيير الحالة
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
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <CashTransactionDialog open={receiptOpen} onOpenChange={setReceiptOpen} type="receipt" />
      <CashTransactionDialog open={paymentOpen} onOpenChange={setPaymentOpen} type="payment" />

      {editTxn && (
        <CashTransactionDialog
          open={!!editTxn}
          onOpenChange={(open) => !open && setEditTxn(null)}
          type={editTxn.type}
          editData={editTxn}
        />
      )}

      <AlertDialog open={!!deleteTxn} onOpenChange={(open) => !open && setDeleteTxn(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذه الحركة؟ سيتم عكس تأثيرها على الأرصدة. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BankAccountDialog open={bankDialogOpen} onOpenChange={setBankDialogOpen} editData={editBank} />
      <CheckDialog open={checkDialogOpen} onOpenChange={setCheckDialogOpen} editData={editCheck} />

      {/* Check status change dialog */}
      <AlertDialog open={!!checkStatusTarget} onOpenChange={(open) => !open && setCheckStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تغيير حالة الشيك</AlertDialogTitle>
            <AlertDialogDescription>
              الشيك رقم: {checkStatusTarget?.number} - المبلغ: {formatCurrency(Number(checkStatusTarget?.amount || 0))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={newCheckStatus} onValueChange={setNewCheckStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">معلق</SelectItem>
                <SelectItem value="collected">محصل</SelectItem>
                <SelectItem value="bounced">مرتد</SelectItem>
                <SelectItem value="cashed">صرف</SelectItem>
                <SelectItem value="endorsed">مظهر</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!checkStatusTarget) return;
              try {
                const { error } = await supabase.from("checks").update({ status: newCheckStatus as any }).eq("id", checkStatusTarget.id);
                if (error) throw error;
                queryClient.invalidateQueries({ queryKey: ["checks"] });
                toast.success("تم تغيير حالة الشيك بنجاح");
              } catch (err: any) {
                toast.error("خطأ: " + err.message);
              }
              setCheckStatusTarget(null);
            }}>
              حفظ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Treasury;
