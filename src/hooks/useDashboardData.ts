import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDashboardData() {
  // Treasury balance (sum of receipts - payments)
  const { data: treasuryBalance = 0 } = useQuery({
    queryKey: ["dashboard-treasury"],
    queryFn: async () => {
      const { data } = await supabase.from("cash_transactions").select("amount, type");
      if (!data) return 0;
      return data.reduce((sum, t) => {
        return t.type === "receipt" ? sum + Number(t.amount) : sum - Number(t.amount);
      }, 0);
    },
  });

  // Total revenue (from posted journal entries on revenue accounts)
  const { data: totalRevenue = 0 } = useQuery({
    queryKey: ["dashboard-revenue"],
    queryFn: async () => {
      const { data: revenueAccounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("type", "revenue");
      if (!revenueAccounts?.length) return 0;
      const ids = revenueAccounts.map((a) => a.id);
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select("credit, debit, journal_entry_id")
        .in("account_id", ids);
      if (!lines?.length) return 0;
      // Get posted entries
      const entryIds = [...new Set(lines.map((l) => l.journal_entry_id))];
      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id")
        .in("id", entryIds)
        .eq("status", "posted");
      if (!entries?.length) return 0;
      const postedIds = new Set(entries.map((e) => e.id));
      return lines
        .filter((l) => postedIds.has(l.journal_entry_id))
        .reduce((sum, l) => sum + Number(l.credit) - Number(l.debit), 0);
    },
  });

  // Total expenses
  const { data: totalExpenses = 0 } = useQuery({
    queryKey: ["dashboard-expenses"],
    queryFn: async () => {
      const { data: expenseAccounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("type", "expense");
      if (!expenseAccounts?.length) return 0;
      const ids = expenseAccounts.map((a) => a.id);
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select("debit, credit, journal_entry_id")
        .in("account_id", ids);
      if (!lines?.length) return 0;
      const entryIds = [...new Set(lines.map((l) => l.journal_entry_id))];
      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id")
        .in("id", entryIds)
        .eq("status", "posted");
      if (!entries?.length) return 0;
      const postedIds = new Set(entries.map((e) => e.id));
      return lines
        .filter((l) => postedIds.has(l.journal_entry_id))
        .reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0);
    },
  });

  // Customer count
  const { data: customerCount = 0 } = useQuery({
    queryKey: ["dashboard-customers"],
    queryFn: async () => {
      const { count } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      return count ?? 0;
    },
  });

  // Inventory items count & low stock
  const { data: inventoryData = { total: 0, lowStock: 0 } } = useQuery({
    queryKey: ["dashboard-inventory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_items")
        .select("current_stock, min_stock")
        .eq("is_active", true);
      if (!data) return { total: 0, lowStock: 0 };
      const lowStock = data.filter(
        (i) => i.min_stock != null && i.current_stock != null && i.current_stock <= i.min_stock
      ).length;
      return { total: data.length, lowStock };
    },
  });

  // Pending checks
  const { data: checksData = { count: 0, total: 0 } } = useQuery({
    queryKey: ["dashboard-checks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("checks")
        .select("amount")
        .eq("status", "pending");
      if (!data) return { count: 0, total: 0 };
      return {
        count: data.length,
        total: data.reduce((s, c) => s + Number(c.amount), 0),
      };
    },
  });

  // Recent journal entries (last 5 posted)
  const { data: recentTransactions = [] } = useQuery({
    queryKey: ["dashboard-recent-transactions"],
    queryFn: async () => {
      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id, number, description, date, total_debit, status")
        .eq("status", "posted")
        .order("date", { ascending: false })
        .limit(5);
      if (!entries?.length) return [];
      return entries.map((e) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.total_debit),
        date: e.date,
        reference: e.number,
      }));
    },
  });

  // Monthly revenue/expenses for chart (last 6 months)
  const { data: monthlyData = [] } = useQuery({
    queryKey: ["dashboard-monthly-chart"],
    queryFn: async () => {
      // Get all revenue and expense account IDs
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, type")
        .in("type", ["revenue", "expense"]);
      if (!accounts?.length) return [];

      const revenueIds = new Set(accounts.filter((a) => a.type === "revenue").map((a) => a.id));
      const expenseIds = new Set(accounts.filter((a) => a.type === "expense").map((a) => a.id));

      // Get posted entries from last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const fromDate = sixMonthsAgo.toISOString().split("T")[0];

      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id, date")
        .eq("status", "posted")
        .gte("date", fromDate);
      if (!entries?.length) return [];

      const entryIds = entries.map((e) => e.id);
      const entryDateMap = new Map(entries.map((e) => [e.id, e.date]));

      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select("account_id, debit, credit, journal_entry_id")
        .in("journal_entry_id", entryIds);
      if (!lines?.length) return [];

      // Aggregate by month
      const monthMap = new Map<string, { income: number; expenses: number }>();
      const monthNames = [
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
      ];

      for (const line of lines) {
        const date = entryDateMap.get(line.journal_entry_id);
        if (!date) continue;
        const month = new Date(date).getMonth();
        const year = new Date(date).getFullYear();
        const key = `${year}-${month}`;

        if (!monthMap.has(key)) monthMap.set(key, { income: 0, expenses: 0 });
        const entry = monthMap.get(key)!;

        if (revenueIds.has(line.account_id)) {
          entry.income += Number(line.credit) - Number(line.debit);
        } else if (expenseIds.has(line.account_id)) {
          entry.expenses += Number(line.debit) - Number(line.credit);
        }
      }

      // Sort and format
      return Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => {
          const month = parseInt(key.split("-")[1]);
          return {
            month: monthNames[month],
            income: Math.abs(val.income),
            expenses: Math.abs(val.expenses),
          };
        });
    },
  });

  // Pending tasks
  const { data: pendingTasks = { dueChecks: 0, dueChecksAmount: 0, overdueInvoices: 0, overdueInvoicesAmount: 0, activeCustodies: 0, pendingEntries: 0 } } = useQuery({
    queryKey: ["dashboard-pending-tasks"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      // Checks due today
      const { data: dueChecks } = await supabase
        .from("checks")
        .select("amount")
        .eq("status", "pending")
        .lte("due_date", today);

      // Active custodies
      const { count: activeCustodies } = await supabase
        .from("custodies")
        .select("*", { count: "exact", head: true })
        .in("status", ["active", "partial"]);

      // Draft journal entries
      const { count: pendingEntries } = await supabase
        .from("journal_entries")
        .select("*", { count: "exact", head: true })
        .eq("status", "draft");

      return {
        dueChecks: dueChecks?.length ?? 0,
        dueChecksAmount: dueChecks?.reduce((s, c) => s + Number(c.amount), 0) ?? 0,
        overdueInvoices: 0,
        overdueInvoicesAmount: 0,
        activeCustodies: activeCustodies ?? 0,
        pendingEntries: pendingEntries ?? 0,
      };
    },
  });

  return {
    treasuryBalance,
    totalRevenue,
    totalExpenses,
    customerCount,
    inventoryData,
    checksData,
    recentTransactions,
    monthlyData,
    pendingTasks,
  };
}
