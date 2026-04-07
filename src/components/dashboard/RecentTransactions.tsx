import { ArrowDownLeft, ArrowUpRight, FileText } from "lucide-react";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  reference: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">آخر القيود المعتمدة</h3>
      </div>
      <div className="divide-y divide-border">
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">لا توجد قيود معتمدة بعد</p>
          </div>
        ) : (
          transactions.map((t) => (
            <div
              key={t.id}
              className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary-light text-primary">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{t.reference}</p>
                </div>
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">{formatCurrency(t.amount)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
