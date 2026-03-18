from typing import Optional

from pydantic import BaseModel


class AISettingsUpdate(BaseModel):
    ai_provider: str = "auto"
    # None = leave unchanged; empty string = clear
    anthropic_api_key: Optional[str] = None
    claude_model: str = "claude-3-5-haiku-20241022"
    local_ai_url: Optional[str] = None
    local_ai_model: Optional[str] = None
    giphy_api_key: Optional[str] = None
    admin_wa_chat_id: Optional[str] = None
    admin_wa_chat_name: Optional[str] = None
    admin_notifications_enabled: Optional[bool] = None


class AISettingsOut(BaseModel):
    ai_provider: str
    anthropic_api_key_masked: Optional[str]
    claude_model: str
    local_ai_url: str
    local_ai_model: str
    giphy_api_key_masked: Optional[str]
    admin_wa_chat_id: Optional[str]
    admin_wa_chat_name: Optional[str]
    admin_notifications_enabled: bool


class AIStatusOut(BaseModel):
    provider_setting: str
    local_available: bool
    local_model: Optional[str]
    local_url: str
    claude_configured: bool
    active_provider: str
    claude_model: str


class WAWebhookPayload(BaseModel):
    chat_id: str
    body: str
    message_id: str
