import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListTodo } from "lucide-react";
import TaskCard from "@/components/TaskCard";
import TaskDetailDialog from "@/components/TaskDetailDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import type { Task, Management, Division } from "@shared/schema";

export default function AllTasks() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    type: "all",
    departmentId: "dept-1", // Default to first department
    managementId: "all",
    divisionId: "all",
  });

  // Fetch managements
  const { data: managements = [] } = useQuery<Management[]>({
    queryKey: ["/api/managements"],
  });

  // Fetch divisions
  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ["/api/divisions"],
  });

  // Fetch tasks with segmented query key for proper cache invalidation
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", filters],
  });

  const filteredTasks = tasks;

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDetailDialogOpen(true);
  };

  // Get filtered divisions based on selected management
  const filteredDivisions = filters.managementId !== "all"
    ? divisions.filter(d => d.managementId === filters.managementId)
    : divisions;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-md bg-primary/10">
          <ListTodo className="text-primary" size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Все задачи</h1>
          <p className="text-muted-foreground">
            Просмотр и управление задачами департамента
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3" data-testid="container-task-filters">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Поиск задач..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-10"
            data-testid="input-search-tasks"
          />
        </div>
        
        <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
          <SelectTrigger className="w-full md:w-40" data-testid="select-filter-status">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="backlog">Бэклог</SelectItem>
            <SelectItem value="inProgress">В работе</SelectItem>
            <SelectItem value="underReview">На проверке</SelectItem>
            <SelectItem value="completed">Выполнена</SelectItem>
            <SelectItem value="overdue">Просрочена</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
          <SelectTrigger className="w-full md:w-40" data-testid="select-filter-type">
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            <SelectItem value="individual">Индивидуальная</SelectItem>
            <SelectItem value="auction">Аукцион</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={filters.managementId} 
          onValueChange={(v) => setFilters({ ...filters, managementId: v, divisionId: "all" })}
        >
          <SelectTrigger className="w-full md:w-48" data-testid="select-filter-management">
            <SelectValue placeholder="Управление" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все управления</SelectItem>
            {managements.map(mgmt => (
              <SelectItem key={mgmt.id} value={mgmt.id}>
                {mgmt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select 
          value={filters.divisionId} 
          onValueChange={(v) => setFilters({ ...filters, divisionId: v })}
        >
          <SelectTrigger className="w-full md:w-48" data-testid="select-filter-division">
            <SelectValue placeholder="Отдел" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все отделы</SelectItem>
            {filteredDivisions.map(div => (
              <SelectItem key={div.id} value={div.id}>
                {div.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Task count */}
      <div className="text-sm text-muted-foreground">
        Найдено задач: {filteredTasks.length}
      </div>

      {/* Tasks grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Загрузка задач...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Задачи не найдены
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task: Task) => (
            <TaskCard
              key={task.id}
              id={task.id}
              title={task.title}
              description={task.description}
              status={task.status}
              type={task.type}
              creator={task.creatorName}
              assignee={task.assigneeName || undefined}
              deadline={new Date(task.deadline).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
              estimatedHours={Number(task.estimatedHours)}
              actualHours={task.actualHours ? Number(task.actualHours) : undefined}
              rating={task.rating ? Number(task.rating) : undefined}
              onCardClick={() => handleTaskClick(task)}
              onBidClick={() => handleTaskClick(task)}
            />
          ))}
        </div>
      )}

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
          assignee: selectedTask.assigneeName || undefined,
          deadline: new Date(selectedTask.deadline).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          }),
          estimatedHours: Number(selectedTask.estimatedHours),
          actualHours: selectedTask.actualHours ? Number(selectedTask.actualHours) : undefined,
          rating: selectedTask.rating ? Number(selectedTask.rating) : undefined,
          comments: [],
        } : undefined}
      />
    </div>
  );
}
