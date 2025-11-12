import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateGrade, type Grade } from "@shared/utils";

interface GradeBadgeProps {
  grade?: Grade;
  points?: number;
  showPoints?: boolean;
  tooltip?: boolean;
  className?: string;
}

const gradeConfig = {
  A: {
    label: "A",
    className: "bg-status-completed/20 text-status-completed border-status-completed/30",
    description: "Grade A (≥85 points)",
  },
  B: {
    label: "B",
    className: "bg-status-inProgress/20 text-status-inProgress border-status-inProgress/30",
    description: "Grade B (65-84 points)",
  },
  C: {
    label: "C",
    className: "bg-status-underReview/20 text-status-underReview border-status-underReview/30",
    description: "Grade C (45-64 points)",
  },
  D: {
    label: "D",
    className: "bg-status-overdue/20 text-status-overdue border-status-overdue/30",
    description: "Grade D (<45 points)",
  },
};

const gradeRangesTable = `Grade Ranges:
• A: ≥85 points
• B: 65-84 points
• C: 45-64 points
• D: <45 points`;

export default function GradeBadge({
  grade: providedGrade,
  points,
  showPoints = false,
  tooltip = false,
  className = "",
}: GradeBadgeProps) {
  // Calculate grade from points if provided, otherwise use provided grade
  let grade: Grade;
  if (points !== undefined) {
    grade = calculateGrade(points);
  } else if (providedGrade) {
    grade = providedGrade;
  } else {
    throw new Error("GradeBadge: Either 'grade' or 'points' must be provided");
  }

  const config = gradeConfig[grade];

  const badgeContent = (
    <Badge
      variant="outline"
      className={`${config.className} ${className}`}
      data-testid={`badge-grade-${grade}`}
      aria-label={config.description}
    >
      <span className="sr-only">{config.description}</span>
      <span className="font-semibold">{config.label}</span>
      {showPoints && points !== undefined && (
        <span className="ml-1.5 font-mono text-muted-foreground" data-testid="text-grade-points">
          {points}
        </span>
      )}
    </Badge>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent>
          <pre className="text-xs whitespace-pre-wrap">{gradeRangesTable}</pre>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badgeContent;
}
