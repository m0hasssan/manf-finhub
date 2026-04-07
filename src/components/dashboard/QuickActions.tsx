import { Link } from "react-router-dom";
import {
  Plus,
  Receipt,
  Wallet,
  FileText,
  Users,
  Package,
} from "lucide-react";

const actions = [
  {
    title: "فاتورة بيع جديدة",
    href: "/inventory/sales",
    icon: Receipt,
    color: "bg-primary text-primary-foreground",
  },
  {
    title: "فاتورة شراء جديدة",
    href: "/inventory/purchases",
    icon: Package,
    color: "bg-warning text-warning-foreground",
  },
  {
    title: "سند قبض",
    href: "/treasury/cash",
    icon: Wallet,
    color: "bg-success text-success-foreground",
  },
  {
    title: "سند صرف",
    href: "/treasury/cash",
    icon: FileText,
    color: "bg-danger text-danger-foreground",
  },
  {
    title: "إضافة عميل",
    href: "/customers",
    icon: Users,
    color: "bg-chart-5 text-white",
  },
  {
    title: "قيد يومية",
    href: "/reports/journal",
    icon: Plus,
    color: "bg-muted text-foreground",
  },
];

export function QuickActions() {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="font-semibold mb-4">إجراءات سريعة</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Link
            key={action.title}
            to={action.href}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
          >
            <div className={`p-2 rounded-lg ${action.color}`}>
              <action.icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium group-hover:text-primary transition-colors">
              {action.title}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
