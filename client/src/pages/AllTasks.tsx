import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ListTodo } from "lucide-react";
import KanbanBoard, { type KanbanTask, type KanbanStatus } from "@/components/KanbanBoard";
import TaskDetailDialog from "@/components/TaskDetailDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Task, Management, Division, Department, SelectUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface ScopeFilter {
  departmentId?: string;
  managementId?: string;
  divisionId?: string;
}

function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AllTasks() {
  const [structureFilter, setStructureFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: authData } = useQuery<{ user: SelectUser | null }>({
    queryKey: ["/api/auth/me"],
  });
  const currentUser = authData?.user ?? null;

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });
  const { data: managements = [] } = useQuery<Management[]>({
    queryKey: ["/api/managements"],
  });
  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ["/api/divisions"],
  });
  const { data: employees = [] } = useQuery<SelectUser[]>({
    queryKey: ["/api/employees"],
  });

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== "admin" && currentUser.departmentId && structureFilter === "all") {
      setStructureFilter(`department:${currentUser.departmentId}`);
    }
  }, [currentUser, structureFilter]);

  const scope = useMemo<ScopeFilter>(() => {
    if (!currentUser) return {};

    if (structureFilter === "all") {
      if (currentUser.role !== "admin" && currentUser.departmentId) {
        return { departmentId: currentUser.departmentId };
      }
      return {};
    }

    const [type, id] = structureFilter.split(":");
    if (!type || !id) return {};

    if (type === "department") {
      return { departmentId: id };
    }

    if (type === "management") {
      const management = managements.find((item) => item.id === id);
      if (!management) return {};
      return { departmentId: management.departmentId, managementId: management.id };
    }

    if (type === "division") {
      const division = divisions.find((item) => item.id === id);
      if (!division) return {};
      return {
        departmentId: division.departmentId,
        managementId: division.managementId ?? undefined,
        divisionId: division.id,
      };
    }

    return {};
  }, [structureFilter, currentUser, managements, divisions]);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (scope.departmentId) params.departmentId = scope.departmentId;
    if (scope.managementId) params.managementId = scope.managementId;
    if (scope.divisionId) params.divisionId = scope.divisionId;
    if (employeeFilter !== "all") params.participantId = employeeFilter;
    return params;
  }, [scope, employeeFilter]);

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", queryParams],
    enabled: !!currentUser,
  });

  const statusMap: Record<Task["status"], KanbanStatus> = {
    backlog: "backlog",
    inProgress: "inProgress",
    underReview: "underReview",
    completed: "completed",
    overdue: "inProgress",
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

  const employeesForFilter = useMemo(() => {
    if (employees.length === 0) return employees;

    return employees.filter((employee) => {
      if (scope.divisionId) {
        return employee.divisionId === scope.divisionId;
      }
      if (scope.managementId) {
        return employee.managementId === scope.managementId;
      }
      if (scope.departmentId) {
        return employee.departmentId === scope.departmentId;
      }
      if (currentUser?.role !== "admin" && currentUser?.departmentId) {
        return employee.departmentId === currentUser.departmentId;
      }
      return true;
    });
  }, [employees, scope, currentUser]);

  useEffect(() => {
    if (employeeFilter === "all") return;
    if (!employeesForFilter.some((employee) => employee.id === employeeFilter)) {
      setEmployeeFilter("all");
    }
  }, [employeesForFilter, employeeFilter]);

  const statusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: KanbanStatus }) => {
      await apiRequest("PATCH", `/api/tasks/${taskId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/overview"] });
    },
    onError: (error: any) => {
      toast({
        title: "Не удалось обновить статус",
        description: error?.message ? String(error.message) : "Попробуйте снова",
        variant: "destructive",
      });
    },
  });

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setDetailDialogOpen(true);
  };

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) : undefined;

  const structureOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    if (currentUser?.role === "admin") {
      options.push({ value: "all", label: "Все департаменты" });
    }
    departments.forEach((department) => {
      options.push({ value: `department:${department.id}`, label: `Департамент · ${department.name}` });
    });
    managements.forEach((management) => {
      options.push({ value: `management:${management.id}`, label: `Управление · ${management.name}` });
    });
    divisions.forEach((division) => {
      options.push({ value: `division:${division.id}`, label: `Отдел · ${division.name}` });
    });
    return options;
  }, [departments, managements, divisions, currentUser]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-md bg-primary/10">
          <ListTodo className="text-primary" size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Все задачи</h1>
          <p className="text-muted-foreground">Общая доска задач организации</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="container-task-filters">
        <Select value={structureFilter} onValueChange={setStructureFilter}>
          <SelectTrigger className="w-full" data-testid="select-structure-filter">
            <SelectValue placeholder="Структурная единица" />
          </SelectTrigger>
          <SelectContent>
            {structureOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-full" data-testid="select-employee-filter">
            <SelectValue placeholder="Сотрудник" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все сотрудники</SelectItem>
            {employeesForFilter.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name} ({employee.username})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        Найдено задач: {tasks.length}
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
    </div>
  );
}
