import { AlertTriangle, Clock, FileCheck, ShieldCheck } from "lucide-react";

interface PendingTasksData {
  dueChecks: number;
  dueChecksAmount: number;
  activeCustodies: number;
  pendingEntries: number;
}

interface PendingTasksProps {
  tasks: PendingTasksData;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(amount);

export function PendingTasks({ tasks }: PendingTasksProps) {
  const items = [
    {
      show: tasks.dueChecks > 0,
      title: "شيكات مستحقة",
      subtitle: `${tasks.dueChecks} شيك بقيمة ${formatCurrency(tasks.dueChecksAmount)}`,
      badge: "عاجل",
      badgeClass: "bg-warning-light text-warning",
      icon: AlertTriangle,
    },
    {
      show: tasks.activeCustodies > 0,
      title: "عهد نشطة",
      subtitle: `${tasks.activeCustodies} عهدة بانتظار التسوية`,
      badge: "قيد المراجعة",
      badgeClass: "bg-primary-light text-primary",
      icon: ShieldCheck,
    },
    {
      show: tasks.pendingEntries > 0,
      title: "قيود مسودة",
      subtitle: `${tasks.pendingEntries} قيد بانتظار الاعتماد`,
      badge: "معلق",
      badgeClass: "bg-muted text-muted-foreground",
      icon: FileCheck,
    },
  ].filter((i) => i.show);

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">المهام المعلقة</h3>
      </div>
      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">لا توجد مهام معلقة</p>
          </div>
        ) : (
          items.map((item, i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                </div>
              </div>
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${item.badgeClass}`}>
                {item.badge}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
