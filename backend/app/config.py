"""Application settings, read from environment variables (see .env.example)."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# Database: SQLite by default (zero setup). For MySQL/PostgreSQL set DATABASE_URL, e.g.
#   mysql+pymysql://user:password@localhost:3306/vidyamitra
#   postgresql+psycopg2://user:password@localhost:5432/vidyamitra
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'vidyamitra.db').as_posix()}")

JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-in-production")
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

UPLOAD_DIR = BASE_DIR / "uploads"
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))

# Plans
FREE_DOC_LIMIT = int(os.getenv("FREE_DOC_LIMIT", "3"))
FREE_DAILY_QUESTIONS = int(os.getenv("FREE_DAILY_QUESTIONS", "20"))
PRO_PRICE_INR = int(os.getenv("PRO_PRICE_INR", "199"))
PRO_DAYS = int(os.getenv("PRO_DAYS", "30"))

# Razorpay (optional). Leave empty to use the built-in demo payment mode.
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "").strip()
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "").strip()

# Optional LLM for generative answers (any OpenAI-compatible API, including a local Ollama server).
# Leave LLM_API_KEY empty to use the built-in offline answer engine.
LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

# Email (SMTP) for OTP verification. Leave SMTP_HOST empty to use demo mode, where the code is
# shown on screen and printed in the backend terminal instead of being emailed.
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM = os.getenv("SMTP_FROM", "").strip() or SMTP_USER
OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES", "10"))
OTP_RESEND_SECONDS = int(os.getenv("OTP_RESEND_SECONDS", "60"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
# If an email fails to send, show the code on screen so a live demo never gets stuck. Set to false in production.
OTP_DEMO_FALLBACK = os.getenv("OTP_DEMO_FALLBACK", "true").lower() == "true"

CORS_ORIGINS = [o.strip() for o in os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
