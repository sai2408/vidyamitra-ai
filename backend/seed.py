"""Creates demo accounts and preloads sample notes so the project can be demonstrated immediately.

Run once from the backend folder:   python seed.py
Safe to run again: existing accounts and documents are kept.
"""
import shutil
import uuid
from pathlib import Path

from app.auth import hash_password
from app.config import UPLOAD_DIR
from app.database import SessionLocal
from app.migrate import migrate
from app.models import Document, User
from app.services.ingest import ingest_file

SAMPLES = Path(__file__).resolve().parent.parent / "sample_data"
PRELOAD = [("Operating_Systems_CPU_Scheduling.pdf", "Operating Systems: CPU Scheduling"),
           ("DBMS_Normalization.pdf", "DBMS: Normalization")]

ACCOUNTS = [
    {"name": "Admin", "email": "admin@vidyamitra.ai", "password": "Admin@123", "role": "admin"},
    {"name": "Demo Student", "email": "student@vidyamitra.ai", "password": "Student@123", "role": "student"},
]


def main():
    migrate()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    try:
        users = {}
        for a in ACCOUNTS:
            user = db.query(User).filter(User.email == a["email"]).first()
            if not user:
                user = User(name=a["name"], email=a["email"], password_hash=hash_password(a["password"]), role=a["role"],
                            is_verified=True)
                db.add(user)
                db.commit()
                db.refresh(user)
                print(f"Created {a['role']:7s} account: {a['email']} / {a['password']}")
            else:
                if not user.is_verified:
                    user.is_verified = True
                    db.commit()
                print(f"Account already exists: {a['email']}")
            users[a["role"]] = user

        student = users["student"]
        for fname, title in PRELOAD:
            if db.query(Document).filter(Document.user_id == student.id, Document.title == title).first():
                print(f"Sample already loaded: {title}")
                continue
            src = SAMPLES / fname
            if not src.exists():
                print(f"Sample file missing, skipped: {src}")
                continue
            dest = UPLOAD_DIR / f"{uuid.uuid4().hex}{src.suffix}"
            shutil.copy(src, dest)
            doc = ingest_file(db, student, dest, title)
            print(f"Loaded sample notes: {doc.title} ({doc.pages} pages, {len(doc.chunks)} chunks)")
        print("\nSeeding complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
