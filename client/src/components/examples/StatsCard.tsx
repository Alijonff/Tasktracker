import StatsCard from '../StatsCard';
import { CheckCircle2, Clock, Users, TrendingUp } from 'lucide-react';

export default function StatsCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
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
  );
}
