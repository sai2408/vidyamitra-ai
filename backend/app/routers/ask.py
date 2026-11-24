import json
from datetime import datetime, time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import effective_plan, get_current_user
from ..config import FREE_DAILY_QUESTIONS
from ..database import get_db
from ..models import Chunk, Document, QuestionLog, User
from ..services.llm import generate_answer, llm_enabled
from ..services.nlp import answer_question, suggestion_terms

router = APIRouter(prefix="/api/ask", tags=["ask"])


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    document_ids: list[int] = []


def questions_today(db: Session, user: User) -> int:
    start = datetime.combine(datetime.utcnow().date(), time.min)
    return db.query(QuestionLog).filter(QuestionLog.user_id == user.id, QuestionLog.created_at >= start).count()


def log_out(q: QuestionLog) -> dict:
    return {"id": q.id, "question": q.question, "answer": q.answer, "confidence": round(q.confidence),
            "found": q.found, "mode": q.mode, "sources": json.loads(q.sources or "[]"),
            "created_at": q.created_at.isoformat()}


@router.post("")
def ask(data: AskIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if effective_plan(user) == "free" and questions_today(db, user) >= FREE_DAILY_QUESTIONS:
        raise HTTPException(403, f"You've used all {FREE_DAILY_QUESTIONS} free questions for today. Upgrade to Pro for unlimited questions.")
    query = db.query(Chunk, Document).join(Document).filter(Document.user_id == user.id)
    if data.document_ids:
        query = query.filter(Document.id.in_(data.document_ids))
    rows = query.order_by(Chunk.id).all()
    chunks = [{"id": c.id, "text": c.text, "page": c.page, "document_id": d.id, "document_title": d.title}
              for c, d in rows]
    result = answer_question(data.question.strip(), chunks)

    mode = "offline"
    if result["found"] and llm_enabled():
        generated = generate_answer(data.question, result.get("context", []))
        if generated:
            result["answer"], mode = generated, "llm"
    result.pop("context", None)

    log = QuestionLog(user_id=user.id, question=data.question.strip(), answer=result["answer"],
                      confidence=result["confidence"], found=result["found"], mode=mode,
                      sources=json.dumps(result["sources"]))
    db.add(log)
    db.commit()
    db.refresh(log)
    return {**result, "id": log.id, "mode": mode, "question": log.question, "created_at": log.created_at.isoformat()}


@router.get("/history")
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logs = (db.query(QuestionLog).filter(QuestionLog.user_id == user.id)
            .order_by(QuestionLog.created_at.desc()).limit(50).all())
    return [log_out(q) for q in logs]


@router.get("/suggestions")
def suggestions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.user_id == user.id).order_by(Document.created_at.desc()).limit(3).all()
    out = []
    for d in docs:
        text = " ".join(c.text for c in d.chunks)
        for t in suggestion_terms(text, json.loads(d.key_terms or "[]"), limit=2):
            out.append(f"What is {t}?")
    return out[:6]
