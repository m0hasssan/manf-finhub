import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home, LayoutDashboard, FolderTree, Package, Users, Truck, Wallet, Building2, FileCheck,
  ClipboardList, FileText, BarChart3, Scale, TrendingUp, ChevronDown, ChevronLeft,
  Receipt, CreditCard, FilePlus, Activity, Shield, Factory, DollarSign,
} from "lucide-react";
import { useNotificationBadges } from "@/hooks/useNotificationBadges";
import { usePermissions } from "@/hooks/usePermissions";
import { routePermissionMap } from "@/lib/permissions";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { title: "الرئيسية", href: "/", icon: Home },
  { title: "لوحة التحكم", href: "/dashboard", icon: LayoutDashboard },
  { title: "شجرة الحسابات", href: "/chart-of-accounts", icon: FolderTree },
  {
    title: "المخازن", href: "/inventory", icon: Package,
    children: [
      { title: "إدارة المخزون", href: "/inventory/items", icon: Package },
      { title: "طلب إذن جديد", href: "/inventory/new-request", icon: FilePlus },
      { title: "إدارة طلبات المخازن", href: "/inventory/requests", icon: ClipboardList },
      { title: "حركة المخازن", href: "/inventory/movements", icon: Package },
      { title: "ميزان مراجعة المخزون", href: "/inventory/trial-balance", icon: Scale },
    ],
  },
  {
    title: "الفواتير", href: "/invoices", icon: Receipt,
    children: [
      { title: "إدارة طلبات الفواتير", href: "/invoices/manage", icon: ClipboardList },
      { title: "فواتير البيع المؤكدة", href: "/invoices/confirmed-sales", icon: Receipt },
      { title: "فواتير الشراء المؤكدة", href: "/invoices/confirmed-purchases", icon: Receipt },
    ],
  },
  { title: "العملاء", href: "/customers", icon: Users },
  { title: "الموردين", href: "/suppliers", icon: Truck },
  {
    title: "الخزينة والبنوك", href: "/treasury", icon: Wallet,
    children: [
      { title: "حركة الخزينة", href: "/treasury/cash", icon: Wallet },
      { title: "حسابات البنوك", href: "/treasury/banks", icon: Building2 },
      { title: "الشيكات", href: "/treasury/checks", icon: CreditCard },
    ],
  },
  { title: "الموظفين", href: "/employees", icon: Users },
  { title: "العهد", href: "/custody", icon: FileCheck },
  { title: "قيود الأطراف", href: "/party-entries", icon: Users },
  {
    title: "التصنيع", href: "/manufacturing", icon: Factory,
    children: [
      { title: "أوامر التشغيل", href: "/manufacturing/orders", icon: Factory },
      { title: "تقرير التكاليف", href: "/manufacturing/costs", icon: DollarSign },
    ],
  },
  { title: "سجل الأحداث", href: "/action-logs", icon: Activity },
  {
    title: "التقارير المالية", href: "/reports", icon: BarChart3,
    children: [
      { title: "اليومية الأمريكية", href: "/reports/journal", icon: ClipboardList },
      { title: "ميزان المراجعة", href: "/reports/trial-balance", icon: Scale },
      { title: "ميزان مراجعة الأطراف", href: "/reports/party-trial-balance", icon: Users },
      { title: "كشف حساب عميل/مورد", href: "/reports/party-statement", icon: FileText },
      { title: "كشف حساب تحليلي", href: "/reports/account-ledger", icon: FileText },
      { title: "قائمة الدخل", href: "/reports/income-statement", icon: TrendingUp },
      { title: "الميزانية العمومية", href: "/reports/balance-sheet", icon: FileText },
      { title: "التدفقات النقدية", href: "/reports/cash-flow", icon: Wallet },
    ],
  },
  { title: "المستخدمين", href: "/users", icon: Shield },
];

export function Sidebar() {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { badges } = useNotificationBadges();
  const { can, isAdmin, loading: permLoading } = usePermissions();

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    if (href === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(href);
  };

  const getBadge = (href: string) => badges[href] || 0;

  const getParentBadge = (item: NavItem): number => {
    if (!item.children) return getBadge(item.href);
    return item.children.reduce((sum, child) => sum + getBadge(child.href), 0);
  };

  // Check if a nav item should be visible based on permissions
  const canSeeItem = (item: NavItem): boolean => {
    if (permLoading) return false;
    // Home page is always visible
    if (item.href === "/") return true;
    if (isAdmin) return true;
    
    const permKey = routePermissionMap[item.href];
    if (permKey) return can(permKey, "view");
    
    if (item.children) {
      return item.children.some((child) => canSeeItem(child));
    }
    
    return false;
  };

  const visibleItems = navItems.filter(canSeeItem);

  return (
    <aside className="w-64 bg-sidebar min-h-screen flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-foreground">نظام المحاسبة</h1>
        <p className="text-sm text-sidebar-foreground/60 mt-1">إدارة مالية متكاملة</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <div key={item.title}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggleExpanded(item.title)}
                  className={`sidebar-link w-full justify-between ${isActive(item.href) ? "active" : ""}`}
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    {item.title}
                    {getParentBadge(item) > 0 && (
                      <span className="bg-destructive text-destructive-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                        +{getParentBadge(item)}
                      </span>
                    )}
                  </span>
                  {expandedItems.includes(item.title) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronLeft className="w-4 h-4" />
                  )}
                </button>
                {expandedItems.includes(item.title) && (
                  <div className="mr-4 mt-1 space-y-1 animate-fade-in">
                    {item.children.filter(canSeeItem).map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        className={`sidebar-link text-sm ${isActive(child.href) ? "active" : ""}`}
                      >
                        <child.icon className="w-4 h-4" />
                        {child.title}
                        {getBadge(child.href) > 0 && (
                          <span className="bg-destructive text-destructive-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center mr-auto">
                            +{getBadge(child.href)}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Link
                to={item.href}
                className={`sidebar-link ${isActive(item.href) ? "active" : ""}`}
              >
                <item.icon className="w-5 h-5" />
                {item.title}
                {getBadge(item.href) > 0 && (
                  <span className="bg-destructive text-destructive-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center mr-auto">
                    +{getBadge(item.href)}
                  </span>
                )}
              </Link>
            )}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/50 text-center">الإصدار 1.0.0</p>
      </div>
    </aside>
  );
}
