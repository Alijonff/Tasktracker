import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import TaskCard from "@/components/TaskCard";
import PlaceBidDialog from "@/components/PlaceBidDialog";
import { listTasks, placeBid, type AuctionTaskSummary } from "@/api/adapter";
import { useToast } from "@/hooks/use-toast";
import { Gavel } from "lucide-react";

export default function Auctions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: tasks = [], isLoading } = useQuery<AuctionTaskSummary[]>({
    queryKey: ["auctions", "active"],
    queryFn: () => listTasks({ scope: "all" }),
  });

  const activeAuctions = useMemo(
    () => tasks.filter((task) => task.status !== "completed"),
    [tasks],
  );

  const bidMutation = useMutation({
    mutationFn: ({ taskId, amount }: { taskId: string; amount: number }) => placeBid(taskId, amount),
    onSuccess: () => {
      toast({ title: "Ставка принята" });
      queryClient.invalidateQueries({ queryKey: ["auctions", "active"] });
      setBidDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Не удалось отправить ставку", variant: "destructive" });
    },
  });

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-md bg-primary/10">
          <Gavel className="text-primary" size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Активные аукционы</h1>
          <p className="text-muted-foreground">Делайте ставки в сумах и выигрывайте задачи</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-56 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : activeAuctions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Нет активных аукционов. Попробуйте позже.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeAuctions.map((task) => (
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
              canBid={task.canBid}
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
    </div>
  );
}
