# routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.database import get_db
from database import models
from schemas import user as user_schemas
from crud import crud_user
from core.security import get_password_hash

# The prefix="/users" means every route in this file automatically starts with /users
router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/", response_model=user_schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: user_schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Register a new student.
    """
    # 1. Check if the email is already registered in the database
    db_user = crud_user.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Email already registered"
        )

    if user.unipd_id:
        existing_unipd_id = db.query(models.User).filter(models.User.unipd_id == user.unipd_id).first()
        if existing_unipd_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unipd ID already registered"
            )
    
    # 2. Hash the raw password before saving it
    hashed_password = get_password_hash(user.password)
    
    # 3. Save the new user to Postgres
    return crud_user.create_user(db=db, user=user, hashed_password=hashed_password)


@router.get("/{user_id}", response_model=user_schemas.UserResponse)
def read_user(user_id: int, db: Session = Depends(get_db)):
    """
    Fetch a specific student's public profile by their ID.
    """
    db_user = crud_user.get_user(db, user_id=user_id)
    
    # If no user is found with that ID, return a 404 error
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
        
    return db_user
