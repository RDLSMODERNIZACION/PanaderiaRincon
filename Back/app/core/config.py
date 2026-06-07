from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Panaderia API"
    app_env: str = "development"
    app_version: str = "0.1.0"
    log_level: str = "INFO"
    enable_docs: str = "1"

    cors_origins: str = "*"

    database_url: str = ""
    db_pool_min: int = 1
    db_pool_max: int = 8
    db_pool_timeout: int = 30
    db_connect_timeout: int = 8

    api_key: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def docs_enabled(self) -> bool:
        return self.enable_docs == "1"

    @property
    def cors_origin_list(self) -> List[str]:
        raw = (self.cors_origins or "*").strip()
        if raw == "*":
            return ["*"]
        return [item.strip() for item in raw.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
