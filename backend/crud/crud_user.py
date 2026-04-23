# crud/crud_user.py
from sqlalchemy.orm import Session
from database import models
from schemas import user as user_schemas

def get_user(db: Session, user_id: int):
    """Fetch a single user by their ID."""
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    """Check if an email is already registered."""
    return db.query(models.User).filter(models.User.email == email).first()

# crud/crud_user.py (Snippet)
# Update your existing create_user function to look like this:

def create_user(db: Session, user: user_schemas.UserCreate, hashed_password: str):
    db_user = models.User(
        name=user.name,
        email=user.email,
        unipd_id=user.unipd_id,
        hashed_password=hashed_password,
        is_verified=False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
