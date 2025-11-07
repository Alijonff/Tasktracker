import PlaceBidDialog from '../PlaceBidDialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function PlaceBidDialogExample() {
  const [open, setOpen] = useState(false);

  const mockTask = {
    title: "Design new dashboard layout",
    currentMinBid: 32,
    bids: [
      { id: "1", bidder: "Alex Rivera", hours: 32, rating: 4.8, timestamp: "5 min ago" },
      { id: "2", bidder: "Emma Wilson", hours: 35, rating: 4.6, timestamp: "1 hour ago" },
      { id: "3", bidder: "Mike Chen", hours: 38, rating: 4.7, timestamp: "2 hours ago" },
    ],
  };

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Bid Dialog</Button>
      <PlaceBidDialog open={open} onOpenChange={setOpen} task={mockTask} />
    </div>
  );
}
