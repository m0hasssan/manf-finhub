import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { useWorkOrders, useWorkOrderDetails, WorkOrderInput, WorkOrderStage, WorkOrderOutput } from "@/hooks/useWorkOrders";
import { supabase } from "@/integrations/supabase/client";

interface WorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOrderId: string | null;
}

const defaultStageNames = ["صهر", "سحب", "تشكيل", "تلميع", "تجميع"];

const inputTypeLabels: Record<string, string> = {
  gold_raw: "ذهب خام",
  stones: "أحجار كريمة",
  other: "أخرى",
};

export function WorkOrderDialog({ open, onOpenChange, editingOrderId }: WorkOrderDialogProps) {
  const { createWorkOrder, updateWorkOrder, getNextNumber } = useWorkOrders();
  const { inputs: existingInputs, stages: existingStages, outputs: existingOutputs } = useWorkOrderDetails(editingOrderId || undefined);

  const [number, setNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [productName, setProductName] = useState("");
  const [targetKarat, setTargetKarat] = useState(21);
  const [goldPrice, setGoldPrice] = useState(0);
  const [overheadCost, setOverheadCost] = useState(0);
  const [notes, setNotes] = useState("");
  const [inputs, setInputs] = useState<WorkOrderInput[]>([]);
  const [stages, setStages] = useState<WorkOrderStage[]>([]);
  const [outputs, setOutputs] = useState<WorkOrderOutput[]>([]);
  const [existingOrder, setExistingOrder] = useState<any>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    if (open && !editingOrderId) {
      resetForm();
      getNextNumber().then(setNumber);
    }
  }, [open, editingOrderId]);

  useEffect(() => {
    if (editingOrderId && open) {
      supabase.from("gold_work_orders").select("*").eq("id", editingOrderId).single().then(({ data }) => {
        if (data) {
          setExistingOrder(data);
          setNumber(data.number);
          setDate(data.date);
          setProductName(data.product_name);
          setTargetKarat(data.target_karat);
          setGoldPrice(data.gold_price_per_gram);
          setOverheadCost(data.overhead_cost);
          setNotes(data.notes || "");
          setIsReadOnly(data.status !== "draft");
        }
      });
    }
  }, [editingOrderId, open]);

  useEffect(() => {
    if (editingOrderId && existingInputs.length > 0) setInputs(existingInputs);
  }, [existingInputs, editingOrderId]);

  useEffect(() => {
    if (editingOrderId && existingStages.length > 0) setStages(existingStages);
  }, [existingStages, editingOrderId]);

  useEffect(() => {
    if (editingOrderId && existingOutputs.length > 0) setOutputs(existingOutputs);
  }, [existingOutputs, editingOrderId]);

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setProductName("");
    setTargetKarat(21);
    setGoldPrice(0);
    setOverheadCost(0);
    setNotes("");
    setInputs([]);
    setStages([]);
    setOutputs([]);
    setExistingOrder(null);
    setIsReadOnly(false);
  };

  // Calculations
  const totalInputWeight = inputs.reduce((s, i) => s + (i.weight || 0), 0);
  const totalPureGoldInput = inputs.reduce((s, i) => s + (i.pure_gold_weight || 0), 0);
  const materialCost = inputs.reduce((s, i) => s + (i.total_cost || 0), 0);
  const laborCost = stages.reduce((s, st) => s + (st.labor_cost || 0), 0);
  const totalOutputWeight = outputs.reduce((s, o) => s + (o.weight || 0) * (o.quantity || 1), 0);
  const totalLoss = stages.reduce((s, st) => s + (st.loss_weight || 0), 0);
  const lossPercentage = totalInputWeight > 0 ? (totalLoss / totalInputWeight) * 100 : 0;
  const totalCost = materialCost + laborCost + overheadCost;

  // Input handlers
  const addInput = () => {
    setInputs([...inputs, { input_type: "gold_raw", karat: 24, weight: 0, pure_gold_weight: 0, unit_price: goldPrice, total_cost: 0 }]);
  };

  const updateInput = (index: number, field: string, value: any) => {
    const updated = [...inputs];
    (updated[index] as any)[field] = value;
    // Recalculate pure gold weight
    if (field === "weight" || field === "karat") {
      updated[index].pure_gold_weight = (updated[index].weight * updated[index].karat) / 24;
    }
    if (field === "weight" || field === "unit_price") {
      updated[index].total_cost = updated[index].weight * updated[index].unit_price;
    }
    setInputs(updated);
  };

  const removeInput = (index: number) => setInputs(inputs.filter((_, i) => i !== index));

  // Stage handlers
  const addStage = () => {
    const nextOrder = stages.length + 1;
    const suggestedName = defaultStageNames[nextOrder - 1] || `مرحلة ${nextOrder}`;
    setStages([...stages, { stage_order: nextOrder, stage_name: suggestedName, status: "pending", input_weight: 0, output_weight: 0, loss_weight: 0, labor_cost: 0 }]);
  };

  const updateStage = (index: number, field: string, value: any) => {
    const updated = [...stages];
    (updated[index] as any)[field] = value;
    if (field === "input_weight" || field === "output_weight") {
      updated[index].loss_weight = (updated[index].input_weight || 0) - (updated[index].output_weight || 0);
    }
    setStages(updated);
  };

  const removeStage = (index: number) => setStages(stages.filter((_, i) => i !== index));

  // Output handlers
  const addOutput = () => {
    setOutputs([...outputs, { product_name: productName, karat: targetKarat, weight: 0, pure_gold_weight: 0, quantity: 1, unit_cost: 0, total_cost: 0 }]);
  };

  const updateOutput = (index: number, field: string, value: any) => {
    const updated = [...outputs];
    (updated[index] as any)[field] = value;
    if (field === "weight" || field === "karat") {
      updated[index].pure_gold_weight = (updated[index].weight * updated[index].karat) / 24;
    }
    if (field === "weight" || field === "quantity") {
      const qty = updated[index].quantity || 1;
      updated[index].unit_cost = totalCost > 0 && qty > 0 ? totalCost / qty : 0;
      updated[index].total_cost = updated[index].unit_cost * qty;
    }
    setOutputs(updated);
  };

  const removeOutput = (index: number) => setOutputs(outputs.filter((_, i) => i !== index));

  const handleSave = async () => {
    const orderData = {
      number,
      date,
      product_name: productName,
      target_karat: targetKarat,
      gold_price_per_gram: goldPrice,
      total_gold_input_weight: totalInputWeight,
      total_output_weight: totalOutputWeight,
      total_loss_weight: totalLoss,
      loss_percentage: lossPercentage,
      material_cost: materialCost,
      labor_cost: laborCost,
      overhead_cost: overheadCost,
      total_cost: totalCost,
      notes: notes || null,
      status: "draft" as const,
      inputs,
      stages,
      outputs,
    };

    if (editingOrderId) {
      await updateWorkOrder.mutateAsync({ id: editingOrderId, ...orderData });
    } else {
      await createWorkOrder.mutateAsync(orderData);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingOrderId ? (isReadOnly ? "عرض أمر التشغيل" : "تعديل أمر التشغيل") : "أمر تشغيل جديد"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>رقم الأمر</Label>
              <Input value={number} disabled className="font-mono" />
            </div>
            <div>
              <Label>التاريخ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isReadOnly} />
            </div>
            <div>
              <Label>اسم المنتج</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="خاتم، سلسلة..." disabled={isReadOnly} />
            </div>
            <div>
              <Label>العيار المستهدف</Label>
              <Select value={String(targetKarat)} onValueChange={(v) => setTargetKarat(Number(v))} disabled={isReadOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 قيراط</SelectItem>
                  <SelectItem value="21">21 قيراط</SelectItem>
                  <SelectItem value="18">18 قيراط</SelectItem>
                  <SelectItem value="14">14 قيراط</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>سعر جرام الذهب</Label>
              <Input type="number" value={goldPrice} onChange={(e) => setGoldPrice(Number(e.target.value))} disabled={isReadOnly} />
            </div>
            <div>
              <Label>تكاليف إضافية</Label>
              <Input type="number" value={overheadCost} onChange={(e) => setOverheadCost(Number(e.target.value))} disabled={isReadOnly} />
            </div>
          </div>

          <Tabs defaultValue="inputs" dir="rtl">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="inputs">المدخلات ({inputs.length})</TabsTrigger>
              <TabsTrigger value="stages">المراحل ({stages.length})</TabsTrigger>
              <TabsTrigger value="outputs">المخرجات ({outputs.length})</TabsTrigger>
              <TabsTrigger value="summary">ملخص التكلفة</TabsTrigger>
            </TabsList>

            {/* Inputs Tab */}
            <TabsContent value="inputs" className="space-y-4">
              {!isReadOnly && (
                <Button variant="outline" size="sm" onClick={addInput}>
                  <Plus className="w-4 h-4 ml-1" /> إضافة مادة
                </Button>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النوع</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>العيار</TableHead>
                    <TableHead>الوزن (جم)</TableHead>
                    <TableHead>الوزن الصافي</TableHead>
                    <TableHead>سعر الجرام</TableHead>
                    <TableHead>التكلفة</TableHead>
                    {!isReadOnly && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inputs.map((input, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select value={input.input_type} onValueChange={(v) => updateInput(idx, "input_type", v)} disabled={isReadOnly}>
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gold_raw">ذهب خام</SelectItem>
                            <SelectItem value="stones">أحجار</SelectItem>
                            <SelectItem value="other">أخرى</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input value={input.description || ""} onChange={(e) => updateInput(idx, "description", e.target.value)} disabled={isReadOnly} className="w-32" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={input.karat} onChange={(e) => updateInput(idx, "karat", Number(e.target.value))} disabled={isReadOnly} className="w-16" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={input.weight} onChange={(e) => updateInput(idx, "weight", Number(e.target.value))} disabled={isReadOnly} className="w-20" />
                      </TableCell>
                      <TableCell className="font-mono">{input.pure_gold_weight.toFixed(2)}</TableCell>
                      <TableCell>
                        <Input type="number" value={input.unit_price} onChange={(e) => updateInput(idx, "unit_price", Number(e.target.value))} disabled={isReadOnly} className="w-24" />
                      </TableCell>
                      <TableCell className="font-mono">{input.total_cost.toFixed(2)}</TableCell>
                      {!isReadOnly && (
                        <TableCell>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeInput(idx)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-sm text-muted-foreground">
                إجمالي الوزن: {totalInputWeight.toFixed(2)} جم | الوزن الصافي: {totalPureGoldInput.toFixed(2)} جم | تكلفة المواد: {materialCost.toLocaleString()}
              </div>
            </TabsContent>

            {/* Stages Tab */}
            <TabsContent value="stages" className="space-y-4">
              {!isReadOnly && (
                <Button variant="outline" size="sm" onClick={addStage}>
                  <Plus className="w-4 h-4 ml-1" /> إضافة مرحلة
                </Button>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الترتيب</TableHead>
                    <TableHead>المرحلة</TableHead>
                    <TableHead>وزن الدخول (جم)</TableHead>
                    <TableHead>وزن الخروج (جم)</TableHead>
                    <TableHead>الفاقد (جم)</TableHead>
                    <TableHead>المصنعية</TableHead>
                    <TableHead>العامل</TableHead>
                    {!isReadOnly && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stages.map((stage, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{stage.stage_order}</TableCell>
                      <TableCell>
                        <Input value={stage.stage_name} onChange={(e) => updateStage(idx, "stage_name", e.target.value)} disabled={isReadOnly} className="w-24" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={stage.input_weight} onChange={(e) => updateStage(idx, "input_weight", Number(e.target.value))} disabled={isReadOnly} className="w-20" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={stage.output_weight} onChange={(e) => updateStage(idx, "output_weight", Number(e.target.value))} disabled={isReadOnly} className="w-20" />
                      </TableCell>
                      <TableCell className="font-mono text-destructive">{stage.loss_weight.toFixed(2)}</TableCell>
                      <TableCell>
                        <Input type="number" value={stage.labor_cost} onChange={(e) => updateStage(idx, "labor_cost", Number(e.target.value))} disabled={isReadOnly} className="w-24" />
                      </TableCell>
                      <TableCell>
                        <Input value={stage.worker_name || ""} onChange={(e) => updateStage(idx, "worker_name", e.target.value)} disabled={isReadOnly} className="w-28" />
                      </TableCell>
                      {!isReadOnly && (
                        <TableCell>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeStage(idx)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-sm text-muted-foreground">
                إجمالي الفاقد: {totalLoss.toFixed(2)} جم ({lossPercentage.toFixed(1)}%) | إجمالي المصنعية: {laborCost.toLocaleString()}
              </div>
            </TabsContent>

            {/* Outputs Tab */}
            <TabsContent value="outputs" className="space-y-4">
              {!isReadOnly && (
                <Button variant="outline" size="sm" onClick={addOutput}>
                  <Plus className="w-4 h-4 ml-1" /> إضافة منتج
                </Button>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنتج</TableHead>
                    <TableHead>العيار</TableHead>
                    <TableHead>الوزن (جم)</TableHead>
                    <TableHead>الوزن الصافي</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>تكلفة القطعة</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    {!isReadOnly && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outputs.map((output, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Input value={output.product_name} onChange={(e) => updateOutput(idx, "product_name", e.target.value)} disabled={isReadOnly} className="w-32" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={output.karat} onChange={(e) => updateOutput(idx, "karat", Number(e.target.value))} disabled={isReadOnly} className="w-16" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={output.weight} onChange={(e) => updateOutput(idx, "weight", Number(e.target.value))} disabled={isReadOnly} className="w-20" />
                      </TableCell>
                      <TableCell className="font-mono">{output.pure_gold_weight.toFixed(2)}</TableCell>
                      <TableCell>
                        <Input type="number" value={output.quantity} onChange={(e) => updateOutput(idx, "quantity", Number(e.target.value))} disabled={isReadOnly} className="w-16" />
                      </TableCell>
                      <TableCell className="font-mono">{output.unit_cost.toFixed(2)}</TableCell>
                      <TableCell className="font-mono">{output.total_cost.toFixed(2)}</TableCell>
                      {!isReadOnly && (
                        <TableCell>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeOutput(idx)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Cost Summary Tab */}
            <TabsContent value="summary">
              <Card>
                <CardHeader>
                  <CardTitle>ملخص التكلفة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex justify-between p-3 bg-muted rounded-lg">
                      <span>تكلفة المواد الخام</span>
                      <span className="font-bold">{materialCost.toLocaleString()} جنيه</span>
                    </div>
                    <div className="flex justify-between p-3 bg-muted rounded-lg">
                      <span>تكلفة المصنعية</span>
                      <span className="font-bold">{laborCost.toLocaleString()} جنيه</span>
                    </div>
                    <div className="flex justify-between p-3 bg-muted rounded-lg">
                      <span>تكاليف إضافية</span>
                      <span className="font-bold">{overheadCost.toLocaleString()} جنيه</span>
                    </div>
                    <div className="flex justify-between p-3 bg-primary/10 rounded-lg border border-primary">
                      <span className="font-bold">التكلفة الإجمالية</span>
                      <span className="font-bold text-primary">{totalCost.toLocaleString()} جنيه</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">وزن المدخلات</p>
                      <p className="font-bold">{totalInputWeight.toFixed(2)} جم</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">وزن المخرجات</p>
                      <p className="font-bold">{totalOutputWeight.toFixed(2)} جم</p>
                    </div>
                    <div className="text-center p-3 bg-destructive/10 rounded-lg">
                      <p className="text-sm text-muted-foreground">الفاقد</p>
                      <p className="font-bold text-destructive">{totalLoss.toFixed(2)} جم ({lossPercentage.toFixed(1)}%)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Notes */}
          <div>
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isReadOnly} />
          </div>

          {/* Actions */}
          {!isReadOnly && (
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
              <Button onClick={handleSave} disabled={!productName || createWorkOrder.isPending || updateWorkOrder.isPending}>
                {editingOrderId ? "حفظ التعديلات" : "إنشاء أمر التشغيل"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
