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
          <DialogTitle>Place Bid</DialogTitle>
          <p className="text-sm text-muted-foreground">{task.title}</p>
        </DialogHeader>

        <div className="space-y-6">
          <div className="p-4 rounded-md bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Current Minimum Bid</span>
              <div className="flex items-center gap-2">
                <Clock className="text-primary" size={18} />
                <span className="text-2xl font-bold font-mono text-primary">{task.currentMinBid}h</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              You must bid less than the current minimum to win the task
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bidHours">Your Bid (hours) *</Label>
              <Input
                id="bidHours"
                type="number"
                min="1"
                max={task.currentMinBid - 1}
                placeholder="Enter hours"
                value={bidHours}
                onChange={(e) => setBidHours(e.target.value)}
                required
                data-testid="input-bid-hours"
              />
              <p className="text-xs text-muted-foreground">
                Must be less than {task.currentMinBid} hours
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                Current Bids ({task.bids.length})
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
                          <p className="font-mono font-bold text-primary">{bid.hours}h</p>
                          {index === 0 && (
                            <p className="text-xs text-primary">Winning</p>
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
                Cancel
              </Button>
              <Button type="submit" data-testid="button-submit-bid">
                Place Bid
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
