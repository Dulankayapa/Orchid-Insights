import hashlib
import uuid
from collections import defaultdict
from datetime import datetime
from typing import DefaultDict, List, Optional

from app.models.schemas import ReminderItem

_reminders: DefaultDict[str, List[ReminderItem]] = defaultdict(list)


def _user_key(authorization: Optional[str]) -> str:
    if not authorization:
        return "anonymous"

    return hashlib.sha256(authorization.encode("utf-8")).hexdigest()


def list_reminders(authorization: Optional[str]) -> List[ReminderItem]:
    key = _user_key(authorization)
    return sorted(_reminders[key], key=lambda item: item.reminder_time)


def create_reminder(title: str, reminder_type: str, reminder_time: str, authorization: Optional[str]) -> ReminderItem:
    key = _user_key(authorization)
    reminder = ReminderItem(
        id=str(uuid.uuid4()),
        title=title.strip(),
        type=reminder_type.strip() or "watering",
        reminder_time=datetime.fromisoformat(reminder_time.replace("Z", "+00:00")),
    )
    _reminders[key] = sorted([reminder, *_reminders[key]], key=lambda item: item.reminder_time)
    return reminder


def delete_reminder(reminder_id: str, authorization: Optional[str]) -> bool:
    key = _user_key(authorization)
    current = _reminders[key]
    next_items = [item for item in current if item.id != reminder_id]
    deleted = len(next_items) != len(current)
    _reminders[key] = next_items
    return deleted
