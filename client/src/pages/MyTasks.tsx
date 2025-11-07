import { useState } from "react";
import TaskCard from "@/components/TaskCard";
import TaskFilters from "@/components/TaskFilters";
import TaskDetailDialog from "@/components/TaskDetailDialog";
import TimeLogDialog from "@/components/TimeLogDialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export default function MyTasks() {
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [timeLogOpen, setTimeLogOpen] = useState(false);

  const mockTasks = [
    {
      id: "1",
      title: "Implement user authentication",
      description: "Set up JWT-based authentication with role-based access control for all user types",
      status: "inProgress" as const,
      type: "individual" as const,
      creator: "Sarah Johnson",
      assignee: "Mike Chen",
      deadline: "Dec 15, 2024",
      estimatedHours: 24,
      actualHours: 12,
      rating: 4.7,
    },
    {
      id: "2",
      title: "Database schema design",
      description: "Design database schema for task management system with proper relationships",
      status: "underReview" as const,
      type: "individual" as const,
      creator: "David Park",
      assignee: "Mike Chen",
      deadline: "Dec 18, 2024",
      estimatedHours: 16,
      actualHours: 16,
      rating: 4.8,
    },
    {
      id: "3",
      title: "API endpoint implementation",
      description: "Create REST API endpoints for task CRUD operations",
      status: "backlog" as const,
      type: "individual" as const,
      creator: "Emma Wilson",
      assignee: "Mike Chen",
      deadline: "Dec 22, 2024",
      estimatedHours: 20,
      rating: 4.6,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Tasks</h1>
          <p className="text-muted-foreground">Tasks assigned to you</p>
        </div>
        <Button onClick={() => setTimeLogOpen(true)} variant="outline" data-testid="button-log-time-header">
          <Clock size={18} />
          Log Time
        </Button>
      </div>

      <TaskFilters onFilterChange={(filters) => console.log("Filters:", filters)} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockTasks.map((task) => (
          <TaskCard
            key={task.id}
            {...task}
            onCardClick={() => setDetailDialogOpen(true)}
          />
        ))}
      </div>

      <TaskDetailDialog 
        open={detailDialogOpen} 
        onOpenChange={setDetailDialogOpen}
        task={mockTasks[0] && {
          ...mockTasks[0],
          comments: [
            {
              id: "1",
              author: "Sarah Johnson",
              content: "Please make sure to implement proper password hashing.",
              timestamp: "2 hours ago",
            },
          ],
        }}
      />

      <TimeLogDialog open={timeLogOpen} onOpenChange={setTimeLogOpen} />
    </div>
  );
}
