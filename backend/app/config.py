from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    anthropic_api_key: str = ""
    db_url: str = "sqlite:///./wishing_bot.db"
    wa_bridge_url: str = "http://localhost:3001"
    scheduler_timezone: str = "Asia/Kolkata"
    scheduler_hour: int = 8
    scheduler_minute: int = 0

    # Allowed frontend origin for CORS (set to your frontend URL in production/Docker)
    frontend_origin: str = "http://localhost:5173"

    # AI provider: "auto" tries local first then falls back to Claude
    # "claude" forces Claude, "local" forces local (LM Studio / Ollama)
    ai_provider: str = "auto"
    local_ai_url: str = "http://localhost:1234/v1"   # LM Studio default
    local_ai_model: str = ""                          # empty = auto-detect first model


settings = Settings()
