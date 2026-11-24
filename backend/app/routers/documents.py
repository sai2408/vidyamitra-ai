import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..auth import effective_plan, get_current_user
from ..config import FREE_DOC_LIMIT, MAX_UPLOAD_MB, UPLOAD_DIR
from ..database import get_db
from ..models import Document, User
from ..services.ingest import IngestError, extract_pages, ingest_file

router = APIRouter(prefix="/api/documents", tags=["documents"])


def doc_out(d: Document, detail: bool = False) -> dict:
    out = {"id": d.id, "title": d.title, "file_type": d.file_type, "pages": d.pages,
           "word_count": d.word_count, "key_terms": json.loads(d.key_terms or "[]"),
           "created_at": d.created_at.isoformat()}
    if detail:
        out.update({"summary": d.summary, "chunks": len(d.chunks),
                    "reading_minutes": max(1, round(d.word_count / 200))})
    return out


def get_owned(db: Session, user: User, doc_id: int) -> Document:
    doc = db.get(Document, doc_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(404, "Document not found.")
    return doc


@router.get("")
def list_documents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.user_id == user.id).order_by(Document.created_at.desc()).all()
    return [doc_out(d) for d in docs]


@router.post("")
async def upload_document(file: UploadFile = File(...), title: str = Form(""),
                          user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validate the file first, so users see the real problem (wrong type, no text) before the plan limit.
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in (".pdf", ".txt"):
        raise HTTPException(400, "Only PDF and TXT files are supported.")
    content = await file.read()
    if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(400, f"File is too large. The limit is {MAX_UPLOAD_MB} MB.")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    path = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"
    path.write_bytes(content)
    doc_title = title.strip() or Path(file.filename).stem.replace("_", " ").replace("-", " ").strip()
    try:
        extract_pages(path)  # raises IngestError for unreadable or text-less files
        count = db.query(Document).filter(Document.user_id == user.id).count()
        if effective_plan(user) == "free" and count >= FREE_DOC_LIMIT:
            path.unlink(missing_ok=True)
            raise HTTPException(403, f"The Free plan allows {FREE_DOC_LIMIT} documents. Upgrade to Pro for unlimited uploads.")
        doc = ingest_file(db, user, path, doc_title)
    except IngestError as e:
        path.unlink(missing_ok=True)
        raise HTTPException(400, str(e))
    return doc_out(doc, detail=True)


@router.get("/{doc_id}")
def get_document(doc_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return doc_out(get_owned(db, user, doc_id), detail=True)


@router.delete("/{doc_id}")
def delete_document(doc_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = get_owned(db, user, doc_id)
    (UPLOAD_DIR / doc.filename).unlink(missing_ok=True)
    db.delete(doc)
    db.commit()
    return {"ok": True}
