from typing import Dict, List, Optional

import httpx

from app.core.config import get_settings
from app.models.schemas import FirebasePlant

MAX_VALID_HEIGHT_MM = 190.0


def _get_db_url() -> Optional[str]:
    settings = get_settings()
    return settings.firebase_db_url.rstrip("/") if settings.firebase_db_url else None


def _client():
    return httpx.AsyncClient(timeout=10)


def _to_number(value) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    return num


async def list_plants() -> List[FirebasePlant]:
    db_url = _get_db_url()
    if not db_url:
        return []
    async with _client() as client:
        resp = await client.get(f"{db_url}/plants.json")
        resp.raise_for_status()
        raw = resp.json() or {}
    plants: List[FirebasePlant] = []
    invalid_ids: List[str] = []
    for key, data in raw.items():
        base = data or {}
        height_mm = _to_number(base.get("height_mm") or base.get("height") or base.get("current_height"))
        if height_mm is not None and height_mm > MAX_VALID_HEIGHT_MM:
            invalid_ids.append(key)
            continue
        plants.append(
            FirebasePlant(
                id=key,
                planting_date=base.get("planting_date") or base.get("plantingDate"),
                height_mm=height_mm,
                updated_at=base.get("updated_at") or base.get("timestamp") or base.get("recorded_at"),
                cultivar=base.get("cultivar") or base.get("variety"),
                extra={k: v for k, v in base.items() if k not in {"planting_date", "plantingDate", "height_mm", "height", "current_height", "updated_at", "timestamp", "recorded_at", "cultivar", "variety"}},
            )
        )
    if invalid_ids:
        async with _client() as client:
            for plant_id in invalid_ids:
                await client.delete(f"{db_url}/plants/{plant_id}.json")
    return plants


async def write_plant(data: Dict[str, object]) -> FirebasePlant:
    db_url = _get_db_url()
    if not db_url:
        raise ValueError("FIREBASE_DB_URL not configured")
    plant_id = data["id"]
    height_mm = _to_number(data.get("height_mm"))
    if height_mm is not None and height_mm > MAX_VALID_HEIGHT_MM:
        raise ValueError(f"height_mm must be at most {int(MAX_VALID_HEIGHT_MM)}")
    payload = {
        "planting_date": data.get("planting_date"),
        "height_mm": height_mm,
        "cultivar": data.get("cultivar"),
        "updated_at": data.get("updated_at"),
    }
    async with _client() as client:
        resp = await client.put(f"{db_url}/plants/{plant_id}.json", json=payload)
        resp.raise_for_status()
    return FirebasePlant(id=plant_id, **payload)


async def delete_plant(plant_id: str):
    db_url = _get_db_url()
    if not db_url:
        raise ValueError("FIREBASE_DB_URL not configured")
    async with _client() as client:
        resp = await client.delete(f"{db_url}/plants/{plant_id}.json")
        resp.raise_for_status()
