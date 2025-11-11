import { CheckCircle2, Clock, TrendingUp, Plus, ListTodo } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import StatsCard from "@/components/StatsCard";
import TaskCard from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import CreateTaskDialog from "@/components/CreateTaskDialog";
import TaskDetailDialog from "@/components/TaskDetailDialog";
import type { Task } from "@shared/schema";

interface DashboardMetricsBlock {
  value: number;
  hasData: boolean;
}

interface DashboardOverviewResponse {
  metrics: {
    completedTasks: DashboardMetricsBlock;
    totalHours: DashboardMetricsBlock;
    activeAuctions: DashboardMetricsBlock;
    backlogTasks: DashboardMetricsBlock;
  };
  highlightTasks: Task[];
}

function formatDate(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Dashboard() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { data, isLoading } = useQuery<DashboardOverviewResponse>({
    queryKey: ["/api/dashboard/overview"],
  });

  const highlightTasks = data?.highlightTasks ?? [];

  const hasTasksToShow = highlightTasks.length > 0;

  const dashboardCards = useMemo(() => {
    const metrics = data?.metrics;
    return [
      {
        title: "Выполненные задачи",
        icon: CheckCircle2,
        metric: metrics?.completedTasks,
        subtitle: "В этом месяце",
      },
      {
        title: "Всего часов",
        icon: Clock,
        metric: metrics?.totalHours,
        subtitle: "В этом месяце",
      },
      {
        title: "Активные аукционы",
        icon: TrendingUp,
        metric: metrics?.activeAuctions,
      },
      {
        title: "Задачи в бэклоге",
        icon: ListTodo,
        metric: metrics?.backlogTasks,
      },
    ];
  }, [data]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDetailDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Панель управления</h1>
          <p className="text-muted-foreground">Добро пожаловать! Вот ваш обзор</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-task-header">
          <Plus size={18} />
          Создать задачу
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardCards.map(({ title, icon, metric, subtitle }) => (
          <StatsCard
            key={title}
            title={title}
            icon={icon}
            value={metric ? metric.value : 0}
            subtitle={subtitle}
            isEmpty={!metric?.hasData}
          />
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : hasTasksToShow ? (
        <div>
          <h2 className="text-2xl font-bold mb-4">Активные и обновлённые задачи</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {highlightTasks.map((task) => (
              <TaskCard
                key={task.id}
                id={task.id}
                title={task.title}
                description={task.description}
                status={task.status}
                type={task.type}
                creator={task.creatorName}
                assignee={task.assigneeName ?? undefined}
                deadline={formatDate(task.deadline)}
                estimatedHours={Number(task.estimatedHours)}
                actualHours={task.actualHours ? Number(task.actualHours) : undefined}
                rating={task.rating ? Number(task.rating) : undefined}
                onCardClick={() => handleTaskClick(task)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Нет активных задач для отображения
        </div>
      )}

      <CreateTaskDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <TaskDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
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
    </div>
  );
}
