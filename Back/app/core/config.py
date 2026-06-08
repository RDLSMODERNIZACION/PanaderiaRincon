from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Panaderia API"
    app_env: str = "development"
    app_version: str = "0.2.0"
    log_level: str = "INFO"
    enable_docs: str = "1"

    cors_origins: str = "*"

    database_url: str = ""
    db_pool_min: int = 1
    db_pool_max: int = 8
    db_pool_timeout: int = 30
    db_connect_timeout: int = 8

    # Seguridad simple para Render/frontend.
    # API_KEY funciona como llave maestra para admin.
    # AUTH_REQUIRED=0 permite trabajar libremente durante desarrollo.
    # AUTH_REQUIRED=1 obliga a mandar X-API-Key o X-User-Id con permisos.
    api_key: str = ""
    auth_required: str = "0"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def docs_enabled(self) -> bool:
        return self.enable_docs == "1"

    @property
    def auth_enabled(self) -> bool:
        return self.auth_required == "1"

    @property
    def cors_origin_list(self) -> List[str]:
        raw = (self.cors_origins or "*").strip()
        if raw == "*":
            return ["*"]
        return [item.strip() for item in raw.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
