import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import TaskCard from "@/components/TaskCard";
import PlaceBidDialog from "@/components/PlaceBidDialog";
import {
  createAuctionTask,
  listAuctions,
  placeBid,
  type AuctionTaskSummary,
  type Grade,
  type CreateAuctionTaskPayload,
} from "@/api/adapter";
import { useToast } from "@/hooks/use-toast";
import { Gavel, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SelectUser } from "@shared/schema";
import { calculateGrade } from "@shared/utils";

const gradeWeights: Record<Grade, number> = {
  D: 0,
  C: 1,
  B: 2,
  A: 3,
};

interface CreateFormState {
  title: string;
  description: string;
  minimumGrade: Grade;
  startingPrice: string;
  deadline: string;
}

function getLocalDateTimeInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function createInitialFormState(): CreateFormState {
  const defaultDeadline = new Date(Date.now() + 1000 * 60 * 60 * 72);
  return {
    title: "",
    description: "",
    minimumGrade: "D",
    startingPrice: "",
    deadline: getLocalDateTimeInputValue(defaultDeadline),
  };
}

export default function Auctions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formState, setFormState] = useState<CreateFormState>(() => createInitialFormState());

  const { data: userResponse } = useQuery<{ user: SelectUser | null }>({ queryKey: ["/api/auth/me"] });
  const currentUser = userResponse?.user;

  const userGrade = useMemo<Grade | null>(() => {
    if (!currentUser) return null;
    const rawPoints = typeof currentUser.points === "number" ? currentUser.points : Number(currentUser.points ?? 0);
    const safePoints = Number.isFinite(rawPoints) ? Number(rawPoints) : 0;
    return calculateGrade(safePoints);
  }, [currentUser]);

  const { data: tasks = [], isLoading } = useQuery<AuctionTaskSummary[]>({
    queryKey: ["auctions", "backlog"],
    queryFn: () => listAuctions({ scope: "all" }),
  });

  const canCreateAuction = currentUser?.role === "admin" || currentUser?.role === "director";

  const bidMutation = useMutation({
    mutationFn: ({ taskId, amount }: { taskId: string; amount: number }) => placeBid(taskId, amount),
    onSuccess: () => {
      toast({ title: "Ставка принята" });
      queryClient.invalidateQueries({ queryKey: ["auctions"], exact: false });
      setBidDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Не удалось отправить ставку", variant: "destructive" });
    },
  });

  const createAuctionMutation = useMutation({
    mutationFn: (payload: CreateAuctionTaskPayload) => createAuctionTask(payload),
    onSuccess: () => {
      toast({ title: "Аукцион создан" });
      queryClient.invalidateQueries({ queryKey: ["auctions"], exact: false });
      setCreateDialogOpen(false);
      setFormState(createInitialFormState());
    },
    onError: () => {
      toast({ title: "Не удалось создать аукцион", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!createDialogOpen) {
      setFormState(createInitialFormState());
    }
  }, [createDialogOpen]);

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) : undefined;

  const handleCreateAuction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = formState.title.trim();
    const trimmedDescription = formState.description.trim();
    const amount = Number(formState.startingPrice);
    const deadline = new Date(formState.deadline);

    if (!trimmedTitle) {
      toast({ title: "Введите название", variant: "destructive" });
      return;
    }

    if (!trimmedDescription) {
      toast({ title: "Опишите задачу", variant: "destructive" });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Укажите начальную сумму", variant: "destructive" });
      return;
    }

    if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
      toast({ title: "Выберите корректный дедлайн", variant: "destructive" });
      return;
    }

    createAuctionMutation.mutate({
      title: trimmedTitle,
      description: trimmedDescription,
      minimumGrade: formState.minimumGrade,
      startingPrice: amount,
      deadline: deadline.toISOString(),
    });
  };

  const backlogAuctions = useMemo(() => {
    return tasks.map((task) => {
      const gradeAllowed = userGrade ? gradeWeights[userGrade] >= gradeWeights[task.minimumGrade] : true;
      const restrictionReason = userGrade && !gradeAllowed ? `Ставка доступна с грейда ${task.minimumGrade}` : undefined;
      return {
        task,
        canBid: task.canBid && gradeAllowed,
        restrictionReason,
      };
    });
  }, [tasks, userGrade]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-md bg-primary/10">
            <Gavel className="text-primary" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Аукционы в бэклоге</h1>
            <p className="text-muted-foreground">Только задачи со статусом «backlog» доступны для торгов</p>
          </div>
        </div>
        {canCreateAuction && (
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-auction">
            <PlusCircle className="mr-2 h-4 w-4" />
            Создать аукцион
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-56 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : backlogAuctions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Нет аукционов в бэклоге. Попробуйте позже.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {backlogAuctions.map(({ task, canBid, restrictionReason }) => (
            <TaskCard
              key={task.id}
              id={task.id}
              title={task.title}
              description={task.description}
              status={task.status}
              creator={task.creatorName}
              deadline={task.deadline}
              minimumGrade={task.minimumGrade}
              startingPrice={task.startingPrice}
              currentPrice={task.currentPrice}
              bidsCount={task.bidsCount}
              leadingBidderName={task.leadingBidderName}
              canBid={canBid}
              bidRestrictionReason={restrictionReason}
              onBidClick={() => {
                setSelectedTaskId(task.id);
                setBidDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <PlaceBidDialog
        open={bidDialogOpen}
        onOpenChange={setBidDialogOpen}
        isSubmitting={bidMutation.isPending}
        onSubmit={(amount) => {
          if (!selectedTaskId) return;
          bidMutation.mutate({ taskId: selectedTaskId, amount });
        }}
        task={selectedTask ? {
          id: selectedTask.id,
          title: selectedTask.title,
          currentPrice: selectedTask.currentPrice ?? selectedTask.startingPrice,
          minimumGrade: selectedTask.minimumGrade,
          bids: [],
        } : undefined}
      />

      {canCreateAuction && (
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-lg" data-testid="dialog-create-auction">
            <DialogHeader>
              <DialogTitle>Создать аукцион</DialogTitle>
              <DialogDescription>
                Опишите задачу, укажите минимальный грейд исполнителя и стартовую сумму в сумах
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleCreateAuction}>
              <div className="space-y-2">
                <Label htmlFor="auction-title">Название *</Label>
                <Input
                  id="auction-title"
                  value={formState.title}
                  onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Например, редизайн личного кабинета"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auction-description">Описание *</Label>
                <Textarea
                  id="auction-description"
                  value={formState.description}
                  onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Опишите ключевые задачи и ожидания"
                  required
                  rows={4}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="auction-grade">Минимальный грейд *</Label>
                  <Select
                    value={formState.minimumGrade}
                    onValueChange={(value: Grade) => setFormState((prev) => ({ ...prev, minimumGrade: value }))}
                  >
                    <SelectTrigger id="auction-grade">
                      <SelectValue placeholder="Выберите грейд" />
                    </SelectTrigger>
                    <SelectContent>
                      {(["D", "C", "B", "A"] as Grade[]).map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auction-sum">Начальная сумма, сум *</Label>
                  <Input
                    id="auction-sum"
                    type="number"
                    min={1000}
                    step={1000}
                    value={formState.startingPrice}
                    onChange={(event) => setFormState((prev) => ({ ...prev, startingPrice: event.target.value }))}
                    placeholder="Например, 1500000"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="auction-deadline">Дедлайн аукциона *</Label>
                <Input
                  id="auction-deadline"
                  type="datetime-local"
                  value={formState.deadline}
                  onChange={(event) => setFormState((prev) => ({ ...prev, deadline: event.target.value }))}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" disabled={createAuctionMutation.isPending}>
                  {createAuctionMutation.isPending ? "Создание..." : "Создать"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
