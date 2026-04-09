from datetime import datetime

from fastapi import APIRouter

from app.models.schemas import DeviceStatusResponse
from app.services import device_registry
from app.services.device_status import require_online

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("/{device_id}/status", response_model=DeviceStatusResponse)
async def device_status(device_id: str):
    ok, status = require_online(device_id)
    if not ok:
        return DeviceStatusResponse(status="offline", last_seen=None)
    return DeviceStatusResponse(status="online", last_seen=status.last_seen)


@router.post("/telemetry")
async def ingest_device(payload: dict):
    """
    HTTP ingestion helper for devices that can't publish via MQTT.
    Body should contain device_id and last_seen (ISO string or epoch ms).
    """
    device_id = payload.get("device_id") or "unknown"
    raw_last_seen = payload.get("last_seen_iso") or payload.get("last_seen") or datetime.utcnow().isoformat()
    if isinstance(raw_last_seen, (int, float)):
        last_seen = datetime.utcnow()
    else:
        last_seen = datetime.fromisoformat(str(raw_last_seen))
    device_registry.update_device(device_id, last_seen, payload)
    return {"status": "ok"}
