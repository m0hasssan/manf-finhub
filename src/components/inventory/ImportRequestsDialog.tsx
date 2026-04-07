import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { saveAs } from "file-saver";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRequest {
  rowNum: number;
  type: "in" | "out";
  date: string;
  itemCode: string;
  itemName?: string;
  quantity: number;
  partyCode: string;
  partyName?: string;
  warehouse: string;
  error?: string;
}

const TEMPLATE_HEADERS = [
  { key: "type", label: "النوع (وارد/صرف)", required: true },
  { key: "date", label: "التاريخ", required: false },
  { key: "item_code", label: "كود الصنف", required: true },
  { key: "quantity", label: "الكمية", required: true },
  { key: "party_code", label: "كود الطرف (عميل/مورد)", required: true },
  { key: "warehouse", label: "المخزن" },
];

export function ImportRequestsDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsed, setParsed] = useState<ParsedRequest[]>([]);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState({ success: 0, failed: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const reset = () => {
    setStep("upload");
    setParsed([]);
    setProgress(0);
    setImportResult({ success: 0, failed: 0 });
  };

  const downloadTemplate = async () => {
    // Load reference data
    const [{ data: items }, { data: customers }, { data: suppliers }] = await Promise.all([
      supabase.from("inventory_items").select("code, name, unit, category").eq("is_active", true).order("code"),
      supabase.from("customers").select("code, name, phone").eq("is_active", true).order("code"),
      supabase.from("suppliers").select("code, name, phone").eq("is_active", true).order("code"),
    ]);

    const wb = new ExcelJS.Workbook();

    // ── Main sheet ──
    const ws = wb.addWorksheet("أذونات المخازن", { views: [{ rightToLeft: true }] });
    const headerRow = ws.addRow(TEMPLATE_HEADERS.map(h => h.label));
    headerRow.eachCell(cell => {
      cell.font = { bold: true, name: "Cairo", size: 11, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2C3E50" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    headerRow.height = 28;
    const today = new Date().toISOString().split("T")[0];
    ws.addRow(["وارد", today, items?.[0]?.code || "ITM-001", 10, suppliers?.[0]?.code || "SUP-001", "المخزن الرئيسي"]);
    ws.addRow(["صرف", today, items?.[0]?.code || "ITM-001", 5, customers?.[0]?.code || "CUS-001", "المخزن الرئيسي"]);
    ws.columns.forEach(col => { col.width = 22; });

    const styleRefSheet = (sheet: ExcelJS.Worksheet, headers: string[]) => {
      const hr = sheet.addRow(headers);
      hr.eachCell(cell => {
        cell.font = { bold: true, name: "Cairo", size: 11, color: { argb: "FFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1B4F72" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      hr.height = 28;
    };

    // ── Items reference sheet ──
    const itemsSheet = wb.addWorksheet("أكواد الأصناف", { views: [{ rightToLeft: true }] });
    styleRefSheet(itemsSheet, ["الكود", "الاسم", "الوحدة", "الفئة"]);
    (items || []).forEach(i => itemsSheet.addRow([i.code, i.name, i.unit, i.category || ""]));
    itemsSheet.columns.forEach(col => { col.width = 20; });

    // ── Customers reference sheet ──
    const custSheet = wb.addWorksheet("أكواد العملاء", { views: [{ rightToLeft: true }] });
    styleRefSheet(custSheet, ["الكود", "الاسم", "الهاتف"]);
    (customers || []).forEach(c => custSheet.addRow([c.code, c.name, c.phone || ""]));
    custSheet.columns.forEach(col => { col.width = 20; });

    // ── Suppliers reference sheet ──
    const supSheet = wb.addWorksheet("أكواد الموردين", { views: [{ rightToLeft: true }] });
    styleRefSheet(supSheet, ["الكود", "الاسم", "الهاتف"]);
    (suppliers || []).forEach(s => supSheet.addRow([s.code, s.name, s.phone || ""]));
    supSheet.columns.forEach(col => { col.width = 20; });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "قالب_أذونات_المخازن.xlsx");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) { toast.error("الملف فارغ"); return; }

      // Load items, customers, suppliers for validation
      const [{ data: items }, { data: customers }, { data: suppliers }] = await Promise.all([
        supabase.from("inventory_items").select("id, code, name"),
        supabase.from("customers").select("id, code, name"),
        supabase.from("suppliers").select("id, code, name"),
      ]);

      const itemMap = new Map((items || []).map(i => [i.code, i]));
      const customerMap = new Map((customers || []).map(c => [c.code, c]));
      const supplierMap = new Map((suppliers || []).map(s => [s.code, s]));

      const rows: ParsedRequest[] = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const typeRaw = String(row.getCell(1).value || "").trim();
        const dateRaw = row.getCell(2).value;
        const itemCode = String(row.getCell(3).value || "").trim();
        const qty = Number(row.getCell(4).value) || 0;
        const partyCode = String(row.getCell(5).value || "").trim();
        const warehouse = String(row.getCell(6).value || "المخزن الرئيسي").trim();

        // Parse date
        let dateStr = new Date().toISOString().split("T")[0];
        if (dateRaw) {
          if (dateRaw instanceof Date) {
            dateStr = dateRaw.toISOString().split("T")[0];
          } else {
            const parsed = new Date(String(dateRaw));
            if (!isNaN(parsed.getTime())) dateStr = parsed.toISOString().split("T")[0];
          }
        }

        if (!typeRaw && !itemCode) return; // skip empty rows

        const type: "in" | "out" = typeRaw === "صرف" || typeRaw.toLowerCase() === "out" ? "out" : "in";
        
        let error: string | undefined;
        const item = itemMap.get(itemCode);
        if (!item) error = `كود الصنف "${itemCode}" غير موجود`;
        if (qty <= 0) error = (error ? error + " | " : "") + "الكمية يجب أن تكون أكبر من صفر";

        let partyName = "";
        if (type === "out") {
          const customer = customerMap.get(partyCode);
          if (!customer) error = (error ? error + " | " : "") + `كود العميل "${partyCode}" غير موجود`;
          else partyName = customer.name;
        } else {
          const supplier = supplierMap.get(partyCode);
          if (!supplier) error = (error ? error + " | " : "") + `كود المورد "${partyCode}" غير موجود`;
          else partyName = supplier.name;
        }

        rows.push({
          rowNum: rowNumber,
          type,
          date: dateStr,
          itemCode,
          itemName: item?.name,
          quantity: qty,
          partyCode,
          partyName,
          warehouse,
          error,
        });
      });

      if (rows.length === 0) { toast.error("لا توجد بيانات في الملف"); return; }
      setParsed(rows);
      setStep("preview");
    } catch (err: any) {
      toast.error("خطأ في قراءة الملف: " + err.message);
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  const validRows = parsed.filter(r => !r.error);
  const errorRows = parsed.filter(r => r.error);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setStep("importing");

    // Get next request number
    const { data: lastReq } = await supabase
      .from("inventory_requests")
      .select("number")
      .order("created_at", { ascending: false })
      .limit(1);
    
    let counter = 1;
    if (lastReq && lastReq.length > 0) {
      counter = parseInt(lastReq[0].number.replace("REQ-", ""), 10) + 1;
    }

    // Load maps for IDs
    const [{ data: items }, { data: customers }, { data: suppliers }] = await Promise.all([
      supabase.from("inventory_items").select("id, code"),
      supabase.from("customers").select("id, code"),
      supabase.from("suppliers").select("id, code"),
    ]);
    const itemIdMap = new Map((items || []).map(i => [i.code, i.id]));
    const customerIdMap = new Map((customers || []).map(c => [c.code, c.id]));
    const supplierIdMap = new Map((suppliers || []).map(s => [s.code, s.id]));

    // Group rows by type + party + warehouse to create one request per group
    const groups = new Map<string, ParsedRequest[]>();
    for (const row of validRows) {
      const key = `${row.type}|${row.partyCode}|${row.warehouse}|${row.date}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    let success = 0;
    let failed = 0;
    const totalGroups = groups.size;
    let processed = 0;

    for (const [, groupRows] of groups) {
      try {
        const first = groupRows[0];
        const number = `REQ-${String(counter).padStart(5, "0")}`;
        counter++;

        const itemId = itemIdMap.get(first.itemCode)!;
        const totalQty = groupRows.reduce((s, r) => s + r.quantity, 0);

        const requestData: any = {
          number,
          type: first.type,
          date: first.date,
          warehouse: first.warehouse,
          item_id: itemId,
          quantity: totalQty,
          status: "pending",
        };

        if (first.type === "out") {
          requestData.customer_id = customerIdMap.get(first.partyCode) || null;
        } else {
          requestData.supplier_id = supplierIdMap.get(first.partyCode) || null;
        }

        const { data: req, error: reqErr } = await supabase
          .from("inventory_requests")
          .insert(requestData)
          .select()
          .single();
        if (reqErr) throw reqErr;

        // Insert lines
        const lines = groupRows.map(r => ({
          request_id: req.id,
          item_id: itemIdMap.get(r.itemCode)!,
          quantity: r.quantity,
        }));
        const { error: linesErr } = await supabase
          .from("inventory_request_lines")
          .insert(lines);
        if (linesErr) throw linesErr;

        success++;
      } catch {
        failed++;
      }
      processed++;
      setProgress(Math.round((processed / totalGroups) * 100));
    }

    setImportResult({ success, failed });
    setStep("done");
    queryClient.invalidateQueries({ queryKey: ["inventory_requests"] });
    queryClient.invalidateQueries({ queryKey: ["next_request_number"] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>استيراد أذونات مخازن من Excel</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                قم بتحميل القالب وملئه بالبيانات ثم رفعه. سيتم تجميع الأصناف التي لها نفس النوع والطرف والمخزن في إذن واحد.
              </p>
              <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                <Download className="w-4 h-4" />
                تحميل القالب
              </Button>
            </div>
            <div className="flex justify-center">
              <label className="cursor-pointer border-2 border-dashed rounded-xl p-12 hover:border-primary transition-colors flex flex-col items-center gap-3">
                <Upload className="w-10 h-10 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">اضغط لرفع ملف Excel</span>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              </label>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" /> صالح: {validRows.length}
              </span>
              {errorRows.length > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="w-4 h-4" /> أخطاء: {errorRows.length}
                </span>
              )}
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>كود الصنف</TableHead>
                    <TableHead>اسم الصنف</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>كود الطرف</TableHead>
                    <TableHead>اسم الطرف</TableHead>
                    <TableHead>المخزن</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((row, i) => (
                    <TableRow key={i} className={row.error ? "bg-red-50 dark:bg-red-950/20" : ""}>
                      <TableCell>{row.rowNum}</TableCell>
                      <TableCell>{row.type === "in" ? "وارد" : "صرف"}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="font-mono">{row.itemCode}</TableCell>
                      <TableCell>{row.itemName || "—"}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell className="font-mono">{row.partyCode}</TableCell>
                      <TableCell>{row.partyName || "—"}</TableCell>
                      <TableCell>{row.warehouse}</TableCell>
                      <TableCell>
                        {row.error ? (
                          <span className="text-xs text-red-600">{row.error}</span>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={reset}>رجوع</Button>
              <Button onClick={handleImport} disabled={validRows.length === 0}>
                استيراد {validRows.length} صف
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 space-y-4 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p>جاري الاستيراد...</p>
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <p className="text-lg font-semibold">تم الاستيراد</p>
            <div className="flex justify-center gap-6 text-sm">
              <span className="text-green-600">نجح: {importResult.success} إذن</span>
              {importResult.failed > 0 && (
                <span className="text-red-600">فشل: {importResult.failed}</span>
              )}
            </div>
            <Button onClick={() => { reset(); onOpenChange(false); }}>إغلاق</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
