import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
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

type ImportType = "customers" | "suppliers" | "inventory";

interface ImportConfig {
  label: string;
  headers: { key: string; label: string; required?: boolean }[];
  tableName: string;
  queryKeys: string[];
}

const configs: Record<ImportType, ImportConfig> = {
  customers: {
    label: "العملاء",
    headers: [
      { key: "code", label: "الكود", required: true },
      { key: "name", label: "الاسم", required: true },
      { key: "phone", label: "الهاتف" },
      { key: "email", label: "البريد الإلكتروني" },
      { key: "address", label: "العنوان" },
      { key: "tax_number", label: "الرقم الضريبي" },
      { key: "opening_balance_debit", label: "رصيد افتتاحي مدين" },
      { key: "opening_balance_credit", label: "رصيد افتتاحي دائن" },
      { key: "credit_limit", label: "حد الائتمان" },
      { key: "account_code", label: "كود الحساب (شجرة الحسابات)", required: true },
      { key: "currency", label: "العملة" },
      { key: "exchange_rate", label: "معامل الصرف" },
    ],
    tableName: "customers",
    queryKeys: ["customers_full", "customers"],
  },
  suppliers: {
    label: "الموردين",
    headers: [
      { key: "code", label: "الكود", required: true },
      { key: "name", label: "الاسم", required: true },
      { key: "phone", label: "الهاتف" },
      { key: "email", label: "البريد الإلكتروني" },
      { key: "address", label: "العنوان" },
      { key: "tax_number", label: "الرقم الضريبي" },
      { key: "opening_balance_debit", label: "رصيد افتتاحي مدين" },
      { key: "opening_balance_credit", label: "رصيد افتتاحي دائن" },
      { key: "credit_limit", label: "حد الائتمان" },
      { key: "account_code", label: "كود الحساب (شجرة الحسابات)", required: true },
      { key: "currency", label: "العملة" },
      { key: "exchange_rate", label: "معامل الصرف" },
    ],
    tableName: "suppliers",
    queryKeys: ["suppliers_full", "suppliers"],
  },
  inventory: {
    label: "الأصناف",
    headers: [
      { key: "code", label: "الكود", required: true },
      { key: "name", label: "الاسم", required: true },
      { key: "unit", label: "الوحدة" },
      { key: "category", label: "الفئة" },
      { key: "warehouse", label: "المخزن" },
      { key: "cost_price", label: "سعر التكلفة" },
      { key: "sell_price", label: "سعر البيع" },
      { key: "current_stock", label: "الرصيد الحالي" },
      { key: "min_stock", label: "الحد الأدنى" },
      { key: "account_code", label: "كود الحساب (شجرة الحسابات)", required: true },
    ],
    tableName: "inventory_items",
    queryKeys: ["inventory_items", "inventory_items_full"],
  },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ImportType;
}

interface ParsedRow {
  data: Record<string, any>;
  errors: string[];
  rowNum: number;
}

export function ImportExcelDialog({ open, onOpenChange, type }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const config = configs[type];

  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ success: 0, failed: 0 });

  // Fetch accounts for inventory import to resolve account_code -> account_id
  const { data: allAccounts } = useQuery({
    queryKey: ["accounts_for_import"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, code").eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: (type === "inventory" || type === "customers" || type === "suppliers") && open,
  });

  const reset = () => {
    setStep("upload");
    setParsedRows([]);
    setProgress(0);
    setResults({ success: 0, failed: 0 });
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(config.label, {
      views: [{ rightToLeft: true }],
    });

    const headerRow = sheet.addRow(config.headers.map((h) => h.label));
    headerRow.eachCell((cell) => {
      cell.font = { name: "Cairo", bold: true, size: 11, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2C3E50" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    headerRow.height = 28;

    // Example row
    if (type === "customers") {
      sheet.addRow(["C001", "عميل تجريبي", "01000000000", "test@example.com", "القاهرة", "", 0, 0, 0, "1201", "EGP", 1]);
    } else if (type === "suppliers") {
      sheet.addRow(["S001", "مورد تجريبي", "01000000000", "supplier@example.com", "الإسكندرية", "", 0, 0, 0, "2101", "EGP", 1]);
    } else {
      sheet.addRow(["ITM001", "صنف تجريبي", "قطعة", "عام", "المخزن الرئيسي", 100, 150, 0, 10, "1301"]);
    }

    sheet.columns.forEach((col) => { col.width = 18; });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `قالب_${config.label}.xlsx`);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);

      const sheet = workbook.worksheets[0];
      if (!sheet) {
        toast.error("الملف فارغ");
        return;
      }

      const rows: ParsedRow[] = [];
      const headerKeys = config.headers.map((h) => h.key);

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header

        const data: Record<string, any> = {};
        const errors: string[] = [];

        config.headers.forEach((h, i) => {
          const cellValue = row.getCell(i + 1).value;
          let val = cellValue != null ? String(cellValue).trim() : "";

          if (h.required && !val) {
            errors.push(`${h.label} مطلوب`);
          }

          // Convert numeric fields
          if (["opening_balance_debit", "opening_balance_credit", "opening_balance", "credit_limit", "cost_price", "sell_price", "current_stock", "min_stock"].includes(h.key)) {
            data[h.key] = val ? Number(val) || 0 : 0;
          } else {
            data[h.key] = val || null;
          }
        });

        // Transform debit/credit into single opening_balance for DB
        if (type === "customers") {
          data.opening_balance = (data.opening_balance_debit || 0) - (data.opening_balance_credit || 0);
          delete data.opening_balance_debit;
          delete data.opening_balance_credit;
        } else if (type === "suppliers") {
          data.opening_balance = (data.opening_balance_credit || 0) - (data.opening_balance_debit || 0);
          delete data.opening_balance_debit;
          delete data.opening_balance_credit;
        }

        // Handle currency & exchange_rate
        if (type === "customers" || type === "suppliers") {
          if (!data.currency) data.currency = "EGP";
          if (!data.exchange_rate) data.exchange_rate = 1;
          // Multiply opening_balance by exchange_rate for local currency storage
          if (data.exchange_rate && data.exchange_rate !== 1 && data.opening_balance) {
            data.opening_balance = data.opening_balance * data.exchange_rate;
          }
          // currency/exchange_rate not columns on customers/suppliers table - remove them
          // They are used for the account creation below
        }

        // Resolve account_code to account_id for customers, suppliers, and inventory
        if (type === "customers" || type === "suppliers" || type === "inventory") {
          const accountCode = data.account_code ? String(data.account_code).trim() : "";
          if (!accountCode) {
            errors.push("كود الحساب مطلوب");
          } else {
            const account = allAccounts?.find((a) => a.code === accountCode);
            if (!account) {
              errors.push(`كود الحساب "${accountCode}" غير موجود في شجرة الحسابات`);
            } else {
              data.account_id = account.id;
            }
          }
          delete data.account_code;
          if (type === "customers" || type === "suppliers") {
            delete data.currency;
            delete data.exchange_rate;
          }
        }

        rows.push({ data, errors, rowNum: rowNumber });
      });

      if (rows.length === 0) {
        toast.error("لم يتم العثور على بيانات في الملف");
        return;
      }

      setParsedRows(rows);
      setStep("preview");
    } catch (err: any) {
      toast.error("خطأ في قراءة الملف: " + err.message);
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) {
      toast.error("لا توجد صفوف صالحة للاستيراد");
      return;
    }

    setStep("importing");
    let success = 0;
    let failed = 0;

    // Batch insert in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize).map((r) => r.data);
      const { error } = await supabase.from(config.tableName as any).insert(chunk as any);
      if (error) {
        // Try one by one for this chunk
        for (const row of chunk) {
          const { error: singleError } = await supabase.from(config.tableName as any).insert(row as any);
          if (singleError) {
            failed++;
          } else {
            success++;
          }
        }
      } else {
        success += chunk.length;
      }
      setProgress(Math.round(((i + chunkSize) / validRows.length) * 100));
    }

    setResults({ success, failed });
    setProgress(100);
    setStep("done");

    config.queryKeys.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });

    if (success > 0) {
      toast.success(`تم استيراد ${success} سجل بنجاح`);
    }
    if (failed > 0) {
      toast.error(`فشل استيراد ${failed} سجل (قد يكون الكود مكرر)`);
    }
  };

  const validCount = parsedRows.filter((r) => r.errors.length === 0).length;
  const errorCount = parsedRows.filter((r) => r.errors.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>استيراد {config.label} من Excel</DialogTitle>
          <DialogDescription>
            قم برفع ملف Excel يحتوي على بيانات {config.label} لاستيرادها دفعة واحدة
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="border-2 border-dashed border-border rounded-xl p-10 text-center w-full">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">اسحب ملف Excel هنا أو اختر ملف</p>
              <p className="text-sm text-muted-foreground mb-4">
                يجب أن يحتوي الملف على أعمدة: {config.headers.filter((h) => h.required).map((h) => h.label).join("، ")} (إلزامي)
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="w-4 h-4" />
                  اختر ملف
                </Button>
                <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                  <Download className="w-4 h-4" />
                  تحميل القالب
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>{validCount} صف صالح</span>
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{errorCount} صف به أخطاء (سيتم تجاهله)</span>
                </div>
              )}
            </div>

            <ScrollArea className="flex-1 border rounded-lg max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {config.headers.slice(0, 5).map((h) => (
                      <TableHead key={h.key}>{h.label}</TableHead>
                    ))}
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 100).map((row, i) => (
                    <TableRow key={i} className={row.errors.length > 0 ? "bg-destructive/5" : ""}>
                      <TableCell className="text-muted-foreground">{row.rowNum}</TableCell>
                      {config.headers.slice(0, 5).map((h) => (
                        <TableCell key={h.key}>{String(row.data[h.key] ?? "")}</TableCell>
                      ))}
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <span className="text-destructive text-xs">{row.errors.join("، ")}</span>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-lg font-medium">جاري الاستيراد...</p>
            <Progress value={progress} className="w-64" />
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="w-14 h-14 text-success" />
            <p className="text-lg font-medium">تم الانتهاء!</p>
            <div className="flex gap-6 text-sm">
              <span className="text-success">✓ نجح: {results.success}</span>
              {results.failed > 0 && <span className="text-destructive">✗ فشل: {results.failed}</span>}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>رجوع</Button>
              <Button onClick={handleImport} disabled={validCount === 0} className="gap-2">
                <Upload className="w-4 h-4" />
                استيراد {validCount} سجل
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => handleClose(false)}>إغلاق</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
