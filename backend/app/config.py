from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    anthropic_api_key: str = ""
    db_url: str = "sqlite:///./wishing_bot.db"
    wa_bridge_url: str = "http://localhost:3001"
    scheduler_timezone: str = "Australia/Sydney"
    scheduler_hour: int = 8
    scheduler_minute: int = 0

    # Allowed frontend origin for CORS (set to your frontend URL in production/Docker)
    frontend_origin: str = "http://localhost:5173"

    # AI provider: "auto" | "claude" | "openai" | "gemini" | "local"
    # "auto" tries local first then falls back to Claude
    ai_provider: str = "auto"
    local_ai_url: str = "http://localhost:1234/v1"   # LM Studio default
    local_ai_model: str = ""                          # empty = auto-detect first model
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"


settings = Settings()
