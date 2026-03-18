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
