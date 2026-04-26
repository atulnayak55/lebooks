from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt

from database.database import get_db
from database import models
from crud import crud_user
from core.security import verify_password, create_access_token, SECRET_KEY, ALGORITHM
from core.security import get_password_hash
from schemas import auth as auth_schemas
from schemas import user as user_schemas
from services.email import send_password_reset_email, send_signup_otp_email
from services.pending_signup import (
    create_or_replace_pending_signup,
    resend_pending_signup_otp,
    verify_pending_signup,
)
from services.user_security import (
    EmailNotValidError,
    RESET_PASSWORD_PURPOSE,
    build_reset_password_expiry,
    consume_token,
    create_auth_token,
    normalize_email,
    revoke_tokens,
    validate_signup_email,
)

router = APIRouter(tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def normalize_email_or_400(email: str) -> str:
    try:
        return normalize_email(email)
    except EmailNotValidError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. Find user
    try:
        normalized_email = normalize_email(form_data.username)
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    user = crud_user.get_user_by_email(db, email=normalized_email)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    # 2. Verify password
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your email before signing in")

    # 3. Create the real JWT! We embed the user's email inside it (the "sub" / subject)
    access_token = create_access_token(data={"sub": user.email})

    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": user.id
    }


def get_user_from_token(token: str, db: Session):
    """Decode a JWT, verify the signature, and fetch the user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode the token using our secret key
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        # If the token is fake, expired, or tampered with, this triggers
        raise credentials_exception
        
    # Fetch the user using the email safely extracted from the verified token
    user = crud_user.get_user_by_email(db, email=email)
    if not user:
        raise credentials_exception
        
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """FastAPI dependency for authenticated HTTP routes."""
    return get_user_from_token(token=token, db=db)


@router.post("/auth/signup/start", response_model=auth_schemas.VerificationTokenResponse)
def start_signup(
    payload: auth_schemas.SignupStartRequest,
    db: Session = Depends(get_db),
):
    try:
        normalized_email = validate_signup_email(payload.email)
    except EmailNotValidError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    existing_user = crud_user.get_user_by_email(db, email=normalized_email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    if payload.unipd_id:
        existing_unipd_id = db.query(models.User).filter(models.User.unipd_id == payload.unipd_id).first()
        if existing_unipd_id:
            raise HTTPException(status_code=400, detail="Unipd ID already registered")

    pending_signup, otp_code = create_or_replace_pending_signup(
        db,
        name=payload.name,
        email=normalized_email,
        unipd_id=payload.unipd_id,
        hashed_password=get_password_hash(payload.password),
    )
    send_signup_otp_email(
        recipient_email=pending_signup.email,
        recipient_name=pending_signup.name,
        otp_code=otp_code,
    )
    return {
        "message": "Verification code sent",
        "expires_at": pending_signup.expires_at,
    }


@router.post("/auth/signup/verify", response_model=user_schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def verify_signup_otp(
    payload: auth_schemas.SignupVerifyRequest,
    db: Session = Depends(get_db),
):
    normalized_email = normalize_email_or_400(payload.email)
    pending_signup = verify_pending_signup(db, email=normalized_email, otp_code=payload.otp_code)
    if not pending_signup:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    if crud_user.get_user_by_email(db, email=pending_signup.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    if pending_signup.unipd_id:
        existing_unipd_id = db.query(models.User).filter(models.User.unipd_id == pending_signup.unipd_id).first()
        if existing_unipd_id:
            raise HTTPException(status_code=400, detail="Unipd ID already registered")

    created_user = crud_user.create_user(
        db=db,
        user=user_schemas.UserCreate(
            name=pending_signup.name,
            email=pending_signup.email,
            unipd_id=pending_signup.unipd_id,
            password="verified-via-otp",
        ),
        hashed_password=pending_signup.hashed_password,
    )
    created_user.is_verified = True
    created_user.email_verified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(created_user)
    return created_user


@router.post("/auth/signup/resend-otp", response_model=auth_schemas.VerificationTokenResponse)
def resend_signup_otp(
    payload: auth_schemas.ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    normalized_email = normalize_email_or_400(payload.email)
    if crud_user.get_user_by_email(db, email=normalized_email):
        raise HTTPException(status_code=400, detail="Email already registered")

    resend_result = resend_pending_signup_otp(db, email=normalized_email)
    if not resend_result:
        raise HTTPException(status_code=404, detail="No pending signup found for this email")
    pending_signup, otp_code = resend_result

    send_signup_otp_email(
        recipient_email=pending_signup.email,
        recipient_name=pending_signup.name,
        otp_code=otp_code,
    )
    return {
        "message": "Verification code resent",
        "expires_at": pending_signup.expires_at,
    }


@router.post("/auth/forgot-password", response_model=auth_schemas.MessageResponse)
def forgot_password(payload: auth_schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    normalized_email = normalize_email_or_400(payload.email)
    user = crud_user.get_user_by_email(db, email=normalized_email)
    if user:
        revoke_tokens(db, user_id=user.id, purpose=RESET_PASSWORD_PURPOSE)
        _, raw_token = create_auth_token(
            db,
            user_id=user.id,
            purpose=RESET_PASSWORD_PURPOSE,
            expires_at=build_reset_password_expiry(),
        )
        send_password_reset_email(recipient_email=user.email, recipient_name=user.name, token=raw_token)

    return {"message": "If an account exists for that email, a password reset link has been sent"}


@router.post("/auth/reset-password", response_model=auth_schemas.MessageResponse)
def reset_password(
    payload: auth_schemas.ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    db_token = consume_token(db, token=payload.token, purpose=RESET_PASSWORD_PURPOSE)
    if not db_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    user = db.query(models.User).filter(models.User.id == db_token.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = get_password_hash(payload.new_password)
    revoke_tokens(db, user_id=user.id, purpose=RESET_PASSWORD_PURPOSE)

    return {"message": "Password reset successfully"}
