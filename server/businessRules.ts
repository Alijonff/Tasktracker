import type { AuctionBid, Task } from "@shared/schema";
import { diffWorkingHours } from "@shared/utils";

export const NO_BID_GRACE_HOURS = 3;

export function parseDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
}

export function calculateAuctionPrice(task: Task, now: Date = new Date()): number | null {
  if (!task.auctionInitialSum || !task.auctionMaxSum || !task.auctionStartAt || !task.auctionPlannedEndAt) {
    return null;
  }

  const start = new Date(task.auctionStartAt);
  const plannedEnd = new Date(task.auctionPlannedEndAt);
  const initial = parseDecimal(task.auctionInitialSum);
  const max = parseDecimal(task.auctionMaxSum);

  if (
    initial === null ||
    max === null ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(plannedEnd.getTime()) ||
    start.getTime() === plannedEnd.getTime()
  ) {
    return null;
  }

  if (task.auctionHasBids) {
    return initial;
  }

  if (now <= start) {
    return initial;
  }

  if (now >= plannedEnd) {
    return max;
  }

  const total = plannedEnd.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  const progress = Math.min(Math.max(elapsed / total, 0), 1);
  return initial + (max - initial) * progress;
}

export function selectWinningBid(bids: AuctionBid[]): AuctionBid | null {
  if (bids.length === 0) {
    return null;
  }

  const sorted = [...bids].sort((a, b) => {
    const amountDiff = (parseDecimal(a.bidAmount) ?? Number.POSITIVE_INFINITY) -
      (parseDecimal(b.bidAmount) ?? Number.POSITIVE_INFINITY);
    if (amountDiff !== 0) {
      return amountDiff;
    }

    const pointsDiff = (b.bidderPoints ?? 0) - (a.bidderPoints ?? 0);
    if (pointsDiff !== 0) {
      return pointsDiff;
    }

    const aTime = new Date(a.createdAt ?? 0).getTime();
    const bTime = new Date(b.createdAt ?? 0).getTime();
    return aTime - bTime;
  });

  return sorted[0];
}

export function shouldAutoAssignToCreator(task: Task, now: Date = new Date()): boolean {
  if (!task.auctionPlannedEndAt) {
    return false;
  }
  const plannedEnd = new Date(task.auctionPlannedEndAt);
  if (Number.isNaN(plannedEnd.getTime())) {
    return false;
  }
  const graceEndsAt = plannedEnd.getTime() + NO_BID_GRACE_HOURS * 60 * 60 * 1000;
  return now.getTime() >= graceEndsAt;
}

export function calculateOverduePenaltyHours(deadline: Date, completedAt: Date): number {
  return Math.max(0, Math.ceil(diffWorkingHours(deadline, completedAt)));
}
