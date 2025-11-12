import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import KanbanBoard, { type KanbanTask } from "@/components/KanbanBoard";
import TaskDetailDialog from "@/components/TaskDetailDialog";
import { listTasks, updateTaskStatus, type AuctionTaskSummary } from "@/api/adapter";
import { useToast } from "@/hooks/use-toast";
import type { SelectUser } from "@shared/schema";

export default function MyTasks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: userResponse } = useQuery<{ user: SelectUser | null }>({ queryKey: ["/api/auth/me"] });
  const currentUser = userResponse?.user;

  const { data: tasks = [], isLoading } = useQuery<AuctionTaskSummary[]>({
    queryKey: ["tasks", "mine", currentUser?.id],
    enabled: !!currentUser,
    queryFn: () =>
      listTasks({
        scope: "mine",
        currentUser: currentUser ? { id: currentUser.id, departmentId: currentUser.departmentId } : null,
      }),
  });

  const boardTasks = useMemo<KanbanTask[]>(
    () =>
      tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        creatorName: task.creatorName,
        minimumGrade: task.minimumGrade,
        deadline: task.deadline,
        startingPrice: task.startingPrice,
        currentPrice: task.currentPrice,
        bidsCount: task.bidsCount,
        leadingBidderName: task.leadingBidderName,
        canBid: task.canBid,
      })),
    [tasks],
  );

  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: KanbanTask["status"] }) =>
      updateTaskStatus(taskId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "mine"], exact: false });
    },
    onError: () => {
      toast({
        title: "Не удалось обновить статус",
        description: "Попробуйте снова позже",
        variant: "destructive",
      });
    },
  });

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Мои аукционы</h1>
        <p className="text-muted-foreground">Задачи, в которых вы участвуете</p>
      </div>

      <KanbanBoard
        tasks={boardTasks}
        isLoading={isLoading}
        onTaskClick={(taskId) => {
          setSelectedTaskId(taskId);
          setDetailDialogOpen(true);
        }}
        onStatusChange={(taskId, status) => statusMutation.mutate({ taskId, status })}
      />

      <TaskDetailDialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open);
          if (!open) setSelectedTaskId(null);
        }}
        task={selectedTask ? {
          id: selectedTask.id,
          title: selectedTask.title,
          description: selectedTask.description,
          status: selectedTask.status,
          creator: selectedTask.creatorName,
          deadline: selectedTask.deadline,
          minimumGrade: selectedTask.minimumGrade,
          startingPrice: selectedTask.startingPrice,
          currentPrice: selectedTask.currentPrice,
          bidsCount: selectedTask.bidsCount,
          leadingBidderName: selectedTask.leadingBidderName,
        } : undefined}
      />
    </div>
  );
}
