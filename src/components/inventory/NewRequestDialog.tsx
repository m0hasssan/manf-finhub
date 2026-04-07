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
import { useInventoryItems, useCustomers, useSuppliers } from "@/hooks/useInventory";
import { useNextRequestNumber, useCreateRequest } from "@/hooks/useInventoryRequests";
import { Plus, Trash2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface RequestLine {
  itemId: string;
  quantity: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "in" | "out";
}

export function NewRequestDialog({ open, onOpenChange, type }: Props) {
  const [warehouse, setWarehouse] = useState("المخزن الرئيسي");
  const [partyId, setPartyId] = useState("");
  const [lines, setLines] = useState<RequestLine[]>([{ itemId: "", quantity: "" }]);

  const { data: items } = useInventoryItems();
  const { data: customers } = useCustomers();
  const { data: suppliers } = useSuppliers();
  const { data: nextNumber, refetch: refetchNumber } = useNextRequestNumber();
  const createRequest = useCreateRequest();

  const parties = type === "out" ? customers : suppliers;
  const partyLabel = type === "out" ? "العميل" : "المورد";
  const today = new Date().toLocaleDateString("ar-EG");

  useEffect(() => {
    if (open) {
      refetchNumber();
      setLines([{ itemId: "", quantity: "" }]);
      setWarehouse("المخزن الرئيسي");
      setPartyId("");
    }
  }, [open, refetchNumber]);

  const addLine = () => setLines([...lines, { itemId: "", quantity: "" }]);

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof RequestLine, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const validLines = lines.filter(l => l.itemId && l.quantity && parseFloat(l.quantity) > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validLines.length === 0 || !nextNumber) return;

    createRequest.mutate(
      {
        number: nextNumber,
        type,
        warehouse,
        ...(type === "out" ? { customer_id: partyId || null } : { supplier_id: partyId || null }),
        lines: validLines.map(l => ({
          item_id: l.itemId,
          quantity: parseFloat(l.quantity),
        })),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const itemOptions = (items || []).map((item) => ({
    value: item.id,
    label: `${item.code} - ${item.name} (${item.unit})`,
  }));

  const partyOptions = (parties || []).map((p) => ({
    value: p.id,
    label: `${p.code} - ${p.name}`,
  }));

  const getItemName = (id: string) => {
    const item = items?.find(i => i.id === id);
    return item ? `${item.code} - ${item.name}` : "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {type === "in" ? "طلب إذن وارد جديد" : "طلب إذن صرف جديد"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>رقم الطلب</Label>
              <Input value={nextNumber || "..."} disabled className="bg-muted font-mono" />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الطلب</Label>
              <Input value={today} disabled className="bg-muted" />
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

          {/* Lines Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">الأصناف *</Label>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addLine}>
                <Plus className="w-4 h-4" />
                إضافة صنف
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>الصنف</TableHead>
                    <TableHead className="w-[120px]">الكمية</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center font-mono text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <SearchableSelect
                          value={line.itemId}
                          onValueChange={(v) => updateLine(index, "itemId", v)}
                          options={itemOptions}
                          placeholder="اختر الصنف"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, "quantity", e.target.value)}
                          placeholder="الكمية"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removeLine(index)}
                          disabled={lines.length <= 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">عدد الأصناف: {validLines.length}</p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={createRequest.isPending || validLines.length === 0}>
              {createRequest.isPending ? "جاري الحفظ..." : "إرسال الطلب"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
