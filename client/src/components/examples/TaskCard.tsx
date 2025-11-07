import TaskCard from '../TaskCard';

export default function TaskCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      <TaskCard
        id="1"
        title="Implement user authentication"
        description="Set up JWT-based authentication with role-based access control for all user types"
        status="inProgress"
        type="individual"
        creator="Sarah Johnson"
        assignee="Mike Chen"
        deadline="Dec 15, 2024"
        estimatedHours={24}
        actualHours={12}
        rating={4.7}
        onCardClick={() => console.log('Task clicked')}
      />
      <TaskCard
        id="2"
        title="Design new dashboard layout"
        description="Create responsive dashboard with analytics widgets and real-time data visualization"
        status="backlog"
        type="auction"
        creator="Alex Rivera"
        deadline="Dec 20, 2024"
        estimatedHours={40}
        rating={4.5}
        bidCount={5}
        minBid={32}
        timeRemaining="2h 15m"
        onCardClick={() => console.log('Auction task clicked')}
        onBidClick={() => console.log('Place bid clicked')}
      />
      <TaskCard
        id="3"
        title="Database optimization"
        description="Optimize database queries and add proper indexing for better performance"
        status="completed"
        type="individual"
        creator="David Park"
        assignee="Emma Wilson"
        deadline="Dec 10, 2024"
        estimatedHours={16}
        actualHours={14}
        rating={4.9}
        onCardClick={() => console.log('Task clicked')}
      />
    </div>
  );
}
