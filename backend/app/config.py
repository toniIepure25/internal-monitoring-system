from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://monitor:monitor_secret_change_me@localhost:5432/monitor_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth
    SECRET_KEY: str = "change-me-to-a-random-64-char-string"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.strip("[]").replace('"', "").split(",")]
        return v

    # Logging
    LOG_LEVEL: str = "INFO"

    # VM / Container access
    VM_EXEC_PREFIX: str = "multipass exec ubuntu-vm --"

    # Monitoring
    MONITORING_ENABLED: bool = True
    DEFAULT_CHECK_INTERVAL_SECONDS: int = 60
    DEFAULT_TIMEOUT_SECONDS: int = 10
    HEALTH_DISCOVERY_TIMEOUT_SECONDS: int = 3

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "monitor@company.internal"
    SMTP_TLS: bool = True

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""

    # VAPID / Browser Push
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_CLAIMS_EMAIL: str = "admin@company.internal"

    @field_validator("VAPID_PRIVATE_KEY", mode="before")
    @classmethod
    def normalize_vapid_private_key(cls, v):
        if isinstance(v, str):
            return v.replace("\\n", "\n").strip()
        return v

    class Config:
        env_file = "../.env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
