import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, ClipboardList, Download, Upload, Loader2, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { JournalEntryDialog } from "@/components/journal/JournalEntryDialog";
import { ImportJournalDialog } from "@/components/journal/ImportJournalDialog";

const Journal = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [deleteEntry, setDeleteEntry] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const { data: journalEntries = [], isLoading } = useQuery({
    queryKey: ["journal_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*, journal_entry_lines(*, accounts(code, name))")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async () => {
    if (!deleteEntry) return;
    setDeleting(true);
    try {
      // Delete lines first
      await supabase.from("journal_entry_lines").delete().eq("journal_entry_id", deleteEntry.id);
      const { error } = await supabase.from("journal_entries").delete().eq("id", deleteEntry.id);
      if (error) throw error;
      toast.success("تم حذف القيد بنجاح");
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      queryClient.invalidateQueries({ queryKey: ["trial_balance"] });
    } catch (error: any) {
      toast.error("خطأ في الحذف: " + error.message);
    } finally {
      setDeleting(false);
      setDeleteEntry(null);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount === 0) return "-";
    return new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("ar-EG");

  const filtered = journalEntries.filter((e: any) =>
    e.description?.includes(searchQuery) || e.number?.includes(searchQuery)
  );

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              اليومية الأمريكية
            </h1>
            <p className="text-muted-foreground">سجل جميع القيود المحاسبية</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => {
              const headers = ["رقم القيد", "التاريخ", "البيان", "الحالة", "الحساب", "مدين", "دائن"];
              const rows: (string | number)[][] = [];
              filtered.forEach((entry: any) => {
                (entry.journal_entry_lines || []).forEach((line: any, idx: number) => {
                  rows.push([
                    idx === 0 ? entry.number : "",
                    idx === 0 ? new Date(entry.date).toLocaleDateString("ar-EG") : "",
                    idx === 0 ? entry.description : "",
                    idx === 0 ? (entry.status === "posted" ? "مُعتمد" : entry.status === "draft" ? "مسودة" : "ملغي") : "",
                    `${line.accounts?.code || ""} - ${line.accounts?.name || ""}`,
                    Number(line.debit) || 0,
                    Number(line.credit) || 0,
                  ]);
                });
              });
              exportToExcel(headers, rows, "اليومية_الأمريكية", { title: "اليومية الأمريكية", subtitle: `تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")}`, showTotalsRow: false });
            }}>
              <Download className="w-4 h-4" />
              تصدير Excel
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4" />
              استيراد Excel
            </Button>
            <Button className="gap-2" onClick={() => { setEditEntry(null); setDialogOpen(true); }}>
              <Plus className="w-4 h-4" />
              قيد جديد
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث في القيود..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد قيود</h3>
            <p className="text-muted-foreground">ابدأ بإضافة قيد يومية جديد</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((entry: any) => (
              <div key={entry.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 bg-muted/50 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm bg-primary/10 text-primary px-3 py-1 rounded">{entry.number}</span>
                    <span className="text-muted-foreground">{formatDate(entry.date)}</span>
                    <span className="font-medium">{entry.description}</span>
                    {entry.currency !== "EGP" && (
                      <span className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded">
                        {entry.currency} × {entry.exchange_rate}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${entry.status === "posted" ? "bg-success/10 text-success" : entry.status === "draft" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
                      {entry.status === "posted" ? "مُعتمد" : entry.status === "draft" ? "مسودة" : "ملغي"}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditEntry(entry); setDialogOpen(true); }}>
                          <Edit className="w-4 h-4 ml-2" /> تعديل التفاصيل
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteEntry(entry)}>
                          <Trash2 className="w-4 h-4 ml-2" /> حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الحساب</TableHead>
                      <TableHead className="text-center w-40">مدين</TableHead>
                      <TableHead className="text-center w-40">دائن</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(entry.journal_entry_lines || []).map((line: any) => (
                      <TableRow key={line.id}>
                        <TableCell className={line.credit > 0 ? "pr-8" : ""}>
                          {line.credit > 0 ? "إلى: " : "من: "}
                          {line.accounts?.code} - {line.accounts?.name}
                          {line.description && <span className="text-muted-foreground text-sm mr-2">({line.description})</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {line.debit > 0 ? <span className="font-semibold">{formatCurrency(line.debit)}</span> : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {line.credit > 0 ? <span className="font-semibold">{formatCurrency(line.credit)}</span> : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-bold">
                      <TableCell>الإجمالي</TableCell>
                      <TableCell className="text-center text-primary">{formatCurrency(entry.total_debit)}</TableCell>
                      <TableCell className="text-center text-primary">{formatCurrency(entry.total_credit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </div>

      <JournalEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} editData={editEntry} />

      <AlertDialog open={!!deleteEntry} onOpenChange={(open) => !open && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف القيد {deleteEntry?.number}؟ سيتم حذف جميع أسطر القيد وعكس الأثر المالي.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ImportJournalDialog open={importOpen} onOpenChange={setImportOpen} />
    </MainLayout>
  );
};

export default Journal;
