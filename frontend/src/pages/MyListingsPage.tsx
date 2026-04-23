import { useEffect, useState } from "react";

import type { AuthSession } from "../features/auth/session";
import { deleteListing, fetchListings } from "../features/listings/api";
import { isOwnListing } from "../features/listings/filter";
import { backendBaseUrl } from "../lib/api";
import type { Listing } from "../types/domain";
import { formatEuro } from "../utils/format";

type MyListingsPageProps = {
  session: AuthSession | null;
};

export function MyListingsPage({ session }: MyListingsPageProps) {
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMyListings() {
      if (!session) {
        setMyListings([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await fetchListings(undefined, session.userId);
        setMyListings(data.filter((listing) => isOwnListing(listing, session.userId)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    void loadMyListings();
  }, [session]);

  async function handleDelete(listingId: number) {
    if (!session) return;

    const confirmed = window.confirm("Are you sure you want to delete this listing?");
    if (!confirmed) return;

    try {
      await deleteListing(listingId, session.token);
      setMyListings((prev) => prev.filter((listing) => listing.id !== listingId));
    } catch {
      alert("Failed to delete listing.");
    }
  }

  if (!session) {
    return <p className="inbox-empty">Please sign in to view your listings.</p>;
  }

  if (loading) {
    return <p className="inbox-empty">Loading your books...</p>;
  }

  return (
    <div className="listings-page">
      {myListings.length === 0 ? (
        <div className="status-message">
          <p className="status-title">You do not have any active listings.</p>
          <p className="status-subtitle">Head to Marketplace to sell a book.</p>
        </div>
      ) : (
        <div className="listings-grid">
          {myListings.map((listing) => (
            <article key={listing.id} className="listing-card">
              <div className="listing-image-shell" style={{ cursor: "default" }}>
                {listing.images.length > 0 ? (
                  <img
                    src={`${backendBaseUrl}${listing.images[0].image_url}`}
                    alt={listing.title}
                    className="listing-image-preview"
                  />
                ) : (
                  <span className="listing-image-empty">No image</span>
                )}
              </div>

              <div className="listing-head">
                <h2>{listing.title}</h2>
                <p className="listing-price">{formatEuro(listing.price)}</p>
              </div>
              <p className="listing-condition">Condition: {listing.condition}</p>

              <button
                type="button"
                className="my-listings-delete"
                onClick={() => handleDelete(listing.id)}
              >
                Delete Listing
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
