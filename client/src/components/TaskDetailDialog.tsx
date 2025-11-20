import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatAuctionValue, formatDateTime, formatMoney } from "@/lib/formatters";
import StatusBadge from "./StatusBadge";
import GradeBadge from "./GradeBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PlaceBidDialog from "./PlaceBidDialog";
import { UsersRound, Gavel, CalendarDays, UserRound, Wallet } from "lucide-react";
import type { BidHistoryItem, Grade } from "@/api/adapter";
import type { TaskMode } from "@shared/taskMetadata";
import type { Task } from "@shared/schema";
import { getBidsForTask, placeBid } from "@/api/adapter";
import { useToast } from "@/hooks/use-toast";
import type { SessionUser } from "@/types/session";
import { extractBidErrorMessage, getBidAvailability, resolveUserGrade } from "@/lib/bidRules";

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: {
    id: string;
    title: string;
    description: string;
    status: Task["status"];
    creator: string;
    executorName?: string | null;
    deadline: string;
    minimumGrade: Grade;
    startingPrice: number;
    currentPrice?: number;
    mode: TaskMode;
    bidsCount: number;
    leadingBidderName?: string;
    earnedMoney?: number | string | null;
    earnedTimeMinutes?: number | null;
    canBid?: boolean;
  };
}

export default function TaskDetailDialog({ open, onOpenChange, task }: TaskDetailDialogProps) {
  if (!task) return null;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [bidDialogOpen, setBidDialogOpen] = useState(false);

  const { data: userResponse } = useQuery<{ user: SessionUser | null }>({ queryKey: ["/api/auth/me"] });
  const currentUser = userResponse?.user;
  const userGrade = useMemo(() => resolveUserGrade(currentUser), [currentUser]);

  const { data: bids = [] } = useQuery<BidHistoryItem[]>({
    queryKey: ["task-bids", task.id],
    queryFn: () => getBidsForTask(task.id),
    enabled: bidDialogOpen,
  });

  const bidMutation = useMutation({
    mutationFn: (amount: number) => placeBid(task.id, amount, task.mode),
    onSuccess: () => {
      toast({ title: "Ставка принята" });
      queryClient.invalidateQueries({ queryKey: ["task-bids", task.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["auctions"], exact: false });
      setBidDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: extractBidErrorMessage(error), variant: "destructive" });
    },
  });

  const price = task.currentPrice ?? task.startingPrice;
  const formattedPrice = formatAuctionValue(price, task.mode);
  const rewardAmount =
    task.mode === "TIME"
      ? task.earnedTimeMinutes ?? null
      : typeof task.earnedMoney === "number"
        ? task.earnedMoney
        : task.earnedMoney
          ? Number.parseFloat(task.earnedMoney)
          : null;
  const rewardDisplay = rewardAmount !== null && rewardAmount !== undefined
    ? task.mode === "TIME"
      ? `${rewardAmount} мин`
      : formatMoney(rewardAmount)
    : formatAuctionValue(task.currentPrice ?? task.startingPrice, task.mode);
  const bidAvailability = getBidAvailability(task, currentUser, userGrade);
  const canBid = (task.canBid ?? true) && bidAvailability.canBid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col" data-testid="dialog-task-detail">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="flex-1">{task.title}</DialogTitle>
            <StatusBadge status={task.status} />
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
          <ScrollArea className="lg:col-span-2 h-full">
            <div className="space-y-6 pr-2">
              <div>
                <h3 className="font-semibold mb-2">Описание</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
              </div>

              <Separator />

              <div className="grid gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <UserRound size={16} />
                  <span>Создатель:</span>
                  <span className="font-medium text-foreground">{task.creator}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} />
                  <span>Дедлайн:</span>
                  <span className="font-mono text-foreground">{formatDateTime(task.deadline)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Gavel size={16} />
                  <span>Текущая ставка:</span>
                  <span className="font-semibold text-foreground">{formattedPrice}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UsersRound size={16} />
                  <span>Количество ставок:</span>
                  <Badge variant="secondary">{task.bidsCount}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span>Минимальный грейд:</span>
                  <GradeBadge grade={task.minimumGrade} />
                </div>
                {task.leadingBidderName && (
                  <div className="flex items-center gap-2">
                    <span>Лидирует:</span>
                    <span className="font-medium text-foreground">{task.leadingBidderName}</span>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="space-y-4">
            <div className="p-4 rounded-md bg-muted/40 border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Вознаграждение исполнителя</h3>
                <Wallet size={18} className="text-primary" />
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <div className="flex items-center justify-between">
                  <span>Сумма к получению</span>
                  <span className="font-semibold text-foreground">{rewardDisplay}</span>
                </div>
                {task.executorName && (
                  <div className="flex items-center justify-between">
                    <span>Исполнитель</span>
                    <span className="font-medium text-foreground">{task.executorName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Начальная ставка</span>
                  <span className="font-mono text-foreground">{formatAuctionValue(task.startingPrice, task.mode)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-md border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Участвовать в торгах</h3>
                  <p className="text-sm text-muted-foreground">Подайте ставку прямо из карточки задачи</p>
                </div>
                <Gavel size={18} className="text-primary" />
              </div>

              <Button
                className="w-full"
                onClick={() => setBidDialogOpen(true)}
                disabled={!canBid || bidMutation.isPending}
                data-testid="button-bid-from-detail"
              >
                Сделать ставку
              </Button>
              {!canBid && (
                <p className="text-xs text-muted-foreground text-center">{bidAvailability.reason}</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      <PlaceBidDialog
        open={bidDialogOpen}
        onOpenChange={setBidDialogOpen}
        isSubmitting={bidMutation.isPending}
        onSubmit={(amount) => bidMutation.mutate(amount)}
        task={bidDialogOpen ? {
          id: task.id,
          title: task.title,
          startingPrice: task.startingPrice,
          currentPrice: task.currentPrice ?? task.startingPrice,
          minimumGrade: task.minimumGrade,
          bids,
          mode: task.mode,
        } : undefined}
      />
    </Dialog>
  );
}
