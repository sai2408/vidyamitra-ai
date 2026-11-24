from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import effective_plan, require_admin, user_out
from ..database import get_db
from ..models import Document, Payment, QuestionLog, QuizAttempt, User

router = APIRouter(prefix="/api/admin", tags=["admin"])


class UserPatch(BaseModel):
    is_active: bool


def _per_day(rows: list[datetime], days: int = 7) -> list[dict]:
    today = datetime.utcnow().date()
    labels = [today - timedelta(days=i) for i in range(days - 1, -1, -1)]
    counts = {d: 0 for d in labels}
    for ts in rows:
        if ts.date() in counts:
            counts[ts.date()] += 1
    return [{"day": d.strftime("%d %b"), "count": counts[d]} for d in labels]


@router.get("/stats")
def stats(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=7)
    users = db.query(User).all()
    pro = sum(1 for u in users if effective_plan(u) == "pro")
    revenue = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.status == "paid").scalar() / 100
    q_times = [r[0] for r in db.query(QuestionLog.created_at).filter(QuestionLog.created_at >= since).all()]
    u_times = [r[0] for r in db.query(User.created_at).filter(User.created_at >= since).all()]
    answered = db.query(QuestionLog).filter(QuestionLog.found.is_(True)).count()
    total_q = db.query(QuestionLog).count()
    return {
        "totals": {"users": len(users), "pro_users": pro, "documents": db.query(Document).count(),
                   "questions": total_q, "quiz_attempts": db.query(QuizAttempt).count(), "revenue_inr": revenue,
                   "answer_rate": round(answered * 100 / total_q) if total_q else 0},
        "questions_per_day": _per_day(q_times),
        "signups_per_day": _per_day(u_times),
        "plan_split": [{"name": "Free", "value": len(users) - pro}, {"name": "Pro", "value": pro}],
    }


@router.get("/users")
def users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(User).order_by(User.created_at.desc()).all()
    doc_counts = dict(db.query(Document.user_id, func.count(Document.id)).group_by(Document.user_id).all())
    q_counts = dict(db.query(QuestionLog.user_id, func.count(QuestionLog.id)).group_by(QuestionLog.user_id).all())
    return [{**user_out(u), "documents": doc_counts.get(u.id, 0), "questions": q_counts.get(u.id, 0)} for u in rows]


@router.patch("/users/{user_id}")
def update_user(user_id: int, data: UserPatch, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found.")
    if user.id == admin.id:
        raise HTTPException(400, "You cannot deactivate your own account.")
    user.is_active = data.is_active
    db.commit()
    return user_out(user)


@router.get("/payments")
def payments(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(Payment, User).join(User).order_by(Payment.created_at.desc()).limit(100).all()
    return [{"id": p.id, "user": u.name, "email": u.email, "order_id": p.order_id, "payment_id": p.payment_id,
             "amount": p.amount / 100, "status": p.status, "mode": p.mode, "created_at": p.created_at.isoformat()}
            for p, u in rows]
