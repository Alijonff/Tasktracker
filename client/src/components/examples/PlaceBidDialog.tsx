import PlaceBidDialog from '../PlaceBidDialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function PlaceBidDialogExample() {
  const [open, setOpen] = useState(false);

  const mockTask = {
    id: 'example-auction',
    title: 'Design new dashboard layout',
    currentPrice: 1_200_000,
    minimumGrade: 'C' as const,
    bids: [
      { id: '1', bidder: 'Alex Rivera', amount: 1_200_000, rating: 4.8, timestamp: '5 min ago' },
      { id: '2', bidder: 'Emma Wilson', amount: 1_150_000, rating: 4.6, timestamp: '1 hour ago' },
      { id: '3', bidder: 'Mike Chen', amount: 1_100_000, rating: 4.7, timestamp: '2 hours ago' },
    ],
  };

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Bid Dialog</Button>
      <PlaceBidDialog open={open} onOpenChange={setOpen} task={mockTask} />
    </div>
  );
}
