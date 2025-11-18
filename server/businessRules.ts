import type { AuctionBid, Task } from "@shared/schema";
import { normalizeTaskMode, type TaskMode } from "@shared/taskMetadata";
import { diffWorkingHours } from "@shared/utils";

export const NO_BID_GRACE_HOURS = 3;
export const AUCTION_RANGE_MULTIPLIER = 1.5;

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

export function resolveAuctionMode(task: Task): TaskMode {
  return normalizeTaskMode((task as any).auctionMode ?? (task as any).mode);
}

export function getAuctionBaseValue(task: Task, mode: TaskMode): number | null {
  if (mode === "TIME") {
    return typeof task.baseTimeMinutes === "number" && Number.isFinite(task.baseTimeMinutes)
      ? task.baseTimeMinutes
      : null;
  }
  return parseDecimal(task.basePrice as any);
}

export function getAuctionMaxValue(task: Task, mode: TaskMode): number | null {
  const base = getAuctionBaseValue(task, mode);
  if (base === null) return null;
  if (mode === "TIME") {
    return Math.max(1, Math.round(base * AUCTION_RANGE_MULTIPLIER));
  }
  return base * AUCTION_RANGE_MULTIPLIER;
}

export function calculateAuctionPrice(task: Task, now: Date = new Date(), mode?: TaskMode): number | null {
  if (!task.auctionStartAt || !task.auctionPlannedEndAt) {
    return null;
  }

  const resolvedMode = mode ?? resolveAuctionMode(task);
  const initial = getAuctionBaseValue(task, resolvedMode);
  const max = getAuctionMaxValue(task, resolvedMode);
  const start = new Date(task.auctionStartAt);
  const plannedEnd = new Date(task.auctionPlannedEndAt);

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

  const effectiveNow = now.getTime() > plannedEnd.getTime() ? plannedEnd : now;

  const startDayEvening = new Date(start);
  startDayEvening.setHours(18, 0, 0, 0);

  const finalCheckpoint = new Date(startDayEvening);
  finalCheckpoint.setDate(finalCheckpoint.getDate() + 1);

  const checkpoints: Date[] = [];
  for (
    let point = startDayEvening;
    point.getTime() <= finalCheckpoint.getTime();
    point = new Date(point.getTime() + 3 * 60 * 60 * 1000)
  ) {
    if (point.getTime() >= start.getTime()) {
      checkpoints.push(new Date(point));
    }
  }

  if (checkpoints.length === 0) {
    return initial;
  }

  const intervals = checkpoints.length - 1;
  const step = intervals > 0 ? (AUCTION_RANGE_MULTIPLIER - 1) / intervals : 0;
  const reached = checkpoints.filter((checkpoint) => checkpoint.getTime() <= effectiveNow.getTime()).length;
  const stageIndex = Math.min(Math.max(reached - 1, 0), checkpoints.length - 1);
  const multiplier = 1 + step * stageIndex;

  const scaled = initial + (max - initial) * ((multiplier - 1) / (AUCTION_RANGE_MULTIPLIER - 1));
  return Math.min(Math.max(scaled, initial), max);
}

export function getBidValue(bid: AuctionBid, mode: TaskMode): number | null {
  if (mode === "TIME") {
    if (typeof bid.valueTimeMinutes === "number" && Number.isFinite(bid.valueTimeMinutes)) {
      return bid.valueTimeMinutes;
    }
  }

  const moneyValue = parseDecimal((bid as any).bidAmount ?? bid.valueMoney);
  if (moneyValue !== null) {
    return moneyValue;
  }

  if (typeof bid.valueTimeMinutes === "number" && Number.isFinite(bid.valueTimeMinutes)) {
    return bid.valueTimeMinutes;
  }

  return null;
}

export function compareBids(a: AuctionBid, b: AuctionBid, mode: TaskMode = "MONEY"): number {
  const aValue = getBidValue(a, mode);
  const bValue = getBidValue(b, mode);

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
}

export function selectWinningBid(bids: AuctionBid[], mode: TaskMode = "MONEY"): AuctionBid | null {
  if (bids.length === 0) {
    return null;
  }

  const sorted = [...bids].sort((a, b) => compareBids(a, b, mode));
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

export function calculateEarnedValue(
  task: Task,
  winningBid: AuctionBid | null,
  mode: TaskMode
): number | null {
  if (mode === "TIME") {
    if (winningBid) {
      return getBidValue(winningBid, mode);
    }
    return getAuctionMaxValue(task, mode);
  }

  if (mode === "MONEY") {
    if (winningBid) {
      return getBidValue(winningBid, mode);
    }
    return getAuctionMaxValue(task, mode);
  }

  return null;
}
