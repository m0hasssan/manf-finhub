import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, Activity } from "lucide-react";
import { useAllLogs, getActionLabel, getEntityLabel } from "@/hooks/useActionLog";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const ActionLogs = () => {
  const { data: logs, isLoading } = useAllLogs();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");

  const filtered = logs?.filter((log) => {
    const matchesSearch =
      log.user_name.includes(search) ||
      (log.entity_name || "").includes(search) ||
      (log.details || "").includes(search);
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter;
    return matchesSearch && matchesAction && matchesEntity;
  }) || [];

  const actionBadgeColor = (action: string) => {
    switch (action) {
      case "create": return "bg-success text-success-foreground";
      case "update": return "bg-warning text-warning-foreground";
      case "delete": return "bg-destructive text-destructive-foreground";
      case "approve": case "confirm": return "bg-primary text-primary-foreground";
      default: return "";
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            سجل الأحداث
          </h1>
          <p className="text-muted-foreground">جميع الحركات والإجراءات التي تمت على النظام</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث بالاسم أو التفاصيل..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="نوع الإجراء" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الإجراءات</SelectItem>
                <SelectItem value="create">إضافة</SelectItem>
                <SelectItem value="update">تعديل</SelectItem>
                <SelectItem value="delete">حذف</SelectItem>
                <SelectItem value="approve">اعتماد</SelectItem>
                <SelectItem value="confirm">تأكيد</SelectItem>
                <SelectItem value="settle">تسوية</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="نوع العنصر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع العناصر</SelectItem>
                <SelectItem value="customer">عملاء</SelectItem>
                <SelectItem value="supplier">موردين</SelectItem>
                <SelectItem value="employee">موظفين</SelectItem>
                <SelectItem value="inventory_item">أصناف</SelectItem>
                <SelectItem value="sales_invoice">فواتير بيع</SelectItem>
                <SelectItem value="purchase_invoice">فواتير شراء</SelectItem>
                <SelectItem value="cash_transaction">سندات نقدية</SelectItem>
                <SelectItem value="journal_entry">قيود يومية</SelectItem>
                <SelectItem value="custody">عهد</SelectItem>
                <SelectItem value="check">شيكات</SelectItem>
                <SelectItem value="bank_account">حسابات بنكية</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                  <TableHead>التاريخ والوقت</TableHead>
                  <TableHead>المستخدم</TableHead>
                  <TableHead>الإجراء</TableHead>
                  <TableHead>العنصر</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>التفاصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      لا توجد سجلات
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(log.created_at), "yyyy/MM/dd HH:mm", { locale: ar })}
                      </TableCell>
                      <TableCell className="font-medium">{log.user_name}</TableCell>
                      <TableCell>
                        <Badge className={actionBadgeColor(log.action)}>
                          {getActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getEntityLabel(log.entity_type)}</Badge>
                      </TableCell>
                      <TableCell>{log.entity_name || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {log.details || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ActionLogs;
