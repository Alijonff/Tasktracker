import RatingDisplay from '../RatingDisplay';

export default function RatingDisplayExample() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <RatingDisplay rating={4.8} trend="up" showTrend />
      <RatingDisplay rating={3.7} trend="down" showTrend />
      <RatingDisplay rating={2.9} trend="stable" showTrend />
      <RatingDisplay rating={4.2} size="sm" />
    </div>
  );
}
