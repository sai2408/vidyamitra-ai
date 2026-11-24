from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from ..auth import create_token, get_current_user, hash_password, user_out, verify_password
from ..config import OTP_EXPIRE_MINUTES, OTP_RESEND_SECONDS
from ..database import get_db
from ..models import User
from ..services.mailer import EmailSendError, send_otp
from ..services.otp import check_otp, issue_otp

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class VerifyIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendIn(BaseModel):
    email: EmailStr
    purpose: Literal["verify", "reset"] = "verify"


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=6, max_length=128)


def _deliver(db: Session, user: User, purpose: str) -> dict:
    code = issue_otp(db, user.email, purpose)
    try:
        delivery = send_otp(user.email, user.name, code, purpose)
    except EmailSendError as e:
        raise HTTPException(502, str(e))
    return {**delivery, "expires_minutes": OTP_EXPIRE_MINUTES, "resend_seconds": OTP_RESEND_SECONDS}


@router.post("/register")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    user = db.query(User).filter(User.email == email).first()
    if user and user.is_verified:
        raise HTTPException(400, "An account with this email already exists.")
    if user:  # registered earlier but never verified: update details and send a fresh code
        user.name, user.password_hash = data.name.strip(), hash_password(data.password)
    else:
        user = User(name=data.name.strip(), email=email, password_hash=hash_password(data.password), is_verified=False)
        db.add(user)
    db.commit()
    db.refresh(user)
    try:
        delivery = _deliver(db, user, "verify")
    except HTTPException as e:
        if e.status_code != 429:
            raise
        delivery = {"mode": "cooldown", "message": e.detail["message"], "resend_seconds": e.detail["retry_after"]}
    return {"needs_verification": True, "email": email, "delivery": delivery}


@router.post("/verify-email")
def verify_email(data: VerifyIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(404, "No account found for this email.")
    if not user.is_verified:
        check_otp(db, email, "verify", data.code)
        user.is_verified = True
        db.commit()
        db.refresh(user)
    return {"token": create_token(user), "user": user_out(user)}


@router.post("/resend-otp")
def resend_otp(data: ResendIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or (data.purpose == "verify" and user.is_verified):
        return {"ok": True, "delivery": None}  # don't reveal which emails exist
    return {"ok": True, "delivery": _deliver(db, user, data.purpose)}


@router.post("/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password.")
    if not user.is_active:
        raise HTTPException(403, "This account has been deactivated. Contact the administrator.")
    if not user.is_verified:
        raise HTTPException(403, {"message": "Please verify your email to continue. We'll send you a new code.",
                                  "code": "EMAIL_NOT_VERIFIED", "email": user.email})
    return {"token": create_token(user), "user": user_out(user)}


@router.post("/forgot-password")
def forgot_password(data: ForgotIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    user = db.query(User).filter(User.email == email).first()
    # Same reply whether or not the account exists, so the form can't be used to discover emails.
    delivery = _deliver(db, user, "reset") if user and user.is_active else {"mode": "email"}
    return {"ok": True, "message": "If an account exists for this email, a reset code has been sent.",
            "delivery": {**delivery, "expires_minutes": OTP_EXPIRE_MINUTES, "resend_seconds": OTP_RESEND_SECONDS}}


@router.post("/reset-password")
def reset_password(data: ResetIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(400, "No active code. Please request a new one.")
    check_otp(db, email, "reset", data.code)
    user.password_hash = hash_password(data.new_password)
    user.is_verified = True  # they proved they own the email
    db.commit()
    return {"ok": True, "message": "Password updated. You can now log in with your new password."}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_out(user)
