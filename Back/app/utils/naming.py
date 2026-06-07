from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(word[:1].upper() + word[1:] for word in parts[1:])


def snake_to_camel(value: str) -> str:
    return to_camel(value)


def camelize(obj: Any) -> Any:
    if isinstance(obj, list):
        return [camelize(item) for item in obj]

    if isinstance(obj, dict):
        return {snake_to_camel(str(key)): camelize(value) for key, value in obj.items()}

    if isinstance(obj, Decimal):
        # Evita problemas de JSON. Si es entero, sale como int; si no, float.
        if obj == obj.to_integral_value():
            return int(obj)
        return float(obj)

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()

    return obj
