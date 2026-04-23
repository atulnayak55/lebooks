import type { Listing } from "../../types/domain";

export function listingSellerId(listing: Listing): number | undefined {
  const rawSellerId = listing.seller_id ?? listing.seller?.id;
  const sellerId = Number(rawSellerId);
  return Number.isFinite(sellerId) ? sellerId : undefined;
}

export function isOwnListing(listing: Listing, userId: number): boolean {
  return listingSellerId(listing) === userId;
}
