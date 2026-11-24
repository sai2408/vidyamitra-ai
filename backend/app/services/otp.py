"""One-time passwords: 6 digits, stored only as a keyed hash, with expiry, attempt limits and a resend cooldown."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..config import JWT_SECRET, OTP_EXPIRE_MINUTES, OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS
from ..models import EmailOTP


def _hash(email: str, purpose: str, code: str) -> str:
    return hmac.new(JWT_SECRET.encode(), f"{email}|{purpose}|{code}".encode(), hashlib.sha256).hexdigest()


def issue_otp(db: Session, email: str, purpose: str) -> str:
    """Creates a new code (invalidating older ones). Raises 429 if asked again within the cooldown."""
    now = datetime.utcnow()
    latest = (db.query(EmailOTP).filter(EmailOTP.email == email, EmailOTP.purpose == purpose)
              .order_by(EmailOTP.created_at.desc()).first())
    if latest and (now - latest.created_at).total_seconds() < OTP_RESEND_SECONDS:
        wait = OTP_RESEND_SECONDS - int((now - latest.created_at).total_seconds())
        raise HTTPException(429, {"message": f"Please wait {wait} seconds before requesting a new code.",
                                  "code": "COOLDOWN", "retry_after": wait})
    db.query(EmailOTP).filter(EmailOTP.email == email, EmailOTP.purpose == purpose,
                              EmailOTP.used.is_(False)).update({"used": True})
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(EmailOTP(email=email, purpose=purpose, code_hash=_hash(email, purpose, code),
                    expires_at=now + timedelta(minutes=OTP_EXPIRE_MINUTES)))
    db.commit()
    return code


def check_otp(db: Session, email: str, purpose: str, code: str) -> None:
    """Validates and consumes a code, or raises a clear 400 error."""
    otp = (db.query(EmailOTP).filter(EmailOTP.email == email, EmailOTP.purpose == purpose, EmailOTP.used.is_(False))
           .order_by(EmailOTP.created_at.desc()).first())
    if not otp:
        raise HTTPException(400, "No active code. Please request a new one.")
    if otp.expires_at < datetime.utcnow():
        otp.used = True
        db.commit()
        raise HTTPException(400, "This code has expired. Please request a new one.")
    if otp.attempts >= OTP_MAX_ATTEMPTS:
        otp.used = True
        db.commit()
        raise HTTPException(400, "Too many wrong attempts. Please request a new code.")
    if not hmac.compare_digest(otp.code_hash, _hash(email, purpose, code.strip())):
        otp.attempts += 1
        left = OTP_MAX_ATTEMPTS - otp.attempts
        if left <= 0:
            otp.used = True
        db.commit()
        raise HTTPException(400, f"Incorrect code. {left} attempt{'s' if left != 1 else ''} left." if left > 0
                            else "Too many wrong attempts. Please request a new code.")
    otp.used = True
    db.commit()
