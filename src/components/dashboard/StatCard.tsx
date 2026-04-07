import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  variant?: "default" | "success" | "danger" | "warning";
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  variant = "default",
}: StatCardProps) {
  const iconBgClasses = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/20 text-success",
    danger: "bg-danger/20 text-danger",
    warning: "bg-warning/20 text-warning",
  };

  const changeClasses = {
    positive: "text-success",
    negative: "text-danger",
    neutral: "text-muted-foreground",
  };

  return (
    <div className="bg-card rounded-xl p-4 shadow-sm border border-border hover:shadow-md transition-all duration-200 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground mb-1 truncate">{title}</p>
          <p className="text-lg font-bold truncate leading-tight">{value}</p>
          {change && (
            <p className={`text-xs mt-1.5 truncate ${changeClasses[changeType]}`}>
              {change}
            </p>
          )}
        </div>
        <div className={`p-2 rounded-lg shrink-0 ${iconBgClasses[variant]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
