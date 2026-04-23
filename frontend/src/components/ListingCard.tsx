import { useCallback, useEffect, useMemo, useState } from "react";
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

  const imageUrls = useMemo(
    () => listing.images.map((image) => `${backendBaseUrl}${image.image_url}`),
    [listing.images],
  );

  const hasImages = imageUrls.length > 0;
  const firstImage = hasImages ? imageUrls[0] : null;
  const activeImage = hasImages ? imageUrls[activeImageIndex] : null;

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
      <button
        type="button"
        className="listing-image-shell"
        onClick={() => openLightbox(0)}
        disabled={!hasImages}
        aria-label={hasImages ? `Open image for ${listing.title}` : "No listing image available"}
      >
        {firstImage ? (
          <img
            src={firstImage}
            alt={listing.title}
            className="listing-image-preview"
          />
        ) : (
          <span className="listing-image-empty">No image</span>
        )}
      </button>

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

      {lightboxOpen && activeImage ? (
        <div className="listing-lightbox" role="dialog" aria-modal="true" aria-label="Listing images">
          <button type="button" className="listing-lightbox-backdrop" onClick={closeLightbox} />
          <div className="listing-lightbox-content">
            <button
              type="button"
              className="listing-lightbox-close"
              onClick={closeLightbox}
              aria-label="Close image viewer"
            >
              x
            </button>

            {imageUrls.length > 1 ? (
              <button
                type="button"
                className="listing-lightbox-arrow listing-lightbox-arrow-left"
                onClick={showPreviousImage}
                aria-label="Show previous image"
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
                aria-label="Show next image"
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
