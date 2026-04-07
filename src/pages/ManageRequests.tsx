import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Search, Loader2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useInventoryRequests, type InventoryRequestWithDetails } from "@/hooks/useInventoryRequests";
import { SettleRequestDialog } from "@/components/inventory/SettleRequestDialog";
import { usePermissions } from "@/hooks/usePermissions";

const ManageRequests = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<InventoryRequestWithDetails | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const { can } = usePermissions();

  const { data: requests, isLoading } = useInventoryRequests("pending");

  const formatDate = (d: string) => new Date(d).toLocaleDateString("ar-EG");

  const filtered = requests?.filter((r) => {
    const itemName = r.inventory_items?.name || "";
    const partyName = (r.type === "out" ? r.customers?.name : r.suppliers?.name) || "";
    return itemName.includes(searchQuery) || r.number.includes(searchQuery) || partyName.includes(searchQuery);
  }) || [];

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            إدارة طلبات المخازن
          </h1>
          <p className="text-muted-foreground">مراجعة وتسوية طلبات الأذون المعلقة</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">إجمالي الطلبات المعلقة</p>
            <p className="text-2xl font-bold">{requests?.length || 0}</p>
          </div>
          <div className="stat-card stat-card-success">
            <p className="text-sm text-muted-foreground">طلبات وارد</p>
            <p className="text-2xl font-bold text-success">{requests?.filter(r => r.type === "in").length || 0}</p>
          </div>
          <div className="stat-card stat-card-danger">
            <p className="text-sm text-muted-foreground">طلبات صرف</p>
            <p className="text-2xl font-bold text-danger">{requests?.filter(r => r.type === "out").length || 0}</p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالصنف أو رقم الطلب أو الطرف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        {/* Table */}
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
                {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        لا توجد طلبات معلقة
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((req) => {
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
                              {lines.map((l, i) => (
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
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">معلق</Badge>
                        </TableCell>
                        <TableCell>
                          {can("inventory_requests", "approve") && (
                            <Button
                              size="sm"
                              onClick={() => { setSelectedRequest(req); setSettleOpen(true); }}
                            >
                              تسوية
                            </Button>
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

      <SettleRequestDialog
        open={settleOpen}
        onOpenChange={setSettleOpen}
        request={selectedRequest}
      />
    </MainLayout>
  );
};

export default ManageRequests;
