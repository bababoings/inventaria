import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

interface AutomationLog {
  id: number;
  timestamp: string;
  trigger: string;
  product: string;
  status: "success" | "failed" | "pending";
  details: string;
}

const logs: AutomationLog[] = [
  {
    id: 1,
    timestamp: "2024-01-14 09:23:15",
    trigger: "Low Stock",
    product: "Webcam HD",
    status: "success",
    details: "Email notification sent to purchasing team",
  },
  {
    id: 2,
    timestamp: "2024-01-14 08:45:00",
    trigger: "Low Stock",
    product: "USB-C Hub",
    status: "success",
    details: "Slack alert sent to #inventory channel",
  },
  {
    id: 3,
    timestamp: "2024-01-13 16:30:22",
    trigger: "Low Stock",
    product: "Wireless Mouse",
    status: "success",
    details: "Auto-generated PO draft created",
  },
  {
    id: 4,
    timestamp: "2024-01-13 14:15:00",
    trigger: "Low Stock",
    product: "Monitor Stand",
    status: "failed",
    details: "Failed to send notification - email service unavailable",
  },
  {
    id: 5,
    timestamp: "2024-01-12 11:00:00",
    trigger: "Low Stock",
    product: "Laptop Stand",
    status: "success",
    details: "Email notification sent to purchasing team",
  },
  {
    id: 6,
    timestamp: "2024-01-11 09:45:30",
    trigger: "Low Stock",
    product: "Desk Pad XL",
    status: "success",
    details: "Slack alert sent to #inventory channel",
  },
];

export default function AutomationLogs() {
  const columns = [
    {
      key: "timestamp",
      header: "Timestamp",
      className: "font-mono text-sm text-muted-foreground",
    },
    {
      key: "trigger",
      header: "Trigger",
      render: () => (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warning" />
          Low Stock
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: AutomationLog) => (
        <StatusBadge
          variant={
            item.status === "success"
              ? "success"
              : item.status === "failed"
              ? "error"
              : "warning"
          }
        >
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </StatusBadge>
      ),
    },
    {
      key: "details",
      header: "Details",
      className: "text-sm text-muted-foreground max-w-xs truncate",
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Automation Logs"
        description="View triggered automation events and their status"
      />

      {/* Summary Stats */}
      <div className="flex gap-6 mb-6 text-sm">
        <div>
          <span className="text-muted-foreground">Total Events: </span>
          <span className="font-medium">{logs.length}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Successful: </span>
          <span className="font-medium text-success">
            {logs.filter((l) => l.status === "success").length}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Failed: </span>
          <span className="font-medium text-destructive">
            {logs.filter((l) => l.status === "failed").length}
          </span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        emptyState={{
          title: "No automation logs",
          description: "Automation events will appear here when triggered.",
        }}
      />
    </div>
  );
}
