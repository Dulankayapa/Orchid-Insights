from typing import Dict, List, Optional

import httpx

from app.core.config import get_settings
from app.models.schemas import FirebasePlant


def _get_db_url() -> Optional[str]:
    settings = get_settings()
    return settings.firebase_db_url.rstrip("/") if settings.firebase_db_url else None


def _client():
    return httpx.AsyncClient(timeout=10)


async def list_plants() -> List[FirebasePlant]:
    db_url = _get_db_url()
    if not db_url:
        return []
    async with _client() as client:
        resp = await client.get(f"{db_url}/plants.json")
        resp.raise_for_status()
        raw = resp.json() or {}
    plants: List[FirebasePlant] = []
    for key, data in raw.items():
        base = data or {}
        plants.append(
            FirebasePlant(
                id=key,
                planting_date=base.get("planting_date") or base.get("plantingDate"),
                height_mm=base.get("height_mm") or base.get("height") or base.get("current_height"),
                updated_at=base.get("updated_at") or base.get("timestamp") or base.get("recorded_at"),
                cultivar=base.get("cultivar") or base.get("variety"),
                extra={k: v for k, v in base.items() if k not in {"planting_date", "plantingDate", "height_mm", "height", "current_height", "updated_at", "timestamp", "recorded_at", "cultivar", "variety"}},
            )
        )
    return plants


async def write_plant(data: Dict[str, object]) -> FirebasePlant:
    db_url = _get_db_url()
    if not db_url:
        raise ValueError("FIREBASE_DB_URL not configured")
    plant_id = data["id"]
    payload = {
        "planting_date": data.get("planting_date"),
        "height_mm": data.get("height_mm"),
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
