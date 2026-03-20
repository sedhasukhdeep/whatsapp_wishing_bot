from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Contact, WhatsAppTarget
from app.models.broadcast import Broadcast
from app.models.broadcast_recipient import BroadcastRecipient
from app.schemas.broadcast import (
    AddRecipientsRequest,
    BroadcastCreate,
    BroadcastOut,
    BroadcastRecipientOut,
    BroadcastWithRecipients,
)
from app.services.claude_service import generate_broadcast_message
from app.services.whatsapp_service import send_whatsapp_message

router = APIRouter(prefix="/api/broadcasts", tags=["broadcasts"])


def _load_broadcast(db: Session, broadcast_id: int) -> Broadcast:
    b = db.query(Broadcast).filter(Broadcast.id == broadcast_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    return b


def _broadcast_with_recipients(b: Broadcast) -> BroadcastWithRecipients:
    return BroadcastWithRecipients(
        id=b.id,
        name=b.name,
        occasion_name=b.occasion_name,
        message_text=b.message_text,
        status=b.status,
        created_at=b.created_at,
        sent_at=b.sent_at,
        recipients=[BroadcastRecipientOut.from_orm_with_names(r) for r in b.recipients],
    )


@router.get("", response_model=list[BroadcastOut])
def list_broadcasts(db: Session = Depends(get_db)):
    return db.query(Broadcast).order_by(Broadcast.created_at.desc()).all()


@router.post("", response_model=BroadcastOut, status_code=201)
def create_broadcast(body: BroadcastCreate, db: Session = Depends(get_db)):
    b = Broadcast(name=body.name, occasion_name=body.occasion_name)
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


@router.get("/{broadcast_id}", response_model=BroadcastWithRecipients)
def get_broadcast(broadcast_id: int, db: Session = Depends(get_db)):
    b = (
        db.query(Broadcast)
        .options(
            joinedload(Broadcast.recipients).joinedload(BroadcastRecipient.contact),
            joinedload(Broadcast.recipients).joinedload(BroadcastRecipient.target),
        )
        .filter(Broadcast.id == broadcast_id)
        .first()
    )
    if not b:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    return _broadcast_with_recipients(b)


@router.delete("/{broadcast_id}", status_code=204)
def delete_broadcast(broadcast_id: int, db: Session = Depends(get_db)):
    b = _load_broadcast(db, broadcast_id)
    db.delete(b)
    db.commit()


@router.post("/{broadcast_id}/generate", response_model=BroadcastOut)
async def generate_message_for_broadcast(broadcast_id: int, db: Session = Depends(get_db)):
    b = _load_broadcast(db, broadcast_id)
    text, _ = await generate_broadcast_message(b.occasion_name, db=db)
    b.message_text = text
    db.commit()
    db.refresh(b)
    return b


@router.post("/{broadcast_id}/recipients", response_model=BroadcastWithRecipients)
def add_recipients(broadcast_id: int, body: AddRecipientsRequest, db: Session = Depends(get_db)):
    b = (
        db.query(Broadcast)
        .options(
            joinedload(Broadcast.recipients).joinedload(BroadcastRecipient.contact),
            joinedload(Broadcast.recipients).joinedload(BroadcastRecipient.target),
        )
        .filter(Broadcast.id == broadcast_id)
        .first()
    )
    if not b:
        raise HTTPException(status_code=404, detail="Broadcast not found")

    for cid in body.contact_ids:
        contact = db.query(Contact).filter(Contact.id == cid).first()
        if contact:
            r = BroadcastRecipient(broadcast_id=broadcast_id, recipient_type="contact", contact_id=cid)
            db.add(r)

    for tid in body.target_ids:
        target = db.query(WhatsAppTarget).filter(WhatsAppTarget.id == tid).first()
        if target:
            r = BroadcastRecipient(broadcast_id=broadcast_id, recipient_type="target", target_id=tid)
            db.add(r)

    db.commit()
    db.expire(b)
    b = (
        db.query(Broadcast)
        .options(
            joinedload(Broadcast.recipients).joinedload(BroadcastRecipient.contact),
            joinedload(Broadcast.recipients).joinedload(BroadcastRecipient.target),
        )
        .filter(Broadcast.id == broadcast_id)
        .first()
    )
    return _broadcast_with_recipients(b)  # type: ignore[arg-type]


@router.delete("/{broadcast_id}/recipients/{recipient_id}", status_code=204)
def remove_recipient(broadcast_id: int, recipient_id: int, db: Session = Depends(get_db)):
    r = db.query(BroadcastRecipient).filter(
        BroadcastRecipient.id == recipient_id,
        BroadcastRecipient.broadcast_id == broadcast_id,
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recipient not found")
    db.delete(r)
    db.commit()


async def _do_send(broadcast_id: int, message_text: str) -> None:
    """Background task: send to all recipients and update status."""
    from app.database import SessionLocal  # local import to avoid circular
    db = SessionLocal()
    try:
        recipients = (
            db.query(BroadcastRecipient)
            .options(
                joinedload(BroadcastRecipient.contact),
                joinedload(BroadcastRecipient.target),
            )
            .filter(BroadcastRecipient.broadcast_id == broadcast_id)
            .all()
        )

        for r in recipients:
            try:
                if r.recipient_type == "contact" and r.contact and r.contact.whatsapp_chat_id:
                    name = (r.contact.name or "").split()[0]  # first name only
                    personalized = message_text.replace("{name}", name)
                    await send_whatsapp_message(r.contact.whatsapp_chat_id, personalized)
                elif r.recipient_type == "target" and r.target:
                    await send_whatsapp_message(r.target.chat_id, message_text)
                else:
                    r.error = "No WhatsApp chat linked"
                    db.commit()
                    continue
                r.sent_at = datetime.now(timezone.utc)
                db.commit()
            except Exception as e:
                r.error = str(e)[:500]
                db.commit()
    finally:
        db.close()


@router.post("/{broadcast_id}/send", status_code=202)
async def send_broadcast(broadcast_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    b = _load_broadcast(db, broadcast_id)
    if not b.message_text:
        raise HTTPException(status_code=400, detail="Message text is required before sending")
    if b.status == "sent":
        raise HTTPException(status_code=400, detail="Broadcast already sent")

    b.status = "sent"
    b.sent_at = datetime.now(timezone.utc)
    db.commit()

    background_tasks.add_task(_do_send, broadcast_id, b.message_text)
    return {"status": "sending"}
