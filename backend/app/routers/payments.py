"""Pro plan upgrade. Uses Razorpay (test or live keys) when configured, otherwise a clearly labelled demo mode."""
import base64
import hashlib
import hmac
import json
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import effective_plan, get_current_user, user_out
from ..config import PRO_DAYS, PRO_PRICE_INR, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
from ..database import get_db
from ..models import Payment, User

router = APIRouter(prefix="/api/payments", tags=["payments"])


def razorpay_enabled() -> bool:
    return bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)


class VerifyIn(BaseModel):
    order_id: str
    payment_id: str = ""
    signature: str = ""


@router.get("/config")
def config():
    return {"mode": "razorpay" if razorpay_enabled() else "demo", "key_id": RAZORPAY_KEY_ID or None,
            "amount": PRO_PRICE_INR * 100, "currency": "INR", "price_inr": PRO_PRICE_INR, "days": PRO_DAYS}


@router.post("/create-order")
def create_order(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    amount = PRO_PRICE_INR * 100
    if razorpay_enabled():
        body = json.dumps({"amount": amount, "currency": "INR", "receipt": f"vm_{user.id}_{uuid.uuid4().hex[:8]}"}).encode()
        auth = base64.b64encode(f"{RAZORPAY_KEY_ID}:{RAZORPAY_KEY_SECRET}".encode()).decode()
        req = urllib.request.Request("https://api.razorpay.com/v1/orders", data=body,
                                     headers={"Content-Type": "application/json", "Authorization": f"Basic {auth}"})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                order_id = json.loads(resp.read().decode())["id"]
        except (urllib.error.URLError, KeyError, ValueError):
            raise HTTPException(502, "Could not reach Razorpay. Check your keys and internet connection.")
        mode = "razorpay"
    else:
        order_id, mode = f"demo_order_{uuid.uuid4().hex[:14]}", "demo"
    db.add(Payment(user_id=user.id, order_id=order_id, amount=amount, mode=mode))
    db.commit()
    return {"order_id": order_id, "amount": amount, "currency": "INR", "mode": mode, "key_id": RAZORPAY_KEY_ID or None,
            "name": user.name, "email": user.email}


@router.post("/verify")
def verify(data: VerifyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.order_id == data.order_id, Payment.user_id == user.id).first()
    if not payment:
        raise HTTPException(404, "Order not found.")
    if payment.status == "paid":
        return {"status": "paid", "user": user_out(user)}
    if payment.mode == "razorpay":
        expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), f"{data.order_id}|{data.payment_id}".encode(),
                            hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, data.signature):
            payment.status = "failed"
            db.commit()
            raise HTTPException(400, "Payment verification failed.")
        payment.payment_id = data.payment_id
    else:
        payment.payment_id = f"demo_pay_{uuid.uuid4().hex[:14]}"
    payment.status = "paid"
    start = user.plan_expires_at if effective_plan(user) == "pro" else datetime.utcnow()
    user.plan, user.plan_expires_at = "pro", start + timedelta(days=PRO_DAYS)
    db.commit()
    db.refresh(user)
    return {"status": "paid", "payment_id": payment.payment_id, "user": user_out(user)}


@router.get("/history")
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Payment).filter(Payment.user_id == user.id).order_by(Payment.created_at.desc()).all()
    return [{"id": p.id, "order_id": p.order_id, "payment_id": p.payment_id, "amount": p.amount / 100,
             "status": p.status, "mode": p.mode, "created_at": p.created_at.isoformat()} for p in rows]
