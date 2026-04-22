# routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database.database import get_db
from crud import crud_user
from core.security import verify_password
from fastapi.security import OAuth2PasswordBearer
router = APIRouter(tags=["Authentication"])

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. Find user
    user = crud_user.get_user_by_email(db, email=form_data.username)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    # 2. Verify password
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    # 3. Return dummy token (We will upgrade this to a real JWT later)
    return {"access_token": user.email, "token_type": "bearer", "user_id": user.id}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Reads the token (currently the email) and fetches the user from the database."""
    user = crud_user.get_user_by_email(db, email=token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user