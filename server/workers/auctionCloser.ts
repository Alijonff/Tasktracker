import { calculateAuctionPrice, getBidValue, selectWinningBid, shouldAutoAssignToCreator } from "../businessRules";
import { storage } from "../storage";
import { getTaskMetadata } from "../taskMetadataStore";

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

function formatAssignedSum(value: number | null, fallback: string | null, mode: string = "MONEY"): string | null {
  if (value === null || Number.isNaN(value)) {
    return fallback;
  }
  if (mode === "TIME") {
    return Math.round(value).toString();
  }
  return value.toFixed(2);
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
        const metadata = getTaskMetadata(auction.id);
        const bids = await storage.getTaskBids(auction.id);
        const now = new Date();

        if (bids.length === 0) {
          if (!shouldAutoAssignToCreator(auction, now)) {
            continue;
          }

          const calculatedPrice = calculateAuctionPrice(auction, now);
          const assignedSum = formatAssignedSum(
            calculatedPrice,
            auction.auctionMaxSum ?? auction.auctionInitialSum ?? null,
            metadata.mode,
          );

          await storage.closeAuction(auction.id, {
            winnerId: auction.creatorId,
            winnerName: auction.creatorName,
            assignedSum: assignedSum ?? undefined,
            endAt: now,
          });

          console.log(
            `[AuctionCloser] Closed auction ${auction.id} without bids, assigned to creator ${auction.creatorName}`
          );
        } else {
          const winningBid = selectWinningBid(bids, metadata.mode);
          if (!winningBid) {
            continue;
          }

          const assignedValue = getBidValue(winningBid, metadata.mode);

          await storage.closeAuction(auction.id, {
            winnerId: winningBid.bidderId,
            winnerName: winningBid.bidderName,
            assignedSum: formatAssignedSum(assignedValue, auction.auctionMaxSum ?? null, metadata.mode) ?? undefined,
            endAt: now,
          });

          console.log(
            `[AuctionCloser] Closed auction ${auction.id}, winner: ${winningBid.bidderName} with bid ${assignedValue}`
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
