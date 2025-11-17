import { storage } from "../storage";
import { calculateAuctionPrice, selectWinningBid } from "../businessRules";

export async function processExpiredAuctions(): Promise<void> {
  try {
    const expiredAuctions = await storage.getAuctionsToClose();
    
    if (expiredAuctions.length === 0) {
      return;
    }
    
    console.log(`[AuctionCloser] Processing ${expiredAuctions.length} expired auctions`);
    
    for (const auction of expiredAuctions) {
      try {
        const bids = await storage.getTaskBids(auction.id);
        
        if (bids.length === 0) {
          const departmentUsers = await storage.getAllUsers({
            departmentId: auction.departmentId,
          });
          const director = departmentUsers.find((user) => user.role === "director");
          const winnerId = director?.id ?? auction.creatorId;
          const winnerName = director?.name ?? auction.creatorName;
          const currentValue = calculateAuctionPrice(auction, new Date()) ?? auction.auctionMaxSum ?? auction.auctionInitialSum ?? "0";

          await storage.closeAuction(
            auction.id,
            winnerId,
            winnerName,
            auction.auctionMode === "time" ? null : currentValue,
            auction.auctionMode === "time" ? Number(currentValue) : undefined,
          );

          console.log(
            `[AuctionCloser] Closed auction ${auction.id} without bids, assigned to director ${winnerName}`
          );
        } else {
          const winningBid = selectWinningBid(bids);
          if (!winningBid) continue;

          await storage.closeAuction(
            auction.id,
            winningBid.bidderId,
            winningBid.bidderName,
            winningBid.valueTimeMinutes != null ? null : winningBid.bidAmount,
            winningBid.valueTimeMinutes ?? undefined,
          );

          console.log(
            `[AuctionCloser] Closed auction ${auction.id}, winner: ${winningBid.bidderName} with bid ${winningBid.bidAmount}`
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
  
  return setInterval(() => {
    processExpiredAuctions();
  }, intervalMs);
}
