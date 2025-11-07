import { useState } from "react";
import TaskCard from "@/components/TaskCard";
import TaskFilters from "@/components/TaskFilters";
import PlaceBidDialog from "@/components/PlaceBidDialog";
import { Gavel } from "lucide-react";

export default function Auctions() {
  const [bidDialogOpen, setBidDialogOpen] = useState(false);

  const mockAuctionTasks = [
    {
      id: "1",
      title: "Design new dashboard layout",
      description: "Create responsive dashboard with analytics widgets and real-time data visualization",
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
      id: "2",
      title: "Mobile app optimization",
      description: "Optimize mobile app performance and reduce bundle size",
      status: "backlog" as const,
      type: "auction" as const,
      creator: "Sarah Johnson",
      deadline: "Dec 25, 2024",
      estimatedHours: 30,
      rating: 4.7,
      bidCount: 3,
      minBid: 28,
      timeRemaining: "5h 30m",
    },
    {
      id: "3",
      title: "Security audit",
      description: "Perform comprehensive security audit of the application",
      status: "backlog" as const,
      type: "auction" as const,
      creator: "David Park",
      deadline: "Dec 28, 2024",
      estimatedHours: 50,
      rating: 4.9,
      bidCount: 7,
      minBid: 42,
      timeRemaining: "1h 45m",
    },
  ];

  const mockBidTask = {
    title: "Design new dashboard layout",
    currentMinBid: 32,
    bids: [
      { id: "1", bidder: "Alex Rivera", hours: 32, rating: 4.8, timestamp: "5 min ago" },
      { id: "2", bidder: "Emma Wilson", hours: 35, rating: 4.6, timestamp: "1 hour ago" },
      { id: "3", bidder: "Mike Chen", hours: 38, rating: 4.7, timestamp: "2 hours ago" },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-md bg-primary/10">
          <Gavel className="text-primary" size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Активные аукционы</h1>
          <p className="text-muted-foreground">Делайте ставки на доступные задачи</p>
        </div>
      </div>

      <TaskFilters onFilterChange={(filters) => console.log("Filters:", filters)} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockAuctionTasks.map((task) => (
          <TaskCard
            key={task.id}
            {...task}
            onCardClick={() => console.log("Task clicked")}
            onBidClick={() => setBidDialogOpen(true)}
          />
        ))}
      </div>

      <PlaceBidDialog 
        open={bidDialogOpen} 
        onOpenChange={setBidDialogOpen}
        task={mockBidTask}
      />
    </div>
  );
}
