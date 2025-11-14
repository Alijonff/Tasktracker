import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listTasks, updateTaskStatus, type AuctionTaskSummary } from "@/api/adapter";
import KanbanBoard, { type KanbanTask } from "@/components/KanbanBoard";
import TaskDetailDialog from "@/components/TaskDetailDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { SessionUser } from "@/types/session";
import { Search } from "lucide-react";

export default function AllTasks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [participant, setParticipant] = useState("all");
  const [onlyMyDepartment, setOnlyMyDepartment] = useState(true);

  const { data: userResponse } = useQuery<{ user: SessionUser | null }>({ queryKey: ["/api/auth/me"] });
  const currentUser = userResponse?.user;

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handler);
  }, [search]);

  const { data: tasks = [], isLoading } = useQuery<AuctionTaskSummary[]>({
    queryKey: ["tasks", "all", { search: debouncedSearch, participant, onlyMyDepartment }],
    enabled: !!currentUser,
    queryFn: () =>
      listTasks({
        scope: "all",
        search: debouncedSearch,
        participantId: participant !== "all" ? participant : undefined,
        onlyMyDepartment,
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
      queryClient.invalidateQueries({ queryKey: ["tasks", "all"], exact: false });
    },
    onError: () => {
      toast({
        title: "Не удалось обновить статус",
        description: "Попробуйте снова позже",
        variant: "destructive",
      });
    },
  });

  const participants = useMemo(() => {
    const unique = new Map<string, { id: string; name: string }>();
    tasks.forEach((task) => {
      unique.set(task.creatorId, { id: task.creatorId, name: task.creatorName });
      if (task.leadingBidderId && task.leadingBidderName) {
        unique.set(task.leadingBidderId, { id: task.leadingBidderId, name: task.leadingBidderName });
      }
    });
    return Array.from(unique.values());
  }, [tasks]);

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Все аукционы</h1>
        <p className="text-muted-foreground">Общая доска департамента</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2">
          <Label htmlFor="search" className="text-sm text-muted-foreground">Поиск по названию</Label>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              id="search"
              placeholder="Введите название задачи"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div>
          <Label className="text-sm text-muted-foreground">Участники</Label>
          <Select value={participant} onValueChange={setParticipant}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все участники</SelectItem>
              {participants.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-sm text-muted-foreground">Только мой департамент</Label>
            <Switch checked={onlyMyDepartment} onCheckedChange={setOnlyMyDepartment} />
          </div>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">Найдено аукционов: {tasks.length}</div>

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
