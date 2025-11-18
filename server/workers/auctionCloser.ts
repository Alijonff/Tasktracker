import {
  calculateEarnedValue,
  resolveAuctionMode,
  selectWinningBid,
  shouldAutoAssignToCreator,
} from "../businessRules";
import { storage } from "../storage";

export async function processExpiredReviews(): Promise<void> {
  try {
    const expiredReviews = await storage.getReviewsToExpire();
    
    if (expiredReviews.length === 0) {
      return;
    }
    
    console.log(`[ReviewCloser] Processing ${expiredReviews.length} expired reviews`);
    
    for (const task of expiredReviews) {
      try {
        await storage.updateTask(task.id, {
          status: "IN_PROGRESS" as any,
          reviewDeadline: null as any
        });

        console.log(
          `[ReviewCloser] Returned task ${task.id} (${task.title}) to IN_PROGRESS after review deadline expired`
        );
      } catch (error) {
        console.error(`[ReviewCloser] Error processing task ${task.id}:`, error);
      }
    }
  } catch (error) {
    console.error("[ReviewCloser] Error in processExpiredReviews:", error);
  }
}

export async function processExpiredAuctions(): Promise<void> {
  try {
    const expiredAuctions = await storage.getAuctionsToClose();
    
    if (expiredAuctions.length === 0) {
      return;
    }
    
    console.log(`[AuctionCloser] Processing ${expiredAuctions.length} expired auctions`);

    for (const auction of expiredAuctions) {
      try {
        const mode = resolveAuctionMode(auction);
        const bids = await storage.getTaskBids(auction.id);
        const now = new Date();

        if (bids.length === 0) {
          if (!shouldAutoAssignToCreator(auction, now)) {
            continue;
          }

          const assignedValue = calculateEarnedValue(auction, null, mode);

          await storage.closeAuction(auction.id, {
            winnerId: auction.creatorId,
            winnerName: auction.creatorName,
            assignedValue: assignedValue ?? null,
            mode,
            endAt: now,
          });

          console.log(
            `[AuctionCloser] Closed auction ${auction.id} without bids, assigned to creator ${auction.creatorName} with value ${assignedValue}`
          );
        } else {
          const winningBid = selectWinningBid(bids, mode);
          if (!winningBid) {
            continue;
          }

          const assignedValue = calculateEarnedValue(auction, winningBid, mode);

          await storage.closeAuction(auction.id, {
            winnerId: winningBid.bidderId,
            winnerName: winningBid.bidderName,
            assignedValue: assignedValue ?? null,
            mode,
            endAt: now,
          });

          console.log(
            `[AuctionCloser] Closed auction ${auction.id}, winner: ${winningBid.bidderName} with value ${assignedValue}`
          );
        }
      } catch (error) {
        console.error(`[AuctionCloser] Error processing auction ${auction.id}:`, error);
      }
    }
  } catch (error) {
    console.error("[AuctionCloser] Error in processExpiredAuctions:", error);
  }
}

export function startAuctionCloser(intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout {
  console.log(`[AuctionCloser] Started with interval ${intervalMs / 1000} seconds`);
  
  processExpiredAuctions();
  processExpiredReviews();
  
  return setInterval(() => {
    processExpiredAuctions();
    processExpiredReviews();
  }, intervalMs);
}
