import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { Button } from "./button";

interface AlertCardProps {
  title: string;
  description: string;
  variant?: "info" | "warning" | "success" | "error";
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const variantConfig = {
  info: {
    icon: Info,
    bg: "bg-primary/5 border-primary/20",
    iconBg: "bg-primary/10 text-primary",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-warning/5 border-warning/20",
    iconBg: "bg-warning/10 text-warning",
  },
  success: {
    icon: CheckCircle,
    bg: "bg-success/5 border-success/20",
    iconBg: "bg-success/10 text-success",
  },
  error: {
    icon: XCircle,
    bg: "bg-destructive/5 border-destructive/20",
    iconBg: "bg-destructive/10 text-destructive",
  },
};

export function AlertCard({
  title,
  description,
  variant = "info",
  action,
  className,
}: AlertCardProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "p-4 rounded-xl border flex items-start gap-4 animate-fade-in",
        config.bg,
        className
      )}
    >
      <div className={cn("p-2 rounded-lg shrink-0", config.iconBg)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
