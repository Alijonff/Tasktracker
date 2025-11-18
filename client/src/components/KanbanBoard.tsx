import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import UserAvatar from "@/components/UserAvatar";
import GradeBadge from "@/components/GradeBadge";
import StatusBadge from "@/components/StatusBadge";
import { Gavel, UsersRound } from "lucide-react";
import type { AuctionStatus, Grade } from "@/api/adapter";
import { formatAuctionValue, formatDateTime } from "@/lib/formatters";
import type { TaskMode, TaskType } from "@shared/taskMetadata";

export type KanbanStatus = AuctionStatus;

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  status: KanbanStatus;
  creatorName: string;
  minimumGrade: Grade;
  deadline: string;
  startingPrice: number;
  currentPrice?: number;
  mode: TaskMode;
  taskType: TaskType;
  bidsCount: number;
  leadingBidderName?: string;
  canBid: boolean;
}

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onStatusChange?: (taskId: string, status: KanbanStatus) => void;
  onTaskClick?: (taskId: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

const columnConfig: Record<KanbanStatus, { title: string; description: string }> = {
  BACKLOG: {
    title: "Бэклог",
    description: "Аукционы ожидают старта",
  },
  IN_PROGRESS: {
    title: "В работе",
    description: "Ведутся работы по аукциону",
  },
  UNDER_REVIEW: {
    title: "На проверке",
    description: "Результат ожидает подтверждения",
  },
  DONE: {
    title: "Завершена",
    description: "Аукцион закрыт",
  },
};

export const allowedTransitions: Record<KanbanStatus, KanbanStatus[]> = {
  BACKLOG: ["IN_PROGRESS"],
  IN_PROGRESS: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["IN_PROGRESS", "DONE"],
  DONE: [],
};

export const isAllowedTransition = (from: KanbanStatus, to: KanbanStatus): boolean => {
  if (from === to) return true;
  return allowedTransitions[from]?.includes(to) ?? false;
};

interface ColumnData {
  status: KanbanStatus;
  tasks: KanbanTask[];
}

interface DragPayload {
  taskId: string;
  fromStatus: KanbanStatus;
}

function KanbanCard({
  task,
  onClick,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  task: KanbanTask;
  onClick?: (taskId: string) => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, task: KanbanTask) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const priceLabel = task.currentPrice ?? task.startingPrice;

  return (
    <Card
      draggable
      onDragStart={(event) => onDragStart(event, task)}
      onDragEnd={onDragEnd}
      onClick={() => onClick?.(task.id)}
      className={`border bg-card shadow-sm transition-shadow ${isDragging ? "ring-2 ring-primary" : "hover:border-primary/40"}`}
      data-testid={`kanban-task-${task.id}`}
    >
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h3 className="font-semibold leading-tight line-clamp-2">{task.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
          </div>
          <StatusBadge status={task.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <UserAvatar name={task.creatorName} size="sm" />
            <span>{task.creatorName}</span>
          </div>
          <GradeBadge grade={task.minimumGrade} />
        </div>
        <Separator />
        <div className="grid gap-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Дедлайн</span>
            <span className="font-mono">{formatDateTime(task.deadline)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Текущая ставка</span>
            <span className="font-semibold text-foreground">{formatAuctionValue(priceLabel, task.mode)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <UsersRound size={16} />
              Ставок
            </span>
            <Badge variant="secondary">{task.bidsCount}</Badge>
          </div>
          {task.leadingBidderName && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Gavel size={16} />
                Лидер аукциона
              </span>
              <span className="font-medium text-foreground">{task.leadingBidderName}</span>
            </div>
          )}
        </div>
        {!task.canBid && (
          <div className="text-xs text-muted-foreground">
            Ставки закрыты для этого аукциона
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  column,
  isActive,
  onDragOver,
  onDrop,
  onDragLeave,
  children,
}: {
  column: ColumnData;
  isActive: boolean;
  onDragOver: (event: React.DragEvent<HTMLDivElement>, status: KanbanStatus) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>, status: KanbanStatus) => void;
  onDragLeave: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onDragOver={(event) => onDragOver(event, column.status)}
      onDragEnter={(event) => onDragOver(event, column.status)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, column.status)}
      className={`flex h-full min-h-[320px] flex-col rounded-lg border bg-muted/30 p-3 transition-colors ${
        isActive ? "border-primary/60 bg-primary/5" : "border-transparent"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{columnConfig[column.status].title}</h3>
          <p className="text-xs text-muted-foreground">{columnConfig[column.status].description}</p>
        </div>
        <Badge variant="outline">{column.tasks.length}</Badge>
      </div>
      <div className="flex-1 space-y-3">
        {children}
        {column.tasks.length === 0 && (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Нет данных
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({
  tasks,
  onStatusChange,
  onTaskClick,
  isLoading = false,
  emptyMessage = "Нет данных",
}: KanbanBoardProps) {
  const createEmptyColumns = useCallback(
    (): Record<KanbanStatus, KanbanTask[]> => ({
      BACKLOG: [],
      IN_PROGRESS: [],
      UNDER_REVIEW: [],
      DONE: [],
    }),
    [],
  );

  const groupTasks = useCallback(
    (list: KanbanTask[]) => {
      const grouping = createEmptyColumns();
      list.forEach((task) => {
        grouping[task.status].push(task);
      });
      return grouping;
    },
    [createEmptyColumns],
  );

  const [columns, setColumns] = useState<Record<KanbanStatus, KanbanTask[]>>(() => groupTasks(tasks));
  const [activeColumn, setActiveColumn] = useState<KanbanStatus | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  useEffect(() => {
    setColumns(groupTasks(tasks));
  }, [tasks, groupTasks]);

  const columnEntries: ColumnData[] = useMemo(
    () =>
      (Object.keys(columns) as KanbanStatus[]).map((status) => ({
        status,
        tasks: columns[status],
      })),
    [columns],
  );

  const resetDragState = () => {
    setActiveColumn(null);
    setDraggedTaskId(null);
  };

  const handleTaskDragStart = (event: React.DragEvent<HTMLDivElement>, task: KanbanTask) => {
    const payload: DragPayload = { taskId: task.id, fromStatus: task.status };
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
    setDraggedTaskId(task.id);
  };

  const handleColumnDragOver = (event: React.DragEvent<HTMLDivElement>, status: KanbanStatus) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActiveColumn(status);
  };

    const handleColumnDrop = (event: React.DragEvent<HTMLDivElement>, status: KanbanStatus) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/json");
    resetDragState();
    if (!raw) return;

    let parsed: DragPayload;
    try {
      parsed = JSON.parse(raw) as DragPayload;
    } catch {
      return;
    }

    if (!isAllowedTransition(parsed.fromStatus, status)) {
      return;
    }

    setColumns((prev) => {
      const current = groupTasks(Object.values(prev).flat());
      const sourceTasks = [...current[parsed.fromStatus]];
      const targetTasks = parsed.fromStatus === status ? sourceTasks : [...current[status]];

      const taskIndex = sourceTasks.findIndex((task) => task.id === parsed.taskId);
      if (taskIndex === -1) {
        return prev;
      }

      const [movedTask] = sourceTasks.splice(taskIndex, 1);
      const updatedTask: KanbanTask = { ...movedTask, status };

      if (parsed.fromStatus === status) {
        sourceTasks.splice(taskIndex, 0, updatedTask);
        current[status] = sourceTasks;
      } else {
        current[parsed.fromStatus] = sourceTasks;
        targetTasks.push(updatedTask);
        current[status] = targetTasks;
      }

      if (parsed.fromStatus !== status) {
        onStatusChange?.(parsed.taskId, status);
      }

      return current;
    });
  };

  if (!isLoading && tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {columnEntries.map((column) => (
        <KanbanColumn
          key={column.status}
          column={column}
          isActive={activeColumn === column.status}
          onDragOver={handleColumnDragOver}
          onDrop={handleColumnDrop}
          onDragLeave={() => setActiveColumn(null)}
        >
          {isLoading ? (
            <div className="h-48 rounded-md bg-muted animate-pulse" />
          ) : (
            column.tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onClick={onTaskClick}
                onDragStart={handleTaskDragStart}
                onDragEnd={resetDragState}
                isDragging={draggedTaskId === task.id}
              />
            ))
          )}
        </KanbanColumn>
      ))}
    </div>
  );
}
