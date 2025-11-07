import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, Users, Timer } from "lucide-react";
import UserAvatar from "./UserAvatar";
import StatusBadge, { TaskStatus } from "./StatusBadge";
import RatingDisplay from "./RatingDisplay";

interface TaskCardProps {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  type: "individual" | "auction";
  creator: string;
  assignee?: string;
  deadline: string;
  estimatedHours: number;
  actualHours?: number;
  rating?: number;
  bidCount?: number;
  minBid?: number;
  timeRemaining?: string;
  onCardClick?: () => void;
  onBidClick?: () => void;
}

export default function TaskCard({
  id,
  title,
  description,
  status,
  type,
  creator,
  assignee,
  deadline,
  estimatedHours,
  actualHours,
  rating,
  bidCount = 0,
  minBid,
  timeRemaining,
  onCardClick,
  onBidClick,
}: TaskCardProps) {
  return (
    <Card 
      className="hover-elevate cursor-pointer transition-all" 
      onClick={onCardClick}
      data-testid={`card-task-${id}`}
    >
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg leading-tight flex-1" data-testid={`text-task-title-${id}`}>
            {title}
          </h3>
          <StatusBadge status={status} />
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <UserAvatar name={creator} size="sm" />
            <span className="text-muted-foreground">Creator</span>
          </div>
          {assignee && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Assignee</span>
              <UserAvatar name={assignee} size="sm" />
            </div>
          )}
        </div>

        {type === "auction" && (
          <div className="p-3 rounded-md bg-primary/5 border border-primary/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-primary" />
                <span className="text-sm font-medium">{bidCount} Bids</span>
              </div>
              {minBid !== undefined && (
                <div className="flex items-center gap-1">
                  <Clock size={16} className="text-primary" />
                  <span className="text-sm font-mono font-medium text-primary">{minBid}h</span>
                </div>
              )}
            </div>
            {timeRemaining && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Timer size={14} />
                <span>{timeRemaining} until time increase</span>
              </div>
            )}
            <Button 
              size="sm" 
              className="w-full" 
              onClick={(e) => {
                e.stopPropagation();
                onBidClick?.();
              }}
              data-testid={`button-place-bid-${id}`}
            >
              Place Bid
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              <span className="font-mono">{deadline}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span className="font-mono">
                {actualHours !== undefined ? `${actualHours}/${estimatedHours}h` : `${estimatedHours}h`}
              </span>
            </div>
          </div>
          {rating !== undefined && <RatingDisplay rating={rating} size="sm" />}
        </div>
      </CardContent>
    </Card>
  );
}
