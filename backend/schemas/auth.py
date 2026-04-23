from datetime import datetime

from pydantic import BaseModel, EmailStr


class MessageResponse(BaseModel):
    message: str


class SignupStartRequest(BaseModel):
    name: str
    email: EmailStr
    unipd_id: str | None = None
    password: str


class SignupVerifyRequest(BaseModel):
    email: EmailStr
    otp_code: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class VerificationTokenResponse(BaseModel):
    message: str
    expires_at: datetime
