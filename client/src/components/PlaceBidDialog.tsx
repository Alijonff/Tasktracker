import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Gavel } from "lucide-react";
import { useEffect, useState } from "react";
import UserAvatar from "./UserAvatar";
import RatingDisplay from "./RatingDisplay";
import GradeBadge from "./GradeBadge";
import { formatMoney } from "@/lib/formatters";
import type { Grade } from "@/api/adapter";

interface Bid {
  id: string;
  bidder: string;
  amount: number;
  rating?: number;
  timestamp: string;
}

interface PlaceBidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (amount: number) => void;
  task?: {
    id: string;
    title: string;
    currentPrice: number;
    minimumGrade: Grade;
    bids: Bid[];
  };
  isSubmitting?: boolean;
}

export function parseBidAmount(raw: string): number | null {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export default function PlaceBidDialog({
  open,
  onOpenChange,
  onSubmit,
  task,
  isSubmitting = false,
}: PlaceBidDialogProps) {
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!open) {
      setAmount("");
    }
  }, [open]);

  if (!task) return null;

  const currentPrice = task.currentPrice ?? 0;
  const parsedAmount = parseBidAmount(amount);
  const isAmountEntered = parsedAmount !== null;
  const isAmountWithinLimit = parsedAmount !== null && parsedAmount <= currentPrice;
  const isBidValid = isAmountEntered && isAmountWithinLimit;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBidValid || parsedAmount === null) return;
    onSubmit?.(parsedAmount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-place-bid">
        <DialogHeader>
          <DialogTitle>Сделать ставку</DialogTitle>
          <p className="text-sm text-muted-foreground">{task.title}</p>
        </DialogHeader>

        <div className="space-y-6">
          <div className="p-4 rounded-md bg-primary/5 border border-primary/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Текущая ставка</span>
              <span className="text-2xl font-bold text-primary">{formatMoney(task.currentPrice)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Минимальный грейд</span>
              <GradeBadge grade={task.minimumGrade} />
            </div>
            <p className="text-xs text-muted-foreground">
              Введите сумму в сумах, которую готовы предложить за выполнение задачи
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bidAmount">Ваша ставка *</Label>
              <Input
                id="bidAmount"
                type="number"
                min="1"
                step="1"
                placeholder="Введите сумму"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                data-testid="input-bid-amount"
              />
              {isAmountEntered && !isAmountWithinLimit && (
                <p className="text-xs text-status-overdue">Ставка должна быть не больше текущей цены</p>
              )}
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  История ставок
                  <Gavel className="text-primary" size={16} />
                </h3>
                <span className="text-sm text-muted-foreground">{task.bids.length}</span>
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {task.bids.map((bid, index) => (
                    <div
                      key={bid.id}
                      className={`flex items-center justify-between p-3 rounded-md ${
                        index === 0 ? "bg-primary/10 border border-primary/30" : "bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar name={bid.bidder} size="sm" />
                        <div>
                          <p className="font-medium text-sm">{bid.bidder}</p>
                          <p className="text-xs text-muted-foreground">{bid.timestamp}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {bid.rating !== undefined && <RatingDisplay rating={bid.rating} size="sm" />}
                        <div className="text-right">
                          <p className="font-mono font-bold text-primary">{formatMoney(bid.amount)}</p>
                          {index === 0 && <p className="text-xs text-primary">Лидер</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {task.bids.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">Нет данных</div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isSubmitting || !isBidValid} data-testid="button-submit-bid">
                {isSubmitting ? "Отправка..." : "Сделать ставку"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
