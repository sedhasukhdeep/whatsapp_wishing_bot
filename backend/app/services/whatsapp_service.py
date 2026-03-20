import httpx
from fastapi import HTTPException

from app.config import settings


async def send_whatsapp_message(chat_id: str, message: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.wa_bridge_url}/send",
                json={"chat_id": chat_id, "message": message},
            )
            if resp.status_code == 503:
                raise HTTPException(status_code=503, detail="WhatsApp not connected — scan QR code first")
            resp.raise_for_status()
            return resp.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {e}") from e


async def get_wa_contacts() -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{settings.wa_bridge_url}/wa-contacts")
            if resp.status_code == 503:
                raise HTTPException(status_code=503, detail="WhatsApp not connected — scan QR code first")
            resp.raise_for_status()
            return resp.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {e}") from e


async def get_wa_chats() -> list[dict]:
    """Fetch list of all WhatsApp chats from the bridge."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{settings.wa_bridge_url}/chats")
            if resp.status_code == 503:
                raise HTTPException(status_code=503, detail="WhatsApp not connected — scan QR code first")
            resp.raise_for_status()
            return resp.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {e}") from e


async def get_chat_messages(chat_id: str, limit: int = 200) -> tuple[str | None, list[dict]]:
    """
    Fetch historical text messages from a chat via the bridge.
    Returns (chat_name, messages) tuple.
    """
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(
                f"{settings.wa_bridge_url}/messages/{chat_id}",
                params={"limit": limit},
            )
            if resp.status_code == 503:
                raise HTTPException(status_code=503, detail="WhatsApp not connected — scan QR code first")
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Chat {chat_id} not found")
            resp.raise_for_status()
            data = resp.json()
            # Support both new {chat_name, messages} format and legacy array format
            if isinstance(data, list):
                return None, data
            return data.get("chat_name"), data.get("messages", [])
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {e}") from e


async def send_whatsapp_gif(chat_id: str, gif_url: str, caption: str = "") -> dict:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.wa_bridge_url}/send-gif",
                json={"chat_id": chat_id, "gif_url": gif_url, "caption": caption},
            )
            if resp.status_code == 503:
                raise HTTPException(status_code=503, detail="WhatsApp not connected — scan QR code first")
            resp.raise_for_status()
            return resp.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {e}") from e
