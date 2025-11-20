import type { AuctionBid, Task } from "@shared/schema";
import { normalizeTaskMode, type TaskMode } from "@shared/taskMetadata";
import { diffWorkingHours, getTashkentTime } from "@shared/utils";

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

export function getAuctionCurrentValue(task: Task, mode: TaskMode): number | null {
  if (mode === "TIME") {
    if (typeof task.currentPrice === "number" && Number.isFinite(task.currentPrice)) {
      return task.currentPrice;
    }
    return parseDecimal((task as any).currentPrice);
  }
  return parseDecimal((task as any).currentPrice);
}

export function calculateAuctionPrice(
  task: Task,
  now: Date = new Date(),
  mode: "MONEY" | "TIME"
): number | null {
  if (!task.auctionStartAt || !task.auctionPlannedEndAt) {
    return null;
  }

  const startAt = new Date(task.auctionStartAt);
  const endAt = new Date(task.auctionPlannedEndAt); // deadline_at (18:00)
  const graceEndAt = new Date(endAt.getTime() + 3 * 60 * 60 * 1000); // deadline_at + 3h (21:00)

  // Auction is closed after grace period
  if (now > graceEndAt) {
    return null;
  }

  const baseValue = getAuctionBaseValue(task, mode);
  if (task.auctionHasBids) {
    return getAuctionCurrentValue(task, mode) ?? baseValue;
  }

  if (baseValue === null) {
    return null;
  }

  // Before auction starts
  if (now < startAt) {
    return baseValue;
  }

  // Checkpoints logic (v2.2)
  // Checkpoints are at: 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 (Tashkent time)
  // Growth starts after the *second* checkpoint passes since creation.
  // Growth stops at deadline_at OR when first bid is placed (handled by caller checking task.auctionHasBids)

  const checkpoints = [0, 3, 6, 9, 12, 15, 18, 21];

  // Helper to get checkpoints passed between two times
  const countCheckpoints = (start: Date, current: Date) => {
    let count = 0;

    // We use getTashkentTime to work with "local" hours
    const s = getTashkentTime(start);
    const c = getTashkentTime(current);

    // Normalize to start of days (in Tashkent time)
    const sDay = new Date(s); sDay.setUTCHours(0, 0, 0, 0);
    const cDay = new Date(c); cDay.setUTCHours(0, 0, 0, 0);

    let iter = new Date(sDay);
    while (iter.getTime() <= cDay.getTime()) {
      for (const hour of checkpoints) {
        const cpTime = new Date(iter);
        cpTime.setUTCHours(hour, 0, 0, 0);

        // Checkpoint must be strictly after start and less than or equal to current
        // We compare using the "shifted" times which preserves the relative order and duration
        if (cpTime.getTime() > s.getTime() && cpTime.getTime() <= c.getTime()) {
          count++;
        }
      }
      iter.setUTCDate(iter.getUTCDate() + 1);
    }
    return count;
  };

  // Growth period: from startAt to deadline_at
  // After deadline_at, price is frozen at the level reached by deadline_at
  const effectiveNow = now > endAt ? endAt : now;
  const passedCheckpoints = countCheckpoints(startAt, effectiveNow);

  const totalCheckpoints = countCheckpoints(startAt, endAt);
  const effectiveSteps = Math.max(0, totalCheckpoints - 3);
  const increases = Math.max(0, passedCheckpoints - 3);

  if (effectiveSteps === 0) {
    return baseValue;
  }

  // We have `effectiveSteps` steps to reach AUCTION_RANGE_MULTIPLIER
  const maxMultiplier = AUCTION_RANGE_MULTIPLIER;
  const fraction = Math.min(1, increases / effectiveSteps);

  const multiplier = 1 + (maxMultiplier - 1) * fraction;

  return baseValue * multiplier;
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
  if (task.auctionHasBids) {
    return now.getTime() >= plannedEnd.getTime();
  }

  const graceEndsAt = plannedEnd.getTime() + NO_BID_GRACE_HOURS * 60 * 60 * 1000;
  return now.getTime() >= graceEndsAt;
}

export function calculateOverduePenaltyHours(deadline: Date, completedAt: Date): number {
  const hours = diffWorkingHours(deadline, completedAt, { useTashkentTime: false });
  return Math.max(0, Math.ceil(hours));
}

export function calculateEarnedValue(
  task: Task,
  winningBid: AuctionBid | null,
  mode: TaskMode,
  now: Date = new Date(),
): number | null {
  if (winningBid) {
    return getBidValue(winningBid, mode);
  }

  const currentValue = calculateAuctionPrice(task, now, mode);
  if (currentValue !== null) {
    return currentValue;
  }

  return getAuctionMaxValue(task, mode);
}
