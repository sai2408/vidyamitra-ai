"""Sends OTP emails over SMTP (e.g. Gmail). Without SMTP settings it runs in demo mode:
the code is printed in the backend terminal and returned to the screen instead of emailed."""
import logging
import smtplib
import ssl
from email.message import EmailMessage

from ..config import (OTP_DEMO_FALLBACK, OTP_EXPIRE_MINUTES, SMTP_FROM, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT,
                      SMTP_USER)

log = logging.getLogger("vidyamitra.mail")

SUBJECTS = {"verify": "Your VidyaMitra AI verification code", "reset": "Reset your VidyaMitra AI password"}
INTROS = {"verify": "Use this code to verify your email and activate your account.",
          "reset": "Use this code to reset your password. If you didn't ask for this, you can ignore this email."}


class EmailSendError(RuntimeError):
    pass


def smtp_enabled() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def _build(to: str, name: str, code: str, purpose: str) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = SUBJECTS[purpose]
    msg["From"] = f"VidyaMitra AI <{SMTP_FROM}>"
    msg["To"] = to
    msg.set_content(f"Hi {name},\n\n{INTROS[purpose]}\n\nYour code: {code}\n\n"
                    f"It expires in {OTP_EXPIRE_MINUTES} minutes. Never share this code with anyone.\n\n- VidyaMitra AI")
    msg.add_alternative(f"""\
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
  <h2 style="color:#2554E6;margin:0 0 16px">VidyaMitra AI</h2>
  <p>Hi {name},</p>
  <p>{INTROS[purpose]}</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#EEF4FF;color:#13245E;padding:16px;text-align:center;border-radius:8px">{code}</p>
  <p style="color:#64748b;font-size:13px">This code expires in {OTP_EXPIRE_MINUTES} minutes. Never share it with anyone.</p>
</div>""", subtype="html")
    return msg


def send_otp(to: str, name: str, code: str, purpose: str) -> dict:
    """Returns how the code was delivered: {"mode": "email"} or {"mode": "demo", "demo_code": ...}."""
    if smtp_enabled():
        try:
            msg = _build(to, name, code, purpose)
            ctx = ssl.create_default_context()
            if SMTP_PORT == 465:
                with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx, timeout=20) as s:
                    s.login(SMTP_USER, SMTP_PASSWORD)
                    s.send_message(msg)
            else:
                with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
                    s.starttls(context=ctx)
                    s.login(SMTP_USER, SMTP_PASSWORD)
                    s.send_message(msg)
            return {"mode": "email"}
        except Exception as e:  # network blocked, wrong password, etc.
            log.warning("OTP email to %s failed: %s", to, e)
            print(f"[VidyaMitra] Email sending failed ({e}).", flush=True)
            if not OTP_DEMO_FALLBACK:
                raise EmailSendError("We couldn't send the verification email. Please try again later.")
            print(f"[VidyaMitra] DEMO OTP for {to} ({purpose}): {code}", flush=True)
            return {"mode": "demo", "demo_code": code, "email_failed": True}
    print(f"[VidyaMitra] DEMO OTP for {to} ({purpose}): {code}", flush=True)
    return {"mode": "demo", "demo_code": code}
