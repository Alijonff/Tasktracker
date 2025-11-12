import TaskCard from '../TaskCard';

export default function TaskCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      <TaskCard
        id="1"
        title="Implement user authentication"
        description="Set up JWT-based authentication with role-based access control for all user types"
        status="inProgress"
        creator="Sarah Johnson"
        deadline={new Date().toISOString()}
        minimumGrade="C"
        startingPrice={1_200_000}
        currentPrice={1_350_000}
        bidsCount={4}
        leadingBidderName="Mike Chen"
        canBid={false}
        onCardClick={() => console.log('Task clicked')}
      />
      <TaskCard
        id="2"
        title="Design new dashboard layout"
        description="Create responsive dashboard with analytics widgets and real-time data visualization"
        status="backlog"
        creator="Alex Rivera"
        deadline={new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString()}
        minimumGrade="B"
        startingPrice={1_800_000}
        bidsCount={5}
        canBid
        onCardClick={() => console.log('Auction task clicked')}
        onBidClick={() => console.log('Place bid clicked')}
      />
      <TaskCard
        id="3"
        title="Database optimization"
        description="Optimize database queries and add proper indexing for better performance"
        status="completed"
        creator="David Park"
        deadline={new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()}
        minimumGrade="D"
        startingPrice={950_000}
        currentPrice={1_050_000}
        bidsCount={3}
        leadingBidderName="Emma Wilson"
        canBid={false}
        onCardClick={() => console.log('Task clicked')}
      />
    </div>
  );
}
