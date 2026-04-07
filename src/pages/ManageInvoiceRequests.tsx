import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ClipboardList, Search, Loader2, ArrowDownLeft, ArrowUpRight, Check, X, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type InvoiceRequest = {
  id: string;
  number: string;
  date: string;
  type: string;
  status: string;
  subtotal: number | string;
  tax_amount: number | string;
  tax_rate: number | string;
  discount: number | string;
  total: number | string;
  notes: string | null;
  customer_id?: string | null;
  supplier_id?: string | null;
  customers?: { name: string } | null;
  suppliers?: { name: string } | null;
  lines: { item_id: string; quantity: number; unit_price: number; total: number; item_name?: string }[];
};

function useInvoiceRequests(typeFilter: string) {
  return useQuery({
    queryKey: ["invoice_requests", typeFilter],
    queryFn: async () => {
      // Fetch pending sales invoices
      const { data: sales, error: salesErr } = await supabase
        .from("sales_invoices")
        .select("*, customers(name)")
        .eq("status", "pending")
        .order("date", { ascending: false });
      if (salesErr) throw salesErr;

      const { data: purchases, error: purchErr } = await supabase
        .from("purchase_invoices")
        .select("*, suppliers(name)")
        .eq("status", "pending")
        .order("date", { ascending: false });
      if (purchErr) throw purchErr;

      // Fetch lines for each
      const salesWithLines = await Promise.all(
        (sales || []).map(async (inv) => {
          const { data: lines } = await supabase
            .from("sales_invoice_lines")
            .select("*, inventory_items(name)")
            .eq("invoice_id", inv.id);
          return {
            ...inv,
            type: "out" as const,
            lines: (lines || []).map((l: any) => ({
              item_id: l.item_id,
              quantity: l.quantity,
              unit_price: l.unit_price,
              total: l.total,
              item_name: l.inventory_items?.name,
            })),
          };
        })
      );

      const purchasesWithLines = await Promise.all(
        (purchases || []).map(async (inv) => {
          const { data: lines } = await supabase
            .from("purchase_invoice_lines")
            .select("*, inventory_items(name)")
            .eq("invoice_id", inv.id);
          return {
            ...inv,
            type: "in" as const,
            lines: (lines || []).map((l: any) => ({
              item_id: l.item_id,
              quantity: l.quantity,
              unit_price: l.unit_price,
              total: l.total,
              item_name: l.inventory_items?.name,
            })),
          };
        })
      );

      let all: InvoiceRequest[] = [...salesWithLines, ...purchasesWithLines];
      if (typeFilter === "in") all = purchasesWithLines;
      else if (typeFilter === "out") all = salesWithLines;

      return all;
    },
  });
}

const ManageInvoiceRequests = () => {
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRequest | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);

  const { data: requests, isLoading } = useInvoiceRequests(typeFilter);
  const queryClient = useQueryClient();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);
  const formatDate = (d: string) => new Date(d).toLocaleDateString("ar-EG");

  const filtered = useMemo(() => {
    return (requests || []).filter((r) => {
      const partyName = r.type === "out" ? r.customers?.name : r.suppliers?.name;
      return r.number.includes(searchQuery) || (partyName || "").includes(searchQuery);
    });
  }, [requests, searchQuery]);

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            إدارة طلبات الفواتير
          </h1>
          <p className="text-muted-foreground">مراجعة الفواتير المعلقة وإضافة الخصم والضريبة قبل التأكيد</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">إجمالي الطلبات المعلقة</p>
            <p className="text-2xl font-bold">{requests?.length || 0}</p>
          </div>
          <div className="stat-card stat-card-success">
            <p className="text-sm text-muted-foreground">فواتير شراء (وارد)</p>
            <p className="text-2xl font-bold text-success">{requests?.filter(r => r.type === "in").length || 0}</p>
          </div>
          <div className="stat-card stat-card-danger">
            <p className="text-sm text-muted-foreground">فواتير بيع (صرف)</p>
            <p className="text-2xl font-bold text-danger">{requests?.filter(r => r.type === "out").length || 0}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالرقم أو الطرف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="نوع الطلب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الطلبات</SelectItem>
                <SelectItem value="in">وارد (شراء)</SelectItem>
                <SelectItem value="out">منصرف (بيع)</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                   <TableHead>رقم الفاتورة</TableHead>
                   <TableHead>التاريخ</TableHead>
                   <TableHead>النوع</TableHead>
                   <TableHead>الطرف</TableHead>
                   <TableHead>الأصناف</TableHead>
                   <TableHead>المجموع الفرعي</TableHead>
                   <TableHead>الضريبة</TableHead>
                   <TableHead>الخصم</TableHead>
                   <TableHead>الإجمالي</TableHead>
                   <TableHead>إجراء</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {filtered.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                       لا توجد فواتير معلقة
                     </TableCell>
                   </TableRow>
                ) : (
                  filtered.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono">{inv.number}</TableCell>
                      <TableCell>{formatDate(inv.date)}</TableCell>
                      <TableCell>
                        <Badge className={inv.type === "in" ? "bg-success text-success-foreground" : "bg-danger text-danger-foreground"}>
                          {inv.type === "in" ? (
                            <span className="flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" />وارد</span>
                          ) : (
                            <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />صرف</span>
                          )}
                        </Badge>
                      </TableCell>
                       <TableCell>{inv.type === "out" ? inv.customers?.name : inv.suppliers?.name}</TableCell>
                       <TableCell>
                         <div className="space-y-1">
                           {inv.lines.map((line, i) => (
                             <div key={i} className="text-xs">
                               <span className="font-medium">{line.item_name || "صنف"}</span>
                               <span className="text-muted-foreground"> × {line.quantity}</span>
                             </div>
                           ))}
                         </div>
                       </TableCell>
                      <TableCell>{formatCurrency(Number(inv.subtotal))}</TableCell>
                      <TableCell>{formatCurrency(Number(inv.tax_amount))}</TableCell>
                      <TableCell>{formatCurrency(Number(inv.discount))}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(Number(inv.total))}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => { setSelectedInvoice(inv); setSettleOpen(true); }}>
                          تسوية
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <SettleInvoiceDialog
        open={settleOpen}
        onOpenChange={setSettleOpen}
        invoice={selectedInvoice}
        onDone={() => {
          queryClient.invalidateQueries({ queryKey: ["invoice_requests"] });
          queryClient.invalidateQueries({ queryKey: ["sales_invoices"] });
          queryClient.invalidateQueries({ queryKey: ["purchase_invoices"] });
          queryClient.invalidateQueries({ queryKey: ["inventory_movements"] });
          queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
          queryClient.invalidateQueries({ queryKey: ["trial_balance"] });
          queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
        }}
      />
    </MainLayout>
  );
};

// Settle invoice dialog with discount/tax
function SettleInvoiceDialog({
  open, onOpenChange, invoice, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoice: InvoiceRequest | null;
  onDone: () => void;
}) {
  const [discount, setDiscount] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");
  const [loading, setLoading] = useState(false);

  // Read exchange rate from invoice (saved during store request settlement)
  const rateVal = Number((invoice as any)?.exchange_rate) || 1;
  const isForeignCurrency = rateVal !== 1;

  // Fetch party currency label
  const partyId = invoice?.type === "out" ? invoice?.customer_id : invoice?.supplier_id;
  const partyTable = invoice?.type === "out" ? "customers" : "suppliers";

  const { data: partyData } = useQuery({
    queryKey: ["party_currency_label", partyTable, partyId],
    queryFn: async () => {
      if (!partyId) return null;
      const { data } = await supabase
        .from(partyTable)
        .select("account_id")
        .eq("id", partyId)
        .single();
      if (!data?.account_id) return null;
      const { data: account } = await supabase
        .from("accounts")
        .select("currency")
        .eq("id", data.account_id)
        .single();
      return account;
    },
    enabled: !!partyId,
  });

  if (!invoice) return null;

  const actualCurrency = partyData?.currency || "EGP";
  const isActuallyForeign = actualCurrency !== "EGP";

  const subtotal = Number(invoice.subtotal);
  const discountVal = parseFloat(discount) || 0;
  const taxVal = parseFloat(taxAmount) || 0;
  const newTotal = subtotal - discountVal + taxVal;
  const newTotalEGP = newTotal * rateVal;
  const subtotalEGP = subtotal * rateVal;
  const discountEGP = discountVal * rateVal;
  const taxEGP = taxVal * rateVal;

  const formatCurrency = (amount: number, currency?: string) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: currency || "EGP" }).format(amount);

  const tableName = invoice.type === "out" ? "sales_invoices" : "purchase_invoices";

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // 1. Update invoice status, discount, tax, total
      const { error } = await supabase
        .from(tableName)
        .update({
          discount: discountVal,
          tax_amount: taxVal,
          total: newTotal,
          status: "accepted",
        })
        .eq("id", invoice.id);
      if (error) throw error;

      // 2. Create inventory movements for each line & fetch item account info
      const itemIds = invoice.lines.map(l => l.item_id);
      const { data: itemsData } = await supabase
        .from("inventory_items")
        .select("id, current_stock, account_id, cost_price")
        .in("id", itemIds);

      for (const line of invoice.lines) {
        const movementData: any = {
          type: invoice.type,
          item_id: line.item_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
          total: line.total,
          warehouse: "المخزن الرئيسي",
          reference: invoice.number,
          date: invoice.date,
        };
        if (invoice.type === "out") movementData.customer_id = invoice.customer_id;
        else movementData.supplier_id = invoice.supplier_id;

        await supabase.from("inventory_movements").insert(movementData);

        // 3. Update stock
        const item = itemsData?.find(i => i.id === line.item_id);
        if (item) {
          const newStock = invoice.type === "in"
            ? (item.current_stock || 0) + line.quantity
            : (item.current_stock || 0) - line.quantity;
          await supabase
            .from("inventory_items")
            .update({ current_stock: newStock })
            .eq("id", line.item_id);
        }
      }

      // 4. Create journal entry
      const journalNumber = `JV-${invoice.number}`;
      const journalDescription = invoice.type === "out"
        ? `قيد فاتورة بيع رقم ${invoice.number}`
        : `قيد فاتورة شراء رقم ${invoice.number}`;

      // Fetch account IDs for standard accounts
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, code")
        .in("code", ["521", "1241", "41", "512"]);

      const discountAccId = accounts?.find(a => a.code === "521")?.id;
      const vatAccId = accounts?.find(a => a.code === "1241")?.id;
      const revenueAccId = accounts?.find(a => a.code === "41")?.id;
      const cogsAccId = accounts?.find(a => a.code === "512")?.id;

      // Get party account
      let partyAccountId: string | null = null;
      if (invoice.type === "out" && invoice.customer_id) {
        const { data: customer } = await supabase
          .from("customers")
          .select("account_id")
          .eq("id", invoice.customer_id)
          .single();
        partyAccountId = customer?.account_id || null;
      } else if (invoice.type === "in" && invoice.supplier_id) {
        const { data: supplier } = await supabase
          .from("suppliers")
          .select("account_id")
          .eq("id", invoice.supplier_id)
          .single();
        partyAccountId = supplier?.account_id || null;
      }

      const journalLines: { account_id: string; debit: number; credit: number; description: string }[] = [];

      if (invoice.type === "out") {
        // Sales: Debit Customer (EGP), Credit Revenue (EGP), Debit Discount (EGP), Credit VAT (EGP)
        if (partyAccountId) {
          journalLines.push({ account_id: partyAccountId, debit: newTotalEGP, credit: 0, description: `العميل - فاتورة بيع${isActuallyForeign ? ` (${formatCurrency(newTotal, actualCurrency)} بسعر ${rateVal})` : ""}` });
        }
        if (revenueAccId) {
          journalLines.push({ account_id: revenueAccId, debit: 0, credit: subtotalEGP, description: "إيرادات المبيعات" });
        }
        if (discountAccId && discountVal > 0) {
          journalLines.push({ account_id: discountAccId, debit: discountEGP, credit: 0, description: "خصم مسموح به" });
        }
        if (vatAccId && taxVal > 0) {
          journalLines.push({ account_id: vatAccId, debit: 0, credit: taxEGP, description: "ضريبة 14% قيمة مضافة" });
        }
      } else {
        // Purchase: Debit each item's linked account (EGP), Credit Supplier (EGP)
        for (const line of invoice.lines) {
          const itemData = itemsData?.find(i => i.id === line.item_id);
          const itemAccountId = itemData?.account_id;
          if (itemAccountId) {
            journalLines.push({
              account_id: itemAccountId,
              debit: line.total * rateVal,
              credit: 0,
              description: `المخزون - ${line.item_name || "صنف"} (فاتورة شراء)`,
            });
          }
        }
        if (partyAccountId) {
          journalLines.push({ account_id: partyAccountId, debit: 0, credit: newTotalEGP, description: `المورد - فاتورة شراء${isActuallyForeign ? ` (${formatCurrency(newTotal, actualCurrency)} بسعر ${rateVal})` : ""}` });
        }
        if (discountAccId && discountVal > 0) {
          journalLines.push({ account_id: discountAccId, debit: 0, credit: discountEGP, description: "خصم مكتسب" });
        }
        if (vatAccId && taxVal > 0) {
          journalLines.push({ account_id: vatAccId, debit: taxEGP, credit: 0, description: "ضريبة 14% قيمة مضافة" });
        }
      }

      const totalDebit = journalLines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = journalLines.reduce((s, l) => s + l.credit, 0);

      if (journalLines.length > 0) {
        const { data: journalEntry } = await supabase
          .from("journal_entries")
          .insert({
            number: journalNumber,
            date: invoice.date,
            description: journalDescription,
            total_debit: totalDebit,
            total_credit: totalCredit,
            status: "posted",
            posted_at: new Date().toISOString(),
            reference_type: invoice.type === "out" ? "sales_invoice" : "purchase_invoice",
            reference_id: invoice.id,
            currency: isActuallyForeign ? actualCurrency : "EGP",
            exchange_rate: rateVal,
          })
          .select()
          .single();

        if (journalEntry) {
          await supabase.from("journal_entry_lines").insert(
            journalLines.map((line) => ({
              journal_entry_id: journalEntry.id,
              ...line,
            }))
          );
        }
      }

      // 5. COGS journal entry for sales invoices (at cost price, credit each item's linked account)
      if (invoice.type === "out" && cogsAccId) {
        const cogsLines: { account_id: string; debit: number; credit: number; description: string }[] = [];
        let totalCogs = 0;

        for (const line of invoice.lines) {
          const itemInfo = itemsData?.find(i => i.id === line.item_id);
          const costPrice = Number(itemInfo?.cost_price || 0);
          const lineCogs = costPrice * line.quantity;
          totalCogs += lineCogs;

          // Credit the item's specific linked account (not generic inventory)
          if (lineCogs > 0 && itemInfo?.account_id) {
            cogsLines.push({
              account_id: itemInfo.account_id,
              debit: 0,
              credit: lineCogs,
              description: `المخزون - تكلفة ${line.item_name || "صنف"} مباعة`,
            });
          }
        }

        if (totalCogs > 0) {
          cogsLines.push({ account_id: cogsAccId, debit: totalCogs, credit: 0, description: "تكلفة البضاعة المباعة" });

          const { data: cogsJournal } = await supabase
            .from("journal_entries")
            .insert({
              number: `COGS-${invoice.number}`,
              date: invoice.date,
              description: `قيد تكلفة بضاعة مباعة - فاتورة ${invoice.number}`,
              total_debit: totalCogs,
              total_credit: totalCogs,
              status: "posted",
              posted_at: new Date().toISOString(),
              reference_type: "sales_invoice",
              reference_id: invoice.id,
            })
            .select()
            .single();

          if (cogsJournal) {
            await supabase.from("journal_entry_lines").insert(
              cogsLines.map((line) => ({
                journal_entry_id: cogsJournal.id,
                ...line,
              }))
            );
          }
        }
      }

      toast.success("تم تأكيد الفاتورة بنجاح");
      onDone();
      onOpenChange(false);
      setDiscount("0");
      setTaxAmount("0");
    } catch (err: any) {
      toast.error("حدث خطأ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ status: "rejected" })
        .eq("id", invoice.id);
      if (error) throw error;
      toast.success("تم رفض الفاتورة");
      onDone();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("حدث خطأ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleHold = () => {
    onOpenChange(false);
    setDiscount("0");
    setTaxAmount("0");
    
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>تسوية الفاتورة {invoice.number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoice details */}
          <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">النوع</span>
              <Badge variant={invoice.type === "in" ? "default" : "destructive"}>
                {invoice.type === "in" ? "شراء (وارد)" : "بيع (صرف)"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {invoice.type === "out" ? "العميل" : "المورد"}
              </span>
              <span className="font-medium">
                {invoice.type === "out" ? invoice.customers?.name : invoice.suppliers?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">التاريخ</span>
              <span>{new Date(invoice.date).toLocaleDateString("ar-EG")}</span>
            </div>

            {/* Line items */}
            <Separator />
            <p className="font-medium">الأصناف:</p>
            {invoice.lines.map((line, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span>{line.item_name || "صنف"} × {line.quantity}</span>
                <span>{formatCurrency(line.total)}</span>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex justify-between text-sm font-medium">
            <span>المجموع الفرعي</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          {/* Discount */}
          <div className="space-y-2">
            <Label>قيمة الخصم (خصم مسموح به)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="أدخل قيمة الخصم"
            />
          </div>

          {/* Tax */}
          <div className="space-y-2">
            <Label>قيمة الضريبة (ضريبة 14% قيمة مضافة)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={taxAmount}
              onChange={(e) => setTaxAmount(e.target.value)}
              placeholder="أدخل قيمة الضريبة"
            />
          </div>

          {/* Exchange Rate - read-only, from store request settlement */}
          {isActuallyForeign && (
            <div className="bg-muted rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">معامل التغيير (من إدارة طلبات المخازن)</p>
              <p className="font-bold text-lg">1 {actualCurrency} = {rateVal} جنيه مصري</p>
            </div>
          )}

          {/* Total */}
          <div className="bg-primary/10 rounded-lg p-4 text-center space-y-1">
            <p className="text-sm text-muted-foreground">الإجمالي بعد الخصم والضريبة</p>
            <p className="text-2xl font-bold text-primary">
              {isActuallyForeign
                ? `${formatCurrency(newTotal, actualCurrency)}`
                : formatCurrency(newTotal)}
            </p>
            {isActuallyForeign && (
              <p className="text-sm text-muted-foreground">
                ما يعادل: {formatCurrency(newTotalEGP)} جنيه مصري
              </p>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              className="flex-1 gap-2"
              onClick={handleConfirm}
              disabled={loading}
            >
              <Check className="w-4 h-4" />
              {loading ? "جاري التأكيد..." : "تأكيد الفاتورة"}
            </Button>
            <Button
              variant="destructive"
              className="flex-1 gap-2"
              onClick={handleReject}
              disabled={loading}
            >
              <X className="w-4 h-4" />
              رفض
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleHold}
            >
              <Clock className="w-4 h-4" />
              تعليق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ManageInvoiceRequests;
