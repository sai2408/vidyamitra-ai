import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Document, Quiz, QuizAttempt, User
from ..services.ingest import document_pages
from ..services.quiz_gen import generate_quiz

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])


class QuizIn(BaseModel):
    document_id: int
    num_questions: int = Field(default=5, ge=3, le=15)


class SubmitIn(BaseModel):
    answers: dict[str, str]


def public_questions(questions: list[dict]) -> list[dict]:
    return [{"id": q["id"], "question": q["question"], "options": q["options"]} for q in questions]


@router.post("")
def create_quiz(data: QuizIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(Document, data.document_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(404, "Document not found.")
    previous = db.query(Quiz).filter(Quiz.user_id == user.id, Quiz.document_id == doc.id).count()
    questions = generate_quiz(document_pages(doc), data.num_questions, seed=doc.id * 1000 + previous)
    if not questions:
        raise HTTPException(400, "This document doesn't have enough content to build a quiz.")
    quiz = Quiz(user_id=user.id, document_id=doc.id, questions=json.dumps(questions))
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return {"id": quiz.id, "document_id": doc.id, "document_title": doc.title,
            "questions": public_questions(questions)}


@router.post("/{quiz_id}/submit")
def submit_quiz(quiz_id: int, data: SubmitIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.get(Quiz, quiz_id)
    if not quiz or quiz.user_id != user.id:
        raise HTTPException(404, "Quiz not found.")
    questions = json.loads(quiz.questions)
    review, score = [], 0
    for q in questions:
        chosen = data.answers.get(str(q["id"]))
        correct = chosen == q["answer"]
        score += int(correct)
        review.append({**q, "chosen": chosen, "correct": correct})
    attempt = QuizAttempt(quiz_id=quiz.id, user_id=user.id, answers=json.dumps(data.answers),
                          score=score, total=len(questions))
    db.add(attempt)
    db.commit()
    return {"score": score, "total": len(questions), "percent": round(score * 100 / len(questions)),
            "review": review}


@router.get("/attempts")
def attempts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (db.query(QuizAttempt, Quiz, Document).join(Quiz, QuizAttempt.quiz_id == Quiz.id)
            .join(Document, Quiz.document_id == Document.id).filter(QuizAttempt.user_id == user.id)
            .order_by(QuizAttempt.created_at.desc()).limit(20).all())
    return [{"id": a.id, "quiz_id": q.id, "document_title": d.title, "score": a.score, "total": a.total,
             "percent": round(a.score * 100 / a.total) if a.total else 0, "created_at": a.created_at.isoformat()}
            for a, q, d in rows]
