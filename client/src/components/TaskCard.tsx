import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import UserAvatar from "./UserAvatar";
import StatusBadge from "./StatusBadge";
import GradeBadge from "./GradeBadge";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatMoney } from "@/lib/formatters";
import { UsersRound, Gavel, Timer } from "lucide-react";
import type { Grade } from "@/api/adapter";
import { formatTimeRemaining } from "@/lib/formatters";

export interface TaskCardProps {
  id: string;
  title: string;
  description: string;
  status: "backlog" | "inProgress" | "underReview" | "completed";
  creator: string;
  deadline: string;
  minimumGrade: Grade;
  startingPrice: number;
  currentPrice?: number;
  bidsCount: number;
  leadingBidderName?: string;
  canBid: boolean;
  bidRestrictionReason?: string;
  onCardClick?: () => void;
  onBidClick?: () => void;
}

export default function TaskCard({
  id,
  title,
  description,
  status,
  creator,
  deadline,
  minimumGrade,
  startingPrice,
  currentPrice,
  bidsCount,
  leadingBidderName,
  canBid,
  bidRestrictionReason,
  onCardClick,
  onBidClick,
}: TaskCardProps) {
  const activePrice = currentPrice ?? startingPrice;
  const timeRemaining = formatTimeRemaining(deadline);

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
        <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <UserAvatar name={creator} size="sm" />
            <span>{creator}</span>
          </div>
          <GradeBadge grade={minimumGrade} />
        </div>

        <div className="grid gap-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Timer size={16} />
              До завершения
            </span>
            <span className="font-semibold text-foreground">{timeRemaining}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Дедлайн</span>
            <span className="font-mono">{formatDateTime(deadline)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Текущая ставка</span>
            <span className="font-semibold text-foreground">{formatMoney(activePrice)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <UsersRound size={16} />
              Ставок
            </span>
            <Badge variant="secondary">{bidsCount}</Badge>
          </div>
          {leadingBidderName && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Gavel size={16} />
                Лидер аукциона
              </span>
              <span className="font-medium text-foreground">{leadingBidderName}</span>
            </div>
          )}
        </div>

        <Button
          size="sm"
          className="w-full"
          disabled={!canBid}
          onClick={(event) => {
            event.stopPropagation();
            onBidClick?.();
          }}
          data-testid={`button-place-bid-${id}`}
        >
          Сделать ставку
        </Button>
        {!canBid && (
          <p className="text-xs text-muted-foreground text-center">
            {bidRestrictionReason ?? "Ставки недоступны для этого аукциона"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
