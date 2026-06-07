from fastapi import Header, HTTPException, status

from app.core.config import get_settings


settings = get_settings()


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """
    Protección simple para endpoints privados futuros.
    Si API_KEY está vacío, no bloquea nada. Cuando quieras cerrar el backend,
    poné API_KEY en el .env y mandá el header X-API-Key desde el frontend.
    """
    if not settings.api_key:
        return

    if x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key inválida o ausente.",
        )
