from datetime import datetime, timedelta
from typing import Dict, Optional

from app.models.schemas import DeviceStatus

ONLINE_WINDOW = timedelta(seconds=10)

_registry: Dict[str, DeviceStatus] = {}


def update_device(device_id: str, last_seen: datetime, payload: Optional[dict] = None) -> DeviceStatus:
    status = DeviceStatus(device_id=device_id, last_seen=last_seen, payload=payload or {})
    _registry[device_id] = status
    return status


def get_device(device_id: str) -> Optional[DeviceStatus]:
    return _registry.get(device_id)


def is_online(device: DeviceStatus, now: Optional[datetime] = None) -> bool:
    now = now or datetime.utcnow()
    return (now - device.last_seen) <= ONLINE_WINDOW
