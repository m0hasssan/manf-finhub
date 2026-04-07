// Permission tree definition
export interface PermissionAction {
  key: string;
  label: string;
}

export interface PermissionNode {
  key: string;
  label: string;
  actions?: PermissionAction[];
  children?: PermissionNode[];
}

export const permissionTree: PermissionNode[] = [
  {
    key: "dashboard",
    label: "لوحة التحكم",
    actions: [{ key: "view", label: "عرض" }],
  },
  {
    key: "chart_of_accounts",
    label: "شجرة الحسابات",
    actions: [
      { key: "view", label: "عرض" },
      { key: "create", label: "إضافة" },
      { key: "edit", label: "تعديل" },
      { key: "delete", label: "حذف" },
    ],
  },
  {
    key: "inventory",
    label: "المخازن",
    children: [
      {
        key: "inventory_items",
        label: "إدارة المخزون",
        actions: [
          { key: "view", label: "عرض" },
          { key: "create", label: "إضافة" },
          { key: "edit", label: "تعديل" },
          { key: "delete", label: "حذف" },
        ],
      },
      {
        key: "inventory_new_request",
        label: "طلب إذن جديد",
        actions: [
          { key: "view", label: "عرض" },
          { key: "create", label: "إنشاء طلب" },
        ],
      },
      {
        key: "inventory_requests",
        label: "إدارة طلبات المخازن",
        actions: [
          { key: "view", label: "عرض" },
          { key: "approve", label: "اعتماد" },
          { key: "reject", label: "رفض" },
        ],
      },
      {
        key: "inventory_movements",
        label: "حركة المخازن",
        actions: [{ key: "view", label: "عرض" }],
      },
      {
        key: "inventory_trial_balance",
        label: "ميزان مراجعة المخزون",
        actions: [{ key: "view", label: "عرض" }],
      },
    ],
  },
  {
    key: "invoices",
    label: "الفواتير",
    children: [
      {
        key: "invoices_manage",
        label: "إدارة طلبات الفواتير",
        actions: [
          { key: "view", label: "عرض" },
          { key: "approve", label: "اعتماد" },
          { key: "reject", label: "رفض" },
        ],
      },
      {
        key: "invoices_confirmed_sales",
        label: "فواتير البيع المؤكدة",
        actions: [
          { key: "view", label: "عرض" },
          { key: "edit", label: "تعديل" },
          { key: "delete", label: "حذف" },
        ],
      },
      {
        key: "invoices_confirmed_purchases",
        label: "فواتير الشراء المؤكدة",
        actions: [
          { key: "view", label: "عرض" },
          { key: "edit", label: "تعديل" },
          { key: "delete", label: "حذف" },
        ],
      },
    ],
  },
  {
    key: "customers",
    label: "العملاء",
    actions: [
      { key: "view", label: "عرض" },
      { key: "create", label: "إضافة" },
      { key: "edit", label: "تعديل" },
      { key: "delete", label: "حذف" },
    ],
  },
  {
    key: "suppliers",
    label: "الموردين",
    actions: [
      { key: "view", label: "عرض" },
      { key: "create", label: "إضافة" },
      { key: "edit", label: "تعديل" },
      { key: "delete", label: "حذف" },
    ],
  },
  {
    key: "treasury",
    label: "الخزينة والبنوك",
    children: [
      {
        key: "treasury_cash",
        label: "حركة الخزينة",
        actions: [
          { key: "view", label: "عرض" },
          { key: "create", label: "إضافة" },
          { key: "edit", label: "تعديل" },
          { key: "delete", label: "حذف" },
        ],
      },
      {
        key: "treasury_banks",
        label: "حسابات البنوك",
        actions: [
          { key: "view", label: "عرض" },
          { key: "create", label: "إضافة" },
          { key: "edit", label: "تعديل" },
          { key: "delete", label: "حذف" },
        ],
      },
      {
        key: "treasury_checks",
        label: "الشيكات",
        actions: [
          { key: "view", label: "عرض" },
          { key: "create", label: "إضافة" },
          { key: "edit", label: "تعديل" },
        ],
      },
    ],
  },
  {
    key: "employees",
    label: "الموظفين",
    actions: [
      { key: "view", label: "عرض" },
      { key: "create", label: "إضافة" },
      { key: "edit", label: "تعديل" },
      { key: "delete", label: "حذف" },
    ],
  },
  {
    key: "custody",
    label: "العهد",
    actions: [
      { key: "view", label: "عرض" },
      { key: "create", label: "إضافة" },
      { key: "edit", label: "تعديل" },
      { key: "delete", label: "حذف" },
      { key: "settle", label: "تسوية" },
    ],
  },
  {
    key: "party_entries",
    label: "قيود الأطراف",
    actions: [
      { key: "view", label: "عرض" },
      { key: "create", label: "إضافة" },
    ],
  },
  {
    key: "action_logs",
    label: "سجل الأحداث",
    actions: [{ key: "view", label: "عرض" }],
  },
  {
    key: "reports",
    label: "التقارير المالية",
    children: [
      { key: "reports_journal", label: "اليومية الأمريكية", actions: [{ key: "view", label: "عرض" }] },
      { key: "reports_trial_balance", label: "ميزان المراجعة", actions: [{ key: "view", label: "عرض" }] },
      { key: "reports_party_trial_balance", label: "ميزان مراجعة الأطراف", actions: [{ key: "view", label: "عرض" }] },
      { key: "reports_party_statement", label: "كشف حساب عميل/مورد", actions: [{ key: "view", label: "عرض" }] },
      { key: "reports_account_ledger", label: "كشف حساب تحليلي", actions: [{ key: "view", label: "عرض" }] },
      { key: "reports_income_statement", label: "قائمة الدخل", actions: [{ key: "view", label: "عرض" }] },
      { key: "reports_balance_sheet", label: "الميزانية العمومية", actions: [{ key: "view", label: "عرض" }] },
      { key: "reports_cash_flow", label: "التدفقات النقدية", actions: [{ key: "view", label: "عرض" }] },
    ],
  },
  {
    key: "manufacturing",
    label: "التصنيع",
    children: [
      {
        key: "manufacturing_orders",
        label: "أوامر التشغيل",
        actions: [
          { key: "view", label: "عرض" },
          { key: "create", label: "إضافة" },
          { key: "edit", label: "تعديل" },
          { key: "delete", label: "حذف" },
          { key: "approve", label: "اعتماد" },
        ],
      },
      {
        key: "manufacturing_costs",
        label: "تقرير التكاليف",
        actions: [{ key: "view", label: "عرض" }],
      },
    ],
  },
  {
    key: "users",
    label: "المستخدمين",
    actions: [
      { key: "view", label: "عرض" },
      { key: "create", label: "إضافة" },
      { key: "edit", label: "تعديل" },
      { key: "delete", label: "حذف" },
    ],
  },
];

// Map route to permission key
export const routePermissionMap: Record<string, string> = {
  "/dashboard": "dashboard",
  "/chart-of-accounts": "chart_of_accounts",
  "/inventory/items": "inventory_items",
  "/inventory": "inventory_items",
  "/inventory/new-request": "inventory_new_request",
  "/inventory/requests": "inventory_requests",
  "/inventory/movements": "inventory_movements",
  "/inventory/trial-balance": "inventory_trial_balance",
  "/invoices/manage": "invoices_manage",
  "/invoices/confirmed-sales": "invoices_confirmed_sales",
  "/invoices/confirmed-purchases": "invoices_confirmed_purchases",
  "/customers": "customers",
  "/suppliers": "suppliers",
  "/treasury": "treasury_cash",
  "/treasury/cash": "treasury_cash",
  "/treasury/banks": "treasury_banks",
  "/treasury/checks": "treasury_checks",
  "/employees": "employees",
  "/custody": "custody",
  "/party-entries": "party_entries",
  "/action-logs": "action_logs",
  "/reports/journal": "reports_journal",
  "/reports/trial-balance": "reports_trial_balance",
  "/reports/party-trial-balance": "reports_party_trial_balance",
  "/reports/party-statement": "reports_party_statement",
  "/reports/account-ledger": "reports_account_ledger",
  "/reports/income-statement": "reports_income_statement",
  "/reports/balance-sheet": "reports_balance_sheet",
  "/reports/cash-flow": "reports_cash_flow",
  "/manufacturing/orders": "manufacturing_orders",
  "/manufacturing/costs": "manufacturing_costs",
  "/users": "users",
};

// Permissions type: { [sectionKey]: { [actionKey]: boolean } }
export type PermissionsMap = Record<string, Record<string, boolean>>;

// Get all permission keys from the tree (flattened)
export function getAllPermissionKeys(nodes: PermissionNode[] = permissionTree): string[] {
  const keys: string[] = [];
  for (const node of nodes) {
    if (node.actions) keys.push(node.key);
    if (node.children) keys.push(...getAllPermissionKeys(node.children));
  }
  return keys;
}

// Build full admin permissions (all true)
export function buildAdminPermissions(): PermissionsMap {
  const perms: PermissionsMap = {};
  function walk(nodes: PermissionNode[]) {
    for (const node of nodes) {
      if (node.actions) {
        perms[node.key] = {};
        for (const action of node.actions) {
          perms[node.key][action.key] = true;
        }
      }
      if (node.children) walk(node.children);
    }
  }
  walk(permissionTree);
  return perms;
}

// Check if user has specific permission
export function hasPermission(permissions: PermissionsMap | null | undefined, section: string, action: string): boolean {
  if (!permissions) return false;
  return !!permissions[section]?.[action];
}
