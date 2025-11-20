import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import TaskCard from "@/components/TaskCard";
import PlaceBidDialog from "@/components/PlaceBidDialog";
import CreateAuctionModal from "@/components/CreateAuctionModal";
import { listAuctions, placeBid, getBidsForTask, type AuctionTaskSummary } from "@/api/adapter";
import { useToast } from "@/hooks/use-toast";
import { Gavel, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionUser } from "@/types/session";
import type { TaskMode } from "@shared/taskMetadata";
import { extractBidErrorMessage, getBidAvailability, resolveUserGrade } from "@/lib/bidRules";

export default function Auctions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: userResponse } = useQuery<{ user: SessionUser | null }>({
    queryKey: ["/api/auth/me"],
  });
  const currentUser = userResponse?.user;

  const userGrade = useMemo(() => resolveUserGrade(currentUser), [currentUser]);

  const { data: tasks = [], isLoading } = useQuery<AuctionTaskSummary[]>({
    queryKey: ["auctions", "BACKLOG"],
    queryFn: () => listAuctions({ scope: "all", status: "BACKLOG" }),
  });

  const canCreateAuction = Boolean(currentUser?.canCreateAuctions);

  // Fetch bids for the selected task
  const { data: selectedTaskBids = [] } = useQuery({
    queryKey: ["task-bids", selectedTaskId],
    queryFn: () => (selectedTaskId ? getBidsForTask(selectedTaskId) : Promise.resolve([])),
    enabled: !!selectedTaskId && bidDialogOpen,
  });

  const bidMutation = useMutation({
    mutationFn: ({ taskId, amount, mode }: { taskId: string; amount: number; mode: TaskMode }) =>
      placeBid(taskId, amount, mode),
    onSuccess: () => {
      toast({ title: "Ставка принята" });
      queryClient.invalidateQueries({ queryKey: ["auctions"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["task-bids", selectedTaskId] });
      setBidDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: extractBidErrorMessage(error), variant: "destructive" });
    },
  });

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) : undefined;

  const backlogAuctions = useMemo(() => {
    const backlogTasks = tasks.filter((task) => task.status === "BACKLOG");
    return backlogTasks.map((task) => {
      const { canBid, reason } = getBidAvailability(task, currentUser, userGrade);
      return {
        task,
        canBid: task.canBid && canBid,
        restrictionReason: reason,
      };
    });
  }, [tasks, userGrade, currentUser]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-md bg-primary/10">
            <Gavel className="text-primary" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Аукционы в бэклоге</h1>
            <p className="text-muted-foreground">Только задачи со статусом «BACKLOG» доступны для торгов</p>
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
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Нет данных</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {backlogAuctions.map(({ task, canBid, restrictionReason }) => (
            <TaskCard
              key={task.id}
              id={task.id}
              title={task.title}
              description={task.description}
              status={task.status}
              mode={task.mode}
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
          if (!selectedTaskId || !selectedTask) return;
          bidMutation.mutate({ taskId: selectedTaskId, amount, mode: selectedTask.mode });
        }}
        task={selectedTask ? {
          id: selectedTask.id,
          title: selectedTask.title,
          startingPrice: selectedTask.startingPrice,
          currentPrice: selectedTask.currentPrice ?? selectedTask.startingPrice,
          minimumGrade: selectedTask.minimumGrade,
          mode: selectedTask.mode,
          bids: selectedTaskBids,
        } : undefined}
      />

      {canCreateAuction && (
        <CreateAuctionModal open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      )}
    </div>
  );
}
