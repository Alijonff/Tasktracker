import TaskDetailDialog from '../TaskDetailDialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function TaskDetailDialogExample() {
  const [open, setOpen] = useState(false);

  const mockTask = {
    id: "1",
    title: "Implement user authentication system",
    description: "Set up JWT-based authentication with role-based access control for all user types including administrators, department directors, and employees.",
    status: "inProgress" as const,
    type: "individual" as const,
    creator: "Sarah Johnson",
    assignee: "Mike Chen",
    deadline: "Dec 15, 2024",
    estimatedHours: 24,
    actualHours: 12,
    rating: 4.7,
    comments: [
      {
        id: "1",
        author: "Sarah Johnson",
        content: "Please make sure to implement proper password hashing and token refresh mechanisms.",
        timestamp: "2 hours ago",
      },
      {
        id: "2",
        author: "Mike Chen",
        content: "I've completed the basic JWT setup. Working on role-based middleware now.",
        timestamp: "1 hour ago",
      },
    ],
  };

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Task Details</Button>
      <TaskDetailDialog open={open} onOpenChange={setOpen} task={mockTask} />
    </div>
  );
}
