# routers/listings.py
import shutil
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from crud import crud_listing
from database import models
from database.database import get_db
from routers.auth import get_current_user
from schemas import listing as listing_schemas

router = APIRouter(prefix="/listings", tags=["Marketplace Listings"])
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"


@router.post("/", response_model=listing_schemas.ListingResponse, status_code=status.HTTP_201_CREATED)
def create_listing(
    listing: listing_schemas.ListingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Post a new book for sale."""
    if listing.subject_id is not None:
        subject = db.query(models.Subject).filter(models.Subject.id == listing.subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")

    return crud_listing.create_listing(db=db, listing=listing, seller_id=current_user.id)


@router.get("/", response_model=List[listing_schemas.ListingResponse])
def read_listings(
    skip: int = 0,
    limit: int = 50,
    subject_id: Optional[int] = None,
    seller_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """View the marketplace with an optional subject filter."""
    return crud_listing.get_listings(
        db,
        skip=skip,
        limit=limit,
        subject_id=subject_id,
        seller_id=seller_id,
    )


@router.get("/{listing_id}", response_model=listing_schemas.ListingResponse)
def read_listing(listing_id: int, db: Session = Depends(get_db)):
    """View a single listing's details."""
    db_listing = crud_listing.get_listing(db, listing_id=listing_id)
    if db_listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return db_listing


@router.post("/{listing_id}/images", response_model=listing_schemas.ListingImageResponse)
def upload_listing_image(
    listing_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Upload an image for a specific listing owned by the current user."""
    listing = crud_listing.get_listing(db, listing_id)
    if not listing or listing.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this listing")

    filename = file.filename or "upload"
    file_extension = filename.split(".")[-1] if "." in filename else "bin"
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / unique_filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    db_image = models.ListingImage(image_url=f"/uploads/{unique_filename}", listing_id=listing_id)
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Delete a listing. Only the seller is authorized."""
    db_listing = crud_listing.get_listing(db, listing_id)
    if not db_listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if db_listing.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this listing")

    db.delete(db_listing)
    db.commit()
    return None
