from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import effective_plan, get_current_user
from ..config import FREE_DAILY_QUESTIONS, FREE_DOC_LIMIT
from ..database import get_db
from ..models import Document, QuestionLog, QuizAttempt, User
from .ask import log_out, questions_today
from .quizzes import attempts

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = effective_plan(user)
    docs = db.query(Document).filter(Document.user_id == user.id).count()
    q_total = db.query(QuestionLog).filter(QuestionLog.user_id == user.id).count()
    q_today = questions_today(db, user)
    att = db.query(func.count(QuizAttempt.id), func.sum(QuizAttempt.score), func.sum(QuizAttempt.total)) \
        .filter(QuizAttempt.user_id == user.id).one()
    avg = round(att[1] * 100 / att[2]) if att[2] else None
    recent_q = (db.query(QuestionLog).filter(QuestionLog.user_id == user.id)
                .order_by(QuestionLog.created_at.desc()).limit(5).all())
    return {
        "stats": {"documents": docs, "questions_total": q_total, "questions_today": q_today,
                  "quizzes_taken": att[0], "average_score": avg},
        "plan": {"name": plan, "doc_limit": None if plan == "pro" else FREE_DOC_LIMIT,
                 "daily_question_limit": None if plan == "pro" else FREE_DAILY_QUESTIONS},
        "recent_questions": [log_out(q) for q in recent_q],
        "recent_attempts": attempts(user, db)[:5],
    }
