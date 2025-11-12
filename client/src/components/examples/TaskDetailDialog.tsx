import TaskDetailDialog from '../TaskDetailDialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function TaskDetailDialogExample() {
  const [open, setOpen] = useState(false);

  const mockTask = {
    id: '1',
    title: 'Implement user authentication system',
    description:
      'Set up JWT-based authentication with role-based access control for all user types including administrators, department directors, and employees.',
    status: 'inProgress' as const,
    creator: 'Sarah Johnson',
    deadline: new Date().toISOString(),
    minimumGrade: 'B' as const,
    startingPrice: 1_400_000,
    currentPrice: 1_620_000,
    bidsCount: 6,
    leadingBidderName: 'Mike Chen',
  };

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Task Details</Button>
      <TaskDetailDialog open={open} onOpenChange={setOpen} task={mockTask} />
    </div>
  );
}
