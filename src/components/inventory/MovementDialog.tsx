import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useInventoryItems, useCustomers, useSuppliers, useCreateMovement } from "@/hooks/useInventory";

interface MovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "in" | "out";
}

export function MovementDialog({ open, onOpenChange, type }: MovementDialogProps) {
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [warehouse, setWarehouse] = useState("المخزن الرئيسي");
  const [partyId, setPartyId] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: items } = useInventoryItems();
  const { data: customers } = useCustomers();
  const { data: suppliers } = useSuppliers();
  const createMovement = useCreateMovement();

  const parties = type === "out" ? customers : suppliers;
  const partyLabel = type === "out" ? "العميل" : "المورد";

  const total = (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !quantity || !unitPrice || !reference) return;

    createMovement.mutate(
      {
        type,
        item_id: itemId,
        quantity: parseFloat(quantity),
        unit_price: parseFloat(unitPrice),
        total,
        warehouse,
        reference,
        date,
        ...(type === "out" ? { customer_id: partyId || null } : { supplier_id: partyId || null }),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setItemId("");
    setQuantity("");
    setUnitPrice("");
    setWarehouse("المخزن الرئيسي");
    setPartyId("");
    setReference("");
    setDate(new Date().toISOString().split("T")[0]);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);

  const itemOptions = (items || []).map((item) => ({
    value: item.id,
    label: `${item.code} - ${item.name} (${item.unit})`,
  }));

  const partyOptions = (parties || []).map((p) => ({
    value: p.id,
    label: `${p.code} - ${p.name}`,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {type === "in" ? "إذن وارد جديد" : "إذن صرف جديد"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>رقم المرجع *</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={type === "in" ? "PO-005" : "INV-005"} required />
            </div>
            <div className="space-y-2">
              <Label>التاريخ *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>الصنف *</Label>
            <SearchableSelect
              value={itemId}
              onValueChange={(val) => {
                setItemId(val);
                const item = items?.find((i) => i.id === val);
                if (item) setUnitPrice(String(type === "in" ? item.cost_price || 0 : item.sell_price || 0));
              }}
              options={itemOptions}
              placeholder="اختر الصنف"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الكمية *</Label>
              <Input type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>سعر الوحدة *</Label>
              <Input type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>المخزن</Label>
              <Select value={warehouse} onValueChange={setWarehouse}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="المخزن الرئيسي">المخزن الرئيسي</SelectItem>
                  <SelectItem value="مخزن المواد الخام">مخزن المواد الخام</SelectItem>
                  <SelectItem value="مخزن التشطيبات">مخزن التشطيبات</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{partyLabel}</Label>
              <SearchableSelect
                value={partyId}
                onValueChange={setPartyId}
                options={partyOptions}
                placeholder={`اختر ${partyLabel}`}
              />
            </div>
          </div>

          <div className="bg-muted rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">الإجمالي</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={createMovement.isPending}>
              {createMovement.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
