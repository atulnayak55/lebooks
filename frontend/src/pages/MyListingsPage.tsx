import { useEffect, useState } from "react";

import type { AuthSession } from "../features/auth/session";
import { deleteListing, fetchListings } from "../features/listings/api";
import { isOwnListing } from "../features/listings/filter";
import { useI18n } from "../i18n/I18nProvider";
import { backendBaseUrl } from "../lib/api";
import type { Listing } from "../types/domain";
import { formatEuro } from "../utils/format";

type MyListingsPageProps = {
  session: AuthSession | null;
};

export function MyListingsPage({ session }: MyListingsPageProps) {
  const { locale, t } = useI18n();
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

    const confirmed = window.confirm(t("myListings.deleteConfirm"));
    if (!confirmed) return;

    try {
      await deleteListing(listingId, session.token);
      setMyListings((prev) => prev.filter((listing) => listing.id !== listingId));
    } catch {
      alert(t("myListings.deleteFailed"));
    }
  }

  if (!session) {
    return <p className="inbox-empty">{t("myListings.signInRequired")}</p>;
  }

  if (loading) {
    return <p className="inbox-empty">{t("myListings.loading")}</p>;
  }

  return (
    <div className="listings-page">
      {myListings.length === 0 ? (
        <div className="status-message">
          <p className="status-title">{t("myListings.empty")}</p>
          <p className="status-subtitle">{t("myListings.emptySubtitle")}</p>
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
                  <span className="listing-image-empty">{t("card.noImage")}</span>
                )}
              </div>

              <div className="listing-head">
                <h2>{listing.title}</h2>
                <p className="listing-price">{formatEuro(listing.price, locale)}</p>
              </div>
              <p className="listing-condition">
                {t("sell.condition")}: {t(`card.condition.${listing.condition}`)}
              </p>

              <button
                type="button"
                className="my-listings-delete"
                onClick={() => handleDelete(listing.id)}
              >
                {t("myListings.delete")}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
