import React from "react";
import { Badge } from "@/components/ui/badge";

export type TaskStatus = "backlog" | "inProgress" | "underReview" | "completed" | "overdue";

interface StatusBadgeProps {
  status: TaskStatus;
}

const statusConfig = {
  backlog: { label: "Бэклог", className: "bg-status-backlog/20 text-status-backlog border-status-backlog/30" },
  inProgress: { label: "В работе", className: "bg-status-inProgress/20 text-status-inProgress border-status-inProgress/30" },
  underReview: { label: "На проверке", className: "bg-status-underReview/20 text-status-underReview border-status-underReview/30" },
  completed: { label: "Выполнена", className: "bg-status-completed/20 text-status-completed border-status-completed/30" },
  overdue: { label: "Просрочена", className: "bg-status-overdue/20 text-status-overdue border-status-overdue/30" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge variant="outline" className={config.className} data-testid={`badge-status-${status}`}>
      {config.label}
    </Badge>
  );
}
