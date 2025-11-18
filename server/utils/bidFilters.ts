import { type AuctionBid } from "../../shared/schema";
import { storage } from "../storage";

export async function filterOutAdminBids(bids: AuctionBid[]): Promise<AuctionBid[]> {
  if (bids.length === 0) {
    return [];
  }

  const bidderIds = Array.from(new Set(bids.map((bid) => bid.bidderId)));
  const bidders = await Promise.all(bidderIds.map((bidderId) => storage.getUserById(bidderId)));

  const adminIds = new Set(
    bidders
      .filter((bidder): bidder is NonNullable<typeof bidder> => Boolean(bidder))
      .filter((bidder) => bidder.role === "admin")
      .map((bidder) => bidder.id),
  );

  if (adminIds.size === 0) {
    return bids;
  }

  return bids.filter((bid) => !adminIds.has(bid.bidderId));
}

export async function isAdminUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) {
    return false;
  }

  const user = await storage.getUserById(userId);
  return user?.role === "admin";
}
