import httpx
from fastapi import HTTPException
from urllib.parse import quote

from app.config import settings


def _503(detail: str = "WhatsApp not connected — scan QR code first"):
    raise HTTPException(status_code=503, detail=detail)


async def send_whatsapp_message(chat_id: str, message: str, profile_id: int | None = None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.wa_bridge_url}/send",
                json={"profile_id": profile_id, "chat_id": chat_id, "message": message},
            )
            if resp.status_code == 503:
                _503()
            resp.raise_for_status()
            return resp.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {e}") from e


async def get_wa_contacts(profile_id: int) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{settings.wa_bridge_url}/wa-contacts",
                params={"profileId": profile_id},
            )
            if resp.status_code == 503:
                _503()
            resp.raise_for_status()
            return resp.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {e}") from e


async def get_wa_chats(profile_id: int) -> list[dict]:
    """Fetch list of all WhatsApp chats from the bridge for this profile."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{settings.wa_bridge_url}/chats",
                params={"profileId": profile_id},
            )
            if resp.status_code == 503:
                _503()
            resp.raise_for_status()
            return resp.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {e}") from e


async def get_chat_messages(chat_id: str, limit: int = 200, profile_id: int | None = None) -> tuple[str | None, list[dict]]:
    """Fetch historical text messages from a chat via the bridge."""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            params = {"limit": limit}
            if profile_id is not None:
                params["profileId"] = profile_id
            resp = await client.get(
                f"{settings.wa_bridge_url}/messages/{quote(chat_id, safe='')}",
                params=params,
            )
            if resp.status_code == 503:
                _503()
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Chat {chat_id} not found")
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return None, data
            return data.get("chat_name"), data.get("messages", [])
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {e}") from e


async def get_group_members(group_id: str, profile_id: int | None = None) -> dict:
    """Fetch group participants from the bridge."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            params = {}
            if profile_id is not None:
                params["profileId"] = profile_id
            resp = await client.get(
                f"{settings.wa_bridge_url}/group-members/{quote(group_id, safe='')}",
                params=params,
            )
            if resp.status_code == 503:
                _503()
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Group {group_id} not found")
            if resp.status_code == 400:
                raise HTTPException(status_code=400, detail=resp.json().get("error", "Not a group"))
            resp.raise_for_status()
            return resp.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {e}") from e


async def send_whatsapp_gif(chat_id: str, gif_url: str, caption: str = "", profile_id: int | None = None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.wa_bridge_url}/send-gif",
                json={"profile_id": profile_id, "chat_id": chat_id, "gif_url": gif_url, "caption": caption},
            )
            if resp.status_code == 503:
                _503()
            resp.raise_for_status()
            return resp.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {e}") from e


async def get_bridge_status(profile_id: int) -> dict:
    """Get per-profile WhatsApp connection status."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.wa_bridge_url}/status",
                params={"profileId": profile_id},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError:
        return {"ready": False, "qr_image": None, "state": "error"}


async def init_bridge_session(profile_id: int) -> dict:
    """Tell the bridge to (re-)initialize the WhatsApp session for this profile."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{settings.wa_bridge_url}/sessions/{profile_id}/init")
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {e}") from e



async def restart_bridge_session(profile_id: int) -> dict:
    """Force-destroy and reinitialize the WhatsApp session (use when stuck in 'starting')."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.wa_bridge_url}/sessions/{profile_id}/init",
                params={"force": "true"},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WhatsApp bridge error: {e}") from e


async def restart_bridge() -> dict:
    """Tell the bridge process to exit so Docker restarts it."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(f"{settings.wa_bridge_url}/admin/restart")
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError:
        # Bridge may close the connection before sending a response — that's expected
        return {"ok": True, "message": "Bridge restarting..."}
