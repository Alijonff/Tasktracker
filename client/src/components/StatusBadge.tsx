import React from "react";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@shared/schema";

export type TaskStatus = Task["status"];

interface StatusBadgeProps {
  status: TaskStatus;
}

const statusConfig: Record<
  TaskStatus,
  { label: string; className: string }
> = {
  BACKLOG: { label: "Бэклог", className: "bg-status-backlog/20 text-status-backlog border-status-backlog/30" },
  IN_PROGRESS: {
    label: "В работе",
    className: "bg-status-inProgress/20 text-status-inProgress border-status-inProgress/30",
  },
  UNDER_REVIEW: {
    label: "На проверке",
    className: "bg-status-underReview/20 text-status-underReview border-status-underReview/30",
  },
  DONE: { label: "Выполнена", className: "bg-status-completed/20 text-status-completed border-status-completed/30" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge variant="outline" className={config.className} data-testid={`badge-status-${status}`}>
      {config.label}
    </Badge>
  );
}
