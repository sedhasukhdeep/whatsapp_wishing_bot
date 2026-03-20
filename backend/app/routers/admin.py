import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings as env_settings
from app.database import get_db
from app.models.admin_setting import AdminSetting
from app.schemas.admin import AISettingsOut, AISettingsUpdate, AIStatusOut, WAWebhookPayload
from app.services.claude_service import get_ai_status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _get_setting(db: Session, key: str) -> str | None:
    row = db.query(AdminSetting).filter(AdminSetting.key == key).first()
    return row.value if row else None


def _upsert(db: Session, key: str, value: str | None) -> None:
    row = db.query(AdminSetting).filter(AdminSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AdminSetting(key=key, value=value))


def _mask_key(key: str | None) -> str | None:
    if not key:
        return None
    if len(key) <= 8:
        return "****"
    return f"****...{key[-4:]}"


def _build_settings_out(db: Session) -> AISettingsOut:
    ai_provider = _get_setting(db, "ai_provider") or env_settings.ai_provider
    api_key = _get_setting(db, "anthropic_api_key") or env_settings.anthropic_api_key or None
    claude_model = _get_setting(db, "claude_model") or "claude-3-5-haiku-20241022"
    openai_api_key = _get_setting(db, "openai_api_key") or env_settings.openai_api_key or None
    openai_model = _get_setting(db, "openai_model") or env_settings.openai_model
    gemini_api_key = _get_setting(db, "gemini_api_key") or env_settings.gemini_api_key or None
    gemini_model = _get_setting(db, "gemini_model") or env_settings.gemini_model
    local_ai_url = _get_setting(db, "local_ai_url") or env_settings.local_ai_url
    local_ai_model = _get_setting(db, "local_ai_model") or env_settings.local_ai_model or ""
    giphy_api_key = _get_setting(db, "giphy_api_key")
    admin_wa_chat_id = _get_setting(db, "admin_wa_chat_id")
    admin_wa_chat_name = _get_setting(db, "admin_wa_chat_name")
    admin_notifications_enabled = _get_setting(db, "admin_notifications_enabled") == "true"
    return AISettingsOut(
        ai_provider=ai_provider,
        anthropic_api_key_masked=_mask_key(api_key),
        claude_model=claude_model,
        openai_api_key_masked=_mask_key(openai_api_key),
        openai_model=openai_model,
        gemini_api_key_masked=_mask_key(gemini_api_key),
        gemini_model=gemini_model,
        local_ai_url=local_ai_url,
        local_ai_model=local_ai_model,
        giphy_api_key_masked=_mask_key(giphy_api_key),
        admin_wa_chat_id=admin_wa_chat_id,
        admin_wa_chat_name=admin_wa_chat_name,
        admin_notifications_enabled=admin_notifications_enabled,
    )


@router.get("/settings", response_model=AISettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return _build_settings_out(db)


@router.put("/settings", response_model=AISettingsOut)
def update_settings(body: AISettingsUpdate, db: Session = Depends(get_db)):
    _upsert(db, "ai_provider", body.ai_provider)
    if body.anthropic_api_key is not None:
        _upsert(db, "anthropic_api_key", body.anthropic_api_key)
    _upsert(db, "claude_model", body.claude_model)
    if body.openai_api_key is not None:
        _upsert(db, "openai_api_key", body.openai_api_key)
    if body.openai_model is not None:
        _upsert(db, "openai_model", body.openai_model)
    if body.gemini_api_key is not None:
        _upsert(db, "gemini_api_key", body.gemini_api_key)
    if body.gemini_model is not None:
        _upsert(db, "gemini_model", body.gemini_model)
    if body.local_ai_url is not None:
        _upsert(db, "local_ai_url", body.local_ai_url)
    if body.local_ai_model is not None:
        _upsert(db, "local_ai_model", body.local_ai_model)
    if body.giphy_api_key is not None:
        _upsert(db, "giphy_api_key", body.giphy_api_key)
    if body.admin_wa_chat_id is not None:
        _upsert(db, "admin_wa_chat_id", body.admin_wa_chat_id)
    if body.admin_wa_chat_name is not None:
        _upsert(db, "admin_wa_chat_name", body.admin_wa_chat_name)
    if body.admin_notifications_enabled is not None:
        _upsert(db, "admin_notifications_enabled", "true" if body.admin_notifications_enabled else "false")
    db.commit()
    return _build_settings_out(db)


@router.get("/ai-status", response_model=AIStatusOut)
async def ai_status(db: Session = Depends(get_db)):
    return await get_ai_status(db)


@router.post("/wa-webhook")
async def wa_webhook(body: WAWebhookPayload, db: Session = Depends(get_db)):
    from app.services.admin_wa_service import handle_command, get_setting, parse_command
    from app.services.whatsapp_service import send_whatsapp_message
    from app.services.occasion_detection_service import process_message_for_occasion

    # Run occasion detection on ALL incoming messages (non-blocking, silent fail)
    try:
        await process_message_for_occasion(body.chat_id, body.message_id, body.body, db, timestamp=body.timestamp)
    except Exception:
        logger.exception("Occasion detection failed for message %s", body.message_id)

    admin_chat_id = get_setting(db, "admin_wa_chat_id")
    enabled = get_setting(db, "admin_notifications_enabled") == "true"

    # Ignore messages not from admin or if disabled
    if not admin_chat_id or not enabled or body.chat_id != admin_chat_id:
        return {"ok": True}

    command, args = parse_command(body.body)
    if not command:
        return {"ok": True}

    try:
        reply = await handle_command(command, args, db)
    except Exception:
        logger.exception("Error handling WA command '%s'", command)
        reply = "An error occurred. Please try again."

    try:
        await send_whatsapp_message(admin_chat_id, reply)
    except Exception as e:
        logger.warning("Failed to send reply to admin: %s", e)

    return {"ok": True}
