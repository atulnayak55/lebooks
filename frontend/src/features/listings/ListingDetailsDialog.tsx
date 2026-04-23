import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { backendBaseUrl } from "../../lib/api";
import type { Listing } from "../../types/domain";
import { formatEuro } from "../../utils/format";

type ListingDetailsDialogProps = {
  listing: Listing | null;
  open: boolean;
  onClose: () => void;
  onMessageClick?: (listing: Listing) => void;
};

export function ListingDetailsDialog({
  listing,
  open,
  onClose,
  onMessageClick,
}: ListingDetailsDialogProps) {
  const { locale, t } = useI18n();
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const imageUrls = useMemo(() => {
    return listing ? listing.images.map((image) => `${backendBaseUrl}${image.image_url}`) : [];
  }, [listing]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveImageIndex(0);
  }, [listing?.id, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || !listing) {
    return null;
  }

  const activeImage = imageUrls[activeImageIndex] ?? null;
  const listedDate = new Date(listing.created_at);
  const listedLabel = Number.isNaN(listedDate.getTime())
    ? t("card.recentlyListed")
    : t("card.listedOn", {
        date: listedDate.toLocaleDateString(locale, { month: "short", day: "numeric" }),
      });

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true" aria-label={t("details.dialog")}>
      <div className="auth-dialog listing-details-dialog">
        <div className="listing-details-topbar">
          <div>
            <p className="listing-details-kicker">{t("details.about")}</p>
            <h2>{listing.title}</h2>
          </div>
          <button type="button" className="auth-close" onClick={onClose} aria-label={t("details.close")}>
            x
          </button>
        </div>

        <div className="listing-details-grid">
          <div className="listing-details-gallery">
            <div className="listing-details-image-shell">
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={t("details.galleryAlt", {
                    title: listing.title,
                    index: activeImageIndex + 1,
                  })}
                  className="listing-details-image"
                />
              ) : (
                <div className="listing-details-image-empty">{t("card.noImage")}</div>
              )}

              {imageUrls.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="listing-details-arrow listing-details-arrow-left"
                    onClick={() =>
                      setActiveImageIndex((currentIndex) =>
                        currentIndex === 0 ? imageUrls.length - 1 : currentIndex - 1,
                      )
                    }
                    aria-label={t("details.previousImage")}
                  >
                    {"<"}
                  </button>
                  <button
                    type="button"
                    className="listing-details-arrow listing-details-arrow-right"
                    onClick={() =>
                      setActiveImageIndex((currentIndex) =>
                        currentIndex === imageUrls.length - 1 ? 0 : currentIndex + 1,
                      )
                    }
                    aria-label={t("details.nextImage")}
                  >
                    {">"}
                  </button>
                </>
              ) : null}
            </div>

            {imageUrls.length > 1 ? (
              <p className="listing-details-counter">
                {t("details.imageCounter", {
                  current: activeImageIndex + 1,
                  total: imageUrls.length,
                })}
              </p>
            ) : null}
          </div>

          <div className="listing-details-copy">
            <div className="listing-details-meta">
              <span className="listing-tag listing-tag-primary">
                {t(`card.condition.${listing.condition}`)}
              </span>
              <span className="listing-tag">{listedLabel}</span>
            </div>

            <p className="listing-details-price">{formatEuro(listing.price, locale)}</p>
            <p className="listing-seller">{t("card.seller", { name: listing.seller.name })}</p>

            <div className="listing-details-description">
              <h3>{t("details.about")}</h3>
              <p>{listing.description?.trim() || t("details.descriptionFallback")}</p>
            </div>

            {onMessageClick ? (
              <button
                type="button"
                className="listing-action"
                onClick={() => onMessageClick(listing)}
              >
                {t("card.contactSeller")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
