from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import MessageDraft, WhatsAppTarget
from app.schemas.message_draft import (
    DraftApproveRequest,
    DraftHistoryItem,
    DraftScheduleRequest,
    DraftSendRequest,
    MessageDraftOut,
    RegenerateRequest,
)
from app.services.claude_service import generate_message
from app.services.whatsapp_service import send_whatsapp_gif, send_whatsapp_message

router = APIRouter(prefix="/api/drafts", tags=["drafts"])


@router.get("", response_model=list[MessageDraftOut])
def list_drafts(status: str = "", db: Session = Depends(get_db)):
    q = db.query(MessageDraft)
    if status:
        q = q.filter(MessageDraft.status == status)
    return q.order_by(MessageDraft.occasion_date.desc(), MessageDraft.created_at.desc()).all()


# ⚠️ MUST come before /{draft_id} to avoid FastAPI matching "history" as int
@router.get("/history", response_model=list[DraftHistoryItem])
def get_history(db: Session = Depends(get_db)):
    drafts = (
        db.query(MessageDraft)
        .options(joinedload(MessageDraft.contact), joinedload(MessageDraft.occasion))
        .filter(MessageDraft.status == "sent")
        .order_by(MessageDraft.sent_at.desc())
        .all()
    )
    return drafts


@router.get("/{draft_id}", response_model=MessageDraftOut)
def get_draft(draft_id: int, db: Session = Depends(get_db)):
    draft = db.query(MessageDraft).filter(MessageDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft


@router.patch("/{draft_id}/approve", response_model=MessageDraftOut)
async def approve_draft(draft_id: int, body: DraftApproveRequest, db: Session = Depends(get_db)):
    draft = db.query(MessageDraft).filter(MessageDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status == "sent":
        raise HTTPException(status_code=400, detail="Cannot modify a sent draft")
    draft.edited_text = body.edited_text
    draft.status = "approved"
    db.commit()
    db.refresh(draft)

    # Auto-send if contact has auto_send enabled and a linked WhatsApp chat
    contact = draft.contact
    if contact and contact.auto_send and contact.whatsapp_chat_id:
        final_text = draft.edited_text or draft.generated_text
        await send_whatsapp_message(contact.whatsapp_chat_id, final_text)
        draft.final_text = final_text
        draft.status = "sent"
        draft.sent_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(draft)

    return draft


@router.patch("/{draft_id}/skip", response_model=MessageDraftOut)
def skip_draft(draft_id: int, db: Session = Depends(get_db)):
    draft = db.query(MessageDraft).filter(MessageDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status == "sent":
        raise HTTPException(status_code=400, detail="Cannot modify a sent draft")
    draft.status = "skipped"
    db.commit()
    db.refresh(draft)
    return draft


@router.patch("/{draft_id}/schedule", response_model=MessageDraftOut)
def schedule_draft(draft_id: int, body: DraftScheduleRequest, db: Session = Depends(get_db)):
    draft = db.query(MessageDraft).filter(MessageDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status == "sent":
        raise HTTPException(status_code=400, detail="Cannot modify a sent draft")
    draft.scheduled_for = body.scheduled_for
    draft.status = "scheduled"
    db.commit()
    db.refresh(draft)
    return draft


@router.post("/{draft_id}/regenerate", response_model=MessageDraftOut)
async def regenerate_draft(
    draft_id: int,
    body: RegenerateRequest | None = Body(default=None),
    db: Session = Depends(get_db),
):
    draft = db.query(MessageDraft).filter(MessageDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    feedback = body.feedback if body else None
    new_text, prompt = await generate_message(
        draft.contact, draft.occasion, draft.occasion_date, db=db, extra_context=feedback
    )
    draft.generated_text = new_text
    draft.edited_text = None
    draft.generation_prompt = prompt
    draft.status = "pending"
    db.commit()
    db.refresh(draft)
    return draft


@router.post("/{draft_id}/send", response_model=MessageDraftOut)
async def send_draft(draft_id: int, body: DraftSendRequest, db: Session = Depends(get_db)):
    draft = db.query(MessageDraft).filter(MessageDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status == "sent":
        raise HTTPException(status_code=400, detail="Already sent")
    if draft.status not in ("approved", "pending", "scheduled"):
        raise HTTPException(status_code=400, detail="Draft must be approved before sending")

    if body.target_id is not None:
        target = db.query(WhatsAppTarget).filter(WhatsAppTarget.id == body.target_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="Target not found")
        chat_id = target.chat_id
        target_id = target.id
    else:
        contact = draft.contact
        if not contact or not contact.whatsapp_chat_id:
            raise HTTPException(
                status_code=400,
                detail="No WhatsApp target specified and contact has no linked WhatsApp chat",
            )
        chat_id = contact.whatsapp_chat_id
        target_id = None

    final_text = draft.edited_text or draft.generated_text

    if body.gif_url:
        await send_whatsapp_gif(chat_id, body.gif_url, final_text)
        draft.gif_url = body.gif_url
    else:
        await send_whatsapp_message(chat_id, final_text)

    draft.whatsapp_target_id = target_id
    draft.final_text = final_text
    draft.status = "sent"
    draft.sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(draft)
    return draft
