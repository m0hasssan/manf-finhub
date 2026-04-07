import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface InvoiceData {
  id: string;
  number: string;
  date: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total: number;
  notes: string | null;
  customer_id?: string | null;
  supplier_id?: string | null;
  customers?: { name: string; code: string } | null;
  suppliers?: { name: string; code: string } | null;
}

interface EditInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceData | null;
  type: "sales" | "purchase";
  onStatusChange: (invoiceId: string, status: string) => void;
  isAdmin: boolean;
}

interface InvoiceLine {
  id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_name?: string;
  item_code?: string;
  item_unit?: string;
}

const statusConfig = {
  pending: { label: "معلقة", variant: "secondary" as const, icon: Clock, color: "text-yellow-600" },
  approved: { label: "مقبولة", variant: "default" as const, icon: CheckCircle, color: "text-green-600" },
  rejected: { label: "مرفوضة", variant: "destructive" as const, icon: XCircle, color: "text-destructive" },
};

export function EditInvoiceDialog({ open, onOpenChange, invoice, type, onStatusChange, isAdmin }: EditInvoiceDialogProps) {
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");

  const tableName = type === "sales" ? "sales_invoice_lines" : "purchase_invoice_lines";

  useEffect(() => {
    if (open && invoice) {
      setTaxRate(Number(invoice.tax_rate) || 0);
      setDiscount(Number(invoice.discount) || 0);
      setNotes(invoice.notes || "");
      fetchLines();
    }
  }, [open, invoice?.id]);

  const fetchLines = async () => {
    if (!invoice) return;
    setLoading(true);
    const { data, error } = await supabase
      .from(tableName)
      .select("*, inventory_items(name, code, unit)")
      .eq("invoice_id", invoice.id);
    if (error) {
      toast.error("خطأ في تحميل بنود الفاتورة");
    } else {
      setLines(
        (data || []).map((l: any) => ({
          id: l.id,
          item_id: l.item_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          total: l.total,
          item_name: l.inventory_items?.name,
          item_code: l.inventory_items?.code,
          item_unit: l.inventory_items?.unit,
        }))
      );
    }
    setLoading(false);
  };

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);

  const handleSaveDetails = async () => {
    if (!invoice) return;
    setSaving(true);
    const invoiceTable = type === "sales" ? "sales_invoices" : "purchase_invoices";
    const { error } = await supabase
      .from(invoiceTable)
      .update({
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount,
        total,
        notes,
      })
      .eq("id", invoice.id);
    if (error) {
      toast.error("خطأ في حفظ التعديلات: " + error.message);
    } else {
      toast.success("تم حفظ التعديلات بنجاح");
      queryClient.invalidateQueries({ queryKey: [type === "sales" ? "sales_invoices" : "purchase_invoices"] });
    }
    setSaving(false);
  };

  if (!invoice) return null;

  const currentStatus = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            تعديل الفاتورة - {invoice.number}
            <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invoice Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">التاريخ: </span>
              <span className="font-medium">{new Date(invoice.date).toLocaleDateString("ar-EG")}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{type === "sales" ? "العميل" : "المورد"}: </span>
              <span className="font-medium">
                {type === "sales" ? (invoice.customers as any)?.name : (invoice.suppliers as any)?.name}
              </span>
            </div>
          </div>

          <Separator />

          {/* Status Change - Admin Only */}
          {isAdmin && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">تغيير حالة الفاتورة</Label>
              <div className="flex gap-2">
                {Object.entries(statusConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <Button
                      key={key}
                      variant={invoice.status === key ? "default" : "outline"}
                      size="sm"
                      className="gap-2"
                      disabled={invoice.status === key}
                      onClick={() => {
                        onStatusChange(invoice.id, key);
                        onOpenChange(false);
                      }}
                    >
                      <Icon className={`w-4 h-4 ${config.color}`} />
                      {config.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          <Separator />

          {/* Invoice Lines */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">بنود الفاتورة</Label>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-right">الصنف</th>
                      <th className="p-2 text-right">الكود</th>
                      <th className="p-2 text-right">الوحدة</th>
                      <th className="p-2 text-right">الكمية</th>
                      <th className="p-2 text-right">سعر الوحدة</th>
                      <th className="p-2 text-right">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-t">
                        <td className="p-2">{line.item_name}</td>
                        <td className="p-2 font-mono text-xs">{line.item_code}</td>
                        <td className="p-2">{line.item_unit}</td>
                        <td className="p-2">{line.quantity}</td>
                        <td className="p-2">{formatCurrency(line.unit_price)}</td>
                        <td className="p-2 font-semibold">{formatCurrency(line.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Separator />

          {/* Editable Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>نسبة الضريبة (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>الخصم (جنيه)</Label>
              <Input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أضف ملاحظات على الفاتورة..."
            />
          </div>

          {/* Totals */}
          <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>المجموع الفرعي:</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>الضريبة ({taxRate}%):</span>
              <span className="font-medium">{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>الخصم:</span>
              <span className="font-medium text-destructive">- {formatCurrency(discount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>الإجمالي النهائي:</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
          <Button onClick={handleSaveDetails} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            حفظ التعديلات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
