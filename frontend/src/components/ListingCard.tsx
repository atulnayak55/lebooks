import type { Listing } from "../types/domain";
import { formatEuro } from "../utils/format";

type ListingCardProps = {
  listing: Listing;
  onMessageClick?: (listing: Listing) => void;
};

export function ListingCard({ listing, onMessageClick }: ListingCardProps) {
  return (
    <article className="listing-card">
      <div className="listing-head">
        <h2>{listing.title}</h2>
        <p className="listing-price">{formatEuro(listing.price)}</p>
      </div>
      <p className="listing-condition">Condition: {listing.condition}</p>
      <p className="listing-description">
        {listing.description?.trim() || "No description provided."}
      </p>
      <p className="listing-seller">Seller: {listing.seller.name}</p>
      {onMessageClick && (
        <button
          className="sell-book-button"
          style={{ marginTop: "0.5rem", width: "100%" }}
          onClick={() => onMessageClick(listing)}
        >
          Contact Seller
        </button>
      )}
    </article>
  );
}
