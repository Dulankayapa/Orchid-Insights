from datetime import datetime
from typing import Tuple, Union

from app.models.schemas import DeviceStatus, OfflineResponse
from app.services import device_registry


def require_online(device_id: str) -> Tuple[bool, Union[DeviceStatus, OfflineResponse]]:
    device = device_registry.get_device(device_id)
    if not device or not device_registry.is_online(device, datetime.utcnow()):
        return False, OfflineResponse(status="offline", message="Device disconnected")
    return True, device
