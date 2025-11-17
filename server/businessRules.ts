import type { AuctionBid, Task } from "@shared/schema";
import { diffWorkingHours } from "@shared/utils";

export const AUCTION_GROWTH_MULTIPLIER = 1.5;
export const AUCTION_GROWTH_WINDOW_HOURS = 24;
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

function resolveAuctionWindow(task: Task): { start: Date; end: Date } | null {
  if (!task.auctionStartAt) {
    return null;
  }

  const start = new Date(task.auctionStartAt);
  const plannedEnd = task.auctionPlannedEndAt
    ? new Date(task.auctionPlannedEndAt)
    : new Date(start.getTime() + AUCTION_GROWTH_WINDOW_HOURS * 60 * 60 * 1000);

  if (Number.isNaN(start.getTime()) || Number.isNaN(plannedEnd.getTime())) {
    return null;
  }

  return { start, end: plannedEnd };
}

export function calculateAuctionPrice(task: Task, now: Date = new Date()): number | null {
  const window = resolveAuctionWindow(task);

  const baseValue =
    task.auctionMode === "time"
      ? parseDecimal(task.baseTimeMinutes)
      : parseDecimal(task.basePrice ?? task.auctionInitialSum);
  const cappedValue = baseValue === null ? null : baseValue * AUCTION_GROWTH_MULTIPLIER;

  if (!window || baseValue === null || cappedValue === null) {
    return null;
  }

  if (task.auctionHasBids) {
    return baseValue;
  }

  const { start, end } = window;

  if (now <= start) {
    return baseValue;
  }

  if (now >= end) {
    return cappedValue;
  }

  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  const progress = Math.min(Math.max(elapsed / total, 0), 1);
  return baseValue + (cappedValue - baseValue) * progress;
}

export function selectWinningBid(bids: AuctionBid[]): AuctionBid | null {
  if (bids.length === 0) {
    return null;
  }

  const sorted = [...bids].sort((a, b) => {
    const aValue =
      a.valueTimeMinutes != null
        ? parseDecimal(a.valueTimeMinutes)
        : parseDecimal(a.bidAmount);
    const bValue =
      b.valueTimeMinutes != null
        ? parseDecimal(b.valueTimeMinutes)
        : parseDecimal(b.bidAmount);

    const amountDiff = (aValue ?? Number.POSITIVE_INFINITY) - (bValue ?? Number.POSITIVE_INFINITY);
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
  const window = resolveAuctionWindow(task);
  if (!window) return false;

  const graceEndsAt = window.end.getTime() + NO_BID_GRACE_HOURS * 60 * 60 * 1000;
  return now.getTime() >= graceEndsAt;
}

export function calculateOverduePenaltyHours(deadline: Date, completedAt: Date): number {
  return Math.max(0, Math.floor(diffWorkingHours(deadline, completedAt)));
}
