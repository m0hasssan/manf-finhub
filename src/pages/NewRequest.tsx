import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowDownLeft, ArrowUpRight, FilePlus, ListChecks, Loader2, Trash2, ArrowRight, FileSpreadsheet,
} from "lucide-react";
import { NewRequestDialog } from "@/components/inventory/NewRequestDialog";
import { ImportRequestsDialog } from "@/components/inventory/ImportRequestsDialog";
import { useInventoryRequests, useDeletePendingRequest } from "@/hooks/useInventoryRequests";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/usePermissions";

const statusMap: Record<string, { label: string; className: string }> = {
  pending: { label: "معلق", className: "text-yellow-600 border-yellow-600" },
  approved: { label: "مقبول", className: "text-green-600 border-green-600 bg-green-50" },
  rejected: { label: "مرفوض", className: "text-red-600 border-red-600 bg-red-50" },
};

const NewRequest = () => {
  const [dialogType, setDialogType] = useState<"in" | "out">("in");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showSentRequests, setShowSentRequests] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data: allRequests, isLoading } = useInventoryRequests("all");
  const deleteRequest = useDeletePendingRequest();

  const formatDate = (d: string) => new Date(d).toLocaleDateString("ar-EG");

  if (showSentRequests) {
    return (
      <MainLayout>
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ListChecks className="w-6 h-6 text-primary" />
                الطلبات المرسلة
              </h1>
              <p className="text-muted-foreground">متابعة حالة جميع الطلبات</p>
            </div>
            <Button variant="outline" onClick={() => setShowSentRequests(false)}>
              <ArrowRight className="w-4 h-4 ml-2" />
              رجوع
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                 <TableRow>
                     <TableHead>رقم الطلب</TableHead>
                     <TableHead>التاريخ</TableHead>
                     <TableHead>النوع</TableHead>
                     <TableHead>الأصناف</TableHead>
                     <TableHead>المخزن</TableHead>
                     <TableHead>الطرف</TableHead>
                     <TableHead>الحالة</TableHead>
                     <TableHead>إجراء</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {!allRequests?.length ? (
                   <TableRow>
                       <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                         لا توجد طلبات مرسلة
                       </TableCell>
                     </TableRow>
                  ) : (
                    allRequests.map((req) => {
                       const status = statusMap[req.status] || statusMap.pending;
                       const lines = req.inventory_request_lines || [];
                       return (
                         <TableRow key={req.id}>
                           <TableCell className="font-mono">{req.number}</TableCell>
                           <TableCell>{formatDate(req.date)}</TableCell>
                           <TableCell>
                             <Badge className={req.type === "in" ? "bg-success text-success-foreground" : "bg-danger text-danger-foreground"}>
                               {req.type === "in" ? (
                                 <span className="flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" />وارد</span>
                               ) : (
                                 <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />صرف</span>
                               )}
                             </Badge>
                           </TableCell>
                           <TableCell className="font-medium">
                             {lines.length > 0 ? (
                               <div className="space-y-1">
                                 {lines.map((l) => (
                                   <div key={l.id} className="text-xs">
                                     {l.inventory_items?.name} × {l.quantity}
                                   </div>
                                 ))}
                               </div>
                             ) : (
                               <span>{req.inventory_items?.name} × {req.quantity}</span>
                             )}
                           </TableCell>
                           <TableCell className="text-muted-foreground">{req.warehouse}</TableCell>
                           <TableCell>
                             {req.type === "out" ? req.customers?.name : req.suppliers?.name}
                           </TableCell>
                           <TableCell>
                             <Badge variant="outline" className={status.className}>
                               {status.label}
                             </Badge>
                           </TableCell>
                           <TableCell>
                             {req.status === "pending" ? (
                               <AlertDialog>
                                 <AlertDialogTrigger asChild>
                                   <Button size="sm" variant="destructive">
                                     <Trash2 className="w-3 h-3 ml-1" />
                                     حذف
                                   </Button>
                                 </AlertDialogTrigger>
                                 <AlertDialogContent>
                                   <AlertDialogHeader>
                                     <AlertDialogTitle>تأكيد حذف الطلب</AlertDialogTitle>
                                     <AlertDialogDescription>
                                       هل أنت متأكد من حذف الطلب رقم {req.number}؟ لا يمكن التراجع عن هذا الإجراء.
                                     </AlertDialogDescription>
                                   </AlertDialogHeader>
                                   <AlertDialogFooter>
                                     <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                     <AlertDialogAction onClick={() => deleteRequest.mutate(req.id)}>
                                       حذف
                                     </AlertDialogAction>
                                   </AlertDialogFooter>
                                 </AlertDialogContent>
                               </AlertDialog>
                             ) : (
                               <span className="text-xs text-muted-foreground">—</span>
                             )}
                           </TableCell>
                         </TableRow>
                       );
                     })
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="text-center">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <FilePlus className="w-6 h-6 text-primary" />
            طلب إذن جديد
          </h1>
          <p className="text-muted-foreground mt-1">اختر نوع الإذن المطلوب</p>
        </div>

        <div className="flex items-center justify-center gap-8 mt-12 flex-wrap">
          <Button
            variant="outline"
            className="w-64 h-48 flex flex-col items-center justify-center gap-4 text-xl border-2 hover:border-primary hover:bg-primary/5 transition-all"
            onClick={() => { setDialogType("in"); setDialogOpen(true); }}
          >
            <ArrowDownLeft className="w-16 h-16 text-success" />
            <span className="font-bold">إذن وارد</span>
            <span className="text-sm text-muted-foreground">استلام بضاعة من مورد</span>
          </Button>

          <Button
            variant="outline"
            className="w-64 h-48 flex flex-col items-center justify-center gap-4 text-xl border-2 hover:border-primary hover:bg-primary/5 transition-all"
            onClick={() => { setDialogType("out"); setDialogOpen(true); }}
          >
            <ArrowUpRight className="w-16 h-16 text-danger" />
            <span className="font-bold">إذن صرف</span>
            <span className="text-sm text-muted-foreground">صرف بضاعة لعميل</span>
          </Button>

            <Button
              variant="outline"
              className="w-64 h-48 flex flex-col items-center justify-center gap-4 text-xl border-2 hover:border-primary hover:bg-primary/5 transition-all"
              onClick={() => setShowSentRequests(true)}
            >
              <ListChecks className="w-16 h-16 text-primary" />
              <span className="font-bold">عرض الطلبات المرسلة</span>
              <span className="text-sm text-muted-foreground">متابعة حالة الطلبات</span>
            </Button>

            <Button
              variant="outline"
              className="w-64 h-48 flex flex-col items-center justify-center gap-4 text-xl border-2 hover:border-primary hover:bg-primary/5 transition-all"
              onClick={() => setImportOpen(true)}
            >
              <FileSpreadsheet className="w-16 h-16 text-primary" />
              <span className="font-bold">استيراد من Excel</span>
              <span className="text-sm text-muted-foreground">رفع أذونات وارد وصرف من ملف</span>
            </Button>
          </div>
        </div>

        <NewRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} type={dialogType} />
        <ImportRequestsDialog open={importOpen} onOpenChange={setImportOpen} />
    </MainLayout>
  );
};

export default NewRequest;
