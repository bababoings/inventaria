import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  variant?: "default" | "warning" | "success";
  className?: string;
}

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: KPICardProps) {
  const variantStyles = {
    default: "bg-card",
    warning: "bg-warning/10 border-warning/20",
    success: "bg-success/10 border-success/20",
  };

  const iconStyles = {
    default: "bg-primary/10 text-primary",
    warning: "bg-warning/20 text-warning",
    success: "bg-success/20 text-success",
  };

  return (
    <div
      className={cn(
        "p-6 rounded-xl border shadow-sm animate-fade-in",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          {trend && (
            <p
              className={cn(
                "text-sm font-medium",
                trend.positive ? "text-success" : "text-destructive"
              )}
            >
              {trend.positive ? "↑" : "↓"} {trend.value}
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-lg", iconStyles[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
