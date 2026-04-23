# crud/crud_listing.py
from sqlalchemy.orm import Session
from database import models
from schemas import listing as listing_schemas

def get_listing(db: Session, listing_id: int):
    """Fetch a single listing by its ID."""
    return db.query(models.Listing).filter(models.Listing.id == listing_id).first()

def get_listings(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    subject_id: int = None,
    seller_id: int = None,
):
    """Fetch multiple listings, with optional filters for subjects or sellers."""
    query = db.query(models.Listing)

    if subject_id is not None:
        query = query.filter(models.Listing.subject_id == subject_id)
    if seller_id is not None:
        query = query.filter(models.Listing.seller_id == seller_id)

    return query.offset(skip).limit(limit).all()

def create_listing(db: Session, listing: listing_schemas.ListingCreate, seller_id: int):
    """Create a new book listing."""
    # Notice that seller_id is passed as a separate argument, NOT from the Pydantic schema.
    # This prevents users from "faking" who is selling the book.
    db_listing = models.Listing(
        title=listing.title,
        price=listing.price,
        condition=listing.condition,
        description=listing.description,
        subject_id=listing.subject_id,
        seller_id=seller_id
    )
    db.add(db_listing)
    db.commit()
    db.refresh(db_listing)
    return db_listing