import { CheckCircle2, Clock, Users, TrendingUp, Plus } from "lucide-react";
import { useState } from "react";
import StatsCard from "@/components/StatsCard";
import TaskCard from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import CreateTaskDialog from "@/components/CreateTaskDialog";
import TaskDetailDialog from "@/components/TaskDetailDialog";

export default function Dashboard() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const mockRecentTasks = [
    {
      id: "1",
      title: "Implement user authentication",
      description: "Set up JWT-based authentication with role-based access control",
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
      title: "Design analytics dashboard",
      description: "Create comprehensive analytics dashboard with charts and metrics",
      status: "backlog" as const,
      type: "auction" as const,
      creator: "Alex Rivera",
      deadline: "Dec 20, 2024",
      estimatedHours: 40,
      rating: 4.5,
      bidCount: 5,
      minBid: 32,
      timeRemaining: "2h 15m",
    },
    {
      id: "3",
      title: "Database optimization",
      description: "Optimize database queries and add proper indexing",
      status: "underReview" as const,
      type: "individual" as const,
      creator: "David Park",
      assignee: "Emma Wilson",
      deadline: "Dec 18, 2024",
      estimatedHours: 16,
      actualHours: 14,
      rating: 4.9,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your overview</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-task-header">
          <Plus size={18} />
          Create Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Completed Tasks"
          value={127}
          icon={CheckCircle2}
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          title="Total Hours"
          value="1,248"
          icon={Clock}
          subtitle="This month"
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          title="Active Auctions"
          value={15}
          icon={TrendingUp}
        />
        <StatsCard
          title="Team Members"
          value={42}
          icon={Users}
          trend={{ value: 5, isPositive: true }}
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Recent Tasks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockRecentTasks.map((task) => (
            <TaskCard
              key={task.id}
              {...task}
              onCardClick={() => setDetailDialogOpen(true)}
              onBidClick={() => console.log("Place bid")}
            />
          ))}
        </div>
      </div>

      <CreateTaskDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <TaskDetailDialog 
        open={detailDialogOpen} 
        onOpenChange={setDetailDialogOpen}
        task={mockRecentTasks[0] && {
          ...mockRecentTasks[0],
          comments: [
            {
              id: "1",
              author: "Sarah Johnson",
              content: "Please implement proper password hashing.",
              timestamp: "2 hours ago",
            },
          ],
        }}
      />
    </div>
  );
}
