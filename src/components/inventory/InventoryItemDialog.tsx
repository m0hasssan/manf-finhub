import { useState, useEffect } from "react";
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
import { useCreateInventoryItem, useUpdateInventoryItem } from "@/hooks/useInventory";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem: Tables<"inventory_items"> | null;
}

export function InventoryItemDialog({ open, onOpenChange, editItem }: Props) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("قطعة");
  const [category, setCategory] = useState("");
  const [warehouse, setWarehouse] = useState("المخزن الرئيسي");
  const [costPrice, setCostPrice] = useState("0");
  const [sellPrice, setSellPrice] = useState("0");
  const [currentStock, setCurrentStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [openingStock, setOpeningStock] = useState("0");
  const [accountId, setAccountId] = useState("");

  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();

  const { data: accounts } = useQuery({
    queryKey: ["accounts_for_inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, code, name, type")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (editItem) {
      setCode(editItem.code);
      setName(editItem.name);
      setUnit(editItem.unit);
      setCategory(editItem.category || "");
      setWarehouse(editItem.warehouse || "المخزن الرئيسي");
      setCostPrice(String(editItem.cost_price || 0));
      setSellPrice(String(editItem.sell_price || 0));
      setCurrentStock(String(editItem.current_stock || 0));
      setMinStock(String(editItem.min_stock || 0));
      setOpeningStock(String((editItem as any).opening_stock || 0));
      setAccountId(editItem.account_id || "");
    } else {
      resetForm();
    }
  }, [editItem, open]);

  const resetForm = () => {
    setCode(""); setName(""); setUnit("قطعة"); setCategory("");
    setWarehouse("المخزن الرئيسي"); setCostPrice("0"); setSellPrice("0");
    setCurrentStock("0"); setMinStock("0"); setOpeningStock("0"); setAccountId("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;

    if (!accountId) {
      toast.error("يجب ربط الصنف بحساب في شجرة الحسابات");
      return;
    }

    const payload = {
      code, name, unit, category: category || null,
      warehouse: warehouse || "المخزن الرئيسي",
      cost_price: parseFloat(costPrice) || 0,
      sell_price: parseFloat(sellPrice) || 0,
      current_stock: parseFloat(currentStock) || 0,
      min_stock: parseFloat(minStock) || 0,
      account_id: accountId,
      opening_stock: parseFloat(openingStock) || 0,
    };

    if (editItem) {
      updateItem.mutate({ id: editItem.id, ...payload }, {
        onSuccess: () => { onOpenChange(false); resetForm(); },
      });
    } else {
      createItem.mutate(payload, {
        onSuccess: () => { onOpenChange(false); resetForm(); },
      });
    }
  };

  const accountOptions = (accounts || []).map((acc) => ({
    value: acc.id,
    label: `${acc.code} - ${acc.name}`,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "تعديل صنف" : "إضافة صنف جديد"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الكود *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>الاسم *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الوحدة</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الفئة</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>سعر التكلفة</Label>
              <Input type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>سعر البيع</Label>
              <Input type="number" min="0" step="0.01" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الرصيد الحالي</Label>
              <Input type="number" value={currentStock} readOnly disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>الحد الأدنى</Label>
              <Input type="number" min="0" step="0.01" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الرصيد الافتتاحي</Label>
              <Input type="number" min="0" step="0.01" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-destructive font-bold">حساب شجرة الحسابات * (إلزامي)</Label>
            <SearchableSelect
              value={accountId}
              onValueChange={setAccountId}
              options={accountOptions}
              placeholder="اختر الحساب المرتبط"
              className={!accountId ? "border-destructive" : ""}
            />
            {!accountId && (
              <p className="text-xs text-destructive">يجب ربط كل صنف بحساب في شجرة الحسابات</p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
              {(createItem.isPending || updateItem.isPending) ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
