import StatusBadge from '../StatusBadge';

export default function StatusBadgeExample() {
  return (
    <div className="flex flex-wrap gap-2 p-4">
      <StatusBadge status="backlog" />
      <StatusBadge status="inProgress" />
      <StatusBadge status="underReview" />
      <StatusBadge status="completed" />
      <StatusBadge status="overdue" />
    </div>
  );
}
