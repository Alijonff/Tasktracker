import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Clock, TrendingDown } from "lucide-react";
import { useState } from "react";
import UserAvatar from "./UserAvatar";
import RatingDisplay from "./RatingDisplay";

interface Bid {
  id: string;
  bidder: string;
  hours: number;
  rating: number;
  timestamp: string;
}

interface PlaceBidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: {
    title: string;
    currentMinBid: number;
    bids: Bid[];
  };
}

export default function PlaceBidDialog({ open, onOpenChange, task }: PlaceBidDialogProps) {
  const [bidHours, setBidHours] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Placing bid:", bidHours);
    onOpenChange(false);
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-place-bid">
        <DialogHeader>
          <DialogTitle>Сделать ставку</DialogTitle>
          <p className="text-sm text-muted-foreground">{task.title}</p>
        </DialogHeader>

        <div className="space-y-6">
          <div className="p-4 rounded-md bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Текущая минимальная ставка</span>
              <div className="flex items-center gap-2">
                <Clock className="text-primary" size={18} />
                <span className="text-2xl font-bold font-mono text-primary">{task.currentMinBid}ч</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ваша ставка должна быть меньше текущей минимальной
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bidHours">Ваша ставка (часы) *</Label>
              <Input
                id="bidHours"
                type="number"
                min="1"
                max={task.currentMinBid - 1}
                placeholder="Введите часы"
                value={bidHours}
                onChange={(e) => setBidHours(e.target.value)}
                required
                data-testid="input-bid-hours"
              />
              <p className="text-xs text-muted-foreground">
                Должно быть меньше {task.currentMinBid} часов
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                Текущие ставки ({task.bids.length})
                <TrendingDown className="text-primary" size={16} />
              </h3>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {task.bids.map((bid, index) => (
                    <div 
                      key={bid.id} 
                      className={`flex items-center justify-between p-3 rounded-md ${
                        index === 0 ? 'bg-primary/10 border border-primary/30' : 'bg-card'
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
                        <RatingDisplay rating={bid.rating} size="sm" />
                        <div className="text-right">
                          <p className="font-mono font-bold text-primary">{bid.hours}ч</p>
                          {index === 0 && (
                            <p className="text-xs text-primary">Побеждает</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Отмена
              </Button>
              <Button type="submit" data-testid="button-submit-bid">
                Сделать ставку
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
