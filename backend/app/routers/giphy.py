import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.admin_setting import AdminSetting

router = APIRouter(prefix="/api/giphy", tags=["giphy"])


def _get_setting(db: Session, key: str) -> str | None:
    row = db.query(AdminSetting).filter(AdminSetting.key == key).first()
    return row.value if row else None


@router.get("/search")
async def giphy_search(q: str, db: Session = Depends(get_db), limit: int = 20):
    api_key = _get_setting(db, "giphy_api_key")
    if not api_key:
        return JSONResponse(
            status_code=503,
            content={"detail": "Giphy API key not configured — set it in Settings"},
        )
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://api.giphy.com/v1/gifs/search",
            params={"api_key": api_key, "q": q, "limit": limit, "rating": "g"},
        )
        resp.raise_for_status()
        return resp.json()
