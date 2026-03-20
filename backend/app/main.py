from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, broadcasts, calendar_import, contacts, dashboard, detected_occasions, drafts, giphy, occasions, whatsapp_targets
from app.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Wishing Bot API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(contacts.router)
app.include_router(occasions.router)
app.include_router(whatsapp_targets.router)
app.include_router(drafts.router)
app.include_router(dashboard.router)
app.include_router(calendar_import.router)
app.include_router(broadcasts.router)
app.include_router(admin.router)
app.include_router(giphy.router)
app.include_router(detected_occasions.router)


@app.get("/health")
def health():
    return {"status": "ok"}
