import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, X, Clock } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useApproveRequest, useRejectRequest, type InventoryRequestWithDetails } from "@/hooks/useInventoryRequests";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: InventoryRequestWithDetails | null;
}

export function SettleRequestDialog({ open, onOpenChange, request }: Props) {
  const [linePrices, setLinePrices] = useState<Record<string, string>>({});
  const [exchangeRate, setExchangeRate] = useState("1");
  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();

  const lines = request?.inventory_request_lines || [];

  // Determine party
  const partyId = request?.type === "out" ? request?.customer_id : request?.supplier_id;
  const partyTable = request?.type === "out" ? "customers" : "suppliers";

  const { data: partyAccount } = useQuery({
    queryKey: ["party_currency", partyTable, partyId],
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
        .select("currency, exchange_rate")
        .eq("id", data.account_id)
        .single();
      return account;
    },
    enabled: !!partyId,
  });

  const partyCurrency = partyAccount?.currency || "EGP";
  const isForeignCurrency = partyCurrency !== "EGP";

  useEffect(() => {
    if (partyAccount?.exchange_rate) {
      setExchangeRate(String(partyAccount.exchange_rate));
    } else {
      setExchangeRate("1");
    }
  }, [partyId, partyAccount]);

  useEffect(() => {
    if (open && lines.length > 0) {
      const initial: Record<string, string> = {};
      lines.forEach(l => { initial[l.id] = ""; });
      setLinePrices(initial);
    }
  }, [open, request?.id]);

  if (!request) return null;

  const rateVal = parseFloat(exchangeRate) || 1;

  const formatCurrency = (amount: number, currency?: string) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: currency || "EGP" }).format(amount);

  const allPriced = lines.length > 0 && lines.every(l => {
    const price = parseFloat(linePrices[l.id] || "0");
    return price > 0;
  });

  const grandTotal = lines.reduce((sum, l) => {
    const price = parseFloat(linePrices[l.id] || "0");
    return sum + l.quantity * price;
  }, 0);

  const grandTotalEGP = grandTotal * rateVal;

  const handleApprove = () => {
    if (!allPriced) return;
    const priceData = lines.map(l => ({
      lineId: l.id,
      item_id: l.item_id,
      quantity: l.quantity,
      unit_price: parseFloat(linePrices[l.id] || "0"),
    }));
    approveRequest.mutate(
      { id: request.id, request, linePrices: priceData, exchangeRate: rateVal },
      { onSuccess: () => { onOpenChange(false); setLinePrices({}); setExchangeRate("1"); } }
    );
  };

  const handleReject = () => {
    rejectRequest.mutate(request.id, {
      onSuccess: () => { onOpenChange(false); setLinePrices({}); setExchangeRate("1"); },
    });
  };

  const handleHold = async () => {
    await supabase
      .from("inventory_requests")
      .update({ status: "pending" })
      .eq("id", request.id);
    onOpenChange(false);
    setLinePrices({});
    setExchangeRate("1");
  };

  const partyName = request.type === "out"
    ? request.customers?.name
    : request.suppliers?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تسوية الطلب {request.number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Request info */}
          <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">النوع</span>
              <Badge variant={request.type === "in" ? "default" : "destructive"}>
                {request.type === "in" ? "وارد" : "صرف"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">التاريخ</span>
              <span>{new Date(request.date).toLocaleDateString("ar-EG")}</span>
            </div>
            {partyName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{request.type === "out" ? "العميل" : "المورد"}</span>
                <span>{partyName}</span>
              </div>
            )}
            {isForeignCurrency && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">العملة</span>
                <Badge variant="outline">{partyCurrency}</Badge>
              </div>
            )}
          </div>

          <Separator />

          {/* Lines pricing table */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">تسعير الأصناف *</Label>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>الصنف</TableHead>
                    <TableHead className="w-[80px]">الكمية</TableHead>
                    <TableHead className="w-[140px]">سعر الوحدة {isForeignCurrency ? `(${partyCurrency})` : ""}</TableHead>
                    <TableHead className="w-[120px]">الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, idx) => {
                    const price = parseFloat(linePrices[line.id] || "0");
                    const lineTotal = line.quantity * price;
                    return (
                      <TableRow key={line.id}>
                        <TableCell className="text-center font-mono text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">
                          {line.inventory_items?.code} - {line.inventory_items?.name}
                          <span className="text-xs text-muted-foreground mr-1">({line.inventory_items?.unit})</span>
                        </TableCell>
                        <TableCell className="text-center">{line.quantity}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={linePrices[line.id] || ""}
                            onChange={(e) => setLinePrices({ ...linePrices, [line.id]: e.target.value })}
                            placeholder="السعر"
                          />
                        </TableCell>
                        <TableCell className="font-medium text-center">
                          {price > 0 ? formatCurrency(lineTotal, isForeignCurrency ? partyCurrency : "EGP") : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Exchange Rate */}
          {isForeignCurrency && (
            <div className="space-y-2">
              <Label>سعر الصرف ({partyCurrency} → جنيه مصري)</Label>
              <Input
                type="number"
                min="0.001"
                step="0.01"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">1 {partyCurrency} = {rateVal} جنيه مصري</p>
            </div>
          )}

          {allPriced && (
            <div className="bg-primary/10 rounded-lg p-4 text-center space-y-1">
              <p className="text-sm text-muted-foreground">الإجمالي الكلي</p>
              <p className="text-2xl font-bold text-primary">
                {isForeignCurrency ? formatCurrency(grandTotal, partyCurrency) : formatCurrency(grandTotal)}
              </p>
              {isForeignCurrency && (
                <p className="text-sm text-muted-foreground">
                  ما يعادل: {formatCurrency(grandTotalEGP)} جنيه مصري
                </p>
              )}
            </div>
          )}

          <Separator />

          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={handleApprove} disabled={!allPriced || approveRequest.isPending}>
              <Check className="w-4 h-4" />
              {approveRequest.isPending ? "جاري الاعتماد..." : "موافقة"}
            </Button>
            <Button variant="destructive" className="flex-1 gap-2" onClick={handleReject} disabled={rejectRequest.isPending}>
              <X className="w-4 h-4" />
              رفض
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={handleHold}>
              <Clock className="w-4 h-4" />
              تعليق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
