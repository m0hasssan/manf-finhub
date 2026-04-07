import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedLine {
  accountCode: string;
  accountName?: string;
  accountId?: string;
  debit: number;
  credit: number;
  description?: string;
}

interface ParsedEntry {
  rowNum: number;
  date: string;
  partyType: "customer" | "supplier";
  partyCode: string;
  partyName?: string;
  partyId?: string;
  partyAccountId?: string;
  description: string;
  currency: string;
  exchangeRate: number;
  lines: ParsedLine[];
  totalDebit: number;
  totalCredit: number;
  error?: string;
}

export function ImportPartyEntriesDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts_for_linking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, code, name, currency, exchange_rate").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, code, name, account_id").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, code, name, account_id").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();

    // Main template sheet
    const ws = wb.addWorksheet("قالب استيراد قيود الأطراف", {
      views: [{ rightToLeft: true }],
    });

    const headers = [
      "رقم القيد (مجموعة)", "التاريخ", "النوع (عميل/مورد)", "كود أو اسم الطرف",
      "البيان", "العملة", "معامل الصرف", "كود الحساب", "مدين", "دائن", "وصف السطر",
    ];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { name: "Cairo", bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2C3E50" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    const examples = [
      [1, "2025-01-15", "عميل", "C001", "تحصيل من عميل أحمد", "EGP", 1, "1101", 50000, 0, ""],
      [1, "", "", "", "", "", "", "2101", 0, 50000, ""],
      [2, "2025-01-16", "مورد", "S001", "سداد مورد الحديد", "USD", 50, "4101", 0, 1000, ""],
      [2, "", "", "", "", "", "", "1101", 1000, 0, ""],
    ];
    examples.forEach((row) => {
      const r = ws.addRow(row);
      r.eachCell((cell) => {
        cell.font = { name: "Cairo", size: 10, color: { argb: "7F8C8D" } };
        cell.alignment = { horizontal: "center" };
      });
    });

    ws.addRow([]);
    const noteRow = ws.addRow(["ملاحظة: يمكنك استخدام كود الطرف أو اسمه. الأسطر بنفس رقم المجموعة تُدمج في قيد واحد. بيانات التاريخ والنوع والبيان تؤخذ من أول سطر فقط."]);
    noteRow.getCell(1).font = { name: "Cairo", size: 10, color: { argb: "E74C3C" }, bold: true };
    ws.mergeCells(noteRow.number, 1, noteRow.number, 11);
    ws.columns.forEach((col) => { col.width = 18; });

    // Customers reference sheet
    const csWs = wb.addWorksheet("أكواد العملاء", { views: [{ rightToLeft: true }] });
    const csHeader = csWs.addRow(["الكود", "الاسم"]);
    csHeader.eachCell((cell) => {
      cell.font = { name: "Cairo", bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1B4F72" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    customers.forEach((c) => {
      csWs.addRow([c.code, c.name]);
    });
    csWs.columns.forEach((col) => { col.width = 25; });

    // Suppliers reference sheet
    const spWs = wb.addWorksheet("أكواد الموردين", { views: [{ rightToLeft: true }] });
    const spHeader = spWs.addRow(["الكود", "الاسم"]);
    spHeader.eachCell((cell) => {
      cell.font = { name: "Cairo", bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "7D3C98" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    suppliers.forEach((s) => {
      spWs.addRow([s.code, s.name]);
    });
    spWs.columns.forEach((col) => { col.width = 25; });

    // Accounts reference sheet
    const accWs = wb.addWorksheet("أكواد الحسابات", { views: [{ rightToLeft: true }] });
    const accHeader = accWs.addRow(["الكود", "الاسم", "العملة"]);
    accHeader.eachCell((cell) => {
      cell.font = { name: "Cairo", bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "27AE60" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    accounts.filter(a => !accounts.some(c => c.code.startsWith(a.code) && c.code !== a.code && c.code.length > a.code.length)).forEach((a) => {
      accWs.addRow([a.code, a.name, a.currency]);
    });
    accWs.columns.forEach((col) => { col.width = 25; });

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "قالب_استيراد_قيود_الأطراف.xlsx");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) { toast.error("الملف فارغ"); return; }

      // Group rows by entry number (column 1)
      const groups = new Map<string, any[]>();
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const groupKey = String(row.getCell(1).value || "").trim();
        if (!groupKey) return;
        const rowData = {
          rowNum: rowNumber,
          group: groupKey,
          date: String(row.getCell(2).value || "").trim(),
          type: String(row.getCell(3).value || "").trim(),
          partyCode: String(row.getCell(4).value || "").trim(),
          description: String(row.getCell(5).value || "").trim(),
          currency: String(row.getCell(6).value || "EGP").trim(),
          exchangeRate: Number(row.getCell(7).value) || 1,
          accountCode: String(row.getCell(8).value || "").trim(),
          debit: Number(row.getCell(9).value) || 0,
          credit: Number(row.getCell(10).value) || 0,
          lineDesc: String(row.getCell(11).value || "").trim(),
        };
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey)!.push(rowData);
      });

      const parsed: ParsedEntry[] = [];
      groups.forEach((rows, groupKey) => {
        const first = rows[0];
        const partyType = first.type.includes("مورد") ? "supplier" : "customer";
        const partyCodeOrName = first.partyCode;

        // Find party by code or name
        const partyList = partyType === "customer" ? customers : suppliers;
        const party = partyList.find((p) => p.code === partyCodeOrName || p.name === partyCodeOrName);

        const lines: ParsedLine[] = rows.map((r) => {
          const acc = accounts.find((a) => a.code === r.accountCode);
          return {
            accountCode: r.accountCode,
            accountName: acc?.name,
            accountId: acc?.id,
            debit: r.debit,
            credit: r.credit,
            description: r.lineDesc,
          };
        });

        const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
        const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

        let error: string | undefined;
        if (!party) error = `الطرف "${partyCodeOrName}" غير موجود`;
        else if (!party.account_id) error = `الطرف ${party.name} غير مرتبط بحساب`;
        const missingAccounts = lines.filter((l) => !l.accountId);
        if (missingAccounts.length > 0) error = (error ? error + " | " : "") + `حسابات غير موجودة: ${missingAccounts.map((l) => l.accountCode).join(", ")}`;
        if (Math.abs(totalDebit - totalCredit) > 0.01) error = (error ? error + " | " : "") + `القيد غير متزن (مدين: ${totalDebit}, دائن: ${totalCredit})`;

        // Parse date
        let dateStr = first.date;
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) dateStr = d.toISOString().split("T")[0];
        }
        if (!dateStr) dateStr = new Date().toISOString().split("T")[0];

        parsed.push({
          rowNum: first.rowNum,
          date: dateStr,
          partyType,
          partyCode: partyCodeOrName,
          partyName: party?.name,
          partyId: party?.id,
          partyAccountId: party?.account_id || undefined,
          description: first.description,
          currency: first.currency || "EGP",
          exchangeRate: first.exchangeRate,
          lines,
          totalDebit,
          totalCredit,
          error,
        });
      });

      setEntries(parsed);
      setParsed(true);
    } catch (err: any) {
      toast.error("خطأ في قراءة الملف: " + err.message);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const validEntries = entries.filter((e) => !e.error);
  const errorEntries = entries.filter((e) => !!e.error);

  const handleImport = async () => {
    if (validEntries.length === 0) { toast.error("لا توجد قيود صالحة للاستيراد"); return; }
    setImporting(true);
    let success = 0;
    let failed = 0;

    for (const entry of validEntries) {
      try {
        const amountEGP = entry.totalDebit * entry.exchangeRate;

        const { data: je, error: jeErr } = await supabase
          .from("journal_entries")
          .insert({
            number: "",
            date: entry.date,
            description: entry.description,
            currency: entry.currency,
            exchange_rate: entry.exchangeRate,
            total_debit: amountEGP,
            total_credit: amountEGP,
            status: "posted",
            reference_type: entry.partyType === "customer" ? "party_customer" : "party_supplier",
            reference_id: entry.partyId,
          })
          .select()
          .single();
        if (jeErr) throw jeErr;

        const lineInserts = entry.lines.map((l) => ({
          journal_entry_id: je.id,
          account_id: l.accountId!,
          debit: l.debit * entry.exchangeRate,
          credit: l.credit * entry.exchangeRate,
          description: l.description || null,
        }));

        const { error: lErr } = await supabase.from("journal_entry_lines").insert(lineInserts);
        if (lErr) throw lErr;
        success++;
      } catch {
        failed++;
      }
    }

    toast.success(`تم استيراد ${success} قيد بنجاح${failed > 0 ? ` | فشل ${failed}` : ""}`);
    queryClient.invalidateQueries({ queryKey: ["party_journal_entries"] });
    queryClient.invalidateQueries({ queryKey: ["trial_balance"] });
    setImporting(false);
    setParsed(false);
    setEntries([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setParsed(false); setEntries([]); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>استيراد قيود أطراف من Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={downloadTemplate}>
              <Download className="w-4 h-4" /> تحميل القالب
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" /> اختيار ملف Excel
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
          </div>

          {parsed && (
            <>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-4 h-4" /> صالح: {validEntries.length}
                </span>
                <span className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="w-4 h-4" /> أخطاء: {errorEntries.length}
                </span>
              </div>

              <div className="border rounded-lg overflow-auto max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الطرف</TableHead>
                      <TableHead>البيان</TableHead>
                      <TableHead>العملة</TableHead>
                      <TableHead className="text-center">مدين</TableHead>
                      <TableHead className="text-center">دائن</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e, i) => (
                      <TableRow key={i} className={e.error ? "bg-destructive/5" : ""}>
                        <TableCell>{e.date}</TableCell>
                        <TableCell>{e.partyType === "customer" ? "عميل" : "مورد"}</TableCell>
                        <TableCell>{e.partyName || e.partyCode}</TableCell>
                        <TableCell>{e.description}</TableCell>
                        <TableCell>{e.currency}{e.exchangeRate !== 1 ? ` ×${e.exchangeRate}` : ""}</TableCell>
                        <TableCell className="text-center">{e.totalDebit.toLocaleString()}</TableCell>
                        <TableCell className="text-center">{e.totalCredit.toLocaleString()}</TableCell>
                        <TableCell>
                          {e.error ? (
                            <span className="text-destructive text-xs">{e.error}</span>
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button onClick={handleImport} disabled={importing || validEntries.length === 0} className="w-full gap-2">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                استيراد {validEntries.length} قيد
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
