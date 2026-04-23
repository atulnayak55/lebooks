import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { Listing } from "../types/domain";
import { formatEuro } from "../utils/format";
import { backendBaseUrl } from "../lib/api";

type ListingCardProps = {
  listing: Listing;
  onMessageClick?: (listing: Listing) => void;
};

export function ListingCard({ listing, onMessageClick }: ListingCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { locale, t } = useI18n();

  const imageUrls = useMemo(
    () => listing.images.map((image) => `${backendBaseUrl}${image.image_url}`),
    [listing.images],
  );

  const hasImages = imageUrls.length > 0;
  const firstImage = hasImages ? imageUrls[0] : null;
  const activeImage = hasImages ? imageUrls[activeImageIndex] : null;
  const conditionLabel = t(`card.condition.${listing.condition}`);
  const listedDate = new Date(listing.created_at);
  const listedLabel = Number.isNaN(listedDate.getTime())
    ? t("card.recentlyListed")
    : t("card.listedOn", {
        date: listedDate.toLocaleDateString(locale, { month: "short", day: "numeric" }),
      });

  function openLightbox(index: number) {
    if (!hasImages) {
      return;
    }
    setActiveImageIndex(index);
    setLightboxOpen(true);
  }

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const showPreviousImage = useCallback(() => {
    if (!hasImages) {
      return;
    }
    setActiveImageIndex((currentIndex) =>
      currentIndex === 0 ? imageUrls.length - 1 : currentIndex - 1,
    );
  }, [hasImages, imageUrls.length]);

  const showNextImage = useCallback(() => {
    if (!hasImages) {
      return;
    }
    setActiveImageIndex((currentIndex) =>
      currentIndex === imageUrls.length - 1 ? 0 : currentIndex + 1,
    );
  }, [hasImages, imageUrls.length]);

  useEffect(() => {
    if (!lightboxOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        showPreviousImage();
      } else if (event.key === "ArrowRight") {
        showNextImage();
      } else if (event.key === "Escape") {
        closeLightbox();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeLightbox, lightboxOpen, showNextImage, showPreviousImage]);

  return (
    <article className="listing-card">
      <div className="listing-card-topline">
        <span className="listing-tag listing-tag-primary">{conditionLabel}</span>
        <span className="listing-tag">
          {hasImages
            ? t(imageUrls.length === 1 ? "card.photoCount_one" : "card.photoCount_other", {
                count: imageUrls.length,
              })
            : t("card.textbookOnly")}
        </span>
      </div>

      <button
        type="button"
        className="listing-image-shell"
        onClick={() => openLightbox(0)}
        disabled={!hasImages}
        aria-label={
          hasImages ? t("card.openImage", { title: listing.title }) : t("card.noImageAvailable")
        }
      >
        {firstImage ? (
          <img
            src={firstImage}
            alt={listing.title}
            className="listing-image-preview"
          />
        ) : (
          <span className="listing-image-empty">{t("card.noImage")}</span>
        )}
      </button>

      <div className="listing-head">
        <h2>{listing.title}</h2>
        <p className="listing-price">{formatEuro(listing.price, locale)}</p>
      </div>
      <p className="listing-stamp">{listedLabel}</p>
      <p className="listing-description">
        {listing.description?.trim() || t("card.noDescription")}
      </p>
      <div className="listing-footer">
        <p className="listing-seller">{t("card.seller", { name: listing.seller.name })}</p>
        <span className="listing-seller-chip">{t("card.studentListed")}</span>
      </div>
      {onMessageClick && (
        <button
          className="listing-action"
          onClick={() => onMessageClick(listing)}
        >
          {t("card.contactSeller")}
        </button>
      )}

      {lightboxOpen && activeImage ? (
        <div className="listing-lightbox" role="dialog" aria-modal="true" aria-label={t("card.listingImages")}>
          <button type="button" className="listing-lightbox-backdrop" onClick={closeLightbox} />
          <div className="listing-lightbox-content">
            <button
              type="button"
              className="listing-lightbox-close"
              onClick={closeLightbox}
              aria-label={t("card.closeImageViewer")}
            >
              x
            </button>

            {imageUrls.length > 1 ? (
              <button
                type="button"
                className="listing-lightbox-arrow listing-lightbox-arrow-left"
                onClick={showPreviousImage}
                aria-label={t("card.previousImage")}
              >
                {"<"}
              </button>
            ) : null}

            <img src={activeImage} alt={listing.title} className="listing-lightbox-image" />

            {imageUrls.length > 1 ? (
              <button
                type="button"
                className="listing-lightbox-arrow listing-lightbox-arrow-right"
                onClick={showNextImage}
                aria-label={t("card.nextImage")}
              >
                {">"}
              </button>
            ) : null}

            {imageUrls.length > 1 ? (
              <p className="listing-lightbox-counter">
                {activeImageIndex + 1} / {imageUrls.length}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
