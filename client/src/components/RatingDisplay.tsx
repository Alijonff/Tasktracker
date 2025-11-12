import React from "react";
import { Star, TrendingUp, TrendingDown } from "lucide-react";

interface RatingDisplayProps {
  rating: number;
  trend?: "up" | "down" | "stable";
  showTrend?: boolean;
  size?: "sm" | "md";
}

export default function RatingDisplay({ rating, trend = "stable", showTrend = false, size = "md" }: RatingDisplayProps) {
  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return "text-status-completed";
    if (rating >= 3.5) return "text-status-underReview";
    return "text-status-overdue";
  };

  const sizeClasses = size === "sm" ? "text-sm" : "text-base";
  const iconSize = size === "sm" ? 14 : 16;

  return (
    <div className="flex items-center gap-1" data-testid="rating-display">
      <Star className={`${getRatingColor(rating)} fill-current`} size={iconSize} />
      <span className={`${sizeClasses} font-mono font-medium ${getRatingColor(rating)}`}>
        {rating.toFixed(1)}
      </span>
      {showTrend && trend !== "stable" && (
        trend === "up" ? (
          <TrendingUp className="text-status-completed" size={iconSize} />
        ) : (
          <TrendingDown className="text-status-overdue" size={iconSize} />
        )
      )}
    </div>
  );
}
