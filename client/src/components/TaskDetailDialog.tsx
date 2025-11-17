import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatAuctionValue, formatDateTime } from "@/lib/formatters";
import StatusBadge from "./StatusBadge";
import GradeBadge from "./GradeBadge";
import { Badge } from "@/components/ui/badge";
import { UsersRound, Gavel, CalendarDays, UserRound } from "lucide-react";
import type { Grade } from "@/api/adapter";
import type { TaskMode } from "@shared/taskMetadata";

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: {
    id: string;
    title: string;
    description: string;
    status: "backlog" | "inProgress" | "underReview" | "completed";
    creator: string;
    deadline: string;
    minimumGrade: Grade;
    startingPrice: number;
    currentPrice?: number;
    mode: TaskMode;
    bidsCount: number;
    leadingBidderName?: string;
  };
}

export default function TaskDetailDialog({ open, onOpenChange, task }: TaskDetailDialogProps) {
  if (!task) return null;

  const price = task.currentPrice ?? task.startingPrice;
  const formattedPrice = formatAuctionValue(price, task.mode);

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
              <h3 className="font-semibold">Информация по аукциону</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <div className="flex items-center justify-between">
                  <span>Начальная ставка</span>
                  <span className="font-mono text-foreground">{formatMoney(task.startingPrice)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Текущая ставка</span>
                  <span className="font-mono text-foreground">{formatMoney(price)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Ставки подаются только в сумах. После финального перевода в колонку «Завершена» сотрудник фиксируется
              победителем аукциона.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
