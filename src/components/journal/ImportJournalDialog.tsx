import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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

interface ParsedLine {
  date: string;
  description: string;
  debit_account_code: string;
  credit_account_code: string;
  amount: number;
  errors: string[];
  rowNum: number;
}

interface GroupedEntry {
  group_key: string;
  date: string;
  description: string;
  debit_account_code: string;
  credit_account_code: string;
  debit_account_id: string;
  credit_account_id: string;
  amount: number;
  errors: string[];
}

export function ImportJournalDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsedLines, setParsedLines] = useState<ParsedLine[]>([]);
  const [groupedEntries, setGroupedEntries] = useState<GroupedEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ success: 0, failed: 0 });

  const { data: allAccounts } = useQuery({
    queryKey: ["accounts_for_import"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, code, name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const reset = () => {
    setStep("upload");
    setParsedLines([]);
    setGroupedEntries([]);
    setProgress(0);
    setResults({ success: 0, failed: 0 });
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("قيود يومية", { views: [{ rightToLeft: true }] });

    const headers = ["التاريخ", "البيان", "كود الحساب المدين", "كود الحساب الدائن", "القيمة"];
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { name: "Cairo", bold: true, size: 11, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2C3E50" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    headerRow.height = 28;

    sheet.addRow(["2025-01-15", "شراء بضاعة نقداً", "1301", "1101", 5000]);
    sheet.addRow(["2025-01-16", "مصروفات إيجار", "5101", "1101", 2000]);

    sheet.columns.forEach((col) => { col.width = 22; });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "قالب_قيود_يومية.xlsx");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) { toast.error("الملف فارغ"); return; }

      const lines: ParsedLine[] = [];

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const dateVal = row.getCell(1).value;
        const desc = String(row.getCell(2).value ?? "").trim();
        const debitAccCode = String(row.getCell(3).value ?? "").trim();
        const creditAccCode = String(row.getCell(4).value ?? "").trim();
        const amount = Number(row.getCell(5).value) || 0;

        const errors: string[] = [];
        if (!debitAccCode) errors.push("كود الحساب المدين مطلوب");
        if (!creditAccCode) errors.push("كود الحساب الدائن مطلوب");
        if (amount <= 0) errors.push("القيمة يجب أن تكون أكبر من صفر");

        let dateStr = "";
        if (dateVal instanceof Date) {
          dateStr = dateVal.toISOString().split("T")[0];
        } else if (typeof dateVal === "string") {
          const parsed = new Date(dateVal);
          dateStr = isNaN(parsed.getTime()) ? "" : parsed.toISOString().split("T")[0];
        }
        if (!dateStr) errors.push("التاريخ غير صالح");

        lines.push({ date: dateStr, description: desc, debit_account_code: debitAccCode, credit_account_code: creditAccCode, amount, errors, rowNum: rowNumber });
      });

      if (lines.length === 0) { toast.error("لا توجد بيانات"); return; }

      const entries: GroupedEntry[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const debitAcc = allAccounts?.find((a) => a.code === line.debit_account_code);
        const creditAcc = allAccounts?.find((a) => a.code === line.credit_account_code);
        if (!debitAcc) line.errors.push(`كود الحساب المدين "${line.debit_account_code}" غير موجود`);
        if (!creditAcc) line.errors.push(`كود الحساب الدائن "${line.credit_account_code}" غير موجود`);

        entries.push({
          group_key: `row-${i}`,
          date: line.date,
          description: line.description,
          debit_account_code: line.debit_account_code,
          credit_account_code: line.credit_account_code,
          debit_account_id: debitAcc?.id || "",
          credit_account_id: creditAcc?.id || "",
          amount: line.amount,
          errors: [...line.errors],
        });
      }

      setParsedLines(lines);
      setGroupedEntries(entries);
      setStep("preview");
    } catch (err: any) {
      toast.error("خطأ في قراءة الملف: " + err.message);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validEntries = groupedEntries.filter((e) => e.errors.length === 0);
  const errorEntries = groupedEntries.filter((e) => e.errors.length > 0);

  const handleImport = async () => {
    if (validEntries.length === 0) { toast.error("لا توجد قيود صالحة للاستيراد"); return; }
    setStep("importing");
    let success = 0;
    let failed = 0;

    for (let i = 0; i < validEntries.length; i++) {
      const entry = validEntries[i];
      try {
        const { data: journalEntry, error: jeError } = await supabase
          .from("journal_entries")
          .insert({
            number: "",
            date: entry.date,
            description: entry.description || "قيد مستورد",
            status: "posted",
            total_debit: entry.amount,
            total_credit: entry.amount,
            posted_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (jeError) throw jeError;

        const lines = [
          { journal_entry_id: journalEntry.id, account_id: entry.debit_account_id, debit: entry.amount, credit: 0 },
          { journal_entry_id: journalEntry.id, account_id: entry.credit_account_id, debit: 0, credit: entry.amount },
        ];

        const { error: linesError } = await supabase.from("journal_entry_lines").insert(lines);
        if (linesError) throw linesError;

        success++;
      } catch (err) {
        failed++;
      }
      setProgress(Math.round(((i + 1) / validEntries.length) * 100));
    }

    setResults({ success, failed });
    setStep("done");
    queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
    queryClient.invalidateQueries({ queryKey: ["trial_balance"] });
  };

  const totalAmount = groupedEntries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>استيراد قيود يومية من Excel</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-4">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center space-y-4">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
              <div>
                <p className="font-medium">اختر ملف Excel (.xlsx)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  يجب أن يحتوي على: التاريخ، البيان، كود الحساب المدين، كود الحساب الدائن، القيمة
                </p>
                <p className="text-sm text-muted-foreground">
                  كل سطر في الملف يُنشئ قيد مستقل - رقم القيد يتولد تلقائياً
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                  <Download className="w-4 h-4" />
                  تحميل القالب
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="w-4 h-4" />
                  رفع ملف
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">✓ {validEntries.length} قيد صالح</span>
              {errorEntries.length > 0 && (
                <span className="text-destructive font-medium">✗ {errorEntries.length} قيد به أخطاء</span>
              )}
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>البيان</TableHead>
                    <TableHead>حساب مدين</TableHead>
                    <TableHead>حساب دائن</TableHead>
                    <TableHead>القيمة</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedEntries.map((entry, idx) => (
                    <TableRow key={idx} className={entry.errors.length > 0 ? "bg-destructive/5" : ""}>
                      <TableCell>{entry.date}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{entry.description}</TableCell>
                      <TableCell>{entry.debit_account_code}</TableCell>
                      <TableCell>{entry.credit_account_code}</TableCell>
                      <TableCell>{entry.amount > 0 ? entry.amount.toLocaleString() : "-"}</TableCell>
                      <TableCell>
                        {entry.errors.length > 0 ? (
                          <span className="text-destructive text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {entry.errors[0]}
                          </span>
                        ) : (
                          <span className="text-green-600 text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            صالح
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4}>الإجمالي</TableCell>
                    <TableCell className="text-primary">
                      {totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={reset}>رجوع</Button>
              <Button onClick={handleImport} disabled={validEntries.length === 0} className="gap-2">
                <Upload className="w-4 h-4" />
                استيراد {validEntries.length} قيد
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 space-y-4 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p>جاري استيراد القيود...</p>
            <Progress value={progress} className="max-w-md mx-auto" />
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <p className="text-lg font-semibold">تم الاستيراد</p>
            <div className="flex gap-4 justify-center text-sm">
              <span className="text-green-600">✓ {results.success} قيد ناجح</span>
              {results.failed > 0 && <span className="text-destructive">✗ {results.failed} قيد فشل</span>}
            </div>
            <Button onClick={() => handleClose(false)}>إغلاق</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
