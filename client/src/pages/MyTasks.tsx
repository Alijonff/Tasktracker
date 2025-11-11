import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import TaskDetailDialog from "@/components/TaskDetailDialog";
import TimeLogDialog from "@/components/TimeLogDialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import KanbanBoard, { type KanbanTask, type KanbanStatus } from "@/components/KanbanBoard";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Task } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function MyTasks() {
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [timeLogOpen, setTimeLogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/my-tasks"],
  });

  const statusMap: Record<Task["status"], KanbanStatus> = {
    backlog: "backlog",
    inProgress: "inProgress",
    underReview: "underReview",
    completed: "completed",
    overdue: "inProgress",
  };

  const formatDate = (value: string | Date) => {
    const date = typeof value === "string" ? new Date(value) : value;
    return date.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const boardTasks = useMemo<KanbanTask[]>(() =>
    tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: statusMap[task.status],
      type: task.type,
      creatorName: task.creatorName,
      assigneeName: task.assigneeName ?? undefined,
      deadline: formatDate(task.deadline),
      estimatedHours: Number(task.estimatedHours),
      actualHours: task.actualHours ? Number(task.actualHours) : undefined,
      rating: task.rating ? Number(task.rating) : undefined,
    })),
  [tasks]);

  const statusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: KanbanStatus }) => {
      await apiRequest("PATCH", `/api/tasks/${taskId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/overview"] });
    },
    onError: (error: any) => {
      toast({
        title: "Не удалось обновить статус",
        description: error?.message ? String(error.message) : "Попробуйте снова позже",
        variant: "destructive",
      });
    },
  });

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setDetailDialogOpen(true);
  };

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Мои задачи</h1>
          <p className="text-muted-foreground">Задачи, назначенные вам</p>
        </div>
        <Button onClick={() => setTimeLogOpen(true)} variant="outline" data-testid="button-log-time-header">
          <Clock size={18} />
          Записать время
        </Button>
      </div>

      <KanbanBoard
        tasks={boardTasks}
        isLoading={isLoading}
        onTaskClick={handleTaskClick}
        onStatusChange={(taskId, status) => statusMutation.mutate({ taskId, status })}
      />

      <TaskDetailDialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open);
          if (!open) {
            setSelectedTaskId(null);
          }
        }}
        task={selectedTask ? {
          id: selectedTask.id,
          title: selectedTask.title,
          description: selectedTask.description,
          status: selectedTask.status,
          type: selectedTask.type,
          creator: selectedTask.creatorName,
          assignee: selectedTask.assigneeName ?? undefined,
          deadline: formatDate(selectedTask.deadline),
          estimatedHours: Number(selectedTask.estimatedHours),
          actualHours: selectedTask.actualHours ? Number(selectedTask.actualHours) : undefined,
          rating: selectedTask.rating ? Number(selectedTask.rating) : undefined,
          comments: [],
        } : undefined}
      />

      <TimeLogDialog open={timeLogOpen} onOpenChange={setTimeLogOpen} />
    </div>
  );
}
